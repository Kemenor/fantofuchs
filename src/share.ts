/**
 * Passing a plan between people.
 *
 * The workflow this exists for: you mark your films and your free evenings,
 * send the plan to your brother, he loads it, fills in his half, and sends the
 * whole thing back. That round trip is the reason import **merges** rather than
 * replaces. His copy of *you* is a snapshot taken when you sent it; if you kept
 * marking films while he had it, a replace would silently throw those away.
 *
 * So every person carries `updatedAt`, and on a collision the newer copy wins —
 * with ties going to the copy already on this device, because the one thing
 * worse than a stale import is a surprising one.
 *
 * Nothing here trusts its input. A payload arrives from a chat app via a file
 * or a link, so it is validated field by field and anything unrecognised is
 * dropped rather than merged into your state.
 */
import type { Interest, Person, Settings, Slot } from './model/types.ts';

export const SHARE_FORMAT = 1;

export interface SharePayload {
  app: 'fantofuchs';
  format: number;
  /** Festival year the wishlist refers to; block ids mean nothing without it. */
  edition: number;
  exportedAt: string;
  exportedBy: string;
  people: Person[];
  /** Present only in a full backup — preferences are not worth sharing. */
  settings?: Settings;
}

// ------------------------------------------------------------- validation

const INTERESTS: Interest[] = ['must', 'want', 'maybe', 'no'];

/** Guards against a hand-edited or truncated file bloating state. */
const LIMITS = { people: 20, slotsPerPerson: 100, marksPerPerson: 2000, nameLength: 60 };

class ShareError extends Error {}

function asSlots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Slot =>
      typeof s === 'object' && s !== null &&
      Number.isFinite((s as Slot).from) && Number.isFinite((s as Slot).to) &&
      (s as Slot).to > (s as Slot).from)
    .slice(0, LIMITS.slotsPerPerson)
    .map((s) => ({ from: Math.round(s.from), to: Math.round(s.to) }));
}

function asInterest(value: unknown): Record<string, Interest> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, Interest> = {};
  let count = 0;
  for (const [blockId, level] of Object.entries(value as Record<string, unknown>)) {
    if (count >= LIMITS.marksPerPerson) break;
    // Only real block ids and real levels; `no` is absence, so it is dropped.
    if (!/^prg\d+$/.test(blockId)) continue;
    if (typeof level !== 'string' || !INTERESTS.includes(level as Interest)) continue;
    if (level === 'no') continue;
    out[blockId] = level as Interest;
    count++;
  }
  return out;
}

function asPerson(value: unknown, index: number): Person | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Partial<Person>;
  if (typeof raw.id !== 'string' || raw.id.length === 0 || raw.id.length > 64) return null;
  return {
    id: raw.id,
    name: (typeof raw.name === 'string' && raw.name.trim() ? raw.name : `Person ${index + 1}`)
      .slice(0, LIMITS.nameLength),
    color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '#8559D0',
    slots: asSlots(raw.slots),
    interest: asInterest(raw.interest),
    updatedAt: Number.isFinite(raw.updatedAt) ? Number(raw.updatedAt) : 0,
  };
}

function asSettings(value: unknown): Settings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Partial<Settings>;
  const num = (v: unknown, lo: number, hi: number, fallback: number): number =>
    Number.isFinite(v) ? Math.min(hi, Math.max(lo, Number(v))) : fallback;

  const overrides: Record<string, number> = {};
  if (typeof raw.travelOverrides === 'object' && raw.travelOverrides !== null) {
    for (const [key, minutes] of Object.entries(raw.travelOverrides)) {
      if (/^[a-z0-9-]+\|[a-z0-9-]+$/.test(key) && Number.isFinite(minutes)) {
        overrides[key] = Math.min(600, Math.max(0, Number(minutes)));
      }
    }
  }
  return {
    bufferMin: num(raw.bufferMin, 0, 120, 10),
    samePlaceMin: num(raw.samePlaceMin, 0, 60, 3),
    walkKmh: num(raw.walkKmh, 1, 12, 4.5),
    detourFactor: num(raw.detourFactor, 1, 3, 1.35),
    travelOverrides: overrides,
    excludeClosed: raw.excludeClosed !== false,
  };
}

