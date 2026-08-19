/**
 * Sending a plan to someone, and taking one back.
 *
 * Two ways out (a link to paste into a chat, a file to attach) and three ways
 * in (a link, a file, pasted text), because whichever one your brother's phone
 * makes awkward, another will work.
 */
import { useState } from 'preact/hooks';
import {
  activePerson, applyImport, exportPayload, festival, people, pendingImport, state,
} from '../store.ts';
import { decodeShare, shareLink, type SharePayload } from '../share.ts';
import type { MergeResult } from '../share.ts';

/** Plain-language account of what an import actually did. */
function describe(result: MergeResult, replaced: boolean): string {
  if (replaced) return `Replaced everything with ${result.people.length} people from the file.`;
  const parts: string[] = [];
  if (result.added.length) parts.push(`added ${result.added.map((p) => p.name).join(', ')}`);
  if (result.updated.length) parts.push(`updated ${result.updated.map((p) => p.name).join(', ')}`);
  if (result.kept.length) {
    parts.push(`kept your newer ${result.kept.map((p) => p.name).join(', ')}`);
  }
  return parts.length ? `Done — ${parts.join('; ')}.` : 'Nothing to change; you already had all of it.';
}

/**
 * True while this device still has only the untouched starter profile.
 *
 * Someone opening a shared link on a fresh browser ends up with a nameless
 * "Me" sitting next to the person who sent it, and no obvious sign that the
 * empty one is meant to be them. Worth one sentence.
 */
function hasUnnamedSelf(): boolean {
  return state.value.people.some(
    (p) => p.name === 'Me' && p.slots.length === 0 && Object.keys(p.interest).length === 0,
  );
}

function summarise(payload: SharePayload): string {
  const names = payload.people.map((p) => {
    const marks = Object.keys(p.interest).length;
    return `${p.name} (${marks} marked, ${p.slots.length} free ${p.slots.length === 1 ? 'window' : 'windows'})`;
  });
  return names.join(' · ');
}

/** The card shown when the app is opened via a shared link. */
export function IncomingPlan() {
  const payload = pendingImport.value;
  const [message, setMessage] = useState<string | null>(null);

  // Accepting clears the pending plan, so the outcome has to be held here —
  // otherwise the card vanishes on click and never says what it did.
  if (message !== null) {
    return (
      <div class="card" style="border-color:var(--emerald);margin-bottom:12px">
        <div class="row wrap spread" style="gap:8px">
          <span class="grow">{message}</span>
          <button class="btn small ghost" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
        {hasUnnamedSelf() && (
          <p class="small muted" style="margin:8px 0 0">
            You are still called “Me” — rename yourself under <strong>Setup</strong>, then
            mark your own films and free time and send the whole thing back.
          </p>
        )}
      </div>
    );
  }
  if (!payload) return null;

  const wrongEdition = payload.edition !== 0 && payload.edition !== festival.edition.year;

  const accept = (replace: boolean) => {
    const result = applyImport(payload, { replace });
    setMessage(describe(result, replace));
    pendingImport.value = null;
  };

  return (
    <div class="card" style="border-color:var(--fox);margin-bottom:12px">
      <div style="font-weight:700">
        {payload.exportedBy ? `${payload.exportedBy} sent you a plan` : 'A shared plan'}
      </div>
      <p class="small muted" style="margin:6px 0 12px">{summarise(payload)}</p>

      {wrongEdition && (
        <p class="warn small" style="margin:0 0 12px">
          This plan is for Fantoche {payload.edition || 'an unknown year'}, but this app has{' '}
          {festival.edition.year}. The films marked in it will not match.
        </p>
      )}

      <div class="row wrap" style="gap:8px">
        <button class="btn primary" onClick={() => accept(false)}>
          Merge into mine
        </button>
        <button
          class="btn"
          onClick={() => {
            if (confirm('Throw away everything here and use only what is in this plan?')) accept(true);
          }}
        >
          Replace everything
        </button>
        <button class="btn ghost" onClick={() => (pendingImport.value = null)}>
          Not now
        </button>
      </div>
      <p class="small faded" style="margin:10px 0 0">
        Merging keeps whichever copy of each person was edited most recently, so
        sending a plan back and forth never overwrites what you did in the meantime.
      </p>
    </div>
  );
}

