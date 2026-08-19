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
import type { FestivalCore, TextPack } from '../src/model/types.ts';
import { LANGS } from '../src/model/types.ts';

const YEAR = Number(process.env.FANTOCHE_YEAR ?? 2026);
const path = `data/fantoche-${YEAR}.json`;
const festival = JSON.parse(readFileSync(path, 'utf8')) as FestivalCore;
const packs = LANGS.map(
  (lang) => [lang, JSON.parse(readFileSync(`data/fantoche-${YEAR}.${lang}.json`, 'utf8')) as TextPack] as const,
);

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

// Titles and runtimes are what the app is actually made of; if the selectors
// silently stopped matching, these are the numbers that collapse first.
const withRuntime = blocks.filter((b) => b.durationMin !== undefined).length;
check(withRuntime >= blocks.length * 0.4, `only ${withRuntime}/${blocks.length} blocks have a runtime`);

// --------------------------------------------------------- language packs

const blockIdSet = new Set(blocks.map((b) => b.id));
const venueIdSet = new Set(venues.map((v) => v.id));

for (const [lang, pack] of packs) {
  check(pack.lang === lang, `${lang} pack is labelled "${pack.lang}"`);

  // A pack that has drifted from the structure is the failure mode that
  // matters: a missing block renders as a blank row, and a venue the structure
  // does not know about would silently never be scheduled.
  const missingBlocks = [...blockIdSet].filter((id) => !pack.blocks[id]);
  const extraBlocks = Object.keys(pack.blocks).filter((id) => !blockIdSet.has(id));
  check(missingBlocks.length === 0, `${lang} pack is missing ${missingBlocks.length} blocks`);
  check(extraBlocks.length === 0, `${lang} pack has ${extraBlocks.length} blocks the structure lacks`);

  const missingVenues = [...venueIdSet].filter((id) => !pack.venues[id]);
  check(missingVenues.length === 0, `${lang} pack is missing ${missingVenues.length} venue names`);

  const texts = Object.values(pack.blocks);
  check(texts.every((b) => b.title.length > 0), `a ${lang} block has no title`);
  check(texts.every((b) => b.category.length > 0), `a ${lang} block has no section`);
  check(texts.every((b) => b.url.startsWith('http')), `a ${lang} block has no detail URL`);

  const withFilmsOrCredits = texts.filter((b) => b.films.length > 0 || b.director).length;
  check(
    withFilmsOrCredits >= texts.length * 0.4,
    `only ${withFilmsOrCredits}/${texts.length} ${lang} blocks have films or credits`,
  );
}

// The point of scraping three languages is that they differ. If a path change
// quietly served the same page three times, that is worth failing on.
const categoriesOf = (pack: TextPack) =>
  [...new Set(Object.values(pack.blocks).map((b) => b.category))].sort().join('|');
const en = packs.find(([l]) => l === 'en')?.[1];
for (const [lang, pack] of packs) {
  if (lang === 'en' || !en) continue;
  check(categoriesOf(pack) !== categoriesOf(en), `the ${lang} pack is identical to English — wrong URL?`);
}

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
console.log(`✓ language packs: ${packs.map(([l, p]) => `${l} (${Object.keys(p.blocks).length})`).join(', ')}`);
