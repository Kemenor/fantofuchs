# Fantofuchs — the model

What the app knows, and why it is shaped this way. The types are in
[`src/model/types.ts`](./src/model/types.ts); this is the reasoning behind them.

## Two halves

Everything splits cleanly in two, and the split is what keeps the app simple:

| | The festival | The plan |
|---|---|---|
| Comes from | scraping fantoche.ch | you |
| Changes | daily, in CI | constantly, in the browser |
| Lives in | `data/fantoche-2026.json`, bundled into the build | `localStorage` |
| Shape | `Place`, `Venue`, `Block`, `Showing` | `Person`, `Slot`, `Interest`, `Settings` |

They meet in exactly one place — the optimizer — which takes both and returns a `Plan`.
Nothing writes back into the festival data, so a re-scrape can never corrupt your plan.

## Place vs. Venue

The distinction that makes travel times work.

- A **Place** is a building with an address and coordinates: *Cinema Trafo*.
- A **Venue** is a room you sit in: *Cinema Trafo 1*, *Cinema Trafo 2*, *Cinema Trafo 3* —
  three venues, one place.

Walking time is a property of *places*. Moving between two venues in the same place is a
flat constant (a staircase, a few minutes); moving between places is a real walk. Fantoche
makes this matter: the Trafo halls are one building, Cinema Sterk is 600 m away, and the
Orient is across the river in Wettingen, about twenty minutes on foot. A model that only
knew "venues" would either treat a hall change as a walk or treat a trip to Wettingen as
free.

## Block vs. Showing vs. Film

- A **Block** is what you buy a ticket for and what you express an opinion about: either
  one feature, or a curated set of shorts.
- A **Showing** is one screening of one block, at one time, in one venue.
- A **Film** is one work inside a block. `International Competition 02` is a block of eight
  films; you cannot attend six of them.

**You choose blocks; the optimizer chooses showings.** This is the central decision. 55 of
the 91 blocks screen more than once, and picking *which* screening of each is the whole
problem — the freedom that lets a plan fit far more in than hand-planning ever does. A UI
built around screenings would put that freedom back on you and make the same film appear
five times in a list.

## Where `end` comes from

Fantoche does not publish an end time for everything, so `Showing.endSource` records how
firmly the end is known, rather than pretending:

| `endSource` | Meaning | Count in 2026 |
|---|---|---|
| `published` | A time range was printed (`Sat 5.9. • 12:00 - 20:00`) | 35 |
| `runtime` | Start plus the block's printed runtime | 129 |
| `assumed` | Neither was printed — a talk, a brunch | 45 |

The UI says so on an `assumed` slot instead of quietly showing a made-up end time.

### Opening windows

A `published` range longer than three hours is not something you sit through — it is an
exhibition or a games pop-up that is *open* for that long. Scheduling one as a six-hour
commitment would be nonsense, and the optimizer would then refuse a whole day of films
around it. So those are detected (`isOpenWindow`) and reported separately as things to drop
into, filtered to days you are actually in Baden.

## Interest, and why the weights are far apart

```
must  1000    want  50    maybe  8    no  0
```

The optimizer maximises the sum, so the *gaps* encode the trade-offs rather than any
individual number. One `must` beats any number of `maybe`s (1000 > 8 × 91). One `want`
beats six `maybe`s. That is the behaviour "must-see" implies, expressed in a way a
maximiser can act on — and it degrades gracefully: an unfittable `must` costs you the
schedule around it rather than failing outright, and is reported under *did not fit*.

For a group, weights are **summed** across the people being planned for. A film you both
want outranks one only your brother wants, without anyone needing a veto.

## Availability

Free time is a list of epoch windows per person, not a calendar. Windows may run past
midnight — they belong to the evening they started in — which is why the editor's hour
pickers go past 24 and label the overflow `01:00 +1`.

Planning **together** intersects everyone's windows: a plan proposed for hours only one of
you has free is not a plan. Planning **solo** uses just that person's.

## What is deliberately not modelled

- **Tickets and sold-out screenings.** The festival does not publish availability, and
  guessing would be worse than saying nothing.
- **Public transport.** Everything is walkable; a bus would save a few minutes on the one
  cross-river hop, and modelling timetables costs far more than it returns. The per-pair
  travel override exists for exactly this.
- **Splitting up.** The group either watches together or plans separately. Optimising a
  split-then-rejoin schedule is a much harder problem for a benefit nobody asked for.
- **Meals.** Add a free-time gap if you want to eat.