/** Turn untrusted JSON into a payload, or explain why it is not one. */
export function parsePayload(value: unknown): SharePayload {
  if (typeof value !== 'object' || value === null) throw new ShareError('That is not a Fantofuchs file.');
  const raw = value as Partial<SharePayload>;
  if (raw.app !== 'fantofuchs') throw new ShareError('That file was not made by Fantofuchs.');
  if (typeof raw.format !== 'number' || raw.format > SHARE_FORMAT) {
    throw new ShareError('That file comes from a newer version of Fantofuchs.');
  }

  const people = (Array.isArray(raw.people) ? raw.people : [])
    .slice(0, LIMITS.people)
    .map(asPerson)
    .filter((p): p is Person => p !== null);
  if (people.length === 0) throw new ShareError('That file contains no people.');

  return {
    app: 'fantofuchs',
    format: raw.format,
    edition: Number.isFinite(raw.edition) ? Number(raw.edition) : 0,
    exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
    exportedBy: typeof raw.exportedBy === 'string' ? raw.exportedBy.slice(0, LIMITS.nameLength) : '',
    people,
    settings: asSettings(raw.settings),
  };
}

export function buildPayload(
  people: Person[],
  { edition, exportedBy, settings }: { edition: number; exportedBy: string; settings?: Settings },
): SharePayload {
  return {
    app: 'fantofuchs',
    format: SHARE_FORMAT,
    edition,
    exportedAt: new Date().toISOString(),
    exportedBy,
    people: people.map((p) => ({ ...p, slots: p.slots.map((s) => ({ ...s })), interest: { ...p.interest } })),
    ...(settings ? { settings } : {}),
  };
}

// ---------------------------------------------------------------- merging

export interface MergeResult {
  people: Person[];
  /** People who were not here before. */
  added: Person[];
  /** People whose incoming copy was newer and replaced the local one. */
  updated: Person[];
  /** People whose local copy was newer, so the incoming one was ignored. */
  kept: Person[];
}

/**
 * Combine an incoming plan with what is already here, per person.
 * Newer wins; a tie keeps what is already on this device.
 */
export function mergePeople(mine: Person[], theirs: Person[]): MergeResult {
  const byId = new Map(mine.map((p) => [p.id, p]));
  const added: Person[] = [];
  const updated: Person[] = [];
  const kept: Person[] = [];

  for (const incoming of theirs) {
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, incoming);
      added.push(incoming);
    } else if (incoming.updatedAt > existing.updatedAt) {
      byId.set(incoming.id, incoming);
      updated.push(incoming);
    } else {
      kept.push(existing);
    }
  }

  // Keep the local order, then anyone new, so the list does not reshuffle.
  const order = [...mine.map((p) => p.id), ...added.map((p) => p.id)];
  return { people: order.map((id) => byId.get(id)!), added, updated, kept };
}

// --------------------------------------------------------------- encoding

const base64url = {
  encode(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(text: string): Uint8Array<ArrayBuffer> {
    const padded = text.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  },
};

async function through(stream: ReadableStream<Uint8Array>): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

// Typed as BufferSource because that is what a CompressionStream accepts.
function streamOf(bytes: Uint8Array<ArrayBuffer>): ReadableStream<BufferSource> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/**
 * Encode a payload for a URL fragment.
 *
 * A wishlist is mostly repeated block ids, so it deflates to roughly a third of
 * its size — the difference between a link that survives a chat app and one
 * that does not. The leading digit says whether compression was available, so
 * an older browser still produces something the other side can read.
 */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = JSON.stringify(payload);
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'undefined') return `0${base64url.encode(raw)}`;
  const deflated = await through(streamOf(raw).pipeThrough(new CompressionStream('deflate-raw')));
  return `1${base64url.encode(deflated)}`;
}

/** Accept anything plausible: a share code, or the raw JSON of a saved file. */
export async function decodeShare(text: string): Promise<SharePayload> {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return parsePayload(JSON.parse(trimmed));

  // Tolerate a whole pasted link rather than just the code inside it.
  const code = trimmed.includes('#') ? trimmed.slice(trimmed.lastIndexOf('#') + 1).replace(/^plan=/, '') : trimmed;
  const marker = code[0];
  const body = base64url.decode(code.slice(1));

  if (marker === '0') return parsePayload(JSON.parse(new TextDecoder().decode(body)));
  if (marker === '1') {
    if (typeof DecompressionStream === 'undefined') {
      throw new ShareError('This browser cannot read compressed plans. Ask for the file instead.');
    }
    const inflated = await through(streamOf(body).pipeThrough(new DecompressionStream('deflate-raw')));
    return parsePayload(JSON.parse(new TextDecoder().decode(inflated)));
  }
  throw new ShareError('That does not look like a Fantofuchs plan.');
}

/** The link to send someone. The payload rides in the fragment, so it is never
 *  sent to a server or written into any access log. */
export async function shareLink(payload: SharePayload): Promise<string> {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#plan=${await encodeShare(payload)}`;
}
