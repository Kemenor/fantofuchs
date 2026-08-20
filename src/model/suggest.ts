/**
 * What else could go in the plan.
 *
 * Two questions you ask once a schedule exists, both of which are the same
 * feasibility test the optimizer uses, asked about one hole at a time:
 *
 *   - *What fits in this gap?* — an hour between two films is not much use
 *     unless you know what is actually reachable and back in time.
 *   - *When else does this one screen?* — the question you ask at the box
 *     office when a screening is sold out.
 *
 * Neither may propose something you could not physically get to, so both go
 * through the same travel-and-buffer check as the scheduler itself.
 *
 * Worth knowing why the suggestions are almost always things you did *not*
 * mark: if a marked block had fitted a gap, adding it would have raised the
 * score, so a *proven* optimal plan cannot leave one lying in a gap. When the
 * search ran out of budget that guarantee lapses, which is exactly when a
 * marked leftover showing up here is worth seeing.
 */
import type { Block, Showing, Slot } from './types.ts';
import type { TravelMatrix } from './travel.ts';
import { isOpenWindow, mergeSlots, type PlanItem } from './optimize.ts';

/** A stretch of free time between two scheduled items, or at either end. */
export interface Gap {
  /** Index of the scheduled item this follows; `-1` before the first one. */
  afterIndex: number;
  /** Earliest something here could start. */
  from: number;
  /** Latest something here must end. */
  to: number;
  before: PlanItem | null;
  after: PlanItem | null;
}

export interface SuggestInput {
  blocks: Block[];
  showings: Showing[];
  items: PlanItem[];
  slots: Slot[];
  travel: TravelMatrix;
  bufferMin: number;
  excludeClosed: boolean;
}

/**
 * The holes in a schedule, clipped to the free time they sit in.
 *
 * Clipping matters: the gap between Thursday's last film and Saturday's first
 * is not eleven free hours, it is two evenings with a night in between, and
 * proposing a Friday matinee to someone who said they are busy on Friday would
 * be worse than proposing nothing.
 */
export function gapsOf(items: PlanItem[], slots: Slot[]): Gap[] {
  const windows = mergeSlots(slots);
  const gaps: Gap[] = [];

  for (const window of windows) {
    const inside = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.showing.start >= window.from && item.showing.end <= window.to)
      .sort((a, b) => a.item.showing.start - b.item.showing.start);

    if (inside.length === 0) {
      gaps.push({ afterIndex: -1, from: window.from, to: window.to, before: null, after: null });
      continue;
    }

    const first = inside[0];
    if (first.item.showing.start > window.from) {
      gaps.push({
        afterIndex: -1, from: window.from, to: first.item.showing.start,
        before: null, after: first.item,
      });
    }

    for (let i = 0; i < inside.length - 1; i++) {
      const before = inside[i];
      const after = inside[i + 1];
      if (after.item.showing.start > before.item.showing.end) {
        gaps.push({
          afterIndex: before.index,
          from: before.item.showing.end,
          to: after.item.showing.start,
          before: before.item,
          after: after.item,
        });
      }
    }

    const last = inside[inside.length - 1];
    if (window.to > last.item.showing.end) {
      gaps.push({
        afterIndex: last.index, from: last.item.showing.end, to: window.to,
        before: last.item, after: null,
      });
    }
  }

  return gaps.sort((a, b) => a.from - b.from);
}

/** Could this screening sit in that gap, walking included? */
function fits(
  showing: Showing,
  gap: Gap,
  travel: TravelMatrix,
  bufferMin: number,
): boolean {
  if (showing.start < gap.from || showing.end > gap.to) return false;

  if (gap.before) {
    const walk = travel.between(gap.before.showing.venueId, showing.venueId);
    if (showing.start < gap.before.showing.end + (walk + bufferMin) * 60) return false;
  }
  if (gap.after) {
    const walk = travel.between(showing.venueId, gap.after.showing.venueId);
    if (gap.after.showing.start < showing.end + (walk + bufferMin) * 60) return false;
  }
  return true;
}

