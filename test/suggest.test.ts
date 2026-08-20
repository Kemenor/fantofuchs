import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TravelMatrix } from '../src/model/travel.ts';
import { optimize } from '../src/model/optimize.ts';
import { alternativesFor, gapsOf, suggestFillers, type SuggestInput } from '../src/model/suggest.ts';
import { SETTINGS, allDay, at, festivalOf } from './helpers.ts';

const w = (...pairs: [string, number][]) => new Map(pairs);

function setup(
  festival: ReturnType<typeof festivalOf>,
  weights: Map<string, number>,
  slots = allDay,
) {
  const travel = new TravelMatrix(festival, SETTINGS);
  const plan = optimize({
    festival, slots, weights, travel,
    bufferMin: SETTINGS.bufferMin, excludeClosed: SETTINGS.excludeClosed,
  });
  const input: SuggestInput = {
    blocks: festival.blocks,
    showings: festival.showings,
    items: plan.items,
    slots,
    travel,
    bufferMin: SETTINGS.bufferMin,
    excludeClosed: SETTINGS.excludeClosed,
  };
  return { plan, input };
}

const ids = (list: { block: { id: string } }[]) => list.map((x) => x.block.id);

// ------------------------------------------------------------------- gaps

test('finds the hole between two scheduled films', () => {
  const f = festivalOf([['a', 'trafo-1', 10, 60], ['b', 'trafo-1', 14, 60]]);
  const { plan, input } = setup(f, w(['a', 50], ['b', 50]));
  assert.equal(plan.items.length, 2);
  const middle = gapsOf(input.items, input.slots).find((g) => g.before && g.after);
  assert.ok(middle);
  assert.equal(middle.from, at(11));
  assert.equal(middle.to, at(14));
});

test('gaps are clipped to free time, not stretched across it', () => {
  // Free on two evenings; the night in between is not a gap you can use.
  const f = festivalOf([['a', 'trafo-1', 18, 60]]);
  const slots = [{ from: at(17), to: at(22) }, { from: at(30), to: at(36) }];
  const { input } = setup(f, w(['a', 50]), slots);
  const gaps = gapsOf(input.items, slots);
  assert.ok(gaps.every((g) => g.to - g.from <= 6 * 3600), 'a gap spanned the night');
  assert.ok(gaps.some((g) => g.from === at(19) && g.to === at(22)), 'missing the evening tail');
  assert.ok(gaps.some((g) => g.from === at(30) && g.to === at(36)), 'missing the second window');
});

test('an empty day is one big gap', () => {
  const f = festivalOf([['a', 'trafo-1', 10, 60]]);
  const { input } = setup(f, w());
  const gaps = gapsOf([], input.slots);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].afterIndex, -1);
});

// ------------------------------------------------------------- suggestions

test('offers an unmarked film that fits the gap', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['filler', 'trafo-1', 12, 60],
    ['b', 'trafo-1', 14, 60],
  ]);
  const { input } = setup(f, w(['a', 50], ['b', 50]));
  const filled = suggestFillers(input);
  assert.deepEqual(filled.flatMap((g) => ids(g.suggestions)), ['filler']);
});

test('never offers something you could not walk to in time', () => {
  // The filler is across town and would leave 15 minutes for a 20-minute walk.
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['far', 'orient', 11.25, 45],
    ['b', 'trafo-1', 14, 60],
  ]);
  const { input } = setup(f, w(['a', 50], ['b', 50]));
  assert.deepEqual(suggestFillers(input).flatMap((g) => ids(g.suggestions)), []);
});

test('never offers something that would strand you before the next film', () => {
  // Fits after `a`, but leaves no time to get back across town for `b`.
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['far', 'orient', 11.75, 60],
    ['b', 'trafo-1', 13.25, 60],
  ]);
  const { input } = setup(f, w(['a', 50], ['b', 50]));
  assert.deepEqual(suggestFillers(input).flatMap((g) => ids(g.suggestions)), []);
});

test('never offers something already in the plan', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['a', 'trafo-1', 12, 60],
    ['b', 'trafo-1', 14, 60],
  ]);
  const { input } = setup(f, w(['a', 50], ['b', 50]));
  assert.ok(!suggestFillers(input).flatMap((g) => ids(g.suggestions)).includes('a'));
});

test('offers each film once, not once per screening', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['filler', 'trafo-1', 11.5, 30],
    ['filler', 'trafo-1', 12.5, 30],
    ['filler', 'trafo-1', 13.5, 30],
    ['b', 'trafo-1', 16, 60],
  ]);
  const { input } = setup(f, w(['a', 50], ['b', 50]));
  const all = suggestFillers(input).flatMap((g) => ids(g.suggestions));
  assert.deepEqual(all, ['filler']);
});

test('respects the cap per gap', () => {
  const rows: [string, string, number, number][] = [['a', 'trafo-1', 9, 30]];
  for (let i = 0; i < 8; i++) rows.push([`f${i}`, 'trafo-1', 10 + i, 30]);
  const f = festivalOf(rows);
  const { input } = setup(f, w(['a', 50]));
  for (const g of suggestFillers(input, { perGap: 3 })) {
    assert.ok(g.suggestions.length <= 3, `${g.suggestions.length} suggestions in one gap`);
  }
});

