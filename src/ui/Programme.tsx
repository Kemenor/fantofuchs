/**
 * Browse the programme and say what you want to see.
 *
 * The list is by block rather than by screening, because the block is what you
 * choose and the optimizer is what decides *which* of its screenings you
 * attend. Showing the same film five times over as five rows would be exactly
 * the manual bookkeeping this app exists to remove.
 */
import { useMemo, useState } from 'preact/hooks';
import type { Block, Interest } from '../model/types.ts';
import { isOpenWindow } from '../model/optimize.ts';
import {
  activePerson, festival, interestedIn, plan, setInterest, showingsByBlock, venueById,
} from '../store.ts';
import { dayKey, duration, shortDay, time } from '../format.ts';
import { PeopleBar } from './PeopleBar.tsx';

const LEVELS: { level: Interest; label: string; hint: string }[] = [
  { level: 'must', label: 'Must', hint: 'Do not miss this — outranks any number of maybes' },
  { level: 'want', label: 'Want', hint: 'Would like to see it' },
  { level: 'maybe', label: 'Maybe', hint: 'Only if it fits a gap' },
];

function InterestPicker({ blockId }: { blockId: string }) {
  const person = activePerson.value;
  const current = person.interest[blockId] ?? 'no';
  return (
    <div class="interest" role="group" aria-label="How much do you want to see this?">
      {LEVELS.map(({ level, label, hint }) => (
        <button
          key={level}
          data-level={level}
          title={hint}
          aria-pressed={current === level}
          onClick={() => setInterest(person.id, blockId, current === level ? 'no' : level)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function BlockRow({ block, scheduledShowingId }: { block: Block; scheduledShowingId?: string }) {
  const [open, setOpen] = useState(false);
  const showings = showingsByBlock.get(block.id) ?? [];
  const marks = interestedIn(block.id);

  const credits = [block.director, [block.country, block.year].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(' · ');
  const runtime = block.durationMin ? duration(block.durationMin) : null;

  return (
    <div class="block-row">
      <div class="grow">
        <div class="row" style="gap:8px">
          {marks.map(({ person }) => (
            <span key={person.id} class="dot" style={`background:${person.color}`} title={person.name} />
          ))}
          <button
            class="btn ghost small"
            style="padding:0;min-height:auto;text-align:left"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            <span class="block-title">{block.title}</span>
          </button>
        </div>
        <div class="block-meta">
          {[block.category, runtime, credits, block.films.length > 1 ? `${block.films.length} films` : null]
            .filter(Boolean)
            .join(' · ')}
          {block.ageRating ? ` · ${block.ageRating}+` : ''}
        </div>
      </div>

      <InterestPicker blockId={block.id} />

      <div class="showing-list">
        {showings.map((s) => {
          const venue = venueById.get(s.venueId);
          const isPlanned = s.id === scheduledShowingId;
          return (
            <span
              key={s.id}
              class={`pill tabular${isPlanned ? ' scheduled' : ''}${s.closed ? ' closed' : ''}`}
              title={
                s.closed
                  ? 'Closed school screening — not open to the public'
                  : isOpenWindow(s)
                    ? 'Drop in any time inside this window'
                    : `${venue?.name ?? s.venueId}${isPlanned ? ' — in your plan' : ''}`
              }
            >
              {isPlanned && '✓ '}
              {shortDay(s.start)} {time(s.start)}
              {isOpenWindow(s) ? `–${time(s.end)}` : ''} · {venue?.name ?? s.venueId}
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
            On fantoche.ch ↗
          </a>
        </div>
      )}
    </div>
  );
}

export function Programme() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [day, setDay] = useState('');
  const [onlyMarked, setOnlyMarked] = useState(false);

  const categories = useMemo(
    () => [...new Set(festival.blocks.map((b) => b.category))].sort(),
    [],
  );
  const days = useMemo(
    () => [...new Set(festival.showings.map((s) => dayKey(s.start)))].sort(),
    [],
  );

  const scheduledByBlock = new Map(plan.value.items.map((it) => [it.block.id, it.showing.id]));
  const person = activePerson.value;

  const visible = festival.blocks.filter((b) => {
    if (category && b.category !== category) return false;
    if (onlyMarked && !(b.id in person.interest)) return false;
    if (day && !(showingsByBlock.get(b.id) ?? []).some((s) => dayKey(s.start) === day)) return false;
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
            placeholder="Search films, directors, sections…"
            value={query}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          />
          <select value={category} onChange={(e) => setCategory((e.target as HTMLSelectElement).value)}>
            <option value="">All sections</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={day} onChange={(e) => setDay((e.target as HTMLSelectElement).value)}>
            <option value="">All days</option>
            {days.map((d) => <option key={d} value={d}>{shortDay(new Date(`${d}T12:00:00Z`).getTime() / 1000)}</option>)}
          </select>
          <button class="chip" aria-pressed={onlyMarked} onClick={() => setOnlyMarked(!onlyMarked)}>
            Marked {markedCount > 0 && <span class="tabular">({markedCount})</span>}
          </button>
        </div>
      </div>

      <div class="section-title">
        {visible.length} of {festival.blocks.length} programmes
      </div>

      <div class="card">
        {visible.length === 0 ? (
          <div class="empty">
            <h3>Nothing matches</h3>
            <p class="small">Try a different section, day or search term.</p>
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
