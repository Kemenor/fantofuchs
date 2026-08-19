import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TravelMatrix, haversineKm } from '../src/model/travel.ts';
import { intersectSlots, isOpenWindow, mergeSlots, optimize } from '../src/model/optimize.ts';
import { SETTINGS, allDay, at, bruteForce, festivalOf } from './helpers.ts';

const w = (...pairs: [string, number][]) => new Map(pairs);

const run = (
  festival: ReturnType<typeof festivalOf>,
  weights: Map<string, number>,
  slots = allDay,
  over: Partial<typeof SETTINGS> = {},
) => {
  const settings = { ...SETTINGS, ...over };
  return optimize({
    festival,
    slots,
    weights,
    travel: new TravelMatrix(festival, settings),
    bufferMin: settings.bufferMin,
    excludeClosed: settings.excludeClosed,
  });
};

const titles = (p: { items: { block: { id: string } }[] }) => p.items.map((i) => i.block.id);

// ------------------------------------------------------------------- slots

test('mergeSlots joins overlapping and touching windows', () => {
  assert.deepEqual(
    mergeSlots([{ from: 30, to: 40 }, { from: 0, to: 10 }, { from: 10, to: 20 }, { from: 15, to: 25 }]),
    [{ from: 0, to: 25 }, { from: 30, to: 40 }],
  );
});

test('mergeSlots drops empty windows', () => {
  assert.deepEqual(mergeSlots([{ from: 5, to: 5 }, { from: 9, to: 4 }]), []);
});

test('intersectSlots keeps only shared time', () => {
  const me = [{ from: 0, to: 100 }, { from: 200, to: 300 }];
  const brother = [{ from: 50, to: 250 }];
  assert.deepEqual(intersectSlots(me, brother), [{ from: 50, to: 100 }, { from: 200, to: 250 }]);
});

test('intersectSlots of disjoint availability is empty', () => {
  assert.deepEqual(intersectSlots([{ from: 0, to: 10 }], [{ from: 20, to: 30 }]), []);
});

// ------------------------------------------------------------------ travel

test('haversine matches the real Trafo -> Orient walk', () => {
  const km = haversineKm(
    { id: 'a', name: '', address: '', lat: 47.4785, lon: 8.3056 },
    { id: 'b', name: '', address: '', lat: 47.4700, lon: 8.3166 },
  );
  assert.ok(km > 1.1 && km < 1.4, `expected ~1.2 km, got ${km}`);
});

test('same hall is free, same building is the flat constant, across town is a walk', () => {
  const f = festivalOf([['a', 'trafo-1', 10, 60]]);
  const t = new TravelMatrix(f, SETTINGS);
  assert.equal(t.between('trafo-1', 'trafo-1'), 0);
  assert.equal(t.between('trafo-1', 'trafo-2'), SETTINGS.samePlaceMin);
  assert.ok(t.samePlace('trafo-1', 'trafo-2'));
  assert.ok(!t.samePlace('trafo-1', 'orient'));
  const cross = t.between('trafo-1', 'orient');
  assert.ok(cross >= 18 && cross <= 26, `expected a ~20 min walk, got ${cross}`);
});

test('travel overrides win over the computed distance', () => {
  const f = festivalOf([['a', 'trafo-1', 10, 60]]);
  const t = new TravelMatrix(f, { ...SETTINGS, travelOverrides: { 'orient|trafo': 7 } });
  assert.equal(t.between('trafo-1', 'orient'), 7);
});

// --------------------------------------------------------------- scheduling

test('picks the pair that is worth more, not the one that starts first', () => {
  // `cheap` starts earliest and would block both `x` and `y` if taken greedily.
  const f = festivalOf([
    ['cheap', 'trafo-1', 10, 240],
    ['x', 'trafo-1', 10.5, 60],
    ['y', 'trafo-1', 12, 60],
  ]);
  const plan = run(f, w(['cheap', 50], ['x', 50], ['y', 50]));
  assert.deepEqual(titles(plan), ['x', 'y']);
  assert.equal(plan.weight, 100);
  assert.ok(plan.optimal);
});