test('skips closed school screenings and open windows', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['school', 'trafo-1', 12, 60],
    ['b', 'trafo-1', 16, 60],
  ]);
  f.showings.find((s) => s.blockId === 'school')!.closed = true;
  const { input } = setup(f, w(['a', 50], ['b', 50]));
  assert.deepEqual(suggestFillers(input).flatMap((g) => ids(g.suggestions)), []);

  const expo = festivalOf([['a', 'trafo-1', 10, 60], ['expo', 'trafo-1', 12, 300]], { endSource: 'published' });
  const second = setup(expo, w(['a', 50]));
  assert.deepEqual(suggestFillers(second.input).flatMap((g) => ids(g.suggestions)), []);
});

test('a proven-optimal plan never leaves a marked film sitting in a gap', () => {
  // The property that makes this feature honest: if a wanted film had fitted,
  // taking it would have scored higher, so the optimizer would have taken it.
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const venues = ['trafo-1', 'trafo-2', 'orient'];

  for (let iter = 0; iter < 120; iter++) {
    const rows: [string, string, number, number][] = [];
    for (let b = 0; b < 7; b++)
      for (let s = 0; s < 1 + Math.floor(rnd() * 3); s++)
        rows.push([`b${b}`, venues[Math.floor(rnd() * 3)], 9 + rnd() * 12, 30 + Math.floor(rnd() * 4) * 30]);
    const f = festivalOf(rows);
    const marked = new Map<string, number>();
    for (let b = 0; b < 7; b++) if (rnd() > 0.4) marked.set(`b${b}`, 50);
    if (marked.size === 0) continue;

    const { plan, input } = setup(f, marked);
    if (!plan.optimal) continue;

    const offered = suggestFillers(input, { perGap: 99 }).flatMap((g) => ids(g.suggestions));
    for (const id of offered) {
      assert.ok(!marked.has(id), `iteration ${iter}: optimal plan left marked "${id}" fitting a gap`);
    }
  }
});

// ------------------------------------------------------------ alternatives

test('finds another screening of the same film that still fits', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['a', 'trafo-1', 15, 60],
    ['b', 'trafo-1', 12, 60],
  ]);
  const { plan, input } = setup(f, w(['a', 50], ['b', 50]));
  const aIndex = plan.items.findIndex((it) => it.block.id === 'a');
  const alternatives = alternativesFor(input, aIndex);
  assert.equal(alternatives.length, 1);
  assert.notEqual(alternatives[0].id, plan.items[aIndex].showing.id);
  assert.equal(alternatives[0].start, at(15));
});

test('does not offer an alternative that would collide with the next film', () => {
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['a', 'trafo-1', 12.5, 60],  // would overlap `b`
    ['b', 'trafo-1', 13, 60],
  ]);
  const { plan, input } = setup(f, w(['a', 50], ['b', 50]));
  const aIndex = plan.items.findIndex((it) => it.block.id === 'a');
  assert.deepEqual(alternativesFor(input, aIndex), []);
});

test('does not offer an alternative outside your free time', () => {
  const f = festivalOf([['a', 'trafo-1', 18, 60], ['a', 'trafo-1', 10, 60]]);
  const { plan, input } = setup(f, w(['a', 50]), [{ from: at(17), to: at(23) }]);
  assert.equal(plan.items.length, 1);
  assert.deepEqual(alternativesFor(input, 0), []);
});

test('an out-of-range index yields nothing rather than throwing', () => {
  const f = festivalOf([['a', 'trafo-1', 10, 60]]);
  const { input } = setup(f, w(['a', 50]));
  assert.deepEqual(alternativesFor(input, 9), []);
});

test('an alternative may land anywhere free, not just beside its old slot', () => {
  // `a` also screens in an empty evening; that is a perfectly good answer even
  // though it is not adjacent to where `a` currently sits.
  const f = festivalOf([
    ['a', 'trafo-1', 10, 60],
    ['a', 'trafo-1', 19, 60],
    ['b', 'trafo-1', 12, 60],
  ]);
  const { plan, input } = setup(f, w(['a', 50], ['b', 50]));
  const aIndex = plan.items.findIndex((it) => it.block.id === 'a');
  const alternatives = alternativesFor(input, aIndex);
  assert.equal(alternatives.length, 1);
  assert.equal(alternatives[0].start, at(19));
});

test('every alternative offered really is swappable', () => {
  let seed = 777;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const venues = ['trafo-1', 'trafo-2', 'orient'];

  for (let iter = 0; iter < 80; iter++) {
    const rows: [string, string, number, number][] = [];
    for (let b = 0; b < 5; b++)
      for (let s = 0; s < 1 + Math.floor(rnd() * 3); s++)
        rows.push([`b${b}`, venues[Math.floor(rnd() * 3)], 9 + rnd() * 12, 30 + Math.floor(rnd() * 3) * 30]);
    const f = festivalOf(rows);
    const marked = new Map(Array.from({ length: 5 }, (_, b) => [`b${b}`, 50] as [string, number]));
    const { plan, input } = setup(f, marked);

    for (let i = 0; i < plan.items.length; i++) {
      for (const alternative of alternativesFor(input, i)) {
        // Swapping it in must leave a schedule you could physically attend —
        // checked against every other film in the plan, not just the neighbours.
        for (const [j, other] of plan.items.entries()) {
          if (j === i) continue;
          const there = input.travel.between(other.showing.venueId, alternative.venueId);
          const back = input.travel.between(alternative.venueId, other.showing.venueId);
          const otherThenAlt = alternative.start >= other.showing.end + (there + input.bufferMin) * 60;
          const altThenOther = other.showing.start >= alternative.end + (back + input.bufferMin) * 60;
          assert.ok(
            otherThenAlt || altThenOther,
            `iteration ${iter}: the alternative clashes with "${other.block.id}"`,
          );
        }
      }
    }
  }
});
