/**
 * The knobs, plus the honest disclosure of where the data comes from.
 *
 * The travel table is shown rather than hidden because it is the one place the
 * app guesses: distances are straight lines inflated by a detour factor, not
 * routed walks. Seeing the numbers means you can correct one you know is wrong
 * instead of wondering why the schedule refuses a hop you would happily make.
 */
import { useState } from 'preact/hooks';
import {
  DEFAULT_SETTINGS, festival, festivalCore, people, placeById, removePerson,
  renamePerson, resetEverything, setSettings, settings, travelMatrix,
} from '../store.ts';
import { pairKey } from '../model/travel.ts';
import { date } from '../format.ts';
import { t } from '../i18n/index.ts';
import { LanguageChoiceRow, ThemeChoiceRow } from './TopControls.tsx';

function NumberSetting(
  { label, hint, value, min, max, step, unit, onChange }:
  { label: string; hint: string; value: number; min: number; max: number; step: number; unit: string; onChange: (n: number) => void },
) {
  return (
    <div class="row wrap spread" style="gap:8px;padding:10px 0;border-top:1px solid var(--line)">
      <div class="grow" style="min-width:220px">
        <div style="font-weight:600">{label}</div>
        <div class="small muted">{hint}</div>
      </div>
      <div class="row" style="gap:6px">
        <input
          type="number"
          class="tabular"
          style="width:88px"
          aria-label={`${label} in ${unit}`}
          value={value}
          min={min}
          max={max}
          step={step}
          onInput={(e) => {
            const n = Number((e.target as HTMLInputElement).value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
        />
        <span class="small muted">{unit}</span>
      </div>
    </div>
  );
}

export function SettingsView() {
  const s = t.value;
  const cfg = settings.value;
  const [showTravel, setShowTravel] = useState(false);
  const venues = festival.value.venues;

  // Only places that actually host something, paired once each.
  const usedPlaces = [...new Set(venues.map((v) => v.placeId))]
    .map((id) => placeById.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name));

  const pairs = usedPlaces.flatMap((a, i) =>
    usedPlaces.slice(i + 1).map((b) => ({ a, b, key: pairKey(a.id, b.id) })),
  );

  const venueOf = (placeId: string) =>
    venues.find((v) => v.placeId === placeId)?.id ?? '';

  return (
    <>
      <h2 class="section-title">{s.nav.language}</h2>
      <div class="card">
        <LanguageChoiceRow />
        <p class="small faded" style="margin:10px 0 0">
          {s.settings.langNote}
        </p>
      </div>

      <h2 class="section-title">{s.nav.theme}</h2>
      <div class="card">
        <ThemeChoiceRow />
      </div>

      <h2 class="section-title">{s.settings.people}</h2>
      <div class="card">
        {people.value.map((p) => (
          <div key={p.id} class="row wrap" style="gap:8px;padding:8px 0">
            <span class="dot" style={`background:${p.color}`} aria-hidden="true" />
            <input
              type="text"
              class="grow"
              aria-label={s.people.nameOf(p.name)}
              value={p.name}
              onInput={(e) => renamePerson(p.id, (e.target as HTMLInputElement).value)}
            />
            <span class="small muted tabular">
              {s.people.marked(Object.keys(p.interest).length, p.slots.length)}
            </span>
            {people.value.length > 1 && (
              <button
                class="btn danger small"
                onClick={() => {
                  if (confirm(s.people.removeConfirm(p.name))) removePerson(p.id);
                }}
              >
                {s.people.remove}
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 class="section-title">{s.settings.timing}</h2>
      <div class="card">
        <NumberSetting
          label={s.settings.buffer}
          hint={s.settings.bufferHint}
          value={cfg.bufferMin} min={0} max={60} step={5} unit={s.settings.minutes}
          onChange={(bufferMin) => setSettings({ bufferMin })}
        />
        <NumberSetting
          label={s.settings.samePlace}
          hint={s.settings.samePlaceHint}
          value={cfg.samePlaceMin} min={0} max={20} step={1} unit={s.settings.minutes}
          onChange={(samePlaceMin) => setSettings({ samePlaceMin })}
        />
        <NumberSetting
          label={s.settings.walkSpeed}
          hint={s.settings.walkSpeedHint}
          value={cfg.walkKmh} min={2} max={8} step={0.5} unit={s.settings.kmh}
          onChange={(walkKmh) => setSettings({ walkKmh })}
        />
        <NumberSetting
          label={s.settings.detour}
          hint={s.settings.detourHint}
          value={cfg.detourFactor} min={1} max={2} step={0.05} unit={s.settings.times}
          onChange={(detourFactor) => setSettings({ detourFactor })}
        />
        <div class="row wrap spread" style="gap:8px;padding:10px 0;border-top:1px solid var(--line)">
          <div class="grow" style="min-width:220px">
            <div style="font-weight:600">{s.settings.excludeClosed}</div>
            <div class="small muted">{s.settings.excludeClosedHint}</div>
          </div>
          <button
            class="chip"
            aria-pressed={cfg.excludeClosed}
            onClick={() => setSettings({ excludeClosed: !cfg.excludeClosed })}
          >
            {cfg.excludeClosed ? s.settings.skipping : s.settings.including}
          </button>
        </div>
      </div>

      <h2 class="section-title">{s.settings.walkingTitle}</h2>
      <div class="card">
        <div class="row wrap spread">
          <span class="small muted grow">
            {s.settings.walkingBlurb}
          </span>
          <button class="btn small" onClick={() => setShowTravel(!showTravel)}>
            {showTravel ? s.settings.hide : s.settings.showPairs(pairs.length)}
          </button>
        </div>

        {showTravel && (
          <div style="margin-top:12px">
            {pairs.map(({ a, b, key }) => {
              const computed = travelMatrix.value.between(venueOf(a.id), venueOf(b.id));
              const override = cfg.travelOverrides[key];
              return (
                <div key={key} class="row wrap" style="gap:8px;padding:7px 0;border-top:1px solid var(--line)">
                  <span class="grow small truncate">{a.name} ↔ {b.name}</span>
                  <input
                    type="number"
                    class="tabular"
                    style="width:76px"
                    aria-label={s.settings.pairLabel(a.name, b.name)}
                    value={override ?? computed}
                    min={0}
                    max={120}
                    onInput={(e) => {
                      const n = Number((e.target as HTMLInputElement).value);
                      setSettings({
                        travelOverrides: { ...cfg.travelOverrides, [key]: Math.max(0, n) },
                      });
                    }}
                  />
                  <span class="small muted">{s.settings.minutes}</span>
                  {override !== undefined && (
                    <button
                      class="btn ghost small"
                      title={s.settings.resetPair(computed)}
                      onClick={() => {
                        const next = { ...cfg.travelOverrides };
                        delete next[key];
                        setSettings({ travelOverrides: next });
                      }}
                    >
                      {s.settings.reset}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <h2 class="section-title">{s.settings.data}</h2>
      <div class="card">
        <p class="small muted" style="margin-top:0">
          {s.settings.dataSummary(
            festivalCore.blocks.length,
            festivalCore.showings.length,
            venues.length,
            usedPlaces.length,
          )}{' '}
          <a href={festival.value.source} target="_blank" rel="noopener">
            {s.settings.scrapedOn(date(festivalCore.scrapedAt))}
          </a>
        </p>
        <p class="small muted">{s.settings.privacy}</p>
        <p class="small muted">{s.settings.shareLives}</p>
        <div class="row wrap" style="gap:8px">
          <button
            class="btn small ghost"
            onClick={() => setSettings({ ...DEFAULT_SETTINGS, travelOverrides: {} })}
          >
            {s.settings.resetTiming}
          </button>
          <button
            class="btn danger small"
            onClick={() => {
              if (confirm(s.settings.deleteConfirm)) resetEverything();
            }}
          >
            {s.settings.deleteAll}
          </button>
        </div>
      </div>


    </>
  );
}
