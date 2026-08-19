/**
 * The scheduler.
 *
 * Picking a festival day is a weighted job-interval selection problem: every
 * programme block screens at several times, you may watch each block at most
 * once, two screenings clash if you cannot walk between them in time, and you
 * want the most interesting set overall. That is NP-hard in general — but the
 * instance is tiny once it is cut down to blocks you actually marked (a few
 * dozen showings), so we solve it *exactly* with branch and bound rather than
 * hand-waving with a greedy pass and hoping.
 *
 * Two bounds do the pruning, and the tighter of the two wins:
 *   1. *Interest left* — the weight of every not-yet-watched block that still
 *      appears later in the candidate list.
 *   2. *Time left* — you cannot watch more films than fit: divide the free time
 *      remaining by the shortest block still ahead, and take that many of the
 *      most interesting blocks left.
 *   3. *Clashes ahead* — the same problem with the awkward constraints thrown
 *      away: no walking, and a block may be watched twice. That relaxation is
 *      plain weighted interval scheduling, which a suffix DP solves exactly in
 *      one pass up front. It is the only bound that understands that two
 *      screenings at 20:00 cannot both happen, and it is what actually makes
 *      the search finish.
 * Every bound drops constraints rather than adding them, so none can undershoot
 * the true optimum — which is what makes pruning on them safe.
 *
 * Walking is folded into the objective rather than compared after it: the score
 * is `weight * SCALE - travelMinutes`, with SCALE larger than any plausible
 * total walk. Interest therefore always dominates and less walking breaks ties
 * for free. Settling the two in sequence instead — prove the interest optimum,
 * then polish the walking — was tried and is worse: on the wishlists big enough
 * for the search to run out of budget, the combined score still returns a
 * tightly-packed schedule, whereas a half-finished first pass returns one that
 * wanders across town.
 */
import type { Block, Festival, Showing, Slot } from './types.ts';
import type { TravelMatrix } from './travel.ts';

/**
 * An event printed with a long published time range (an exhibition, a games
 * pop-up) is an *opening window*, not a thing you sit through. Scheduling it
 * as a six-hour commitment would be nonsense, so it is reported separately for
 * you to drop into.
 */
export const OPEN_WINDOW_MIN_HOURS = 3;

export function isOpenWindow(s: Showing): boolean {
  return s.endSource === 'published' && s.end - s.start >= OPEN_WINDOW_MIN_HOURS * 3600;
}

export interface OptimizeInput {
  festival: Festival;
  /** Free time this plan must fit inside, already merged and sorted. */
  slots: Slot[];
  /** blockId -> weight. Anything absent or 0 is not wanted. */
  weights: Map<string, number>;
  travel: TravelMatrix;
  bufferMin: number;
  excludeClosed: boolean;
  /** Abort the search after this many nodes and return the best found so far. */
  nodeBudget?: number;
  /** Abort after this much wall-clock time. Keeps the UI responsive. */
  timeLimitMs?: number;
}

export interface PlanItem {
  showing: Showing;
  block: Block;
  /** Walking minutes from the previous item's venue. */
  travelMin: number;
  /** Idle minutes between arriving and the start. */
  waitMin: number;
}

export interface MissedBlock {
  block: Block;
  weight: number;
  /**
   * `unavailable` — no screening of it falls inside your free time at all.
   * `clash`       — it could have fitted, but something better occupied the slot.
   */
  reason: 'unavailable' | 'clash';
}

export interface Plan {
  items: PlanItem[];
  /** Sum of the weights of the blocks scheduled. The thing being maximised. */
  weight: number;
  totalTravelMin: number;
  missed: MissedBlock[];
  /** Exhibitions and pop-ups — visit any time inside their window. */
  openWindows: { showing: Showing; block: Block }[];
  /**
   * True when the schedule is *provably* the most interesting one possible.
   * False means the search ran out of budget: the plan is good, not proven.
   */
  optimal: boolean;
  nodesExplored: number;
}

