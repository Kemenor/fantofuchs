/**
 * Sending a plan to someone, and taking one back.
 *
 * Two ways out (a link to paste into a chat, a file to attach) and three ways
 * in (a link, a file, pasted text), because whichever one your brother's phone
 * makes awkward, another will work.
 */
import { useState } from 'preact/hooks';
import {
  activePerson, applyImport, exportPayload, festivalCore, people, pendingImport, state,
} from '../store.ts';
import { t } from '../i18n/index.ts';
import { decodeShare, shareLink, type SharePayload } from '../share.ts';
import type { MergeResult } from '../share.ts';

/** Plain-language account of what an import actually did. */
function describe(result: MergeResult, replaced: boolean): string {
  const s = t.value;
  if (replaced) return s.share.doneReplaced(result.people.length);
  const names = (list: { name: string }[]) => list.map((p) => p.name).join(', ');
  const parts: string[] = [];
  if (result.added.length) parts.push(s.share.doneAdded(names(result.added)));
  if (result.updated.length) parts.push(s.share.doneUpdated(names(result.updated)));
  if (result.kept.length) parts.push(s.share.doneKept(names(result.kept)));
  return parts.length ? s.share.done(parts.join('; ')) : s.share.doneNothing;
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
  const s = t.value;
  return payload.people
    .map((p) => s.share.person(p.name, Object.keys(p.interest).length, p.slots.length))
    .join(' · ');
}

/** The card shown when the app is opened via a shared link. */
export function IncomingPlan() {
  const s = t.value;
  const payload = pendingImport.value;
  const [message, setMessage] = useState<string | null>(null);

  // Accepting clears the pending plan, so the outcome has to be held here —
  // otherwise the card vanishes on click and never says what it did.
  if (message !== null) {
    return (
      <div class="card" role="status" aria-live="polite" style="border-color:var(--emerald);margin-bottom:12px">
        <div class="row wrap spread" style="gap:8px">
          <span class="grow">{message}</span>
          <button class="btn small ghost" onClick={() => setMessage(null)}>{s.share.dismiss}</button>
        </div>
        {hasUnnamedSelf() && (
          <p class="small muted" style="margin:8px 0 0">{s.share.unnamedSelf}</p>
        )}
      </div>
    );
  }
  if (!payload) return null;

  const wrongEdition = payload.edition !== 0 && payload.edition !== festivalCore.edition.year;

  const accept = (replace: boolean) => {
    const result = applyImport(payload, { replace });
    setMessage(describe(result, replace));
    pendingImport.value = null;
  };

  return (
    <div class="card" role="region" aria-label={s.share.incomingRegion} style="border-color:var(--fox);margin-bottom:12px">
      <div style="font-weight:700">
        {payload.exportedBy ? s.share.incomingFrom(payload.exportedBy) : s.share.incoming}
      </div>
      <p class="small muted" style="margin:6px 0 12px">{summarise(payload)}</p>

      {wrongEdition && (
        <p class="warn small" style="margin:0 0 12px">
          {s.share.wrongEdition(String(payload.edition || '?'), festivalCore.edition.year)}
        </p>
      )}

      <div class="row wrap" style="gap:8px">
        <button class="btn primary" onClick={() => accept(false)}>{s.share.mergeIntoMine}</button>
        <button
          class="btn"
          onClick={() => {
            if (confirm(s.share.replaceConfirm)) accept(true);
          }}
        >
          {s.share.replaceAll}
        </button>
        <button class="btn ghost" onClick={() => (pendingImport.value = null)}>
          {s.share.notNow}
        </button>
      </div>
      <p class="small faded" style="margin:10px 0 0">{s.share.mergeExplain}</p>
    </div>
  );
}

