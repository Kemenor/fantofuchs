import { useEffect, useState } from 'preact/hooks';
import { festival, pendingImport, plan } from '../store.ts';
import { decodeShare } from '../share.ts';
import { Programme } from './Programme.tsx';
import { Availability } from './Availability.tsx';
import { PlanView } from './PlanView.tsx';
import { Share, IncomingPlan } from './Share.tsx';
import { SettingsView } from './SettingsView.tsx';

type Tab = 'programme' | 'time' | 'plan' | 'share' | 'settings';

/**
 * Pick up a plan someone sent as a link.
 *
 * The payload rides in the fragment, so it never reaches a server. The fragment
 * is cleared as soon as it is read: a share link tends to sit in a chat thread
 * and get tapped again, and the second tap should not re-offer a plan that was
 * already dealt with.
 *
 * `hashchange` matters as much as the initial load. Tapping a link while the
 * app is already open in that tab changes only the fragment — the page never
 * reloads — so without this the link would appear to do nothing at all, which
 * is exactly what happens the second time two people swap plans.
 */
function useSharedLink(): void {
  useEffect(() => {
    const consume = (): void => {
      const match = location.hash.match(/[#&]plan=([^&]+)/);
      if (!match) return;
      history.replaceState(null, '', location.pathname + location.search);
      decodeShare(match[1])
        .then((payload) => { pendingImport.value = payload; })
        .catch(() => { pendingImport.value = null; });
    };
    consume();
    addEventListener('hashchange', consume);
    return () => removeEventListener('hashchange', consume);
  }, []);
}

export function App() {
  const [tab, setTab] = useState<Tab>('programme');
  useSharedLink();
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
        {/* Above everything, on whichever tab you happen to be on. */}
        <IncomingPlan />

        {tab === 'programme' && <Programme />}
        {tab === 'time' && <Availability />}
        {tab === 'plan' && <PlanView />}
        {tab === 'share' && <Share />}
        {tab === 'settings' && <SettingsView />}
      </main>

      <nav class="tabs" aria-label="Sections">
        {([
          ['programme', 'Films'],
          ['time', 'Time'],
          ['plan', 'Plan'],
          ['share', 'Share'],
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
