/**
 * Export a plan as an .ics file, so the schedule ends up in the phone calendar
 * you will actually be looking at while running between cinemas.
 *
 * Hand-rolled rather than pulled from a library: the format is a dozen lines,
 * and the only genuinely fiddly parts are escaping and the 75-octet line fold,
 * both of which are handled below.
 */
import type { Plan } from './model/optimize.ts';
import type { Festival } from './model/types.ts';

const stamp = (epoch: number): string =>
  new Date(epoch * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Escape per RFC 5545: backslash, semicolon, comma and newline are special. */
const esc = (text: string): string =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * Fold to 75 octets per line. Counting *bytes* matters — film titles carry
 * accents, and folding on characters would split a multi-byte one and corrupt
 * the file.
 */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let chunk = '';
  let used = 0;
  let limit = 75;
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    if (used + size > limit) {
      out.push(chunk);
      chunk = ch;
      used = size + 1; // the leading space on a continuation line
      limit = 75;
    } else {
      chunk += ch;
      used += size;
    }
  }
  out.push(chunk);
  return out.join('\r\n ');
}

export function planToIcs(plan: Plan, festival: Festival): string {
  const venues = new Map(festival.venues.map((v) => [v.id, v]));
  const places = new Map(festival.places.map((p) => [p.id, p]));
  const now = stamp(Math.floor(Date.now() / 1000));

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kemenor//Fantofuchs//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(festival.edition.title)}`,
  ];

  const events = [
    ...plan.items.map((it) => ({ showing: it.showing, block: it.block, travelMin: it.travelMin })),
    ...plan.openWindows.map((o) => ({ showing: o.showing, block: o.block, travelMin: 0 })),
  ];

  for (const { showing, block, travelMin } of events) {
    const venue = venues.get(showing.venueId);
    const place = venue ? places.get(venue.placeId) : undefined;
    const location = [venue?.name, place?.address].filter(Boolean).join(', ');

    const description = [
      block.films.length > 0
        ? block.films.map((f) => `• ${f.title}${f.durationMin ? ` (${f.durationMin}′)` : ''}`).join('\n')
        : block.synopsis ?? '',
      travelMin > 0 ? `\nAllow ${travelMin} min to walk here.` : '',
      `\n${block.url}`,
    ].join('\n').trim();

    lines.push(
      'BEGIN:VEVENT',
      `UID:${showing.id}@fantofuchs`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(showing.start)}`,
      `DTEND:${stamp(showing.end)}`,
      fold(`SUMMARY:${esc(block.title)}`),
      fold(`LOCATION:${esc(location)}`),
      fold(`DESCRIPTION:${esc(description)}`),
      fold(`URL:${block.url}`),
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** Hand the file to the browser. */
export function downloadIcs(filename: string, ics: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
