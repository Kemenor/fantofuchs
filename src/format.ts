/**
 * Formatting: pinned to the festival's timezone, following the reader's language.
 *
 * Two independent things, easy to conflate. The **timezone** is always
 * Europe/Zurich — Baden is in Europe/Zurich whatever your laptop thinks, and a
 * schedule that silently shifted by an hour because you planned it from a train
 * in another country would be worse than useless. The **locale** is whatever
 * language you are reading in, so weekdays read "Samstag" or "samedi".
 *
 * Everything here reads `festivalCore`, never the merged festival: the days and
 * the timezone are structure, and must not change when the language does.
 */
import { computed } from '@preact/signals';
import { locale } from './i18n/index.ts';
import { festivalCore } from './store.ts';

const TZ = festivalCore.edition.tz;

/** Intl formatters are expensive to build, so each one is made once per locale. */
function cached<T extends Intl.DateTimeFormatOptions>(options: T) {
  const byLocale = new Map<string, Intl.DateTimeFormat>();
  return (tag: string): Intl.DateTimeFormat => {
    let fmt = byLocale.get(tag);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat(tag, { timeZone: TZ, ...options });
      byLocale.set(tag, fmt);
    }
    return fmt;
  };
}

const timeFmt = cached({ hour: '2-digit', minute: '2-digit', hour12: false });
const weekdayFmt = cached({ weekday: 'long' });
const shortDayFmt = cached({ weekday: 'short', day: 'numeric', month: 'numeric' });
const dateFmt = cached({ dateStyle: 'medium' });

/** `19:30` — 24-hour everywhere, because a festival grid in am/pm is unreadable. */
export const time = (epoch: number): string =>
  timeFmt(locale.value).format(new Date(epoch * 1000));

/** `Saturday` / `Samstag` / `samedi` */
export const weekday = (epoch: number): string =>
  weekdayFmt(locale.value).format(new Date(epoch * 1000));

/** `Sat, 5/9` */
export const shortDay = (epoch: number): string =>
  shortDayFmt(locale.value).format(new Date(epoch * 1000));

/** A full date, for the "scraped on" line. */
export const date = (iso: string): string => dateFmt(locale.value).format(new Date(iso));

/**
 * `2026-09-05` — the festival-local calendar day, used to group things.
 * Locale-independent on purpose: it is a key, not a label.
 */
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export const dayKey = (epoch: number): string => dayKeyFmt.format(new Date(epoch * 1000));

/** `5.9.` — a day key rendered the way it is written in Switzerland. */
export function dayDotMonth(day: string): string {
  const [, month, dayOfMonth] = day.split('-');
  return `${Number(dayOfMonth)}.${Number(month)}.`;
}

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
  const guess = Date.UTC(y, m - 1, d, 12) / 1000;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(guess * 1000));
  const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return guess - hh * 3600 - mm * 60;
}

/** Epoch for a wall-clock time on a festival day. Hours may exceed 24 for
 *  "until 1am", which is how a festival night actually works. */
export const atHour = (day: string, hour: number, minute = 0): number =>
  midnightOf(day) + hour * 3600 + minute * 60;

/** Every calendar day the festival has a screening on, in order. */
export const festivalDays: string[] = [
  ...new Set(festivalCore.showings.map((s) => dayKey(s.start))),
].sort();

/**
 * When each festival day actually runs, so the availability editor can offer
 * "the whole day" without inventing hours nothing is screened in. The end is
 * allowed past midnight — late showings belong to the evening they started in.
 */
export const dayBounds: Record<string, { fromHour: number; toHour: number }> = (() => {
  const out: Record<string, { fromHour: number; toHour: number }> = {};
  for (const day of festivalDays) {
    const midnight = midnightOf(day);
    const onDay = festivalCore.showings.filter((s) => dayKey(s.start) === day);
    const first = Math.min(...onDay.map((s) => s.start));
    const last = Math.max(...onDay.map((s) => s.end));
    out[day] = {
      fromHour: Math.floor((first - midnight) / 3600),
      toHour: Math.ceil((last - midnight) / 3600),
    };
  }
  return out;
})();

/** Weekday names for the festival days, recomputed when the language changes. */
export const dayNames = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const day of festivalDays) out[day] = weekday(midnightOf(day) + 12 * 3600);
  return out;
});
