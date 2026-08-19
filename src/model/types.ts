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
 */

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

/** A room you actually sit in. What a showing points at. */
export interface Venue {
  id: string;
  name: string;
  placeId: string;
  /** Hall number within the place, when the venue is one of several. */
  hall?: string;
}

/** One film inside a block. */
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
 * A programme block — the unit you buy a ticket for and the unit the
 * optimizer picks. Either one feature or a curated set of shorts.
 */
export interface Block {
  /** Festival id, e.g. `prg4327`. Stable across the edition. */
  id: string;
  title: string;
  category: string;
  /** Total runtime in minutes as printed by the festival. */
  durationMin?: number;
  synopsis?: string;
  url: string;
  imageUrl?: string;
  /**
   * Credits for a block that *is* one film (features carry these instead of a
   * film list). Empty for shorts programmes — read `films` there.
   */
  director?: string;
  country?: string;
  year?: number;
  /** Minimum age as printed, e.g. `12` for a `12+` badge. */
  ageRating?: number;
  /**
   * The bordered badges the festival prints: language version (`OV/e`),
   * subtitles (`german subtitles`), spoken language, age rating. Kept verbatim
   * because their vocabulary is not worth modelling.
   */
  badges: string[];
  films: Film[];
}

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

/** The whole scraped festival. One JSON file, committed to the repo. */
export interface Festival {
  edition: {
    year: number;
    title: string;
    /** ISO dates of the first and last festival day. */
    firstDay: string;
    lastDay: string;
    tz: string;
  };
  scrapedAt: string;
  source: string;
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
