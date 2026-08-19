/**
 * Language and appearance, in the header.
 *
 * The appearance control is a two-state toggle rather than a three-way picker,
 * because that is what a header button should be: it shows what you would get
 * by pressing it. "Follow the system" is still the default and still where an
 * untouched install sits — it just lives in Setup, since it is a preference you
 * set once rather than something you flip while reading a schedule.
 */
import { LANGS, type Lang } from '../model/types.ts';
import { LANG_LABEL, t } from '../i18n/index.ts';
import { setLang, setTheme, state, theme } from '../store.ts';

/** What the page is actually showing right now, resolving `system`. */
export function effectiveTheme(): 'light' | 'dark' {
  const chosen = theme.value;
  if (chosen !== 'system') return chosen;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const Sun = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2M12 20v2M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2 12h2M20 12h2M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
  </svg>
);

const Moon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a7 7 0 1 0 9.5 9.5z" />
  </svg>
);

export function TopControls() {
  const s = t.value;
  const showing = effectiveTheme();
  const next = showing === 'dark' ? 'light' : 'dark';

  return (
    <div class="row" style="gap:6px">
      <select
        class="lang-select"
        aria-label={s.nav.language}
        value={state.value.lang}
        onChange={(e) => setLang((e.target as HTMLSelectElement).value as Lang)}
      >
        {LANGS.map((code) => (
          <option key={code} value={code}>
            {code.toUpperCase()}
          </option>
        ))}
      </select>

      <button
        class="icon-btn"
        onClick={() => setTheme(next)}
        aria-label={next === 'dark' ? s.nav.toDark : s.nav.toLight}
        title={next === 'dark' ? s.nav.toDark : s.nav.toLight}
      >
        {showing === 'dark' ? <Sun /> : <Moon />}
      </button>
    </div>
  );
}

/** The full three-way choice, for Setup. */
export function ThemeChoiceRow() {
  const s = t.value;
  const current = theme.value;
  const options = [
    ['system', s.nav.themeSystem],
    ['light', s.nav.themeLight],
    ['dark', s.nav.themeDark],
  ] as const;

  return (
    <div class="row wrap" style="gap:6px" role="group" aria-label={s.nav.theme}>
      {options.map(([value, label]) => (
        <button
          key={value}
          class="chip"
          aria-pressed={current === value}
          onClick={() => setTheme(value)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The language choice as a labelled row, for Setup. */
export function LanguageChoiceRow() {
  const s = t.value;
  const current = state.value.lang;
  return (
    <div class="row wrap" style="gap:6px" role="group" aria-label={s.nav.language}>
      {LANGS.map((code) => (
        <button key={code} class="chip" aria-pressed={current === code} onClick={() => setLang(code)}>
          {LANG_LABEL[code]}
        </button>
      ))}
    </div>
  );
}
