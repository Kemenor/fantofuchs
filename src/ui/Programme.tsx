/**
 * Browse the programme and say what you want to see.
 *
 * The list is by block rather than by screening, because the block is what you
 * choose and the optimizer is what decides *which* of its screenings you
 * attend. Showing the same film five times over as five rows would be exactly
 * the manual bookkeeping this app exists to remove.
 */
import { useState } from 'preact/hooks';
import type { Block, Interest } from '../model/types.ts';
import { isOpenWindow } from '../model/optimize.ts';
import {
  activePerson, festival, interestedIn, plan, setInterest, showingsByBlock, venueById,
} from '../store.ts';
import { dayKey, duration, shortDay, time } from '../format.ts';
import { t } from '../i18n/index.ts';
import { PeopleBar } from './PeopleBar.tsx';

function InterestPicker({ blockId, blockTitle }: { blockId: string; blockTitle: string }) {
  const s = t.value;
  const person = activePerson.value;
  const current = person.interest[blockId] ?? 'no';
  const levels: { level: Interest; label: string; hint: string }[] = [
    { level: 'must', label: s.interest.must, hint: s.interest.mustHint },
    { level: 'want', label: s.interest.want, hint: s.interest.wantHint },
    { level: 'maybe', label: s.interest.maybe, hint: s.interest.maybeHint },
  ];

  return (
    <div class="interest" role="group" aria-label={s.interest.group(person.name, blockTitle)}>
      {levels.map(({ level, label, hint }) => (
        <button
          key={level}
          data-level={level}
          title={hint}
          aria-pressed={current === level}
          // Read out of context — in a list of 91 rows, "Must, pressed" on its
          // own is useless without saying must-see *what*.
          aria-label={s.interest.label(label, blockTitle)}
          onClick={() => setInterest(person.id, blockId, current === level ? 'no' : level)}
        >
          <span aria-hidden="true">{label}</span>
        </button>
      ))}
    </div>
  );
}

