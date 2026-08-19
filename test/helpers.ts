import type { Festival, Place, Settings, Showing, Slot, Venue } from '../src/model/types.ts';

export const DAY = Math.floor(new Date('2026-09-03T00:00:00+02:00').getTime() / 1000);
/** Epoch for a wall-clock time on the test day. */
export const at = (h: number, m = 0): number => DAY + h * 3600 + m * 60;

export const SETTINGS: Settings = {
  bufferMin: 10,
  samePlaceMin: 3,
  walkKmh: 4.5,
  detourFactor: 1.35,
  travelOverrides: {},
  excludeClosed: true,
};

/** Two buildings ~1.2 km apart, so a hop between them is a real walk. */
const PLACES: Place[] = [
  { id: 'trafo', name: 'Trafo', address: '', lat: 47.4785, lon: 8.3056 },
  { id: 'orient', name: 'Orient', address: '', lat: 47.4700, lon: 8.3166 },
];

const VENUES: Venue[] = [
  { id: 'trafo-1', name: 'Trafo 1', placeId: 'trafo', hall: '1' },
  { id: 'trafo-2', name: 'Trafo 2', placeId: 'trafo', hall: '2' },
  { id: 'orient', name: 'Orient', placeId: 'orient' },
];

/** Build a festival from `[blockId, venueId, startHour, durationMin]` tuples. */
export function festivalOf(
  rows: [string, string, number, number][],
  opts: { endSource?: Showing['endSource'] } = {},
): Festival {
  const blockIds = [...new Set(rows.map((r) => r[0]))];
  return {
    edition: { year: 2026, title: 'Test', firstDay: '2026-09-03', lastDay: '2026-09-03', tz: 'Europe/Zurich' },
    scrapedAt: '2026-08-19T00:00:00Z',
    source: 'test',
    places: PLACES,
    venues: VENUES,
    blocks: blockIds.map((id) => ({ id, title: id, category: 'Test', badges: [], films: [], url: '' })),
    showings: rows.map(([blockId, venueId, startHour, durationMin], i) => ({
      id: `${blockId}_${i}`,
      blockId,
      venueId,
      start: DAY + Math.round(startHour * 3600),
      end: DAY + Math.round(startHour * 3600) + durationMin * 60,
      endSource: opts.endSource ?? 'runtime',
    })),
  };
}

export const allDay: Slot[] = [{ from: at(0), to: at(24) }];

/**
 * Exhaustive reference solver. Tries every subset of showings, so it is only
 * usable on tiny instances — which is exactly what makes it a trustworthy
 * check on the branch-and-bound.
 */
export function bruteForce(
  festival: Festival,
  weights: Map<string, number>,
  slots: Slot[],
  travelMin: (a: string, b: string) => number,
  bufferMin: number,
): number {
  const cand = festival.showings
    .filter((s) => (weights.get(s.blockId) ?? 0) > 0)
    .filter((s) => slots.some((w) => s.start >= w.from && s.end <= w.to))
    .sort((a, b) => a.start - b.start);

  let best = 0;
  const walk = (i: number, lastEnd: number, lastVenue: string | null, used: Set<string>, weight: number): void => {
    if (weight > best) best = weight;
    if (i >= cand.length) return;
    const s = cand[i];
    if (!used.has(s.blockId)) {
      const t = lastVenue === null ? 0 : travelMin(lastVenue, s.venueId);
      if (lastVenue === null || s.start >= lastEnd + (t + bufferMin) * 60) {
        used.add(s.blockId);
        walk(i + 1, s.end, s.venueId, used, weight + (weights.get(s.blockId) ?? 0));
        used.delete(s.blockId);
      }
    }
    walk(i + 1, lastEnd, lastVenue, used, weight);
  };
  walk(0, -Infinity, null, new Set(), 0);
  return best;
}
