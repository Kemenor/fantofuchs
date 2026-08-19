/**
 * The active language.
 *
 * `t` is a signal holding the catalogue, so a component that reads `t.value`
 * re-renders when the language changes — no provider, no hook, no keys to look
 * up at runtime. Strings are reached as `t.value.plan.dropIn`, which means a
 * typo is a compile error and a missing translation cannot reach the screen.
 */
import { computed, signal } from '@preact/signals';
import type { Lang } from '../model/types.ts';
import { LANGS } from '../model/types.ts';
import { en } from './strings.ts';
import { de } from './de.ts';
import { fr } from './fr.ts';
import { LOCALE, type Catalogue } from './strings.ts';

export { LANG_LABEL, LOCALE } from './strings.ts';
export type { Catalogue } from './strings.ts';

const CATALOGUES: Record<Lang, Catalogue> = { en, de, fr };

export const lang = signal<Lang>('en');

export const t = computed<Catalogue>(() => CATALOGUES[lang.value]);

/** BCP-47 tag for `Intl`, e.g. `de-CH`. */
export const locale = computed(() => LOCALE[lang.value]);

/**
 * The best supported match for what the browser asks for, falling back to
 * English. Used only for the very first visit; after that the choice is stored.
 */
export function detectLang(): Lang {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = tag.toLowerCase().split('-')[0] as Lang;
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}
