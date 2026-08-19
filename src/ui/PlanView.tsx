/**
 * The answer: what to watch, in order, with the walking accounted for.
 *
 * Everything here is derived — there is no "generate" button, because there is
 * nothing to generate. Change a wish or a free hour and the schedule is already
 * different by the time you look back at it.
 */
import { festival, people, plan, planSlots, planningFor, travelMatrix, venueById } from '../store.ts';
import { dayDotMonth, dayKey, duration, minutesBetween, time, weekday } from '../format.ts';
import { t } from '../i18n/index.ts';
import { downloadIcs, planToIcs } from '../ics.ts';
import type { PlanItem } from '../model/optimize.ts';
import { PeopleBar } from './PeopleBar.tsx';

function Gap({ previous, next }: { previous: PlanItem; next: PlanItem }) {
  const s = t.value;
  const idle = minutesBetween(previous.showing.end, next.showing.start);
  const walk = next.travelMin;
  const samePlace = travelMatrix.value.samePlace(previous.showing.venueId, next.showing.venueId);

  const parts = [
    walk > 0 ? s.plan.gapWalk(walk) : samePlace ? s.plan.gapSamePlace : null,
    next.waitMin > 0 ? s.plan.gapSpare(duration(next.waitMin)) : s.plan.gapStraightOn,
  ].filter(Boolean);

  return (
    <div class="gap">
      <div />
      <div class="bar tabular">{s.plan.gap(idle, parts.join(' · '))}</div>
    </div>
  );
}

function DaySection({ day, items }: { day: string; items: PlanItem[] }) {
  const s = t.value;
  const venues = venueById.value;
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
          {items.map((it, i) => {
            const venue = venues.get(it.showing.venueId);
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
                      {venue?.name ?? it.showing.venueId}
                      {it.block.durationMin ? ` · ${duration(it.block.durationMin)}` : ''}
                      {it.block.films.length > 1 ? ` · ${s.programme.films(it.block.films.length)}` : ''}
                      {it.showing.endSource === 'assumed' && (
                        <span class="faded"> · {s.plan.assumedEnd(duration(90))}</span>
                      )}
                    </div>
                  </div>
                </div>
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

  const byDay = new Map<string, PlanItem[]>();
  for (const item of current.items) {
    const key = dayKey(item.showing.start);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
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
        </div>

        {!current.optimal && (
          <p class="warn small" style="margin:12px 0 0">{s.plan.notProven}</p>
        )}
      </div>

      {[...byDay.entries()].sort().map(([day, items]) => (
        <DaySection key={day} day={day} items={items} />
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
