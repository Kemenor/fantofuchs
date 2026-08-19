import { useState } from 'preact/hooks';
import { festival, plan } from '../store.ts';
import { Programme } from './Programme.tsx';
import { Availability } from './Availability.tsx';
import { PlanView } from './PlanView.tsx';
import { SettingsView } from './SettingsView.tsx';

type Tab = 'programme' | 'time' | 'plan' | 'settings';

export function App() {
  const [tab, setTab] = useState<Tab>('programme');
  const scheduled = plan.value.items.length;

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand grow">
          <span>Fanto<span class="fox">fuchs</span></span>
          <small>{festival.edition.title} · Baden</small>
        </div>
      </header>

      <main>
        {tab === 'programme' && <Programme />}
        {tab === 'time' && <Availability />}
        {tab === 'plan' && <PlanView />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <nav class="tabs" aria-label="Sections">
        {([
          ['programme', 'Films'],
          ['time', 'Time'],
          ['plan', 'Plan'],
          ['settings', 'Setup'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} aria-current={tab === id} onClick={() => setTab(id)}>
            {label}
            {id === 'plan' && scheduled > 0 && <span class="badge tabular">{scheduled}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
