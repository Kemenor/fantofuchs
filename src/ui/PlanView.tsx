/**
 * The answer: what to watch, in order, with the walking accounted for.
 *
 * Everything here is derived — there is no "generate" button, because there is
 * nothing to generate. Change a wish or a free hour and the schedule is already
 * different by the time you look back at it.
 */
import {
  activePerson, alternativesAt, festival, gapSuggestions, people, placeById, plan, planSlots,
  planningFor, setInterest, travelMatrix, venueById,
} from '../store.ts';
import { dayDotMonth, dayKey, duration, minutesBetween, shortDay, time, weekday } from '../format.ts';
import { t } from '../i18n/index.ts';
import { downloadIcs, planToIcs } from '../ics.ts';
import { mapsPlaceUrl, mapsWalkToUrl, mapsWalkUrl } from '../maps.ts';
import type { PlanItem } from '../model/optimize.ts';
import type { Suggestion } from '../model/suggest.ts';
import { useState } from 'preact/hooks';
import { PeopleBar } from './PeopleBar.tsx';

/** The building a showing happens in, for the maps hand-off links. */
function placeOf(venueId: string) {
  const venue = venueById.value.get(venueId);
  return venue ? placeById.get(venue.placeId) : undefined;
}

/** Films that would fit a hole, offered where the hole actually is. */
function Fillers({ suggestions }: { suggestions: Suggestion[] }) {
  const s = t.value;
  const [open, setOpen] = useState(false);
  const venues = venueById.value;
  const person = activePerson.value;
  if (suggestions.length === 0) return null;

  return (
    <div class="fillers">
      <button class="btn ghost small" aria-expanded={open} onClick={() => setOpen(!open)}>
        + {s.plan.fitsHere(suggestions.length)}
      </button>
      {open && (
        <ul class="filler-list">
          {suggestions.map(({ showing, block, travelInMin }) => (
            <li key={showing.id} class="row wrap" style="gap:8px">
              <span class="grow small">
                <span class="tabular">{time(showing.start)}–{time(showing.end)}</span>{' '}
                <strong>{block.title}</strong>{' '}
                <span class="muted">
                  {venues.get(showing.venueId)?.name ?? showing.venueId}
                  {travelInMin > 0 ? ` · ${s.plan.gapWalk(travelInMin)}` : ''}
                </span>
              </span>
              <button
                class="btn small"
                aria-label={s.plan.addFillerLabel(block.title)}
                onClick={() => setInterest(person.id, block.id, 'want')}
              >
                {s.plan.addFiller}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Gap({ previous, next }: { previous: PlanItem; next: PlanItem }) {
  const s = t.value;
  const venues = venueById.value;
  const idle = minutesBetween(previous.showing.end, next.showing.start);
  const walk = next.travelMin;
  const samePlace = travelMatrix.value.samePlace(previous.showing.venueId, next.showing.venueId);

  const parts = [
    walk > 0 ? s.plan.gapWalk(walk) : samePlace ? s.plan.gapSamePlace : null,
    next.waitMin > 0 ? s.plan.gapSpare(duration(next.waitMin)) : s.plan.gapStraightOn,
  ].filter(Boolean);

  const from = placeOf(previous.showing.venueId);
  const to = placeOf(next.showing.venueId);

  return (
    <div class="gap">
      <div />
      <div class="bar tabular">
        {s.plan.gap(idle, parts.join(' · '))}
        {walk > 0 && from && to && (
          <span class="map-route">
            {' · '}
            <a
              class="map-link"
              href={mapsWalkUrl(from, to)}
              target="_blank"
              rel="noopener"
              aria-label={s.plan.routeLabel(
                venues.get(previous.showing.venueId)?.name ?? previous.showing.venueId,
                venues.get(next.showing.venueId)?.name ?? next.showing.venueId,
              )}
            >
              {s.plan.route}
            </a>
          </span>
        )}
      </div>
    </div>
  );
}

interface DayEntry {
  item: PlanItem;
  /** Position in the whole plan, which is what alternatives are asked about. */
  index: number;
}

function DaySection(
  { day, entries, fillersAfter, leadingFillers }:
  { day: string; entries: DayEntry[]; fillersAfter: Map<string, Suggestion[]>; leadingFillers: Suggestion[] },
) {
  const s = t.value;
  const venues = venueById.value;
  const items = entries.map((e) => e.item);
  const first = items[0].showing.start;
  const last = items[items.length - 1].showing.end;
  const walking = items.reduce((sum, it) => sum + it.travelMin, 0);

  return (
    <>
      <h2 class="section-title">
        {weekday(first)} {dayDotMonth(day)} —{' '}
        <span class="tabular">
          {s.plan.daySummary(items.length, time(first), time(last))}
          {walking > 0 ? ` · ${s.plan.walking(walking)}` : ''}
        </span>
      </h2>
      <div class="card">
        <div class="timeline">
          {leadingFillers.length > 0 && <Fillers suggestions={leadingFillers} />}
          {entries.map(({ item: it, index }, i) => {
            const venue = venues.get(it.showing.venueId);
            const venueName = venue?.name ?? it.showing.venueId;
            const place = placeOf(it.showing.venueId);
            const others = people.value
              .filter((p) => p.id !== activePerson.value.id)
              .map((p) => p.name)
              .join(' & ');
            const alternatives = alternativesAt(index);
            const after = fillersAfter.get(it.showing.id) ?? [];
            return (
              <div key={it.showing.id}>
                {i > 0 && <Gap previous={items[i - 1]} next={it} />}
                <div class="slot">
                  <div>
                    <div class="slot-time tabular">{time(it.showing.start)}</div>
                    <div class="slot-end tabular">{time(it.showing.end)}</div>
                  </div>
                  <div class="grow">
                    <h3 class="block-title">{it.block.title}</h3>
                    <div class="block-meta">
                      {place ? (
                        <a
                          class="map-link"
                          href={mapsPlaceUrl(place)}
                          target="_blank"
                          rel="noopener"
                          aria-label={s.plan.mapLink(venueName)}
                        >
                          {venueName}<span class="map-route" aria-hidden="true"> ↗</span>
                        </a>
                      ) : venueName}
                      {it.block.durationMin ? ` · ${duration(it.block.durationMin)}` : ''}
                      {it.block.films.length > 1 ? ` · ${s.programme.films(it.block.films.length)}` : ''}
                      {it.pinned && others && <span> · {s.plan.jointWith(others)}</span>}
                      {it.showing.endSource === 'assumed' && (
                        <span class="faded"> · {s.plan.assumedEnd(duration(90))}</span>
                      )}
                      {i === 0 && place && (
                        <span class="map-route">
                          {' · '}
                          <a
                            class="map-link"
                            href={mapsWalkToUrl(place)}
                            target="_blank"
                            rel="noopener"
                            aria-label={s.plan.routeFromHereLabel(venueName)}
                          >
                            {s.plan.route}
                          </a>
                        </span>
                      )}
                    </div>
                    {alternatives.length > 0 && (
                      <div class="alternatives small faded" aria-label={s.plan.alsoAtLabel(it.block.title)}>
                        {s.plan.alsoAt}:{' '}
                        <span class="tabular">
                          {alternatives
                            .map((a) => `${shortDay(a.start)} ${time(a.start)} · ${venues.get(a.venueId)?.name ?? a.venueId}`)
                            .join('  ·  ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {after.length > 0 && <Fillers suggestions={after} />}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function PlanView() {
  const s = t.value;
  const venues = venueById.value;
  const current = plan.value;
  const group = planningFor.value;
  const hasSlots = planSlots.value.length > 0;
  const marked = group.some((p) => Object.keys(p.interest).length > 0);

  const byDay = new Map<string, DayEntry[]>();
  current.items.forEach((item, index) => {
    const key = dayKey(item.showing.start);
    byDay.set(key, [...(byDay.get(key) ?? []), { item, index }]);
  });

  // Suggestions are placed by the item they follow rather than by index: a gap
  // at the start of a window has no preceding item, and every window has one.
  const fillersAfter = new Map<string, Suggestion[]>();
  const leadingByDay = new Map<string, Suggestion[]>();
  for (const { gap, suggestions } of gapSuggestions.value) {
    if (gap.before) fillersAfter.set(gap.before.showing.id, suggestions);
    else leadingByDay.set(dayKey(gap.from), suggestions);
  }

  const totalMinutes = current.items.reduce(
    (sum, it) => sum + minutesBetween(it.showing.start, it.showing.end),
    0,
  );

  if (!marked) {
    return (
      <>
        <PeopleBar />
        <div class="card" style="margin-top:12px">
          <div class="empty">
            <h3>{s.plan.nothingMarked}</h3>
            <p class="small">{s.plan.nothingMarkedHint}</p>
          </div>
        </div>
      </>
    );
  }

  if (!hasSlots) {
    return (
      <>
        <PeopleBar />
        <div class="card" style="margin-top:12px">
          <div class="empty">
            <h3>{s.plan.noSharedTime}</h3>
            <p class="small">
              {group.length > 1
                ? s.plan.noSharedTimeHint(group.map((p) => p.name).join(' & '))
                : s.plan.noTimeHint}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PeopleBar />

      <div class="card" style="margin-top:12px">
        <div class="row wrap spread" style="gap:12px">
          <div role="status" aria-live="polite">
            <div style="font-size:26px;font-weight:700" class="tabular">
              {s.plan.programmes(current.items.length)}
            </div>
            <div class="small muted tabular">
              {s.plan.ofFilm(duration(totalMinutes))}
              {current.totalTravelMin > 0
                ? ` · ${s.plan.walking(current.totalTravelMin)}`
                : ` · ${s.plan.noWalking}`}
              {' · '}{s.plan.forWhom(group.map((p) => p.name).join(' & '))}
            </div>
          </div>
          <div class="row wrap" style="gap:8px">
          <button
            class="btn primary"
            disabled={current.items.length === 0}
            onClick={() =>
              downloadIcs(
                `fantoche-${festival.value.edition.year}.ics`,
                planToIcs(current, festival.value),
              )
            }
          >
            {s.plan.addToCalendar}
          </button>
          <button class="btn" disabled={current.items.length === 0} onClick={() => print()}>
            {s.plan.print}
          </button>
          </div>
        </div>

        {!current.optimal && (
          <p class="warn small" style="margin:12px 0 0">{s.plan.notProven}</p>
        )}
      </div>

      {[...byDay.entries()].sort().map(([day, entries]) => (
        <DaySection
          key={day}
          day={day}
          entries={entries}
          fillersAfter={fillersAfter}
          leadingFillers={leadingByDay.get(day) ?? []}
        />
      ))}

      {current.items.length === 0 && (
        <div class="card" style="margin-top:12px">
          <div class="empty">
            <h3>{s.plan.nothingFits}</h3>
            <p class="small">{s.plan.nothingFitsHint}</p>
          </div>
        </div>
      )}

      {current.openWindows.length > 0 && (
        <>
          <h2 class="section-title">{s.plan.dropIn}</h2>
          <div class="card">
            {current.openWindows.map(({ showing, block }) => (
              <div key={showing.id} class="block-row">
                <div class="grow">
                  <h3 class="block-title">{block.title}</h3>
                  <div class="block-meta tabular">
                    {weekday(showing.start)} {time(showing.start)}–{time(showing.end)} ·{' '}
                    {venues.get(showing.venueId)?.name ?? showing.venueId}
                  </div>
                </div>
              </div>
            ))}
            <p class="small faded" style="margin:12px 0 0">{s.plan.dropInHint}</p>
          </div>
        </>
      )}

      {current.missed.length > 0 && (
        <>
          <h2 class="section-title">{s.plan.didNotFit(current.missed.length)}</h2>
          <div class="card">
            {current.missed.map(({ block, reason }) => (
              <div key={block.id} class="block-row">
                <div class="grow">
                  <h3 class="block-title faded">{block.title}</h3>
                  <div class="block-meta">
                    {reason === 'unavailable' ? s.plan.reasonUnavailable : s.plan.reasonClash}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {people.value.length > 1 && (
        <p class="small faded" style="margin-top:16px">{s.plan.switchHint}</p>
      )}
    </>
  );
}
