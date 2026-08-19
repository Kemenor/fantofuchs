/**
 * All the state that is yours rather than the festival's: who is planning,
 * when they are free, what they want to see, and the knobs.
 *
 * It lives in localStorage and nowhere else — no account, no server, in
 * keeping with the rest of the fuchs apps. The festival data is read-only and
 * ships with the build, so everything here is small enough to serialise whole
 * on every change.
 */
import { computed, effect, signal } from '@preact/signals';
import type { Festival, Interest, Person, Settings, Slot } from './model/types.ts';
import { INTEREST_WEIGHT } from './model/types.ts';
import { TravelMatrix } from './model/travel.ts';
import { intersectSlots, mergeSlots, optimize, type Plan } from './model/optimize.ts';
import festivalData from '../data/fantoche-2026.json';

export const festival = festivalData as unknown as Festival;

const STORAGE_KEY = 'fantofuchs.v1';

/** Person tints, in order of assignment. The Fuchsbau triad, minus the orange
 *  that the app itself uses for its own accents. */
const PERSON_COLORS = ['#8559D0', '#1FA85D', '#E0A33B', '#3B8FE0'];

export const DEFAULT_SETTINGS: Settings = {
  bufferMin: 10,
  samePlaceMin: 3,
  walkKmh: 4.5,
  detourFactor: 1.35,
  travelOverrides: {},
  excludeClosed: true,
};

export interface Stored {
  version: 1;
  people: Person[];
  settings: Settings;
  /** `together` plans what everyone can attend; `solo` plans for one person. */
  mode: 'together' | 'solo';
  activePersonId: string;
}

function freshPerson(name: string, index: number): Person {
  return {
    id: `p${Date.now().toString(36)}${index}`,
    name,
    color: PERSON_COLORS[index % PERSON_COLORS.length],
    slots: [],
    interest: {},
  };
}

function initial(): Stored {
  const me = freshPerson('Me', 0);
  return { version: 1, people: [me], settings: { ...DEFAULT_SETTINGS }, mode: 'together', activePersonId: me.id };
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial();
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.version !== 1 || !parsed.people?.length) return initial();
    // Settings gain keys as the app grows; fill in anything an older save lacks.
    parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
    if (!parsed.people.some((p) => p.id === parsed.activePersonId)) {
      parsed.activePersonId = parsed.people[0].id;
    }
    return parsed;
  } catch {
    return initial();
  }
}

export const state = signal<Stored>(load());

effect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.value));
  } catch {
    // A full or blocked storage quota must not take the app down; the plan is
    // still usable for this session, it just will not survive a reload.
  }
});

/** Replace the store, keeping it immutable so signals actually fire. */
export function update(fn: (s: Stored) => Stored): void {
  state.value = fn(state.value);
}

function mapPerson(id: string, fn: (p: Person) => Person): void {
  update((s) => ({ ...s, people: s.people.map((p) => (p.id === id ? fn(p) : p)) }));
}

// ------------------------------------------------------------------ people

export const people = computed(() => state.value.people);
export const activePerson = computed(
  () => state.value.people.find((p) => p.id === state.value.activePersonId) ?? state.value.people[0],
);
export const settings = computed(() => state.value.settings);
export const mode = computed(() => state.value.mode);

export function addPerson(name: string): void {
  update((s) => {
    const person = freshPerson(name.trim() || `Person ${s.people.length + 1}`, s.people.length);
    return { ...s, people: [...s.people, person], activePersonId: person.id };
  });
}

export function removePerson(id: string): void {
  update((s) => {
    if (s.people.length <= 1) return s;
    const people = s.people.filter((p) => p.id !== id);
    return { ...s, people, activePersonId: s.activePersonId === id ? people[0].id : s.activePersonId };
  });
}

export function renamePerson(id: string, name: string): void {
  mapPerson(id, (p) => ({ ...p, name }));
}

export function setActivePerson(id: string): void {
  update((s) => ({ ...s, activePersonId: id }));
}

export function setMode(next: Stored['mode']): void {
  update((s) => ({ ...s, mode: next }));
}

// --------------------------------------------------------------- interest

