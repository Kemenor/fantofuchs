# Fantofuchs — project guide for Claude

Static web app (Preact + TypeScript + Vite) that plans a personal schedule for the
Fantoche animation film festival in Baden. Local-first: wishlists live in `localStorage`,
the programme ships with the build. Product plan & decisions: `PLAN.md`. Data model:
`design-concept.md`.

## Working in this repo

Node is on PATH and runs TypeScript natively — the scraper and tests execute `.ts` files
directly, with no build step.

```sh
npm run dev            # vite dev server
npx tsc --noEmit       # typecheck (the whole repo, including scraper/ and test/)
npm test               # node --test over test/*.test.ts
npm run scrape         # refresh data/; NO_CACHE=1 bypasses the on-disk HTTP cache
node scraper/verify.ts # the guard CI runs before committing scraped data
npm run build          # static output in dist/
```

- **Always run `npx tsc --noEmit` and `npm test`** before calling a change done; CI runs
  both and the optimizer tests are the ones that catch real breakage.
- **The HTTP cache** lives in `.cache/http` (gitignored). Scraper iterations are free after
  the first run; pass `NO_CACHE=1` when you actually want fresh pages.

## Layout

```
scraper/    scrape.ts (fantoche.ch -> data/), verify.ts (CI guard), fetch-cache.ts
src/model/  types.ts, travel.ts, optimize.ts — pure, no DOM, no storage
src/store.ts  the only mutable state; everything else is a computed signal
src/ui/     Programme · Availability · PlanView · Share · SettingsView · PeopleBar
src/share.ts  export/import: validation, merge, deflate+base64url link encoding
src/format.ts  all date/time formatting, pinned to Europe/Zurich
src/ics.ts  calendar export
data/       fantoche-<year>.json — committed, refreshed daily by CI
```

## Conventions

- **Keep `src/model/` pure.** No DOM, no `localStorage`, no ambient clock. It is testable
  against a brute-force solver precisely because it is pure — do not reach into the store
  from it; pass what it needs in.
- **The plan is derived, never stored.** `plan` is a `computed` over the store. There is no
  "generate" button and no cached schedule to invalidate.
- **Times are epoch seconds.** Format only through `src/format.ts`, which pins
  `Europe/Zurich`. Never use `toLocaleString` without an explicit `timeZone`, and never
  build a date from a local-time string.
- **Every mutation of a `Person` must bump `updatedAt`.** Go through `mapPerson` in the
  store; it stamps for you. Miss it and a merge silently discards that edit when a plan
  comes back from someone else — the one bug in this app that destroys user data.
- **Treat an imported payload as hostile input.** It arrives from a chat app. `parsePayload`
  validates field by field and drops anything unrecognised; extend it when you add a field
  rather than trusting the shape.
- **The scraper must fail loudly.** If a selector stops matching, `verify.ts` should catch
  it. When you add a field worth relying on, add a threshold there too.
- **Optimizer bounds must never undershoot.** Every bound in `optimize.ts` works by
  *dropping* a constraint. If you add one, add a case to the brute-force cross-check test —
  an unsound bound silently returns a worse schedule and nothing else will notice.
- **Colours come from Fuchsbau** (`src/styles.css` custom properties): tangerine primary,
  indigo secondary, emerald tertiary. Red is destruction-only — never status. Things that
  did not work out fade; they do not bleed. Deviations are recorded in `DESIGN_SYSTEM.md`.
- **Never put white on an accent fill.** Use `--on-fox` / `--on-indigo` / `--on-emerald`;
  white fails WCAG on all three (2.05–3.08:1). For an accent used as *text*, use
  `--fox-text` / `--emerald-text`. `test/contrast.test.ts` reads `styles.css` and will fail
  the build if a token pair drops below AA, so add new pairs to it rather than eyeballing.
- **Touch targets ≥ 44 px**, tabular figures for times and counts, light + dark both
  first-class via `prefers-color-scheme`.
- **Accessibility is checked, not assumed.** Held to WCAG 2.2 AA: one `<h1>`, `<h2>` per
  section, `<h3>` per programme; no information carried by colour or a `title` attribute
  alone; anything that changes without navigation is an `aria-live` region. Re-run axe
  (`node_modules/axe-core/axe.min.js`, injected into the dev server) after UI changes.

## Data notes

- Screening start times come from the favourite button id on fantoche.ch
  (`favorite('3565_1788246000')` = `<block>_<epoch>`), which is exact — do not parse the
  printed `Tue 1.9 • 09:00` text instead.
- `Showing.endSource` is `published` | `runtime` | `assumed`. Never present an `assumed`
  end time as if it were known.
- A `published` window over three hours is an exhibition, not a screening — `isOpenWindow`.
