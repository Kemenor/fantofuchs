import { test } from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../src/i18n/strings.ts';
import { de } from '../src/i18n/de.ts';
import { fr } from '../src/i18n/fr.ts';
import { LANGS } from '../src/model/types.ts';

/**
 * TypeScript already guarantees the three catalogues have the same shape. What
 * it cannot see is whether a string is empty, whether a translation silently
 * dropped an interpolated value, or whether a "translation" is just the English
 * left in place. Those are the ways a catalogue rots in practice.
 */

const CATALOGUES = { en, de, fr } as const;
type Node = Record<string, unknown>;

/** Every leaf, as `section.key` paths. */
function paths(node: Node, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'object' && value !== null ? paths(value as Node, path) : [path];
  });
}

function at(node: Node, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc as Node)?.[key], node);
}

/** Plausible arguments, so an interpolating string can actually be rendered. */
const SAMPLES: unknown[] = ['Thomas', 2, 'Saturday', 'x'];

/**
 * Arguments that pick a branch rather than appearing in the output, so they
 * cannot be expected to show up in the rendered string. Kept as an explicit
 * list rather than a loosened assertion — a flag is the exception, and a new
 * one should have to be justified here.
 */
const FLAG_ARGUMENTS: Record<string, number[]> = {
  // toggle(title, open) — `open` chooses "show" or "hide".
  'programme.toggle': [1],
};

function render(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'function') {
    const fn = value as (...args: unknown[]) => string;
    return fn(...SAMPLES.slice(0, fn.length));
  }
  return '';
}

const enPaths = paths(en as unknown as Node).sort();

test('every language covers the same keys', () => {
  for (const lang of LANGS) {
    const theirs = paths(CATALOGUES[lang] as unknown as Node).sort();
    assert.deepEqual(theirs, enPaths, `the ${lang} catalogue does not match English key for key`);
  }
});

test('the languages offered are exactly the ones with a catalogue', () => {
  assert.deepEqual([...LANGS].sort(), Object.keys(CATALOGUES).sort());
});

for (const lang of LANGS) {
  test(`${lang}: no string is empty`, () => {
    for (const path of enPaths) {
      const text = render(at(CATALOGUES[lang] as unknown as Node, path));
      assert.ok(text.trim().length > 0, `${lang}.${path} renders empty`);
    }
  });

  test(`${lang}: interpolated values all reach the output`, () => {
    for (const path of enPaths) {
      const value = at(CATALOGUES[lang] as unknown as Node, path);
      if (typeof value !== 'function') continue;
      const fn = value as (...args: unknown[]) => string;
      const args = SAMPLES.slice(0, fn.length);
      const text = fn(...args);
      const flags = FLAG_ARGUMENTS[path] ?? [];
      for (const [index, arg] of args.entries()) {
        if (flags.includes(index)) continue;
        // A translation that forgets to interpolate loses information silently:
        // "2 programmes" becoming "programmes" reads fine and is wrong.
        assert.ok(
          text.includes(String(arg)),
          `${lang}.${path} drops the argument ${JSON.stringify(arg)}: "${text}"`,
        );
      }
    }
  });
}

test('German and French are actually translated, not copies of English', () => {
  // A handful of load-bearing strings; if these are still English, something
  // went wrong with the catalogue rather than with one phrase.
  const probes = ['tabs.films', 'plan.dropIn', 'share.loadTitle', 'settings.data', 'time.unavailable'];
  for (const lang of ['de', 'fr'] as const) {
    const identical = probes.filter(
      (path) => render(at(CATALOGUES[lang] as unknown as Node, path)) === render(at(en as unknown as Node, path)),
    );
    assert.ok(
      identical.length < probes.length,
      `every probed string in ${lang} is identical to English: ${identical.join(', ')}`,
    );
  }
});
