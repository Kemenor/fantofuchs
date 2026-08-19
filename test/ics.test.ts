import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planToIcs } from '../src/ics.ts';
import type { Plan } from '../src/model/optimize.ts';
import { festivalOf, at } from './helpers.ts';

const festival = festivalOf([['a', 'trafo-1', 19.5, 68]]);
festival.blocks[0] = {
  ...festival.blocks[0],
  title: 'Opening; selection, part 1',
  films: [{ title: 'Display Nature', durationMin: 9 }],
  url: 'https://fantoche.ch/x',
};
festival.places[0] = { ...festival.places[0], address: 'Brown-Boveri-Platz 1, 5400 Baden' };

const plan: Plan = {
  items: [{ showing: festival.showings[0], block: festival.blocks[0], travelMin: 12, waitMin: 5 }],
  weight: 50,
  totalTravelMin: 12,
  missed: [],
  openWindows: [],
  optimal: true,
  nodesExplored: 1,
};

test('produces a calendar with one event per scheduled screening', () => {
  const ics = planToIcs(plan, festival);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 1);
  assert.match(ics, /UID:a_0@fantofuchs/);
});

test('every line ends CRLF, as the format requires', () => {
  const ics = planToIcs(plan, festival);
  const bare = ics.split('\r\n').join('');
  assert.ok(!bare.includes('\n'), 'a bare newline leaked into the output');
});

test('escapes the characters that would otherwise break a field', () => {
  const ics = planToIcs(plan, festival);
  const summary = ics.split('\r\n').find((l) => l.startsWith('SUMMARY:'))!;
  // Semicolons and commas separate iCalendar fields, so both must be escaped.
  assert.equal(summary, 'SUMMARY:Opening\\; selection\\, part 1');
});

test('carries the venue, the walk and the film list', () => {
  const ics = planToIcs(plan, festival);
  assert.match(ics, /LOCATION:Trafo 1\\, Brown-Boveri-Platz 1\\, 5400 Baden/);
  assert.match(ics, /Allow 12 min to walk here/);
  assert.match(ics, /Display Nature/);
});

test('folds long lines to 75 octets without splitting a character', () => {
  const long = { ...festival, blocks: [{ ...festival.blocks[0], title: 'Ä'.repeat(120) }] };
  const ics = planToIcs({ ...plan, items: [{ ...plan.items[0], block: long.blocks[0] }] }, long);
  for (const line of ics.split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 76, `line too long: ${line.length}`);
  }
  // Unfolding must give the title back intact — no mangled umlauts.
  assert.ok(ics.replace(/\r\n /g, '').includes('Ä'.repeat(120)));
});

test('includes drop-in windows as events too', () => {
  const withWindow: Plan = {
    ...plan,
    openWindows: [{ showing: { ...festival.showings[0], id: 'w1', start: at(12), end: at(20) }, block: festival.blocks[0] }],
  };
  const ics = planToIcs(withWindow, festival);
  assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 2);
});
