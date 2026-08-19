# Fantofuchs 🦊

A schedule planner for [Fantoche](https://fantoche.ch), the international animation film
festival in Baden. Mark the films you want, say when you are free, and it works out the
best possible plan — including the walk from the Trafo to the Orient.

> Built because planning six festival days by hand, on paper and then in Notion, is a
> puzzle a computer should be solving.

## What it does

- 🎬 **The whole programme, browsable** — 91 programme blocks, 209 screenings, six days,
  with runtimes, directors, the films inside each shorts block, and the sections.
- ❤️ **Three levels of wanting** — *Must*, *Want*, *Maybe*. One *Must* outranks any number
  of *Maybe*s, so priorities behave the way you mean them to.
- 🕗 **Your actual free time** — per day, per person, with windows that may run past
  midnight, because a 22:45 screening ends at 00:11.
- 🧠 **A real optimizer, not a greedy guess** — branch and bound over the whole festival.
  Most blocks screen two or three times, and picking *which* showing is the entire game:
  it will move a film to Sunday morning to free up Friday night. Proven optimal for a
  normal wishlist, in about 20 ms.
- 🚶 **Walking is part of the problem** — Trafo 1 → Trafo 2 is a staircase; Trafo → Orient
  is a 20-minute walk to Wettingen. Distances come from the venues' own coordinates, and
  you can override any pair you know better.
- 👥 **Plan together** — several people, each with their own wishlist and free hours. Plan
  for everyone (only shared hours count, and a film you both want counts double) or for
  one person alone.
- 📅 **Export to your calendar** — an `.ics` with the venue, the film list and how long to
  allow for the walk.
- 🗓️ **Honest about the gaps** — exhibitions and pop-ups are opening *windows*, not
  90-minute commitments, so they are listed separately to drop into. Anything that did not
  fit says whether it clashed or never screened while you were free.

## Privacy

Fully local. Wishlists and free time live in `localStorage`, nothing else. No account, no
server, no analytics — the page is static and the festival data ships with it.

## Where the data comes from

`fantoche.ch` is server-rendered, so the whole programme is scrapable: every screening's
exact start is baked into its favourite button (`favorite('3565_1788246000')`), each block
detail page carries the runtime and film list, and the locations page carries lat/lon per
venue. [`scraper/scrape.ts`](./scraper/scrape.ts) turns that into
[`data/fantoche-2026.json`](./data/), which is committed to this repo and refreshed daily
by [a workflow](./.github/workflows/scrape.yml) — with
[`scraper/verify.ts`](./scraper/verify.ts) standing between a broken selector and an empty
programme.

## Stack

Preact · TypeScript · Vite · `@preact/signals` · localStorage · cheerio (build-time only).
Static, no framework server, no runtime dependencies on anything but the browser.
Part of the **[Fuchsbau](https://github.com/Kemenor/fuchsbau)** family — same ethos, same
tangerine triad, ported from Flutter to CSS.

## Build & run

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # optimizer + calendar export
npm run scrape   # refresh data/fantoche-2026.json (NO_CACHE=1 to bypass the HTTP cache)
npm run build
```

The model, the scheduling problem and the phased roadmap are in
[`PLAN.md`](./PLAN.md); the data model in [`design-concept.md`](./design-concept.md).

## License

[Apache-2.0](./LICENSE) — Copyright 2026 Kemenor. Programme data belongs to Fantoche.
