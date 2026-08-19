# Fantofuchs — design system

Inherits [Fuchsbau `DESIGN.md`](https://github.com/Kemenor/fuchsbau/blob/main/DESIGN.md).
This file records only what is specific to this app, per the family convention.

## The port to CSS

Fantofuchs is the first fuchs app that is not Flutter, so the design system is expressed as
CSS custom properties in [`src/styles.css`](./src/styles.css) rather than a `ColorScheme`.
The three pinned hues are carried over **exactly**:

| Role | Light | Dark |
|---|---|---|
| primary — Fox Orange | `#EA7A24` | `#F39C4E` |
| secondary — Indigo | `#8559D0` | `#A98CEE` |
| tertiary — Emerald | `#1FA85D` | `#37CE78` |

Dark and light both come from `prefers-color-scheme`; there is no manual override yet.

## Deviation: explicit `--on-*` foregrounds

**What Fuchsbau does not specify is what goes on top of those hues, and white fails on all
three.** Measured:

| Fill | White text | Ink `#1B1917` |
|---|---|---|
| Fox, light | 2.87:1 ✗ | **6.10:1** ✓ |
| Fox, dark | 2.17:1 ✗ | **8.08:1** ✓ |
| Indigo, light | **4.84:1** ✓ | 3.62:1 ✗ |
| Indigo, dark | 2.74:1 ✗ | **6.40:1** ✓ |
| Emerald, light | 3.08:1 ✗ | **5.69:1** ✓ |
| Emerald, dark | 2.05:1 ✗ | **8.57:1** ✓ |

So each accent carries its own foreground token — `--on-fox`, `--on-indigo`,
`--on-emerald` — chosen for contrast. The visible consequence: **the primary button and
the *Must* chip have dark text on orange, not white.** The hue is untouched.

This is not a fix *to* Fuchsbau — it is catching the CSS port up with it. The Flutter
package already gets this right: `fuchsbauColorScheme` in
[`lib/src/theme.dart`](https://github.com/Kemenor/fuchsbau/blob/main/lib/src/theme.dart)
flips `onBrand` per theme (white in light, `#121009` in dark) and uses dark ink on the
orange and emerald fills, measuring 5.50–9.30:1 across the six combinations. The port to
CSS simply hardcoded `#fff` and lost that. Worth remembering when porting anything else
out of the Flutter package: the `ColorScheme` carries decisions that a naive translation
drops on the floor.

## Extension: accent-as-text variants

An accent used as *text* needs to be darker in light mode than the same accent used as a
*fill*. Hence `--fox-text` (`#B25714`, 4.65:1 on the page) and `--emerald-text`
(`#177F46`, 5.05:1) — used for the wordmark, links and the "scheduled" pill. In dark mode
these are just the pinned accents, which are already light enough.

## Extension: `--line-strong`

Fuchsbau asks for hairline `outlineVariant` borders. A hairline is fine as a *divider*
(decorative — the content is separated by spacing and type anyway), but WCAG 1.4.11 wants
3:1 for a border that defines a **control**. So there are two:

- `--line` — dividers between rows. Quiet, as intended.
- `--line-strong` — the outline of buttons, chips, inputs and selects. 3.14:1 light /
  3.40:1 dark.

## Typography

Figtree throughout, with a system fallback. No typeface picker yet — the Flutter apps
bundle OpenDyslexic and Atkinson Hyperlegible; on the web that is a font-loading decision
rather than an enum, and it is not built.

| Use | Size |
|---|---|
| Programme / plan title (`.block-title`) | 18px / 600 |
| Body | 16px |
| Meta, hints (`.small`) | 13px |
| Badges (`.fs-extra-small`) | 12px |

Times, counts and runtimes use `font-variant-numeric: tabular-nums` so columns line up.

## Accessibility

Held to **WCAG 2.2 AA**, and checked rather than asserted:

- **Contrast** — [`test/contrast.test.ts`](./test/contrast.test.ts) parses `styles.css`
  itself and asserts all 19 token pairs in both themes. Change a colour badly and the test
  fails with the measured ratio.
- **axe-core** — zero violations across all five tabs, in both themes, with panels
  expanded.
- **Reflow (1.4.10)** — no horizontal scrolling at 320 px on any tab.
- **Targets (2.5.8)** — every control is ≥44 px tall. The one exception is an inline link
  inside a sentence, which the success criterion explicitly exempts.
- **Structure** — one `<h1>`, section headings as `<h2>`, programme and plan titles as
  `<h3>`.
- **Never colour alone** — a person's colour dot is `aria-hidden`, with their name and
  interest level in `.sr-only` text beside it.
- **Nothing important lives in a `title` attribute** — tooltips never reach a keyboard or
  screen-reader user, so anything they say (closed school screening, drop-in window, in
  your plan) is repeated in `.sr-only` text.
- **Live regions** — the plan summary, filter count and import result are `aria-live`
  polite, because they change without the user having navigated anywhere.
- **File inputs are visually hidden but focusable** — `display: none` would drop them out
  of the tab order and make loading a shared plan mouse-only.

### Known gaps

- No typeface picker (OpenDyslexic / Atkinson Hyperlegible), unlike the Flutter apps.
- No manual light/dark override; it follows the OS.
- English only. The family standard is en/de/fr/it.
