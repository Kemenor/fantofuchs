# Fantofuchs — plan, architecture, decisions

Fantoche 2026 runs **1–6 September** in Baden. This app replaces the by-hand schedule
planning of previous years (paper, then Notion).

## Status

Phases 0–4 are done: the app is usable end to end — browse, mark, set free time, get an
optimal schedule, export it. Remaining work is polish and the items under *Ideas*.

| Phase | What | State |
|---|---|---|
| 0 | Repo, CI, Pages deploy | ✅ |
| 1 | Scraper + committed data + daily refresh + verifier | ✅ |
| 2 | Data model, travel matrix, optimizer, tests | ✅ |
| 3 | Programme browsing, wishlists, availability editor | ✅ |
| 4 | Plan view, group planning, `.ics` export | ✅ |
| 5 | Polish: keyboard, empty states, print view | ▫️ |
| 6 | Ideas below, as they earn their place | ▫️ |

## Architecture

```
scraper/scrape.ts     fantoche.ch  ->  data/fantoche-2026.json   (CI, daily)
scraper/verify.ts     refuses to commit a broken parse
src/model/            types · travel matrix · optimizer          (pure, tested)
src/store.ts          localStorage + signals; everything derived
src/ui/               Programme · Availability · PlanView · SettingsView
src/ics.ts            calendar export
```

The model layer is pure — no DOM, no storage, no clock of its own — which is why it can be
tested against a brute-force reference solver. The store holds the only mutable state, and
the plan is a `computed`: there is no "optimize" button because there is nothing to
trigger. Change a wish and the schedule has already changed.

## The scheduling problem

Weighted job-interval selection: each block screens at several times, you may watch each
block at most once, two screenings clash if you cannot walk between them in time, and you
want the most interesting set overall. NP-hard in general.

Solved **exactly**, by branch and bound, because the instance is small once cut down to
blocks you actually marked. Three bounds prune it, and the tightest wins:

1. **Interest left** — the weight of every unwatched block still ahead.
2. **Time left** — free minutes remaining ÷ the shortest block ahead, times the most
   interesting blocks left. Only binds on a short evening.
3. **Clashes ahead** — the same problem with the awkward constraints dropped (no walking,
   blocks may repeat), which is plain weighted interval scheduling and falls out of one
   suffix DP up front.

Bound 3 is what makes it work. Without it, a 28-block wishlist burned 4.8 M nodes in two
seconds without proving anything; with it, the same wishlist is **proven optimal in 19 ms
and 20 k nodes**.

Walking is folded into the objective (`weight × 10000 − travelMinutes`) rather than
compared after it, so interest always dominates, less walking breaks ties for free, and a
branch that can only *match* the incumbent gets pruned instead of explored. Settling the
two in sequence was tried and is worse — see the comment in `optimize.ts`.

**Decided (2026-08-19):** the search reports `optimal` honestly. Marking all 91 blocks at
equal weight is a degenerate query that cannot be proven inside the budget; it still
returns a stable 21-film plan (unchanged over a 15× longer search), and the UI says the
answer is good rather than proven instead of quietly implying it is best.

### Correctness

The optimizer is checked against an **exhaustive reference solver** on 300 random
instances, plus 100 more asserting the returned schedule is internally consistent (no block
twice, always enough time to get there). That is the test that matters: a scheduler that is
subtly wrong looks exactly like one that is right.

## Decisions

- **Static web app, not Flutter.** The rest of the family is Flutter, but this is a
  personal tool for a laptop and a phone browser during a festival week. Vite + Preact
  ships 72 KB gzipped including the entire programme, loads instantly, and deploys as
  static files. The Fuchsbau look is ported to CSS so it still reads as a fox app.
- **Data committed to the repo, not Hugging Face.** Knabberfuchs uses HF for hundreds of
  megabytes of binary packs. This is one 229 KB JSON: committing it makes it versioned and
  diffable — you can see when the festival moves a screening — with no token and no CORS.
- **Bundled, not fetched.** The JSON is imported into the build, so the app is one request
  and works offline once loaded. CI rebuilds on every data change anyway.
- **Epoch seconds everywhere, `Intl` for display, pinned to `Europe/Zurich`.** The festival
  never crosses a DST boundary, so no date library earns its place. Display is pinned to
  the festival's timezone so a schedule planned from a train in another country does not
  silently shift by an hour.
- **Interest on blocks, not showings.** See [`design-concept.md`](./design-concept.md).

## Ideas

Not committed to; each needs to earn its place.

- **Gap filling** — after the optimal plan, offer unmarked blocks that fit the leftover
  gaps. Cheap: re-run with the unmarked blocks at weight 1 and the plan pinned.
- **Alternatives per slot** — "you could swap this for X" on each row.
- **Split plans** — let the group separate and rejoin. Materially harder; only if wanted.
- **Print view** — one page per day for a pocket.
- **Other festivals** — the model is not Fantoche-specific; only the scraper is. Would
  mean a source-per-festival plugin and a festival picker.
- **German UI** — the family is en/de/fr/it. This one is English-only for now, on purpose:
  it is a personal tool and the programme itself is English.
