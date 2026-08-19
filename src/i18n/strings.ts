/**
 * UI strings, in the three languages Fantoche publishes.
 *
 * English is the source catalogue and its shape is the contract: `de` and `fr`
 * are typed as `Catalogue`, so leaving a key out — or giving an interpolating
 * one the wrong arguments — is a compile error rather than a blank label
 * someone notices at the festival.
 *
 * Swiss locales (`de-CH`, `fr-CH`) are deliberate: this is a Swiss festival, so
 * dates and numbers should read the way they do locally.
 */
import type { Lang } from '../model/types.ts';

export const LOCALE: Record<Lang, string> = {
  en: 'en-GB',
  de: 'de-CH',
  fr: 'fr-CH',
};

export const LANG_LABEL: Record<Lang, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
};

const en = {
  tabs: { films: 'Films', time: 'Time', plan: 'Plan', share: 'Share', setup: 'Setup' },
  nav: {
    sections: 'Sections',
    scheduled: (n: number) => `${n} programmes scheduled`,
    language: 'Language',
    theme: 'Appearance',
    themeSystem: 'Follow system',
    themeLight: 'Light',
    themeDark: 'Dark',
    toLight: 'Switch to light appearance',
    toDark: 'Switch to dark appearance',
  },

  people: {
    edit: (name: string) => `Edit ${name}'s wishlist and free time`,
    add: 'Add another person',
    addPrompt: 'Who else is coming?',
    planFor: 'Plan for',
    everyone: 'Everyone',
    alone: (name: string) => `${name} alone`,
    remove: 'Remove',
    removeConfirm: (name: string) => `Remove ${name} and their wishlist?`,
    nameOf: (name: string) => `Name of person ${name}`,
    marked: (marks: number, windows: number) => `${marks} marked · ${windows} windows`,
  },

  interest: {
    must: 'Must',
    want: 'Want',
    maybe: 'Maybe',
    mustHint: 'Do not miss this — outranks any number of maybes',
    wantHint: 'Would like to see it',
    maybeHint: 'Only if it fits a gap',
    group: (person: string, title: string) => `How much ${person} wants to see ${title}`,
    label: (level: string, title: string) => `${level} — ${title}`,
  },

  programme: {
    search: 'Search films, directors, sections…',
    searchLabel: 'Search films, directors and sections',
    allSections: 'All sections',
    allDays: 'All days',
    filterSection: 'Filter by section',
    filterDay: 'Filter by day',
    marked: 'Marked',
    count: (shown: number, total: number) => `${shown} of ${total} programmes`,
    films: (n: number) => `${n} films`,
    noMatch: 'Nothing matches',
    noMatchHint: 'Try a different section, day or search term.',
    onSite: 'On fantoche.ch ↗',
    toggle: (title: string, open: boolean) => `${title} — ${open ? 'hide' : 'show'} details`,
    closedNote: 'closed school screening, not open to the public',
    windowNote: 'drop in any time inside this window',
    plannedNote: 'in your plan',
  },

  time: {
    heading: (name: string) => `${name}'s free time`,
    unavailable: 'Not available',
    allDay: 'All day',
    fromFour: 'From 16:00',
    allDayLabel: (day: string) => `Free all day on ${day}`,
    fromFourLabel: (day: string) => `Free from 16:00 on ${day}`,
    to: 'to',
    freeFrom: (day: string) => `${day} — free from`,
    freeUntil: (day: string) => `${day} — free until`,
    addWindow: '+ window',
    addWindowLabel: (day: string) => `Add another free window on ${day}`,
    removeWindow: 'Remove this window',
    removeWindowLabel: (day: string, from: string, to: string) => `Remove ${day} ${from} to ${to}`,
    hours: (h: number) => `${h} hours available`,
    none: 'No free time set yet',
    copyToAll: 'Copy to everyone',
    clear: 'Clear all',
  },

  plan: {
    programmes: (n: number) => (n === 1 ? '1 programme' : `${n} programmes`),
    ofFilm: (d: string) => `${d} of film`,
    walking: (m: number) => `${m}′ walking`,
    noWalking: 'no walking between venues',
    forWhom: (names: string) => `for ${names}`,
    addToCalendar: 'Add to calendar',
    daySummary: (n: number, from: string, to: string) =>
      `${n === 1 ? '1 programme' : `${n} programmes`} · ${from}–${to}`,
    notProven:
      'This is the best schedule found within the time budget, but with this many films marked it could not be proven to be the best one. Marking fewer maybes makes the answer exact.',
    nothingMarked: 'Nothing marked yet',
    nothingMarkedHint: 'Go to Films and mark what you want to see. The schedule builds itself from there.',
    noSharedTime: 'No shared free time',
    noSharedTimeHint: (names: string) =>
      `Set when ${names} are each free under Time — this plan only uses hours you all have.`,
    noTimeHint: 'Set your free hours under Time.',
    nothingFits: 'Nothing fits',
    nothingFitsHint: 'None of the films you marked screen during your free hours.',
    dropIn: 'Drop in any time',
    dropInHint:
      'Exhibitions and pop-ups stay open for hours, so they are not scheduled as sit-down slots — fit them into a gap.',
    didNotFit: (n: number) => `Did not fit (${n})`,
    reasonUnavailable: 'Never screens while you are free',
    reasonClash: 'Clashes with something you wanted more',
    assumedEnd: (d: string) => `end time not published, ${d} assumed`,
    gapWalk: (m: number) => `${m}′ walk`,
    gapSamePlace: 'same building',
    gapSpare: (d: string) => `${d} to spare`,
    gapStraightOn: 'straight on',
    gap: (idle: number, parts: string) => `${idle}′ — ${parts}`,
    switchHint:
      'Together mode only uses hours everyone has free, and counts a film twice when you both want it.',
  },

  share: {
    sendTitle: 'Send your plan',
    sendBlurb:
      'Mark your films and set your free time, then send this to whoever you are going with. They load it, fill in their half, and send the whole thing back.',
    everyoneCount: (n: number) => `Everyone (${n})`,
    onlyMe: (name: string) => `Only ${name}`,
    copyLink: 'Copy share link',
    downloadFile: 'Download file',
    showLink: 'Show link',
    linkCopied: 'Link copied — paste it into a message.',
    linkCopiedLong: (n: number) =>
      `Copied, but it is a long link (${n} characters) — if it gets cut off in the chat, send the file instead.`,
    clipboardBlocked:
      'This browser would not let the page use the clipboard, so here is the link to copy yourself:',
    linkBoxLabel: 'Your share link — select and copy it',
    fragmentNote:
      'The link carries the plan in its own text — nothing is uploaded anywhere, and there is no server to lose it.',

    loadTitle: 'Load a plan',
    chooseFile: 'Choose file…',
    chooseFileLabel: 'Load a plan from a file',
    pasteToggle: 'Paste a link or code',
    pastePlaceholder: 'Paste the link or the code someone sent…',
    pasteLabel: 'Paste a shared link or plan code',
    mergeIt: 'Merge it in',
    mergeNote:
      'Loading merges: anyone new is added, and for someone already here the more recently edited copy wins. Your own work is never overwritten by an older copy of it.',

    backupTitle: 'Backup',
    downloadBackup: 'Download full backup',
    restoreBackup: 'Restore a backup…',
    restoreLabel: 'Restore everything from a backup file',
    restoreConfirm: 'Replace everything here with the contents of this backup?',
    backupNote:
      'A backup also carries your timing settings, and restoring one replaces everything rather than merging — for moving to a new browser, not for swapping plans with someone.',

    incomingFrom: (who: string) => `${who} sent you a plan`,
    incoming: 'A shared plan',
    incomingRegion: 'A shared plan has arrived',
    person: (name: string, marks: number, windows: number) =>
      `${name} (${marks} marked, ${windows} free ${windows === 1 ? 'window' : 'windows'})`,
    mergeIntoMine: 'Merge into mine',
    replaceAll: 'Replace everything',
    replaceConfirm: 'Throw away everything here and use only what is in this plan?',
    notNow: 'Not now',
    mergeExplain:
      'Merging keeps whichever copy of each person was edited most recently, so sending a plan back and forth never overwrites what you did in the meantime.',
    dismiss: 'Dismiss',
    unnamedSelf:
      'You are still called “Me” — rename yourself under Setup, then mark your own films and free time and send the whole thing back.',

    doneReplaced: (n: number) => `Replaced everything with ${n} people from the file.`,
    doneNothing: 'Nothing to change; you already had all of it.',
    doneAdded: (names: string) => `added ${names}`,
    doneUpdated: (names: string) => `updated ${names}`,
    doneKept: (names: string) => `kept your newer ${names}`,
    done: (parts: string) => `Done — ${parts}.`,
    wrongEdition: (theirs: string, ours: number) =>
      `This plan is for Fantoche ${theirs}, but this app has ${ours}. The films marked in it will not match.`,
    wrongEditionShort: (theirs: number, ours: number) =>
      `That plan is for Fantoche ${theirs}, not ${ours}.`,
    unreadable: 'That file could not be read.',
    clipboardFailed: 'Could not copy to the clipboard. Use the file instead.',
  },

  settings: {
    people: 'People',
    timing: 'Timing',
    buffer: 'Buffer between screenings',
    bufferHint: 'Slack on top of the walk — queueing, finding a seat, a coffee.',
    samePlace: 'Changing hall in the same building',
    samePlaceHint: 'Trafo 1 → Trafo 2, for instance. Counted instead of a walk.',
    walkSpeed: 'Walking speed',
    walkSpeedHint: 'Used with the distance between venues to work out the walk.',
    detour: 'Detour factor',
    detourHint: 'Streets are not straight lines. 1.35 is a reasonable town centre.',
    excludeClosed: 'Skip closed school screenings',
    excludeClosedHint: 'Some slots are reserved for school classes and not open to the public.',
    skipping: 'Skipping',
    including: 'Including',
    minutes: 'min',
    kmh: 'km/h',
    times: '×',
    numberLabel: (label: string, unit: string) => `${label} in ${unit}`,

    walkingTitle: 'Walking times',
    walkingBlurb: "Estimated from the venues' own coordinates. Override any that you know better.",
    hide: 'Hide',
    showPairs: (n: number) => `Show ${n} pairs`,
    resetPair: (n: number) => `Back to the estimated ${n} min`,
    reset: 'reset',
    pairLabel: (a: string, b: string) => `Walking minutes between ${a} and ${b}`,

    data: 'Data',
    langNote:
      'The programme itself — sections, synopses, venue names — comes from Fantoche in this language too, not just the buttons.',
    dataSummary: (blocks: number, showings: number, venues: number, places: number) =>
      `${blocks} programmes · ${showings} screenings · ${venues} venues in ${places} buildings.`,
    scrapedOn: (date: string) => `Scraped from fantoche.ch on ${date}.`,
    privacy:
      'Your wishlists and free time are stored in this browser only — no account, no server, nothing leaves the device.',
    shareLives: 'Sending your plan to someone, and backing it up, both live under Share.',
    resetTiming: 'Reset timing to defaults',
    deleteAll: 'Delete everything',
    deleteConfirm: 'Delete every person, wishlist and free-time window? This cannot be undone.',
  },
};

/**
 * The shape every language must satisfy. Deliberately *not* `as const`: the
 * literal types that would produce turn every translated string into a type
 * error, whereas what needs enforcing is the set of keys and each interpolating
 * function's signature.
 */
export type Catalogue = typeof en;

export { en };
