/**
 * The answer: what to watch, in order, with the walking accounted for.
 *
 * Everything here is derived — there is no "generate" button, because there is
 * nothing to generate. Change a wish or a free hour and the schedule is already
 * different by the time you look back at it.
 */
import { festival, people, plan, planSlots, planningFor, travelMatrix, venueById } from '../store.ts';
import { dayDotMonth, dayKey, duration, minutesBetween, time, weekday } from '../format.ts';
import { downloadIcs, planToIcs } from '../ics.ts';
import type { PlanItem } from '../model/optimize.ts';
import { PeopleBar } from './PeopleBar.tsx';

function Gap({ previous, next }: { previous: PlanItem; next: PlanItem }) {
  const idle = minutesBetween(previous.showing.end, next.showing.start);
  const walk = next.travelMin;
  const samePlace = travelMatrix.value.samePlace(previous.showing.venueId, next.showing.venueId);

  const parts = [
    walk > 0 ? `${walk}′ walk` : samePlace ? 'same building' : null,
    next.waitMin > 0 ? `${duration(next.waitMin)} to spare` : 'straight on',
  ].filter(Boolean);

  return (
    <div class="gap">
      <div />
      <div class="bar tabular">{idle}′ — {parts.join(' · ')}</div>
    </div>
  );
}

function DaySection({ day, items }: { day: string; items: PlanItem[] }) {
  const first = items[0].showing.start;
  const last = items[items.length - 1].showing.end;
  const walking = items.reduce((sum, it) => sum + it.travelMin, 0);

  return (
    <>
      <h2 class="section-title">
        {weekday(first)} {dayDotMonth(day)} —{' '}
        <span class="tabular">
          {items.length} {items.length === 1 ? 'programme' : 'programmes'} · {time(first)}–{time(last)}
          {walking > 0 ? ` · ${walking}′ walking` : ''}
        </span>
      </h2>
      <div class="card">
        <div class="timeline">
          {items.map((it, i) => {
            const venue = venueById.get(it.showing.venueId);
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
                      {it.block.films.length > 1 ? ` · ${it.block.films.length} films` : ''}
                      {it.showing.endSource === 'assumed' && (
                        <span class="faded"> · end time not published, {duration(90)} assumed</span>
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
            <h3>Nothing marked yet</h3>
            <p class="small">Go to <strong>Films</strong> and mark what you want to see. The schedule builds itself from there.</p>
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
            <h3>No shared free time</h3>
            <p class="small">
              {group.length > 1
                ? `Set when ${group.map((p) => p.name).join(' and ')} are each free under Time — this plan only uses hours you all have.`
                : 'Set your free hours under Time.'}
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
              {current.items.length} programmes
            </div>
            <div class="small muted tabular">
              {duration(totalMinutes)} of film
              {current.totalTravelMin > 0 ? ` · ${current.totalTravelMin}′ walking` : ' · no walking between venues'}
              {' · '}for {group.map((p) => p.name).join(' & ')}
            </div>
          </div>
          <button
            class="btn primary"
            disabled={current.items.length === 0}
            onClick={() =>
              downloadIcs(
                `fantoche-${festival.edition.year}.ics`,
                planToIcs(current, festival),
              )
            }
          >
            Add to calendar
          </button>
        </div>

        {!current.optimal && (
          <p class="warn small" style="margin:12px 0 0">
            This is the best schedule found within the time budget, but with this many films
            marked it could not be <em>proven</em> to be the best one. Marking fewer maybes
            makes the answer exact.
          </p>
        )}
      </div>

      {[...byDay.entries()].sort().map(([day, items]) => (
        <DaySection key={day} day={day} items={items} />
      ))}

      {current.items.length === 0 && (
        <div class="card" style="margin-top:12px">
          <div class="empty">
            <h3>Nothing fits</h3>
            <p class="small">None of the films you marked screen during your free hours.</p>
          </div>
        </div>
      )}

      {current.openWindows.length > 0 && (
        <>
          <h2 class="section-title">Drop in any time</h2>
          <div class="card">
            {current.openWindows.map(({ showing, block }) => (
              <div key={showing.id} class="block-row">
                <div class="grow">
                  <h3 class="block-title">{block.title}</h3>
                  <div class="block-meta tabular">
                    {weekday(showing.start)} {time(showing.start)}–{time(showing.end)} ·{' '}
                    {venueById.get(showing.venueId)?.name ?? showing.venueId}
                  </div>
                </div>
              </div>
            ))}
            <p class="small faded" style="margin:12px 0 0">
              Exhibitions and pop-ups stay open for hours, so they are not scheduled as
              sit-down slots — fit them into a gap.
            </p>
          </div>
        </>
      )}

      {current.missed.length > 0 && (
        <>
          <h2 class="section-title">Did not fit ({current.missed.length})</h2>
          <div class="card">
            {current.missed.map(({ block, reason }) => (
              <div key={block.id} class="block-row">
                <div class="grow">
                  <h3 class="block-title faded">{block.title}</h3>
                  <div class="block-meta">
                    {reason === 'unavailable'
                      ? 'Never screens while you are free'
                      : 'Clashes with something you wanted more'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {people.value.length > 1 && (
        <p class="small faded" style="margin-top:16px">
          Planning for {group.length > 1 ? 'everyone' : group[0].name} — switch above.
          Together mode only uses hours everyone has free, and counts a film twice when you both want it.
        </p>
      )}
    </>
  );
}
