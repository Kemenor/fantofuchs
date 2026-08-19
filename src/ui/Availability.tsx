/**
 * When each person is free.
 *
 * Availability is stored as plain epoch windows, but nobody thinks in epochs,
 * so the editor is one row per festival day. Late-night windows are allowed to
 * run past midnight (a 22:45 screening ends at 00:11) — they belong to the
 * evening they started in, not to the next morning, which is why the hour
 * pickers go past 24.
 */
import type { Slot } from '../model/types.ts';
import { activePerson, addSlot, copySlotsToAll, people, removeSlot, setSlots } from '../store.ts';
import { atHour, dayBounds, dayDotMonth, dayNames, festivalDays, midnightOf } from '../format.ts';
import { t } from '../i18n/index.ts';
import { PeopleBar } from './PeopleBar.tsx';

/** `16:00`, or `01:00 +1` once a window runs past midnight. */
function hourLabel(h: number): string {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h % 1) * 60);
  const text = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return h >= 24 ? `${text} +1` : text;
}

/**
 * Half-hour steps across the day. The range is widened to cover any window
 * already set, because a day's own bounds come from when it screens things —
 * and you are perfectly entitled to say you are free until 01:00 on a day
 * whose last film ends at midnight.
 */
function hourOptions(from: number, to: number, mustInclude: number[]): number[] {
  const low = Math.floor(Math.min(from, ...mustInclude));
  const high = Math.ceil(Math.max(to, ...mustInclude));
  const out: number[] = [];
  for (let h = low; h <= high + 0.01; h += 0.5) out.push(Number(h.toFixed(1)));
  return out;
}

function DayRow({ day }: { day: string }) {
  const s = t.value;
  const person = activePerson.value;
  const bounds = dayBounds[day];
  const midnight = midnightOf(day);
  const dayEnd = midnight + 30 * 3600;

  // A window belongs to the day it starts on, so a 22:45 → 00:11 evening does
  // not smear across two rows.
  const windows = person.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot.from >= midnight && slot.from < dayEnd)
    .sort((a, b) => a.slot.from - b.slot.from);

  const dayName = dayNames.value[day];
  const options = hourOptions(
    bounds.fromHour,
    bounds.toHour,
    windows.flatMap(({ slot }) => [(slot.from - midnight) / 3600, (slot.to - midnight) / 3600]),
  );

  const replace = (index: number, next: Slot) => {
    setSlots(person.id, person.slots.map((s, i) => (i === index ? next : s)));
  };

  return (
    <div class="day-row">
      <div>
        <strong>{dayName}</strong>
        <div class="small muted tabular">{dayDotMonth(day)}</div>
      </div>

      <div class="stack" style="gap:8px">
        {windows.length === 0 && (
          <div class="row wrap" style="gap:6px">
            <span class="small faded grow">{s.time.unavailable}</span>
            <button
              class="btn small"
              aria-label={s.time.allDayLabel(dayName)}
              onClick={() => addSlot(person.id, { from: atHour(day, bounds.fromHour), to: atHour(day, bounds.toHour) })}
            >
              {s.time.allDay}
            </button>
            <button
              class="btn small"
              aria-label={s.time.fromFourLabel(dayName)}
              onClick={() => addSlot(person.id, { from: atHour(day, 16), to: atHour(day, bounds.toHour) })}
            >
              {s.time.fromFour}
            </button>
          </div>
        )}

        {windows.map(({ slot, index }) => {
          const fromHour = (slot.from - midnight) / 3600;
          const toHour = (slot.to - midnight) / 3600;
          return (
            <div key={index} class="range">
              <select
                aria-label={s.time.freeFrom(dayName)}
                value={String(fromHour)}
                onChange={(e) => {
                  const h = Number((e.target as HTMLSelectElement).value);
                  replace(index, { from: atHour(day, h), to: Math.max(slot.to, atHour(day, h + 0.5)) });
                }}
              >
                {options.map((h) => <option key={h} value={String(h)}>{hourLabel(h)}</option>)}
              </select>
              <span class="muted">{s.time.to}</span>
              <select
                aria-label={s.time.freeUntil(dayName)}
                value={String(toHour)}
                onChange={(e) => {
                  const h = Number((e.target as HTMLSelectElement).value);
                  replace(index, { from: Math.min(slot.from, atHour(day, h - 0.5)), to: atHour(day, h) });
                }}
              >
                {options.map((h) => <option key={h} value={String(h)}>{hourLabel(h)}</option>)}
              </select>
              <button
                class="btn ghost small"
                title={s.time.removeWindow}
                aria-label={s.time.removeWindowLabel(dayName, hourLabel(fromHour), hourLabel(toHour))}
                onClick={() => removeSlot(person.id, index)}
              >
                <span aria-hidden="true">✕</span>
              </button>
              {windows[windows.length - 1].index === index && (
                <button
                  class="btn ghost small"
                  title={s.time.addWindow}
                  aria-label={s.time.addWindowLabel(dayName)}
                  onClick={() => addSlot(person.id, { from: Math.min(slot.to + 3600, atHour(day, bounds.toHour - 1)), to: atHour(day, bounds.toHour) })}
                >
                  {s.time.addWindow}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Availability() {
  const s = t.value;
  const person = activePerson.value;
  const total = person.slots.reduce((sum, slot) => sum + (slot.to - slot.from), 0);

  return (
    <>
      <PeopleBar showMode={false} />

      <h2 class="section-title">{s.time.heading(person.name)}</h2>

      <div class="card">
        <div class="day-grid">
          {festivalDays.map((day) => <DayRow key={day} day={day} />)}
        </div>
      </div>

      <div class="row wrap" style="margin-top:12px;gap:8px">
        <span class="small muted grow tabular" aria-live="polite">
          {total > 0 ? s.time.hours(Math.round(total / 3600)) : s.time.none}
        </span>
        {people.value.length > 1 && (
          <button class="btn small" onClick={() => copySlotsToAll(person.id)}>
            {s.time.copyToAll}
          </button>
        )}
        <button class="btn small ghost" onClick={() => setSlots(person.id, [])}>
          {s.time.clear}
        </button>
      </div>
    </>
  );
}
