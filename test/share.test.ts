import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Person, Settings } from '../src/model/types.ts';
import {
  buildPayload, decodeShare, encodeShare, mergePeople, parsePayload,
} from '../src/share.ts';

const person = (over: Partial<Person> = {}): Person => ({
  id: 'p1',
  name: 'Thomas',
  color: '#8559D0',
  slots: [{ from: 1788400000, to: 1788440000 }],
  interest: { prg3390: 'must', prg3400: 'want' },
  updatedAt: 1000,
  ...over,
});

const payloadOf = (people: Person[], settings?: Settings) =>
  buildPayload(people, { edition: 2026, exportedBy: 'Thomas', settings });

// ------------------------------------------------------------- round trip

test('a plan survives being encoded and read back', async () => {
  const original = payloadOf([person(), person({ id: 'p2', name: 'Marc', updatedAt: 2000 })]);
  const back = await decodeShare(await encodeShare(original));
  assert.equal(back.people.length, 2);
  assert.deepEqual(back.people[0].interest, { prg3390: 'must', prg3400: 'want' });
  assert.deepEqual(back.people[0].slots, [{ from: 1788400000, to: 1788440000 }]);
  assert.equal(back.people[1].name, 'Marc');
  assert.equal(back.exportedBy, 'Thomas');
  assert.equal(back.edition, 2026);
});

test('the saved file itself can be pasted straight back in', async () => {
  const file = JSON.stringify(payloadOf([person()]), null, 2);
  const back = await decodeShare(file);
  assert.equal(back.people[0].name, 'Thomas');
});

test('a whole pasted link works, not just the code inside it', async () => {
  const code = await encodeShare(payloadOf([person()]));
  const back = await decodeShare(`https://fantofuchs.fuchsnest.ch/#plan=${code}`);
  assert.equal(back.people[0].id, 'p1');
});

test('compression actually earns its place on a realistic wishlist', async () => {
  const marks: Record<string, 'must' | 'want' | 'maybe'> = {};
  for (let i = 0; i < 30; i++) marks[`prg${3400 + i}`] = (['must', 'want', 'maybe'] as const)[i % 3];
  const two = [
    person({ interest: marks }),
    person({ id: 'p2', name: 'Marc', interest: marks }),
  ];
  const encoded = await encodeShare(payloadOf(two));
  const plain = JSON.stringify(payloadOf(two)).length;
  assert.ok(encoded.length < plain / 2, `expected real compression, got ${encoded.length} vs ${plain}`);
  // Must still fit comfortably in a link that a chat app will not mangle.
  assert.ok(encoded.length < 1500, `share code too long for a URL: ${encoded.length}`);
});

// ----------------------------------------------------------------- merge

test('someone new is added', () => {
  const result = mergePeople([person()], [person({ id: 'p2', name: 'Marc' })]);
  assert.deepEqual(result.people.map((p) => p.id), ['p1', 'p2']);
  assert.deepEqual(result.added.map((p) => p.id), ['p2']);
  assert.deepEqual(result.updated, []);
});

test('a newer incoming copy replaces the local one', () => {
  const mine = [person({ updatedAt: 1000 })];
  const theirs = [person({ updatedAt: 5000, interest: { prg9999: 'must' } })];
  const result = mergePeople(mine, theirs);
  assert.deepEqual(result.people[0].interest, { prg9999: 'must' });
  assert.deepEqual(result.updated.map((p) => p.id), ['p1']);
});

test('an older incoming copy never clobbers newer local edits', () => {
  // The round trip that matters: he sends back a stale snapshot of you.
  const mine = [person({ updatedAt: 9000, interest: { prg1111: 'must' } })];
  const theirs = [person({ updatedAt: 1000, interest: { prg3390: 'must' } })];
  const result = mergePeople(mine, theirs);
  assert.deepEqual(result.people[0].interest, { prg1111: 'must' });
  assert.deepEqual(result.kept.map((p) => p.id), ['p1']);
  assert.deepEqual(result.updated, []);
});

test('a tie keeps what is already on this device', () => {
  const mine = [person({ updatedAt: 4000, name: 'Local' })];
  const theirs = [person({ updatedAt: 4000, name: 'Remote' })];
  assert.equal(mergePeople(mine, theirs).people[0].name, 'Local');
});

