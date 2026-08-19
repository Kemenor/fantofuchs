/** Who is being planned for — shown above every screen that depends on it. */
import { activePerson, addPerson, mode, people, setActivePerson, setMode } from '../store.ts';
import { t } from '../i18n/index.ts';

export function PeopleBar({ showMode = true }: { showMode?: boolean }) {
  const s = t.value;
  const list = people.value;
  const active = activePerson.value;
  const together = mode.value === 'together';

  return (
    <div class="row wrap" style="gap:8px">
      {list.map((p) => (
        <button
          key={p.id}
          class="chip"
          aria-pressed={p.id === active.id}
          onClick={() => setActivePerson(p.id)}
          title={s.people.edit(p.name)}
        >
          <span class="dot" style={`background:${p.color}`} aria-hidden="true" />
          {p.name}
        </button>
      ))}
      <button
        class="chip"
        onClick={() => {
          const name = prompt(s.people.addPrompt);
          if (name !== null) addPerson(name);
        }}
        title={s.people.add}
      >
        <span aria-hidden="true">+</span>
        <span class="sr-only">{s.people.add}</span>
      </button>

      {showMode && list.length > 1 && (
        <div class="row" style="margin-left:auto;gap:6px">
          <span class="small muted">{s.people.planFor}</span>
          <button class="chip" aria-pressed={together} onClick={() => setMode('together')}>
            {s.people.everyone}
          </button>
          <button class="chip" aria-pressed={!together} onClick={() => setMode('solo')}>
            {s.people.alone(active.name)}
          </button>
        </div>
      )}
    </div>
  );
}