test('one must-see outweighs any number of maybes', () => {
  const f = festivalOf([
    ['must', 'trafo-1', 10, 300],
    ['m1', 'trafo-1', 10, 60],
    ['m2', 'trafo-1', 11.5, 60],
    ['m3', 'trafo-1', 13, 60],
  ]);
  const plan = run(f, w(['must', 1000], ['m1', 8], ['m2', 8], ['m3', 8]));
  assert.deepEqual(titles(plan), ['must']);
});

test('a block is never scheduled twice, even when it screens repeatedly', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['a', 'trafo-1', 12, 60],
    ['a', 'trafo-1', 14, 60],
  ]);
  const plan = run(f, w(['a', 50]));
  assert.deepEqual(titles(plan), ['a']);
  assert.equal(plan.weight, 50);
});

test('uses a later screening of a block to fit an extra film in', () => {
  // `a` and `b` clash at 10:00, but `a` screens again at 14:00.
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['b', 'trafo-1', 10, 60],
    ['a', 'trafo-1', 14, 60],
  ]);
  const plan = run(f, w(['a', 50], ['b', 50]));
  assert.deepEqual(titles(plan), ['b', 'a']);
  assert.equal(plan.weight, 100);
});

test('respects the walk across town', () => {
  // Ends 11:00 in Trafo; Orient needs ~20 min walking plus a 10 min buffer.
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['tooSoon', 'orient', 11.25, 60],
  ]);
  assert.deepEqual(titles(run(f, w(['a', 50], ['tooSoon', 50]))), ['a']);

  const ok = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['later', 'orient', 11.75, 60],
  ]);
  assert.deepEqual(titles(run(ok, w(['a', 50], ['later', 50]))), ['a', 'later']);
});

test('back-to-back in the same building still needs the buffer', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['b', 'trafo-2', 11 + 2 / 60, 60],
  ]);
  assert.equal(titles(run(f, w(['a', 50], ['b', 50]))).length, 1);
});

test('prefers the schedule with less walking when interest ties', () => {
  // `b` screens in both buildings at the same time; staying put should win.
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['b', 'orient', 12, 60],
    ['b', 'trafo-1', 12, 60],
  ]);
  const plan = run(f, w(['a', 50], ['b', 50]));
  assert.deepEqual(titles(plan), ['a', 'b']);
  assert.equal(plan.totalTravelMin, 0);
  assert.equal(plan.items[1].showing.venueId, 'trafo-1');
});

test('only schedules inside your free time', () => {
  const f = festivalOf([
    ['early', 'trafo-1', 10, 60],
    ['evening', 'trafo-1', 17, 60],
  ]);
  const plan = run(f, w(['early', 50], ['evening', 50]), [{ from: at(16), to: at(24) }]);
  assert.deepEqual(titles(plan), ['evening']);
  assert.deepEqual(plan.missed.map((m) => [m.block.id, m.reason]), [['early', 'unavailable']]);
});

test('distinguishes a clash from being outside your availability', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 120],
    ['clashes', 'trafo-1', 10.5, 60],
    ['outside', 'trafo-1', 23, 30],
  ]);
  const plan = run(f, w(['a', 1000], ['clashes', 50], ['outside', 50]), [{ from: at(9), to: at(13) }]);
  assert.deepEqual(
    plan.missed.map((m) => [m.block.id, m.reason]).sort(),
    [['clashes', 'clash'], ['outside', 'unavailable']],
  );
});

test('unmarked blocks are never scheduled', () => {
  const f = festivalOf([['a', 'trafo-1', 10, 60], ['b', 'trafo-1', 12, 60]]);
  assert.deepEqual(titles(run(f, w(['a', 50]))), ['a']);
});

test('closed school screenings are excluded but can be opted back in', () => {
  const f = festivalOf([['a', 'trafo-1', 10, 60]]);
  f.showings[0].closed = true;
  assert.deepEqual(titles(run(f, w(['a', 50]))), []);
  assert.deepEqual(titles(run(f, w(['a', 50]), allDay, { excludeClosed: false })), ['a']);
});

test('reports travel and waiting time per item', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['b', 'orient', 13, 60],
  ]);
  const plan = run(f, w(['a', 50], ['b', 50]));
  assert.equal(plan.items[0].travelMin, 0);
  assert.ok(plan.items[1].travelMin >= 18);
  // Two hours between end and start, minus the walk, is waiting.
  assert.equal(plan.items[1].waitMin, 120 - plan.items[1].travelMin);
  assert.equal(plan.totalTravelMin, plan.items[1].travelMin);
});