/** Merge overlapping/adjacent windows so containment tests are a simple scan. */
export function mergeSlots(slots: Slot[]): Slot[] {
  const sorted = slots.filter((s) => s.to > s.from).sort((a, b) => a.from - b.from);
  const out: Slot[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

/** Intersect two merged slot lists. Used to plan what several people can attend. */
export function intersectSlots(a: Slot[], b: Slot[]): Slot[] {
  const out: Slot[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const from = Math.max(a[i].from, b[j].from);
    const to = Math.min(a[i].to, b[j].to);
    if (to > from) out.push({ from, to });
    if (a[i].to < b[j].to) i++;
    else j++;
  }
  return out;
}

function fitsInSlot(s: Showing, slots: Slot[]): boolean {
  return slots.some((w) => s.start >= w.from && s.end <= w.to);
}

export function optimize(input: OptimizeInput): Plan {
  const { festival, weights, travel, bufferMin, excludeClosed } = input;
  const nodeBudget = input.nodeBudget ?? 20_000_000;
  const timeLimitMs = input.timeLimitMs ?? 2_000;
  const slots = mergeSlots(input.slots);
  const blocks = new Map(festival.blocks.map((b) => [b.id, b]));

  const wanted = festival.showings.filter((s) => (weights.get(s.blockId) ?? 0) > 0);

  // An opening window only needs to *overlap* your free time — you drop in for
  // twenty minutes, you do not sit through it — but a window on a day you are
  // not even in Baden is noise.
  const openWindows = wanted
    .filter(isOpenWindow)
    .filter((s) => !(excludeClosed && s.closed))
    .filter((s) => slots.some((w) => s.start < w.to && s.end > w.from))
    .map((s) => ({ showing: s, block: blocks.get(s.blockId)! }));

  // Candidates: real screenings of blocks you want, that fit your free time.
  const candidates = wanted
    .filter((s) => !isOpenWindow(s))
    .filter((s) => !(excludeClosed && s.closed))
    .filter((s) => fitsInSlot(s, slots))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const n = candidates.length;
  const weightAt = candidates.map((s) => weights.get(s.blockId) ?? 0);

  // lastIndex[block] — the last candidate position where the block appears.
  // A block is still reachable from position i exactly when lastIndex >= i.
  const lastIndex = new Map<string, number>();
  candidates.forEach((s, i) => lastIndex.set(s.blockId, i));

  // suffixWeight[i] — total weight of the distinct blocks in candidates[i..].
  // suffixTopK[i][k] — the k most interesting of those, summed. Feeding the
  // time bound: if only k more films fit, these are the best k you could hope
  // for. suffixMinCost[i] — the shortest block still ahead, plus the buffer,
  // i.e. the cheapest any further film can possibly be in minutes.
  const suffixWeight = new Array<number>(n + 1).fill(0);
  const suffixTopK: number[][] = new Array(n + 1);
  const suffixMinCost = new Array<number>(n + 1).fill(Infinity);
  suffixTopK[n] = [0];
  {
    const distinct = new Map<string, number>();
    for (let i = n - 1; i >= 0; i--) {
      if (!distinct.has(candidates[i].blockId)) distinct.set(candidates[i].blockId, weightAt[i]);
      const costMin = (candidates[i].end - candidates[i].start) / 60 + bufferMin;
      suffixMinCost[i] = Math.min(suffixMinCost[i + 1], costMin);

      const desc = [...distinct.values()].sort((x, y) => y - x);
      const prefix = new Array<number>(desc.length + 1);
      prefix[0] = 0;
      for (let k = 0; k < desc.length; k++) prefix[k + 1] = prefix[k] + desc[k];
      suffixTopK[i] = prefix;
      suffixWeight[i] = prefix[desc.length];
    }
  }

  // relaxedBest[i] — the best you could still score from candidates[i..] if
  // walking were instant and blocks could repeat. Optimistic, so it bounds;
  // and because it respects overlap it collapses the tree where the other two
  // bounds see nothing wrong with watching four films at once.
  const relaxedBest = new Array<number>(n + 1).fill(0);
  {
    const starts = candidates.map((c) => c.start);
    for (let i = n - 1; i >= 0; i--) {
      // First candidate that starts no earlier than this one ends, plus the
      // buffer — which applies between any two screenings, however close.
      const earliest = candidates[i].end + bufferMin * 60;
      let lo = i + 1;
      let hi = n;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid] >= earliest) hi = mid;
        else lo = mid + 1;
      }
      relaxedBest[i] = Math.max(relaxedBest[i + 1], weightAt[i] + relaxedBest[lo]);
    }
  }

  /** Free minutes still available from `t` onwards. */
  const freeMinutesFrom = (t: number): number => {
    let total = 0;
    for (const w of slots) {
      if (w.to <= t) continue;
      total += (w.to - Math.max(w.from, t)) / 60;
    }
    return total;
  };
  const horizonStart = slots.length ? slots[0].from : 0;

  /**
   * Interest is worth this much more than a minute of walking. Any value above
   * the largest conceivable total walk keeps the ordering lexicographic.
   */
  const SCALE = 10_000;

  let bestScore = -1;
  let bestWeight = 0;
  let bestChoice: number[] = [];
  let nodes = 0;
  let aborted = false;

  const used = new Map<string, number>(); // blockId -> weight, for bound repair
  const chosen: number[] = [];

  const deadline = Date.now() + timeLimitMs;

  const search = (start: number, lastEnd: number, lastVenue: string | null, weight: number, travelMin: number): void => {
    if (aborted) return;
    if (++nodes > nodeBudget || (nodes & 0x3fff) === 0 && Date.now() > deadline) {
      aborted = true;
      return;
    }

    // Record: more interest, or the same interest with less walking.
    const score = weight * SCALE - travelMin;
    if (score > bestScore) {
      bestScore = score;
      bestWeight = weight;
      bestChoice = chosen.slice();
    }

    // Walk forward over candidates that offer no choice at all — a block
    // already watched, or one there is no longer time to reach. Those would
    // each cost a node while only ever taking the "skip" branch.
    let i = start;
    let walk = 0;
    for (; i < n; i++) {
      const c = candidates[i];
      if (used.has(c.blockId)) continue;
      walk = lastVenue === null ? 0 : travel.between(lastVenue, c.venueId);
      if (lastEnd === -Infinity || c.start >= lastEnd + (walk + bufferMin) * 60) break;
    }
    if (i >= n) return;

    // Bound 1: every block still ahead that has not been watched yet.
    let byInterest = suffixWeight[i];
    for (const [blockId, w] of used) {
      if ((lastIndex.get(blockId) ?? -1) >= i) byInterest -= w;
    }

    // Bound 2: only so many more films fit in the free time that is left.
    const from = lastEnd === -Infinity ? horizonStart : lastEnd;
    const capacity = Math.floor(freeMinutesFrom(from) / suffixMinCost[i]);
    const topK = suffixTopK[i];
    const byTime = topK[Math.min(capacity, topK.length - 1)];

    // Future walking can only subtract, so leaving it out keeps this optimistic.
    const bound = score + Math.min(byInterest, byTime, relaxedBest[i]) * SCALE;
    if (bound <= bestScore) return;

    // Take it first — diving greedily finds a strong incumbent early, which
    // makes the bounds above prune most of the rest of the tree.
    const s = candidates[i];
    used.set(s.blockId, weightAt[i]);
    chosen.push(i);
    search(i + 1, s.end, s.venueId, weight + weightAt[i], travelMin + walk);
    chosen.pop();
    used.delete(s.blockId);

    search(i + 1, lastEnd, lastVenue, weight, travelMin);
  };

  search(0, -Infinity, null, 0, 0);

  // Rebuild the winning schedule with its travel and waiting times.
  const items: PlanItem[] = [];
  let prev: Showing | null = null;
  let totalTravelMin = 0;
  for (const idx of bestChoice) {
    const showing = candidates[idx];
    const walk = prev ? travel.between(prev.venueId, showing.venueId) : 0;
    const gapMin = prev ? Math.round((showing.start - prev.end) / 60) : 0;
    items.push({
      showing,
      block: blocks.get(showing.blockId)!,
      travelMin: walk,
      waitMin: prev ? Math.max(0, gapMin - walk) : 0,
    });
    totalTravelMin += walk;
    prev = showing;
  }

  const scheduled = new Set(items.map((it) => it.showing.blockId));
  const eligible = new Set(candidates.map((s) => s.blockId));
  const missed: MissedBlock[] = [];
  for (const [blockId, w] of weights) {
    if (w <= 0 || scheduled.has(blockId)) continue;
    const block = blocks.get(blockId);
    if (!block || openWindows.some((o) => o.block.id === blockId)) continue;
    missed.push({ block, weight: w, reason: eligible.has(blockId) ? 'clash' : 'unavailable' });
  }
  missed.sort((a, b) => b.weight - a.weight || a.block.title.localeCompare(b.block.title));

  return {
    items,
    weight: Math.max(0, bestWeight),
    totalTravelMin,
    missed,
    openWindows,
    optimal: !aborted,
    nodesExplored: nodes,
  };
}
