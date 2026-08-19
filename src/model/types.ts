/**
 * Fantofuchs data model.
 *
 * Two halves that meet in the optimizer:
 *  - the *festival* (scraped, immutable, shipped as JSON): places, venues,
 *    blocks, showings.
 *  - the *plan* (yours, in localStorage): people, availability, interest.
 *
 * All times are stored as epoch seconds. The festival lives in one timezone
 * (Europe/Zurich) and never crosses a DST boundary, so a plain epoch + the
 * edition's `tz` is enough — no date library.
 *
 * The festival half splits again, by language. Fantoche publishes the whole
 * programme in German, English and French, and the *text* differs — section
 * names, some titles, every synopsis, and, importantly, the venue names
 * ("Orient Cinema" / "Kino Orient" / "Cinéma Orient"). What does **not** differ
 * is the structure: identical block ids, identical screening ids, identical
 * times. So the structure is scraped once from one canonical language
 * (`FestivalCore`) and only the words are scraped per language (`TextPack`).
 *
 * That split is a correctness requirement, not a size optimisation. Scraping
 * each language end to end would derive venue ids from translated names, so the
 * travel matrix — and therefore the schedule itself — could come out different
 * depending on which language you happened to be reading in.
 */

/** The languages Fantoche publishes, and therefore the ones offered here. */
export type Lang = 'en' | 'de' | 'fr';

export const LANGS: Lang[] = ['en', 'de', 'fr'];

/** The language the structure is scraped from; its ids are canonical. */
export const CANONICAL_LANG: Lang = 'en';

// ---------------------------------------------------------------- festival

/** A physical address. Several `Venue`s can share one (Trafo halls 1/2/3). */
export interface Place {
  id: string;
  name: string;
  address: string;
  /** Public-transport hint as printed by the festival, if any. */
  transit?: string;
  lat: number;
  lon: number;
}

/** A room you actually sit in, minus its (translated) display name. */
export interface VenueCore {
  id: string;
  placeId: string;
  /** Hall number within the place, when the venue is one of several. */
  hall?: string;
}

/** A venue with the name for the language currently being read. */
export interface Venue extends VenueCore {
  name: string;
}

/** One film inside a block. Entirely text, so it lives in the language pack. */
export interface Film {
  title: string;
  /** The "Title, Director, CC Year" credit line as printed. */
  credit?: string;
  director?: string;
  durationMin?: number;
  country?: string;
  year?: number;
  language?: string;
  synopsis?: string;
}

/**
 * The language-independent half of a programme block: numbers and the image.
 */
export interface BlockCore {
  /** Festival id, e.g. `prg4327`. Stable across the edition and all languages. */
  id: string;
  /** Total runtime in minutes as printed by the festival. */
  durationMin?: number;
  /** Minimum age as printed, e.g. `12` for a `12+` badge. */
  ageRating?: number;
  year?: number;
  imageUrl?: string;
}

/** Everything about a block that is words, and therefore per language. */
export interface BlockText {
  title: string;
  category: string;
  synopsis?: string;
  /** The detail page in this language. */
  url: string;
  /**
   * Credits for a block that *is* one film (features carry these instead of a
   * film list). Empty for shorts programmes — read `films` there.
   */
  director?: string;
  country?: string;
  /**
   * The bordered badges the festival prints: language version (`OV/e`),
   * subtitles (`german subtitles`), spoken language. Kept verbatim because
   * their vocabulary is not worth modelling — and translated, hence here.
   */
  badges: string[];
  films: Film[];
}

/**
 * A programme block — the unit you buy a ticket for and the unit the optimizer
 * picks. Either one feature or a curated set of shorts. This is the merged
 * shape everything above the data layer works with.
 */
export interface Block extends BlockCore, BlockText {}

/** One screening of one block, at one time, in one venue. */
export interface Showing {
  /** Festival id, `<blockNumber>_<epoch>`, e.g. `4327_1788283800`. */
  id: string;
  blockId: string;
  venueId: string;
  /** Epoch seconds, start of the screening. */
  start: number;
  /** Epoch seconds. See `endSource` for how firmly this is known. */
  end: number;
  /**
   * Where `end` came from:
   *  - `published` — the festival printed a time range (`12:00 - 20:00`),
   *    typical for exhibitions and pop-ups.
   *  - `runtime`   — start plus the block's printed runtime.
   *  - `assumed`   — neither was published (talks, brunches); a default was
   *    used, so the UI must say so rather than pretend.
   */
  endSource: 'published' | 'runtime' | 'assumed';
  /** True for `Geschlossene Schulvorstellung` — closed school screenings. */
  closed?: boolean;
}

export interface Edition {
  year: number;
  title: string;
  /** ISO dates of the first and last festival day. */
  firstDay: string;
  lastDay: string;
  tz: string;
}

/**
 * The structure, scraped once. `data/fantoche-<year>.json`.
 */
export interface FestivalCore {
  edition: Edition;
  scrapedAt: string;
  source: string;
  /** Coordinates and addresses — proper nouns, so not translated. */
  places: Place[];
  venues: VenueCore[];
  blocks: BlockCore[];
  showings: Showing[];
}

/** The words, per language. `data/fantoche-<year>.<lang>.json`. */
export interface TextPack {
  lang: Lang;
  scrapedAt: string;
  source: string;
  /** Canonical venue id -> the name in this language. */
  venues: Record<string, string>;
  /** Block id -> its text in this language. */
  blocks: Record<string, BlockText>;
}

/**
 * Core plus one language pack: what the optimizer and the whole UI consume.
 * Assembled in the store when the language changes.
 */
export interface Festival {
  edition: Edition;
  scrapedAt: string;
  source: string;
  lang: Lang;
  places: Place[];
  venues: Venue[];
  blocks: Block[];
  showings: Showing[];
}

// -------------------------------------------------------------------- plan

/**
 * How much someone wants to see a block. The optimizer maximises the sum of
 * these, so the gaps between levels decide the trade-offs: one `must` always
 * beats any number of `maybe`s.
 */
export type Interest = 'must' | 'want' | 'maybe' | 'no';

export const INTEREST_WEIGHT: Record<Interest, number> = {
  must: 1000,
  want: 50,
  maybe: 8,
  no: 0,
};

/** A window in which one person is free. Epoch seconds, half-open [from, to). */
export interface Slot {
  from: number;
  to: number;
}

export interface Person {
  id: string;
  name: string;
  /** Colour token used to tint this person's rows. */
  color: string;
  slots: Slot[];
  interest: Record<string, Interest>;
  /**
   * When this person was last edited, in epoch milliseconds.
   *
   * The reason plans can be passed back and forth. When a shared file arrives
   * carrying a copy of someone who already exists here, this decides which copy
   * survives — so your brother returning the file with his half filled in
   * cannot overwrite the changes you made to your own half while he had it.
   */
  updatedAt: number;
}

export interface Settings {
  /** Minutes of slack to leave on top of travel between two screenings. */
  bufferMin: number;
  /** Minutes to allow when changing hall inside the same building. */
  samePlaceMin: number;
  /** Walking speed in km/h, used for the travel matrix. */
  walkKmh: number;
  /** Straight-line distance is multiplied by this to approximate streets. */
  detourFactor: number;
  /** Hand-tuned overrides, keyed `placeA|placeB`, in minutes. */
  travelOverrides: Record<string, number>;
  /** Skip closed school screenings when planning. */
  excludeClosed: boolean;
}
