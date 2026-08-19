/**
 * Guards the scraper's output before CI commits it.
 *
 * The festival site is a CMS we do not control: a template change could turn a
 * selector into a no-op and quietly produce a valid-looking JSON with no
 * screenings in it. Committing that would replace a working programme with an
 * empty one and the app would show nothing, so the scrape job fails loudly here
 * instead. The thresholds are deliberately loose — they catch a parser that
 * broke, not a festival that changed its line-up.
 */
import { readFileSync } from 'node:fs';
import type { Festival } from '../src/model/types.ts';

const YEAR = Number(process.env.FANTOCHE_YEAR ?? 2026);
const path = `data/fantoche-${YEAR}.json`;
const festival = JSON.parse(readFileSync(path, 'utf8')) as Festival;

const problems: string[] = [];
const check = (ok: boolean, message: string): void => {
  if (!ok) problems.push(message);
};

const { blocks, showings, venues, places } = festival;

check(blocks.length >= 50, `only ${blocks.length} programme blocks (expected 50+)`);
check(showings.length >= 120, `only ${showings.length} screenings (expected 120+)`);
check(venues.length >= 8, `only ${venues.length} venues (expected 8+)`);
check(places.length >= 8, `only ${places.length} places (expected 8+)`);

check(
  places.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
  'a place is missing coordinates, so travel times would be guessed',
);
check(
  places.every((p) => p.lat > 47 && p.lat < 48 && p.lon > 8 && p.lon < 9),
  'a place is nowhere near Baden — coordinates were probably parsed wrong',
);

const venueIds = new Set(venues.map((v) => v.id));
const blockIds = new Set(blocks.map((b) => b.id));
check(showings.every((s) => venueIds.has(s.venueId)), 'a screening points at an unknown venue');
check(showings.every((s) => blockIds.has(s.blockId)), 'a screening points at an unknown block');
check(
  venues.every((v) => places.some((p) => p.id === v.placeId)),
  'a venue points at an unknown place',
);

check(new Set(showings.map((s) => s.id)).size === showings.length, 'duplicate screening ids');
check(showings.every((s) => s.end > s.start), 'a screening ends before it starts');
check(blocks.every((b) => b.title.length > 0), 'a block has no title');

// Titles and runtimes are what the app is actually made of; if the selectors
// silently stopped matching, these are the numbers that collapse first.
const withRuntime = blocks.filter((b) => b.durationMin !== undefined).length;
check(withRuntime >= blocks.length * 0.4, `only ${withRuntime}/${blocks.length} blocks have a runtime`);

const withFilmsOrCredits = blocks.filter((b) => b.films.length > 0 || b.director).length;
check(
  withFilmsOrCredits >= blocks.length * 0.4,
  `only ${withFilmsOrCredits}/${blocks.length} blocks have films or credits`,
);

const days = new Set(showings.map((s) => new Date(s.start * 1000).toISOString().slice(0, 10)));
check(days.size >= 4, `only ${days.size} festival days (expected 4+)`);

if (problems.length > 0) {
  console.error(`✗ ${path} failed verification:`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `✓ ${path}: ${blocks.length} blocks, ${showings.length} screenings, ` +
    `${venues.length} venues, ${days.size} days.`,
);