export function Share() {
  const s = t.value;
  const [onlyMe, setOnlyMe] = useState(false);
  const [linkState, setLinkState] = useState<string | null>(null);
  // The link itself, shown when copying is not available — or on request.
  const [visibleLink, setVisibleLink] = useState<string | null>(null);
  const [paste, setPaste] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  // Kept separate from the import error: a failure belongs next to the button
  // that caused it, not in whichever card happens to render an error slot.
  const [exportError, setExportError] = useState<string | null>(null);
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

  const buildLink = () => shareLink(exportPayload({ onlyActive: onlyMe }));

  const copyLink = async () => {
    setExportError(null);
    setVisibleLink(null);
    const link = await buildLink();
    try {
      await navigator.clipboard.writeText(link);
      setLinkState(link.length > 1800 ? s.share.linkCopiedLong(link.length) : s.share.linkCopied);
    } catch {
      // Some in-app browsers refuse clipboard access outright. Falling back to
      // the file would be a dead end for anyone who just wants to paste a link,
      // so show it instead and let them copy it by hand.
      setLinkState(null);
      setExportError(s.share.clipboardBlocked);
      setVisibleLink(link);
    }
  };

  const showLink = async () => {
    setExportError(null);
    setLinkState(null);
    setVisibleLink(await buildLink());
  };

  const load = async (text: string, replace: boolean) => {
    setError(null);
    setMessage(null);
    try {
      const payload = await decodeShare(text);
      if (payload.edition !== 0 && payload.edition !== festivalCore.edition.year) {
        setError(s.share.wrongEditionShort(payload.edition, festivalCore.edition.year));
        return;
      }
      const result = applyImport(payload, { replace, withSettings: replace && Boolean(payload.settings) });
      setMessage(describe(result, replace));
      setPaste('');
      setShowPaste(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : s.share.unreadable);
    }
  };

  return (
    <>
      <h2 class="section-title">{s.share.sendTitle}</h2>
      <div class="card">
        <p class="small muted" style="margin-top:0">{s.share.sendBlurb}</p>

        {everyone.length > 1 && (
          <div class="row wrap" style="gap:6px;margin-bottom:12px">
            <button class="chip" aria-pressed={!onlyMe} onClick={() => setOnlyMe(false)}>
              {s.share.everyoneCount(everyone.length)}
            </button>
            <button class="chip" aria-pressed={onlyMe} onClick={() => setOnlyMe(true)}>
              {s.share.onlyMe(me.name)}
            </button>
          </div>
        )}

        <div class="row wrap" style="gap:8px">
          <button class="btn primary" onClick={copyLink}>{s.share.copyLink}</button>
          <button class="btn" onClick={() => download(false)}>{s.share.downloadFile}</button>
          <button class="btn ghost" onClick={showLink}>{s.share.showLink}</button>
        </div>
        <p class="small" style="margin:10px 0 0" role="status" aria-live="polite">{linkState}</p>
        {exportError && <p class="warn small" style="margin:10px 0 0" role="alert">{exportError}</p>}
        {visibleLink && (
          <textarea
            readOnly
            aria-label={s.share.linkBoxLabel}
            class="tabular"
            style="width:100%;min-height:76px;margin-top:8px;padding:10px;border:1px solid var(--line);border-radius:var(--radius-btn);background:var(--surface-2);font-size:12px;word-break:break-all;resize:vertical"
            value={visibleLink}
            onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        )}
        <p class="small faded" style="margin:10px 0 0">{s.share.fragmentNote}</p>
      </div>

      <h2 class="section-title">{s.share.loadTitle}</h2>
      <div class="card">
        <div class="row wrap" style="gap:8px">
          <label class="btn file-label" style="display:inline-flex;align-items:center">
            {s.share.chooseFile}
            <input
              type="file"
              class="file-input"
              accept="application/json,.json"
              aria-label={s.share.chooseFileLabel}
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
            {s.share.pasteToggle}
          </button>
        </div>

        {showPaste && (
          <div style="margin-top:12px">
            <textarea
              class="grow"
              aria-label={s.share.pasteLabel}
              style="width:100%;min-height:88px;padding:10px;border:1px solid var(--line);border-radius:var(--radius-btn);background:var(--surface);resize:vertical"
              placeholder={s.share.pastePlaceholder}
              value={paste}
              onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)}
            />
            <button
              class="btn primary small"
              style="margin-top:8px"
              disabled={!paste.trim()}
              onClick={() => load(paste, false)}
            >
              {s.share.mergeIt}
            </button>
          </div>
        )}

        <p class="small" style="margin:12px 0 0" role="status" aria-live="polite">{message}</p>
        {error && <p class="warn small" style="margin:12px 0 0" role="alert">{error}</p>}

        <p class="small faded" style="margin:12px 0 0">{s.share.mergeNote}</p>
      </div>

      <h2 class="section-title">{s.share.backupTitle}</h2>
      <div class="card">
        <div class="row wrap" style="gap:8px">
          <button class="btn small" onClick={() => download(true)}>
            {s.share.downloadBackup}
          </button>
          <label class="btn small file-label" style="display:inline-flex;align-items:center">
            {s.share.restoreBackup}
            <input
              type="file"
              class="file-input"
              accept="application/json,.json"
              aria-label={s.share.restoreLabel}
              onChange={async (e) => {
                const input = e.target as HTMLInputElement;
                const file = input.files?.[0];
                if (!file) return;
                if (confirm(s.share.restoreConfirm)) {
                  await load(await file.text(), true);
                }
                input.value = '';
              }}
            />
          </label>
        </div>
        <p class="small faded" style="margin:10px 0 0">{s.share.backupNote}</p>
      </div>
    </>
  );
}