export function Share() {
  const [onlyMe, setOnlyMe] = useState(false);
  const [linkState, setLinkState] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPaste, setShowPaste] = useState(false);

  const everyone = people.value;
  const me = activePerson.value;

  const download = (includeSettings: boolean) => {
    const payload = exportPayload({ onlyActive: onlyMe, includeSettings });
    const name = includeSettings ? 'fantofuchs-backup' : `fantofuchs-${payload.exportedBy.toLowerCase() || 'plan'}`;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyLink = async () => {
    setError(null);
    try {
      const link = await shareLink(exportPayload({ onlyActive: onlyMe }));
      await navigator.clipboard.writeText(link);
      setLinkState(
        link.length > 1800
          ? `Copied, but it is a long link (${link.length} characters) — if it gets cut off in the chat, send the file instead.`
          : 'Link copied — paste it into a message.',
      );
    } catch {
      setError('Could not copy to the clipboard. Use the file instead.');
    }
  };

  const load = async (text: string, replace: boolean) => {
    setError(null);
    setMessage(null);
    try {
      const payload = await decodeShare(text);
      if (payload.edition !== 0 && payload.edition !== festival.edition.year) {
        setError(`That plan is for Fantoche ${payload.edition}, not ${festival.edition.year}.`);
        return;
      }
      const result = applyImport(payload, { replace, withSettings: replace && Boolean(payload.settings) });
      setMessage(describe(result, replace));
      setPaste('');
      setShowPaste(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be read.');
    }
  };

  return (
    <>
      <div class="section-title">Send your plan</div>
      <div class="card">
        <p class="small muted" style="margin-top:0">
          Mark your films and set your free time, then send this to whoever you are going
          with. They load it, fill in their half, and send the whole thing back.
        </p>

        {everyone.length > 1 && (
          <div class="row wrap" style="gap:6px;margin-bottom:12px">
            <button class="chip" aria-pressed={!onlyMe} onClick={() => setOnlyMe(false)}>
              Everyone ({everyone.length})
            </button>
            <button class="chip" aria-pressed={onlyMe} onClick={() => setOnlyMe(true)}>
              Only {me.name}
            </button>
          </div>
        )}

        <div class="row wrap" style="gap:8px">
          <button class="btn primary" onClick={copyLink}>Copy share link</button>
          <button class="btn" onClick={() => download(false)}>Download file</button>
        </div>
        {linkState && <p class="small" style="margin:10px 0 0">{linkState}</p>}
        <p class="small faded" style="margin:10px 0 0">
          The link carries the plan in its own text — nothing is uploaded anywhere, and
          there is no server to lose it.
        </p>
      </div>

      <div class="section-title">Load a plan</div>
      <div class="card">
        <div class="row wrap" style="gap:8px">
          <label class="btn" style="display:inline-flex;align-items:center">
            Choose file…
            <input
              type="file"
              accept="application/json,.json"
              style="display:none"
              onChange={async (e) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (!file) return;
                await load(await file.text(), false);
                input.value = '';
              }}
            />
          </label>
          <button class="btn" onClick={() => setShowPaste(!showPaste)}>
            Paste a link or code
          </button>
        </div>

        {showPaste && (
          <div style="margin-top:12px">
            <textarea
              class="grow"
              style="width:100%;min-height:88px;padding:10px;border:1px solid var(--line);border-radius:var(--radius-btn);background:var(--surface);resize:vertical"
              placeholder="Paste the link or the code your brother sent…"
              value={paste}
              onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)}
            />
            <button
              class="btn primary small"
              style="margin-top:8px"
              disabled={!paste.trim()}
              onClick={() => load(paste, false)}
            >
              Merge it in
            </button>
          </div>
        )}

        {message && <p class="small" style="margin:12px 0 0">{message}</p>}
        {error && <p class="warn small" style="margin:12px 0 0">{error}</p>}

        <p class="small faded" style="margin:12px 0 0">
          Loading merges: anyone new is added, and for someone already here the
          more recently edited copy wins. Your own work is never overwritten by
          an older copy of it.
        </p>
      </div>

      <div class="section-title">Backup</div>
      <div class="card">
        <div class="row wrap" style="gap:8px">
          <button class="btn small" onClick={() => download(true)}>
            Download full backup
          </button>
          <label class="btn small" style="display:inline-flex;align-items:center">
            Restore a backup…
            <input
              type="file"
              accept="application/json,.json"
              style="display:none"
              onChange={async (e) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (!file) return;
                if (confirm('Replace everything here with the contents of this backup?')) {
                  await load(await file.text(), true);
                }
                input.value = '';
              }}
            />
          </label>
        </div>
        <p class="small faded" style="margin:10px 0 0">
          A backup also carries your timing settings, and restoring one replaces
          everything rather than merging — for moving to a new browser, not for
          swapping plans with someone.
        </p>
      </div>
    </>
  );
}
