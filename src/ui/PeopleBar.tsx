/** Who is being planned for — shown above every screen that depends on it. */
import { activePerson, addPerson, mode, people, setActivePerson, setMode } from '../store.ts';

export function PeopleBar({ showMode = true }: { showMode?: boolean }) {
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
          title={`Edit ${p.name}'s wishlist and free time`}
        >
          <span class="dot" style={`background:${p.color}`} aria-hidden="true" />
          {p.name}
        </button>
      ))}
      <button
        class="chip"
        onClick={() => {
          const name = prompt('Who else is coming?');
          if (name !== null) addPerson(name);
        }}
        title="Add another person"
      >
        <span aria-hidden="true">+</span>
        <span class="sr-only">Add another person</span>
      </button>

      {showMode && list.length > 1 && (
        <div class="row" style="margin-left:auto;gap:6px">
          <span class="small muted">Plan for</span>
          <button class="chip" aria-pressed={together} onClick={() => setMode('together')}>
            Everyone
          </button>
          <button class="chip" aria-pressed={!together} onClick={() => setMode('solo')}>
            {active.name} alone
          </button>
        </div>
      )}
    </div>
  );
}
