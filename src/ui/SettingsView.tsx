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
  DEFAULT_SETTINGS, activePerson, festival, people, placeById, removePerson,
  renamePerson, resetEverything, setSettings, settings, travelMatrix, venueById,
} from '../store.ts';
import { pairKey } from '../model/travel.ts';

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
  const s = settings.value;
  const [showTravel, setShowTravel] = useState(false);
  const active = activePerson.value;

  // Only places that actually host something, paired once each.
  const usedPlaces = [...new Set(festival.venues.map((v) => v.placeId))]
    .map((id) => placeById.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => a.name.localeCompare(b.name));

  const pairs = usedPlaces.flatMap((a, i) =>
    usedPlaces.slice(i + 1).map((b) => ({ a, b, key: pairKey(a.id, b.id) })),
  );

  const venueOf = (placeId: string) =>
    festival.venues.find((v) => v.placeId === placeId)?.id ?? '';

  return (
    <>
      <div class="section-title">People</div>
      <div class="card">
        {people.value.map((p) => (
          <div key={p.id} class="row wrap" style="gap:8px;padding:8px 0">
            <span class="dot" style={`background:${p.color}`} />
            <input
              type="text"
              class="grow"
              value={p.name}
              onInput={(e) => renamePerson(p.id, (e.target as HTMLInputElement).value)}
            />
            <span class="small muted tabular">
              {Object.keys(p.interest).length} marked · {p.slots.length} windows
            </span>
            {people.value.length > 1 && (
              <button
                class="btn danger small"
                onClick={() => {
                  if (confirm(`Remove ${p.name} and their wishlist?`)) removePerson(p.id);
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      <div class="section-title">Timing</div>
      <div class="card">
        <NumberSetting
          label="Buffer between screenings"
          hint="Slack on top of the walk — queueing, finding a seat, a coffee."
          value={s.bufferMin} min={0} max={60} step={5} unit="min"
          onChange={(bufferMin) => setSettings({ bufferMin })}
        />
        <NumberSetting
          label="Changing hall in the same building"
          hint="Trafo 1 → Trafo 2, for instance. Counted instead of a walk."
          value={s.samePlaceMin} min={0} max={20} step={1} unit="min"
          onChange={(samePlaceMin) => setSettings({ samePlaceMin })}
        />
        <NumberSetting
          label="Walking speed"
          hint="Used with the distance between venues to work out the walk."
          value={s.walkKmh} min={2} max={8} step={0.5} unit="km/h"
          onChange={(walkKmh) => setSettings({ walkKmh })}
        />
        <NumberSetting
          label="Detour factor"
          hint="Streets are not straight lines. 1.35 is a reasonable town centre."
          value={s.detourFactor} min={1} max={2} step={0.05} unit="×"
          onChange={(detourFactor) => setSettings({ detourFactor })}
        />
        <div class="row wrap spread" style="gap:8px;padding:10px 0;border-top:1px solid var(--line)">
          <div class="grow" style="min-width:220px">
            <div style="font-weight:600">Skip closed school screenings</div>
            <div class="small muted">Some slots are reserved for school classes and not open to the public.</div>
          </div>
          <button class="chip" aria-pressed={s.excludeClosed} onClick={() => setSettings({ excludeClosed: !s.excludeClosed })}>
            {s.excludeClosed ? 'Skipping' : 'Including'}
          </button>
        </div>
      </div>

      <div class="section-title">Walking times</div>
      <div class="card">
        <div class="row wrap spread">
          <span class="small muted grow">
            Estimated from the venues' own coordinates. Override any that you know better.
          </span>
          <button class="btn small" onClick={() => setShowTravel(!showTravel)}>
            {showTravel ? 'Hide' : `Show ${pairs.length} pairs`}
          </button>
        </div>

        {showTravel && (
          <div style="margin-top:12px">
            {pairs.map(({ a, b, key }) => {
              const computed = travelMatrix.value.between(venueOf(a.id), venueOf(b.id));
              const override = s.travelOverrides[key];
              return (
                <div key={key} class="row wrap" style="gap:8px;padding:7px 0;border-top:1px solid var(--line)">
                  <span class="grow small truncate">{a.name} ↔ {b.name}</span>
                  <input
                    type="number"
                    class="tabular"
                    style="width:76px"
                    value={override ?? computed}
                    min={0}
                    max={120}
                    onInput={(e) => {
                      const n = Number((e.target as HTMLInputElement).value);
                      setSettings({
                        travelOverrides: { ...s.travelOverrides, [key]: Math.max(0, n) },
                      });
                    }}
                  />
                  <span class="small muted">min</span>
                  {override !== undefined && (
                    <button
                      class="btn ghost small"
                      title={`Back to the estimated ${computed} min`}
                      onClick={() => {
                        const next = { ...s.travelOverrides };
                        delete next[key];
                        setSettings({ travelOverrides: next });
                      }}
                    >
                      reset
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class="section-title">Data</div>
      <div class="card">
        <p class="small muted" style="margin-top:0">
          {festival.blocks.length} programmes · {festival.showings.length} screenings ·{' '}
          {festival.venues.length} venues in {usedPlaces.length} buildings.
          Scraped from <a href={festival.source} target="_blank" rel="noopener">fantoche.ch</a>{' '}
          on {new Date(festival.scrapedAt).toLocaleDateString('en-GB')}.
        </p>
        <p class="small muted">
          Your wishlists and free time are stored in this browser only — no account,
          no server, nothing leaves the device.
        </p>
        <div class="row wrap" style="gap:8px">
          <button
            class="btn small"
            onClick={() => {
              const blob = new Blob([JSON.stringify(localStorage.getItem('fantofuchs.v1'))], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'fantofuchs-backup.json';
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Export my plan
          </button>
          <button
            class="btn small ghost"
            onClick={() => setSettings({ ...DEFAULT_SETTINGS, travelOverrides: {} })}
          >
            Reset timing to defaults
          </button>
          <button
            class="btn danger small"
            onClick={() => {
              if (confirm('Delete every person, wishlist and free-time window? This cannot be undone.')) {
                resetEverything();
              }
            }}
          >
            Delete everything
          </button>
        </div>
      </div>

      <p class="small faded" style="margin-top:16px">
        Editing {active.name}. Venue names come straight from the festival:{' '}
        {[...new Set(festival.venues.map((v) => venueById.get(v.id)?.name))].slice(0, 4).join(', ')}…
      </p>
    </>
  );
}