// -------------------------------------------------------------- open windows

test('an exhibition is reported as a window, not scheduled as a sit-down', () => {
  const f = festivalOf([['expo', 'trafo-1', 12, 480]], { endSource: 'published' });
  assert.ok(isOpenWindow(f.showings[0]));
  const plan = run(f, w(['expo', 50]));
  assert.deepEqual(titles(plan), []);
  assert.deepEqual(plan.openWindows.map((o) => o.block.id), ['expo']);
  assert.deepEqual(plan.missed, []);
});

test('a long film is still a sit-down, not a window', () => {
  const f = festivalOf([['epic', 'trafo-1', 12, 200]]);
  assert.ok(!isOpenWindow(f.showings[0]));
  assert.deepEqual(titles(run(f, w(['epic', 50]))), ['epic']);
});

// ------------------------------------------------------------- optimality

test('matches an exhaustive search on 300 random instances', () => {
  // A deterministic PRNG so a failure is reproducible.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const venues = ['trafo-1', 'trafo-2', 'orient'];

  for (let iter = 0; iter < 300; iter++) {
    const nBlocks = 2 + Math.floor(rnd() * 5);
    const rows: [string, string, number, number][] = [];
    for (let b = 0; b < nBlocks; b++) {
      const showings = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < showings; s++) {
        rows.push([
          `b${b}`,
          venues[Math.floor(rnd() * venues.length)],
          9 + rnd() * 12,
          30 + Math.floor(rnd() * 5) * 30,
        ]);
      }
    }
    const f = festivalOf(rows);
    const weights = new Map(
      Array.from({ length: nBlocks }, (_, b) => [`b${b}`, [8, 50, 1000][Math.floor(rnd() * 3)]] as [string, number]),
    );
    const travel = new TravelMatrix(f, SETTINGS);
    const plan = optimize({
      festival: f, slots: allDay, weights, travel,
      bufferMin: SETTINGS.bufferMin, excludeClosed: true,
    });
    const reference = bruteForce(f, weights, allDay, (a, b) => travel.between(a, b), SETTINGS.bufferMin);
    assert.equal(plan.weight, reference, `iteration ${iter}: B&B ${plan.weight} != brute force ${reference}`);
    assert.ok(plan.optimal);
  }
});

test('the returned schedule is internally consistent', () => {
  let seed = 999;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const venues = ['trafo-1', 'trafo-2', 'orient'];
  for (let iter = 0; iter < 100; iter++) {
    const rows: [string, string, number, number][] = [];
    for (let b = 0; b < 6; b++)
      for (let s = 0; s < 1 + Math.floor(rnd() * 3); s++)
        rows.push([`b${b}`, venues[Math.floor(rnd() * 3)], 9 + rnd() * 12, 30 + Math.floor(rnd() * 4) * 30]);
    const f = festivalOf(rows);
    const weights = new Map(Array.from({ length: 6 }, (_, b) => [`b${b}`, 50] as [string, number]));
    const settings = SETTINGS;
    const travel = new TravelMatrix(f, settings);
    const plan = optimize({
      festival: f, slots: allDay, weights, travel,
      bufferMin: settings.bufferMin, excludeClosed: true,
    });
    const seen = new Set<string>();
    for (let k = 0; k < plan.items.length; k++) {
      const it = plan.items[k];
      assert.ok(!seen.has(it.block.id), 'a block was scheduled twice');
      seen.add(it.block.id);
      if (k === 0) continue;
      const prev = plan.items[k - 1].showing;
      const need = travel.between(prev.venueId, it.showing.venueId) + settings.bufferMin;
      assert.ok(it.showing.start >= prev.end + need * 60, 'not enough time to get there');
    }
    assert.equal(plan.weight, plan.items.length * 50);
  }
});

test('an opening window is only offered on days you are actually there', () => {
  const f = festivalOf([['expo', 'trafo-1', 12, 480]], { endSource: 'published' });
  const free = run(f, w(['expo', 50]), [{ from: at(9), to: at(23) }]);
  assert.deepEqual(free.openWindows.map((o) => o.block.id), ['expo']);

  const away = run(f, w(['expo', 50]), [{ from: at(21), to: at(23) }]);
  assert.deepEqual(away.openWindows, []);
});
