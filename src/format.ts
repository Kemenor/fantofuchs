/**
 * Formatting, all pinned to the festival's timezone.
 *
 * Baden is in Europe/Zurich whatever your laptop thinks, and a schedule that
 * silently shifts by an hour because you planned it from a train in another
 * country would be worse than useless. So every date here goes through Intl
 * with an explicit `timeZone` — never the local one.
 */
import { festival } from './store.ts';

const TZ = festival.edition.tz;

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'numeric' });
const isoDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** `19:30` */
export const time = (epoch: number): string => timeFmt.format(new Date(epoch * 1000));

/** `Saturday` */
export const weekday = (epoch: number): string => weekdayFmt.format(new Date(epoch * 1000));

/** `Sat, 5/9` */
export const shortDay = (epoch: number): string => shortDayFmt.format(new Date(epoch * 1000));

/** `5.9.` — a day key rendered the way it is written in Switzerland. */
export function dayDotMonth(day: string): string {
  const [, month, dayOfMonth] = day.split('-');
  return `${Number(dayOfMonth)}.${Number(month)}.`;
}

/** `2026-09-05` — the festival-local calendar day, used to group things. */
export const dayKey = (epoch: number): string => isoDayFmt.format(new Date(epoch * 1000));

/** `1h 48′` / `48′` */
export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h${m ? ` ${m}′` : ''}` : `${m}′`;
}

/** Minutes between two epochs, rounded. */
export const minutesBetween = (a: number, b: number): number => Math.round((b - a) / 60);

/**
 * Festival-local midnight for a day key, as epoch seconds. Derived by probing
 * rather than by assuming an offset, so it stays correct across DST.
 */
export function midnightOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  // Start from the UTC instant and correct by whatever offset the zone had.
  const guess = Date.UTC(y, m - 1, d, 12) / 1000;
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(guess * 1000));
  const hh = Number(local.find((p) => p.type === 'hour')?.value ?? 12);
  const mm = Number(local.find((p) => p.type === 'minute')?.value ?? 0);
  return guess - hh * 3600 - mm * 60;
}

/** Epoch for a wall-clock time on a festival day. Hours may exceed 24 for
 *  "until 1am", which is how a festival night actually works. */
export const atHour = (day: string, hour: number, minute = 0): number =>
  midnightOf(day) + hour * 3600 + minute * 60;

/** Every calendar day the festival has a screening on, in order. */
export const festivalDays: string[] = [...new Set(festival.showings.map((s) => dayKey(s.start)))].sort();

/**
 * When each festival day actually runs, so the availability editor can offer
 * "the whole day" without inventing hours nothing is screened in. The end is
 * allowed past midnight — late showings belong to the evening they started in.
 */
export const dayBounds: Record<string, { fromHour: number; toHour: number }> = (() => {
  const out: Record<string, { fromHour: number; toHour: number }> = {};
  for (const day of festivalDays) {
    const midnight = midnightOf(day);
    const onDay = festival.showings.filter((s) => dayKey(s.start) === day);
    const first = Math.min(...onDay.map((s) => s.start));
    const last = Math.max(...onDay.map((s) => s.end));
    out[day] = {
      fromHour: Math.floor((first - midnight) / 3600),
      toHour: Math.ceil((last - midnight) / 3600),
    };
  }
  return out;
})();
