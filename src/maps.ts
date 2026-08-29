/**
 * Hand-offs to a maps app. No API, no key, no script: these are the documented
 * Google Maps universal URLs, which open the native app on a phone and the
 * website on a laptop. Nothing loads until a link is actually tapped, so the
 * app stays local-first — the festival's own coordinates are all that is sent,
 * never anything about the user.
 */
import type { Place } from './model/types.ts';

const point = (p: Place): string => `${p.lat},${p.lon}`;

/** Drop a pin on a venue's building. */
export function mapsPlaceUrl(place: Place): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(point(place))}`;
}

/** Walking directions between two buildings. */
export function mapsWalkUrl(from: Place, to: Place): string {
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&origin=${encodeURIComponent(point(from))}` +
    `&destination=${encodeURIComponent(point(to))}` +
    '&travelmode=walking'
  );
}

/** Walking directions from wherever the phone currently is. */
export function mapsWalkToUrl(to: Place): string {
  return (
    'https://www.google.com/maps/dir/?api=1' +
    `&destination=${encodeURIComponent(point(to))}` +
    '&travelmode=walking'
  );
}