export function setInterest(personId: string, blockId: string, value: Interest): void {
  mapPerson(personId, (p) => {
    const interest = { ...p.interest };
    if (value === 'no') delete interest[blockId];
    else interest[blockId] = value;
    return { ...p, interest };
  });
}

export function interestOf(personId: string, blockId: string): Interest {
  return state.value.people.find((p) => p.id === personId)?.interest[blockId] ?? 'no';
}

/** Everyone who marked this block, for the little dots on a programme row. */
export function interestedIn(blockId: string): { person: Person; interest: Interest }[] {
  return state.value.people
    .map((person) => ({ person, interest: person.interest[blockId] ?? ('no' as Interest) }))
    .filter((x) => x.interest !== 'no');
}

// ----------------------------------------------------------- availability

export function setSlots(personId: string, slots: Slot[]): void {
  mapPerson(personId, (p) => ({ ...p, slots: mergeSlots(slots) }));
}

export function addSlot(personId: string, slot: Slot): void {
  mapPerson(personId, (p) => ({ ...p, slots: mergeSlots([...p.slots, slot]) }));
}

export function removeSlot(personId: string, index: number): void {
  mapPerson(personId, (p) => ({ ...p, slots: p.slots.filter((_, i) => i !== index) }));
}

/** Copy one person's availability onto everyone else — the common case. */
export function copySlotsToAll(personId: string): void {
  update((s) => {
    const source = s.people.find((p) => p.id === personId);
    if (!source) return s;
    return { ...s, people: s.people.map((p) => ({ ...p, slots: source.slots.map((x) => ({ ...x })) })) };
  });
}

// ---------------------------------------------------------------- settings

export function setSettings(patch: Partial<Settings>): void {
  update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function resetEverything(): void {
  state.value = initial();
}

// ------------------------------------------------------------------- plan

export const travelMatrix = computed(() => new TravelMatrix(festival, state.value.settings));

/** Who the current plan is for: everyone, or just the selected person. */
export const planningFor = computed(() =>
  state.value.mode === 'together' ? state.value.people : [activePerson.value],
);

/** Free time everyone in `planningFor` shares. */
export const planSlots = computed<Slot[]>(() => {
  const group = planningFor.value.filter((p) => p.slots.length > 0);
  if (group.length === 0) return [];
  return group.map((p) => mergeSlots(p.slots)).reduce(intersectSlots);
});

/**
 * Interest summed over the group, so a block both of you want beats one only
 * one of you does — while a single `must` still outranks any pile of `maybe`s.
 */
export const planWeights = computed(() => {
  const weights = new Map<string, number>();
  for (const person of planningFor.value) {
    for (const [blockId, interest] of Object.entries(person.interest)) {
      weights.set(blockId, (weights.get(blockId) ?? 0) + INTEREST_WEIGHT[interest]);
    }
  }
  return weights;
});

/**
 * The schedule. Derived, so there is no "optimize" button and nothing to
 * invalidate — mark one more film and this has already changed.
 *
 * It runs synchronously on the main thread, which is fine because it is fast:
 * a normal wishlist is proven optimal in about 20 ms. The budget only matters
 * for a degenerate one (every block marked at the same weight), and there 400 ms
 * was measured to give exactly the same plan as 2 s — so the longer budget would
 * buy a five-times-worse hitch and nothing else.
 */
export const plan = computed<Plan>(() =>
  optimize({
    festival,
    slots: planSlots.value,
    weights: planWeights.value,
    travel: travelMatrix.value,
    bufferMin: state.value.settings.bufferMin,
    excludeClosed: state.value.settings.excludeClosed,
    timeLimitMs: 400,
  }),
);

// --------------------------------------------------------------- lookups

export const blockById = new Map(festival.blocks.map((b) => [b.id, b]));
export const venueById = new Map(festival.venues.map((v) => [v.id, v]));
export const placeById = new Map(festival.places.map((p) => [p.id, p]));

export const showingsByBlock = (() => {
  const out = new Map<string, typeof festival.showings>();
  for (const s of festival.showings) {
    const list = out.get(s.blockId) ?? [];
    list.push(s);
    out.set(s.blockId, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.start - b.start);
  return out;
})();
