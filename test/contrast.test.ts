import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Colour contrast, checked against the stylesheet itself rather than a copy of
 * the values.
 *
 * The palette is inherited from Fuchsbau, where the three hues are pinned — so
 * the thing that has to be got right here is what sits *on* them. Measuring
 * found white text failing on all three accent fills, badly in dark mode
 * (2.05:1 on emerald). These assertions exist so that a later tweak to a token
 * cannot quietly put it back.
 */

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

/**
 * Both palettes live in one `:root` block, prefixed `--l-` and `--d-`, with the
 * active set mapped onto them afterwards. Reading the prefixed values goes
 * straight to the source of truth rather than to an alias.
 */
function paletteOf(prefix: 'l' | 'd'): Record<string, string> {
  const open = css.indexOf('{', css.indexOf(':root {'));
  const body = css.slice(open + 1, css.indexOf('\n}', open));
  const out: Record<string, string> = {};
  const pattern = new RegExp(`--${prefix}-([\\w-]+)\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`, 'g');
  for (const [, name, value] of body.matchAll(pattern)) out[name] = value.toLowerCase();
  return out;
}

const light = paletteOf('l');
const dark = paletteOf('d');

function luminance(hex: string): number {
  const channels = hex.replace('#', '').match(/../g)!.map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground token, background token, what it is, required ratio] */
const PAIRS: [string, string, string, number][] = [
  ['text', 'bg', 'body text', 4.5],
  ['text', 'surface', 'text on a card', 4.5],
  ['text', 'surface-2', 'text on an inset surface', 4.5],
  ['muted', 'bg', 'secondary text on the page', 4.5],
  ['muted', 'surface', 'secondary text on a card', 4.5],
  ['muted', 'surface-2', 'secondary text on an inset surface', 4.5],
  ['faded', 'bg', 'faded text on the page', 4.5],
  ['faded', 'surface', 'faded text on a card', 4.5],
  ['on-fox', 'fox', 'primary button, active tab, Must chip', 4.5],
  ['on-indigo', 'indigo', 'Want chip', 4.5],
  ['on-emerald', 'emerald', 'Maybe chip', 4.5],
  ['fox-text', 'bg', 'brand and links on the page', 4.5],
  ['fox-text', 'surface', 'brand and links on a card', 4.5],
  ['emerald-text', 'surface', 'the scheduled pill', 4.5],
  ['danger', 'surface', 'destructive action', 4.5],
  // Non-text contrast (WCAG 1.4.11): the border *is* the control's boundary.
  ['line-strong', 'bg', 'control border on the page', 3],
  ['line-strong', 'surface', 'control border on a card', 3],
  ['indigo', 'bg', 'focus ring on the page', 3],
  ['indigo', 'surface', 'focus ring on a card', 3],
];

for (const [themeName, theme] of [['light', light], ['dark', dark]] as const) {
  for (const [fg, bg, what, need] of PAIRS) {
    test(`${themeName}: ${what} meets ${need}:1`, () => {
      assert.ok(theme[fg], `--${fg} is not defined in the ${themeName} theme`);
      assert.ok(theme[bg], `--${bg} is not defined in the ${themeName} theme`);
      const ratio = contrast(theme[fg], theme[bg]);
      assert.ok(
        ratio >= need,
        `--${fg} (${theme[fg]}) on --${bg} (${theme[bg]}) is ${ratio.toFixed(2)}:1, needs ${need}:1`,
      );
    });
  }
}

test('both themes define every token the pairs rely on', () => {
  const needed = new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]));
  for (const name of needed) {
    assert.ok(light[name], `--${name} missing from the light theme`);
    assert.ok(dark[name], `--${name} missing from the dark theme`);
  }
});
