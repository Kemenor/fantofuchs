/**
 * Scrapes the Fantoche programme into `data/fantoche-<year>.json`.
 *
 * The festival site is server-rendered Pimcore, so everything we need is in
 * the HTML. Two pages carry the whole thing:
 *   /programme  — every showing, with its exact start epoch baked into the
 *                 favourite button's id (`favorite('3565_1788246000')`).
 *   /en/tickets-and-information/locations — one card per place, with lat/lon
 *                 in its Google Maps link.
 * Then one detail page per block for runtime and the film list.
 *
 * Run: npm run scrape        (NO_CACHE=1 to bypass the on-disk HTTP cache)
 */
import * as cheerio from 'cheerio';
import { mkdirSync, writeFileSync } from 'node:fs';
import { get, pool } from './fetch-cache.ts';
import type { Block, Festival, Film, Place, Showing, Venue } from '../src/model/types.ts';

const ORIGIN = 'https://fantoche.ch';
const YEAR = Number(process.env.FANTOCHE_YEAR ?? 2026);
/** Fallback when a block has no printed runtime, so it still occupies time. */
const DEFAULT_DURATION_MIN = 90;
const TZ = 'Europe/Zurich';

const clean = (s: string | undefined): string =>
  (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const slug = (s: string): string =>
  s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** `68'` / `1h 12'` / `72 min` -> minutes. */
function parseMinutes(text: string): number | undefined {
  const t = clean(text);
  const h = t.match(/(\d+)\s*h\s*(\d+)?/i);
  if (h) return Number(h[1]) * 60 + Number(h[2] ?? 0);
  const m = t.match(/(\d+)\s*(?:'|min)/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * Pull a closing time out of an appointment heading. Most read
 * `Tue 1.9. • 19:30`; open-ended events read `Sat 5.9. • 12:00 - 20:00`.
 * Returns minutes-after-midnight for the end, when one is printed.
 */
function parseEndOfDayMinutes(timeText: string): number | undefined {
  const m = clean(timeText).match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
  return m ? Number(m[3]) * 60 + Number(m[4]) : undefined;
}

// --------------------------------------------------------------- locations

async function scrapePlaces(): Promise<Place[]> {
  const $ = cheerio.load(await get(`${ORIGIN}/en/tickets-and-information/locations`));
  const places: Place[] = [];
  const seen = new Set<string>();

  $('div.card').each((_, card) => {
    const $c = $(card);
    const name = clean($c.find('h5.card-title').first().text());
    const href = $c.find('a[href*="google.com/maps"]').first().attr('href') ?? '';
    const coord = href.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (!name || !coord) return;

    // The address paragraph is "Street 1, 5400 Baden<br>Bus stop «X»".
    const lines = clean($c.find('p').first().html()?.replace(/<br\s*\/?>/gi, '\n') ?? '')
      .split('\n').map(clean).filter(Boolean);
    const raw = $c.find('p').first().html() ?? '';
    const parts = raw.split(/<br\s*\/?>/i).map((p) => clean(cheerio.load(`<x>${p}</x>`)('x').text()));

    const id = slug(name);
    if (seen.has(id)) return;
    seen.add(id);
    places.push({
      id,
      name,
      address: parts[0] ?? lines[0] ?? '',
      transit: parts[1] || undefined,
      lat: Number(coord[1]),
      lon: Number(coord[2]),
    });
  });
  return places;
}

// --------------------------------------------------------------- programme

interface RawItem {
  blockId: string;
  url: string;
  title: string;
  category: string;
  venueName: string;
  showingIds: string[];
}

function scrapeListing(html: string): RawItem[] {
  const $ = cheerio.load(html);
  const items: RawItem[] = [];

  $('.program-item-row').each((_, row) => {
    const $r = $(row);
    const href = $r.find('a[href*="~prg"]').first().attr('href') ?? '';
    const blockId = href.match(/~(prg\d+)/)?.[1];
    if (!blockId) return;

    // Each row renders its favourite button twice (mobile + desktop); the id
    // `f_<n>_<epoch>` is the same, so dedupe.
    const showingIds = [
      ...new Set(
        $r.find('[id^="f_"]').map((_i, el) => ($(el).attr('id') ?? '').slice(2)).get(),
      ),
    ];

    items.push({
      blockId,
      url: ORIGIN + href,
      title: clean($r.find('h2').first().text()),
      category: clean($r.find('.program-listing-category-title').first().text()),
      venueName: clean($r.find('a[href*="locations"]').first().text()),
      showingIds,
    });
  });
  return items;
}

// ------------------------------------------------------------ block detail

/**
 * Read `<span class="fw-bold">Label</span><span class="fw-light">Value</span>`
 * pairs, falling back to the parent's own text for the film-card variant where
 * the value is a bare text node.
 */
function readLabels($: cheerio.CheerioAPI, $scope: cheerio.Cheerio<any>): Map<string, string> {
  const out = new Map<string, string>();
  $scope.find('span.fw-bold').each((_, lab) => {
    const key = clean($(lab).text()).toLowerCase();
    if (!key) return;
    const sibling = clean($(lab).next('span.fw-light').text());
    const own = clean($(lab).parent().clone().children().remove().end().text());
    const value = sibling || own;
    if (value && !out.has(key)) out.set(key, value);
  });
  return out;
}

/** `JP, 1994` / `Switzerland 2026` -> country and year. */
function splitCountryYear(value: string): { country?: string; year?: number } {
  const m = clean(value).match(/^(.*?)[,\s]+(\d{4})$/);
  if (m) return { country: clean(m[1]) || undefined, year: Number(m[2]) };
  return { country: clean(value) || undefined };
}

interface Detail {
  durationMin?: number;
  synopsis?: string;
  imageUrl?: string;
  synopsisHtml?: string;
  director?: string;
  country?: string;
  year?: number;
  ageRating?: number;
  badges: string[];
  films: Film[];
  /** showingId -> what the block's own appointment list says about it. */
  apptByShowing: Map<string, { venue: string; timeText: string }>;
}

function scrapeDetail(html: string): Detail {
  const $ = cheerio.load(html);

  // The festival prints a row of bordered badges: language version, subtitles,
  // age rating, runtime. Only the runtime is structured; keep the rest verbatim.
  let durationMin: number | undefined;
  let ageRating: number | undefined;
  const badges: string[] = [];
  $('span.border').each((_, el) => {
    const text = clean($(el).text());
    if (!text) return;
    const mins = parseMinutes(text);
    if (mins !== undefined && durationMin === undefined) {
      durationMin = mins;
      return;
    }
    const age = text.match(/^(\d+)\+$/);
    if (age) ageRating ??= Number(age[1]);
    badges.push(text);
  });

  // Each appointment is a flex row holding the favourite button, the date/time
  // heading and a venue link. Open-ended events print a range there
  // ("Sat 5.9. • 12:00 - 20:00"), which is the only end time we ever get.
  const apptByShowing = new Map<string, { venue: string; timeText: string }>();
  $('[id^="f_"]').each((_, el) => {
    const id = ($(el).attr('id') ?? '').slice(2);
    if (!id || apptByShowing.has(id)) return;
    const $appt = $(el).closest('.d-flex').parent();
    apptByShowing.set(id, {
      venue: clean($appt.find('a[href*="locations"]').first().text()),
      timeText: clean($appt.find('h5').first().text()),
    });
  });

  const films: Film[] = [];
  $('div.card').each((_, card) => {
    const $c = $(card);
    const title = clean($c.find('h5.card-title').first().text());
    if (!title) return;

    const film: Film = { title };
    film.credit = clean($c.find('.copyright-div').first().text()) || undefined;

    const labels = readLabels($, $c);
    film.director = labels.get('direction');
    film.durationMin = parseMinutes(labels.get('duration') ?? '');
    film.language = labels.get('language');
    const cy = splitCountryYear(labels.get('country') ?? '');
    film.country = cy.country;
    film.year = Number(labels.get('year')) || cy.year;

    // The synopsis is the card body's own text, before the labelled spans.
    const body = $c.find('.card-body').first().clone();
    body.find('h5, span').remove();
    film.synopsis = clean(body.text()) || undefined;
    films.push(film);
  });

  // A feature film has no film card — its credits sit in the "Info" block.
  const $blockScope = $('body').clone();
  $blockScope.find('div.card').remove();
  const info = readLabels($, $blockScope);
  const cy = splitCountryYear(info.get('country') ?? '');

  return {
    durationMin: durationMin ?? parseMinutes(info.get('duration') ?? ''),
    director: info.get('direction'),
    country: cy.country,
    year: cy.year,
    ageRating,
    badges,
    synopsis: clean($('.lead').first().text()) || undefined,
    imageUrl: $('img.img-fluid').first().attr('src') ?? undefined,
    films,
    apptByShowing,
  };
}

// ------------------------------------------------------------------ venues

/** `Cinema Trafo 2 (Geschlossene Schulvorstellung)` -> venue + closed flag. */
function parseVenueName(raw: string): { name: string; closed: boolean } {
  let name = clean(raw);
  const closed = /geschlossene\s+schulvorstellung/i.test(name);
  name = clean(name.replace(/\((?:[^)]*schulvorstellung[^)]*)\)/gi, '')).replace(/\*+$/, '');
  return { name: clean(name), closed };
}

/**
 * Match a venue to its place. Venue names are the place name plus a hall
 * ("Cinema Trafo 2"), so the longest place name that prefixes the venue wins.
 */
function resolvePlace(venueName: string, places: Place[]): { placeId: string; hall?: string } {
  const candidates = places
    .filter((p) => venueName.toLowerCase().startsWith(p.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length);
  if (candidates.length) {
    const p = candidates[0];
    const hall = clean(venueName.slice(p.name.length)) || undefined;
    return { placeId: p.id, hall };
  }
  // Venues the locations page words differently ("Trafo, Hertz" vs
  // "Trafo hall 36.2 + Hertz") fall back to a token overlap.
  const tokens = (s: string) => new Set(slug(s).split('-').filter((t) => t.length > 2));
  const want = tokens(venueName);
  let best: { p: Place; score: number } | undefined;
  for (const p of places) {
    const score = [...tokens(p.name)].filter((t) => want.has(t)).length;
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best ? { placeId: best.p.id } : { placeId: slug(venueName) };
}

/** Minutes after local midnight for an epoch, in the festival's timezone. */
function startMinutesOfDay(epoch: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(epoch * 1000));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

// -------------------------------------------------------------------- main

async function main(): Promise<void> {
  console.log('Fetching locations…');
  const places = await scrapePlaces();
  console.log(`  ${places.length} places`);

  console.log('Fetching programme…');
  const items = scrapeListing(await get(`${ORIGIN}/programme`));
  console.log(`  ${items.length} listing rows`);

  // One row per showing; collapse to one entry per block, keeping every URL.
  const byBlock = new Map<string, RawItem>();
  for (const it of items) {
    const prev = byBlock.get(it.blockId);
    if (prev) prev.showingIds.push(...it.showingIds);
    else byBlock.set(it.blockId, { ...it });
  }
  console.log(`  ${byBlock.size} blocks`);

  const list = [...byBlock.values()];
  console.log('Fetching block details…');
  const details = await pool(list, 4, async (it, i) => {
    if (i % 20 === 0) process.stdout.write(`  ${i}/${list.length}\r`);
    return scrapeDetail(await get(it.url));
  });
  console.log(`  ${list.length}/${list.length} done`);

  // Venue and time come from the listing row and from each block's appointment
  // list; the latter is per-showing, so prefer it.
  const apptFor = new Map<string, { venue: string; timeText: string }>();
  list.forEach((it, i) => {
    for (const sid of new Set(it.showingIds)) {
      const a = details[i].apptByShowing.get(sid);
      apptFor.set(sid, { venue: a?.venue || it.venueName, timeText: a?.timeText ?? '' });
    }
  });

  const venues = new Map<string, Venue>();
  const showings: Showing[] = [];
  const blocks: Block[] = [];

  list.forEach((it, i) => {
    const d = details[i];

    blocks.push({
      id: it.blockId,
      title: it.title,
      category: it.category,
      durationMin: d.durationMin,
      synopsis: d.synopsis,
      url: it.url,
      imageUrl: d.imageUrl ? (d.imageUrl.startsWith('http') ? d.imageUrl : ORIGIN + d.imageUrl) : undefined,
      director: d.director,
      country: d.country,
      year: d.year,
      ageRating: d.ageRating,
      badges: d.badges,
      films: d.films,
    });

    for (const sid of new Set(it.showingIds)) {
      const epoch = Number(sid.split('_')[1]);
      if (!Number.isFinite(epoch)) continue;

      const appt = apptFor.get(sid);
      const { name, closed } = parseVenueName(appt?.venue ?? it.venueName);
      const { placeId, hall } = resolvePlace(name, places);
      const venueId = slug(name);
      if (!venues.has(venueId)) venues.set(venueId, { id: venueId, name, placeId, hall });

      // Prefer a printed closing time, then the printed runtime, then a guess.
      const endMin = parseEndOfDayMinutes(appt?.timeText ?? '');
      let end: number;
      let endSource: Showing['endSource'];
      if (endMin !== undefined) {
        const startOfDay = epoch - (startMinutesOfDay(epoch) * 60);
        end = startOfDay + endMin * 60;
        if (end <= epoch) end += 24 * 3600; // range crossing midnight
        endSource = 'published';
      } else if (d.durationMin !== undefined) {
        end = epoch + d.durationMin * 60;
        endSource = 'runtime';
      } else {
        end = epoch + DEFAULT_DURATION_MIN * 60;
        endSource = 'assumed';
      }

      showings.push({
        id: sid,
        blockId: it.blockId,
        venueId,
        start: epoch,
        end,
        endSource,
        ...(closed ? { closed: true } : {}),
      });
    }
  });

  showings.sort((a, b) => a.start - b.start || a.venueId.localeCompare(b.venueId));
  blocks.sort((a, b) => a.title.localeCompare(b.title));

  const dayOf = (epoch: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, dateStyle: 'short' }).format(new Date(epoch * 1000));
  const days = [...new Set(showings.map((s) => dayOf(s.start)))].sort();

  const festival: Festival = {
    edition: {
      year: YEAR,
      title: `Fantoche ${YEAR}`,
      firstDay: days[0],
      lastDay: days[days.length - 1],
      tz: TZ,
    },
    scrapedAt: new Date().toISOString(),
    source: `${ORIGIN}/programme`,
    places,
    venues: [...venues.values()].sort((a, b) => a.name.localeCompare(b.name)),
    blocks,
    showings,
  };

  mkdirSync('data', { recursive: true });
  const out = `data/fantoche-${YEAR}.json`;
  writeFileSync(out, JSON.stringify(festival, null, 2) + '\n');

  const bySource = { published: 0, runtime: 0, assumed: 0 };
  for (const s of showings) bySource[s.endSource]++;
  console.log(`\nWrote ${out}`);
  console.log(`  ${festival.places.length} places, ${festival.venues.length} venues`);
  console.log(`  ${blocks.length} blocks, ${showings.length} showings, ${days.length} days (${days[0]} … ${days.at(-1)})`);
  console.log(`  end times: ${bySource.published} published, ${bySource.runtime} from runtime, ${bySource.assumed} assumed (${DEFAULT_DURATION_MIN}′)`);
}

await main();