test('the full two-way round trip ends with both halves intact', () => {
  // 1. Thomas marks his films and sends the plan.
  const thomasV1 = person({ id: 'tom', name: 'Thomas', updatedAt: 100, interest: { prg3390: 'must' } });
  const sent = [thomasV1];

  // 2. Marc loads it next to his own empty profile and fills his half in.
  const marcSide = mergePeople(
    [person({ id: 'marc', name: 'Marc', updatedAt: 50, interest: {} })],
    sent,
  ).people;
  const marcFilled: Person[] = marcSide.map((p) =>
    p.id === 'marc' ? { ...p, updatedAt: 300, interest: { prg3400: 'want' as const } } : p,
  );

  // 3. Meanwhile Thomas keeps marking, so his local copy has moved on.
  const thomasNow: Person[] = [
    { ...thomasV1, updatedAt: 400, interest: { prg3390: 'must', prg3500: 'maybe' } },
  ];

  // 4. Marc sends everything back.
  const final = mergePeople(thomasNow, marcFilled).people;

  assert.deepEqual(final.map((p) => p.id), ['tom', 'marc']);
  assert.deepEqual(final[0].interest, { prg3390: 'must', prg3500: 'maybe' }, "Thomas's newer edits survived");
  assert.deepEqual(final[1].interest, { prg3400: 'want' }, "Marc's half arrived");
});

// ------------------------------------------------------------ validation

test('rejects files that are not ours', () => {
  assert.throws(() => parsePayload({ hello: 'world' }), /not a Fantofuchs file|not made by Fantofuchs/);
  assert.throws(() => parsePayload(null), /not a Fantofuchs file/);
  assert.throws(() => parsePayload({ app: 'fantofuchs', format: 99, people: [] }), /newer version/);
  assert.throws(() => parsePayload({ app: 'fantofuchs', format: 1, people: [] }), /no people/);
});

test('drops junk rather than merging it into your state', () => {
  const parsed = parsePayload({
    app: 'fantofuchs',
    format: 1,
    edition: 2026,
    people: [{
      id: 'p1',
      name: 'x'.repeat(500),
      color: 'javascript:alert(1)',
      slots: [{ from: 5, to: 1 }, { from: 1, to: 2 }, { from: 'a', to: 'b' }],
      interest: { prg3390: 'must', 'not-a-block': 'must', prg3400: 'nonsense', prg3401: 'no' },
      updatedAt: 'soon',
    }],
  });
  const p = parsed.people[0];
  assert.equal(p.name.length, 60, 'an absurd name is truncated');
  assert.equal(p.color, '#8559D0', 'a non-colour falls back to a real one');
  assert.deepEqual(p.slots, [{ from: 1, to: 2 }], 'backwards and non-numeric windows are dropped');
  assert.deepEqual(p.interest, { prg3390: 'must' }, 'unknown ids, bad levels and "no" are dropped');
  assert.equal(p.updatedAt, 0, 'a non-numeric timestamp cannot win a merge');
});

test('a person without a usable id is dropped entirely', () => {
  assert.throws(() => parsePayload({ app: 'fantofuchs', format: 1, people: [{ name: 'nope' }] }), /no people/);
});

test('settings are clamped to sane values when present', () => {
  const parsed = parsePayload({
    app: 'fantofuchs',
    format: 1,
    people: [person()],
    settings: { bufferMin: -5, walkKmh: 900, detourFactor: 1.4, travelOverrides: { 'a|b': 12, 'bad key': 3 }, excludeClosed: false },
  });
  assert.equal(parsed.settings?.bufferMin, 0);
  assert.equal(parsed.settings?.walkKmh, 12);
  assert.equal(parsed.settings?.detourFactor, 1.4);
  assert.deepEqual(parsed.settings?.travelOverrides, { 'a|b': 12 });
  assert.equal(parsed.settings?.excludeClosed, false);
});

test('a share without settings stays without settings', async () => {
  const back = await decodeShare(await encodeShare(payloadOf([person()])));
  assert.equal(back.settings, undefined);
});