function BlockRow({ block, scheduledShowingId }: { block: Block; scheduledShowingId?: string }) {
  const s = t.value;
  const [open, setOpen] = useState(false);
  const showings = showingsByBlock.get(block.id) ?? [];
  const marks = interestedIn(block.id);
  const venues = venueById.value;

  const credits = [block.director, [block.country, block.year].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
  const runtime = block.durationMin ? duration(block.durationMin) : null;

  return (
    <div class="block-row">
      <div class="grow">
        <div class="row" style="gap:8px">
          {marks.map(({ person, interest }) => (
            <span key={person.id} class="row" style="gap:0">
              <span class="dot" style={`background:${person.color}`} aria-hidden="true" />
              {/* Colour alone must not be the only carrier of who wants what. */}
              <span class="sr-only">{person.name}: {interest}. </span>
            </span>
          ))}
          <button
            class="btn ghost small"
            style="padding:0;min-height:auto;text-align:left"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={s.programme.toggle(block.title, open)}
          >
            <h3 class="block-title">{block.title}</h3>
          </button>
        </div>
        <div class="block-meta">
          {[block.category, runtime, credits, block.films.length > 1 ? s.programme.films(block.films.length) : null]
            .filter(Boolean)
            .join(' · ')}
          {block.ageRating ? ` · ${block.ageRating}+` : ''}
        </div>
      </div>

      <InterestPicker blockId={block.id} blockTitle={block.title} />

      <div class="showing-list">
        {showings.map((showing) => {
          const venue = venues.get(showing.venueId);
          const isPlanned = showing.id === scheduledShowingId;
          const note = showing.closed
            ? s.programme.closedNote
            : isOpenWindow(showing)
              ? s.programme.windowNote
              : isPlanned
                ? s.programme.plannedNote
                : '';
          return (
            <span
              key={showing.id}
              class={`pill tabular${isPlanned ? ' scheduled' : ''}${showing.closed ? ' closed' : ''}`}
              title={note}
            >
              {isPlanned && <span aria-hidden="true">✓ </span>}
              {shortDay(showing.start)} {time(showing.start)}
              {isOpenWindow(showing) ? `–${time(showing.end)}` : ''} · {venue?.name ?? showing.venueId}
              {note && <span class="sr-only"> — {note}</span>}
            </span>
          );
        })}
      </div>

      {open && (
        <div class="grow" style="grid-column:1/-1">
          {block.synopsis && <p class="small muted" style="margin:4px 0 8px">{block.synopsis}</p>}
          {block.films.length > 0 && (
            <ul class="small muted" style="margin:0;padding-left:18px">
              {block.films.map((f, i) => (
                <li key={i}>
                  <strong style="color:var(--text)">{f.title}</strong>
                  {f.durationMin ? ` · ${duration(f.durationMin)}` : ''}
                  {f.director ? ` · ${f.director}` : ''}
                  {f.country ? ` · ${f.country}${f.year ? ` ${f.year}` : ''}` : ''}
                </li>
              ))}
            </ul>
          )}
          {block.badges.length > 0 && (
            <div class="row wrap small muted" style="margin-top:8px;gap:6px">
              {block.badges.map((b) => <span key={b} class="chip static">{b}</span>)}
            </div>
          )}
          <a class="small" href={block.url} target="_blank" rel="noopener" style="display:inline-block;margin-top:8px">
            {s.programme.onSite}
          </a>
        </div>
      )}
    </div>
  );
}

export function Programme() {
  const s = t.value;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [day, setDay] = useState('');
  const [onlyMarked, setOnlyMarked] = useState(false);

  const all = festival.value.blocks;
  const categories = [...new Set(all.map((b) => b.category))].sort();
  const days = [...new Set(festival.value.showings.map((x) => dayKey(x.start)))].sort();

  const scheduledByBlock = new Map(plan.value.items.map((it) => [it.block.id, it.showing.id]));
  const person = activePerson.value;

  const visible = all.filter((b) => {
    if (category && b.category !== category) return false;
    if (onlyMarked && !(b.id in person.interest)) return false;
    if (day && !(showingsByBlock.get(b.id) ?? []).some((x) => dayKey(x.start) === day)) return false;
    if (query) {
      const haystack = [b.title, b.category, b.director, b.synopsis, ...b.films.map((f) => `${f.title} ${f.director ?? ''}`)]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const markedCount = Object.keys(person.interest).length;

  return (
    <>
      <PeopleBar showMode={false} />

      <div class="card" style="margin-top:12px">
        <div class="row wrap" style="gap:8px">
          <input
            type="search"
            class="grow"
            aria-label={s.programme.searchLabel}
            placeholder={s.programme.search}
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          <select
            aria-label={s.programme.filterSection}
            value={category}
            onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}
          >
            <option value="">{s.programme.allSections}</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            aria-label={s.programme.filterDay}
            value={day}
            onChange={(e) => setDay((e.target as HTMLSelectElement).value)}
          >
            <option value="">{s.programme.allDays}</option>
            {days.map((d) => (
              <option key={d} value={d}>{shortDay(new Date(`${d}T12:00:00Z`).getTime() / 1000)}</option>
            ))}
          </select>
          <button class="chip" aria-pressed={onlyMarked} onClick={() => setOnlyMarked(!onlyMarked)}>
            {s.programme.marked} {markedCount > 0 && <span class="tabular">({markedCount})</span>}
          </button>
        </div>
      </div>

      <h2 class="section-title" aria-live="polite">
        {s.programme.count(visible.length, all.length)}
      </h2>

      <div class="card">
        {visible.length === 0 ? (
          <div class="empty">
            <h3>{s.programme.noMatch}</h3>
            <p class="small">{s.programme.noMatchHint}</p>
          </div>
        ) : (
          visible.map((b) => (
            <BlockRow key={b.id} block={b} scheduledShowingId={scheduledByBlock.get(b.id)} />
          ))
        )}
      </div>
    </>
  );
}
