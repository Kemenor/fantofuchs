/**
 * How long it takes to get from one venue to another, on foot.
 *
 * Fantoche's venues split into a handful of buildings: the Trafo halls sit in
 * one cinema, the Merker-Areal venues share a courtyard, and Orient and the
 * Gluri Suter Huus are over in Wettingen — a real walk. So the interesting
 * number is between *places*, not venues; changing hall inside one building is
 * a flat, short constant.
 *
 * Distances are straight-line, inflated by a detour factor, because a routing
 * API would be one more thing to run and the error is a minute or two.
 */
import type { Festival, Place, Settings, Venue } from './types.ts';

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres. */
export function haversineKm(a: Place, b: Place): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Key for a place pair, order-independent. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * A precomputed venue-to-venue travel time lookup, in minutes.
 * Build once per (festival, settings) and reuse — the optimizer hits it hard.
 */
export class TravelMatrix {
  private readonly minutes = new Map<string, number>();
  private readonly placeOfVenue = new Map<string, string>();

  constructor(festival: Festival, settings: Settings) {
    const places = new Map(festival.places.map((p) => [p.id, p]));
    for (const v of festival.venues) this.placeOfVenue.set(v.id, v.placeId);

    const ids = [...new Set(festival.venues.map((v) => v.placeId))];
    for (const a of ids) {
      for (const b of ids) {
        const key = pairKey(a, b);
        if (this.minutes.has(key)) continue;

        const override = settings.travelOverrides[key];
        if (override !== undefined) {
          this.minutes.set(key, override);
          continue;
        }
        if (a === b) {
          this.minutes.set(key, settings.samePlaceMin);
          continue;
        }
        const pa = places.get(a);
        const pb = places.get(b);
        if (!pa || !pb) {
          // A venue we could not geocode: assume the worst walk on the map so
          // the optimizer never quietly produces an impossible hop.
          this.minutes.set(key, 30);
          continue;
        }
        const km = haversineKm(pa, pb) * settings.detourFactor;
        this.minutes.set(key, Math.ceil((km / settings.walkKmh) * 60));
      }
    }
  }

  /** Walking minutes between two venues. Same hall is always 0. */
  between(venueA: string, venueB: string): number {
    if (venueA === venueB) return 0;
    const a = this.placeOfVenue.get(venueA);
    const b = this.placeOfVenue.get(venueB);
    if (a === undefined || b === undefined) return 30;
    return this.minutes.get(pairKey(a, b)) ?? 30;
  }

  /** True when both venues sit in the same building. */
  samePlace(venueA: string, venueB: string): boolean {
    return this.placeOfVenue.get(venueA) === this.placeOfVenue.get(venueB);
  }
}

/** Venues grouped by place, for the settings screen. */
export function venuesByPlace(festival: Festival): Map<string, Venue[]> {
  const out = new Map<string, Venue[]>();
  for (const v of festival.venues) {
    const list = out.get(v.placeId) ?? [];
    list.push(v);
    out.set(v.placeId, list);
  }
  return out;
}