export interface Suggestion {
  showing: Showing;
  block: Block;
  /** Walking minutes from the previous scheduled item, if there is one. */
  travelInMin: number;
  /** Walking minutes on to the next scheduled item, if there is one. */
  travelOutMin: number;
}

/** Suggestions per gap, in schedule order. */
export interface GapSuggestions {
  gap: Gap;
  suggestions: Suggestion[];
}

/**
 * Things that would fit the holes in a plan.
 *
 * At most one screening per block, because five rows for the same film is the
 * bookkeeping this app exists to remove — and at most `perGap` per gap, since a
 * quiet Saturday afternoon can otherwise offer thirty options and help nobody.
 */
export function suggestFillers(
  input: SuggestInput,
  { perGap = 4 }: { perGap?: number } = {},
): GapSuggestions[] {
  const { showings, items, travel, bufferMin, excludeClosed } = input;
  const byId = new Map(input.blocks.map((b) => [b.id, b]));
  const scheduled = new Set(items.map((it) => it.showing.blockId));
  const gaps = gapsOf(items, input.slots);

  // A block already proposed for an earlier gap is not proposed again — the
  // earlier one is the one you would actually take.
  const proposed = new Set<string>();
  const out: GapSuggestions[] = [];

  for (const gap of gaps) {
    const suggestions: Suggestion[] = [];

    for (const showing of showings) {
      if (showing.start >= gap.to) break; // showings are sorted by start
      if (scheduled.has(showing.blockId) || proposed.has(showing.blockId)) continue;
      if (excludeClosed && showing.closed) continue;
      if (isOpenWindow(showing)) continue;
      if (!fits(showing, gap, travel, bufferMin)) continue;

      const block = byId.get(showing.blockId);
      if (!block) continue;

      suggestions.push({
        showing,
        block,
        travelInMin: gap.before ? travel.between(gap.before.showing.venueId, showing.venueId) : 0,
        travelOutMin: gap.after ? travel.between(showing.venueId, gap.after.showing.venueId) : 0,
      });
      proposed.add(showing.blockId);
      if (suggestions.length >= perGap) break;
    }

    if (suggestions.length > 0) out.push({ gap, suggestions });
  }

  return out;
}

/**
 * Other times the same block screens that you could still get to.
 *
 * The question you ask when a screening turns out to be sold out — Fantoche
 * warns that evenings and weekends go early — so the answer has to be a
 * screening you could actually move to, with the rest of the day left standing.
 *
 * "Rest of the day left standing" is checked against **every** other scheduled
 * item, not just the two either side. A later screening that happens to sit in
 * an empty afternoon is a perfectly good answer, and only comparing neighbours
 * would throw it away for no reason.
 */
export function alternativesFor(input: SuggestInput, index: number): Showing[] {
  const { items, showings, travel, bufferMin, excludeClosed } = input;
  const item = items[index];
  if (!item) return [];

  const others = items.filter((_, i) => i !== index);
  const windows = mergeSlots(input.slots);

  /** Can these two sit in the same day, in either order? */
  const compatible = (a: Showing, b: Showing): boolean => {
    const aThenB = b.start >= a.end + (travel.between(a.venueId, b.venueId) + bufferMin) * 60;
    const bThenA = a.start >= b.end + (travel.between(b.venueId, a.venueId) + bufferMin) * 60;
    return aThenB || bThenA;
  };

  return showings.filter((showing) => {
    if (showing.blockId !== item.showing.blockId) return false;
    if (showing.id === item.showing.id) return false;
    if (excludeClosed && showing.closed) return false;
    if (!windows.some((w) => showing.start >= w.from && showing.end <= w.to)) return false;
    return others.every((other) => compatible(showing, other.showing));
  });
}
