import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { errorMessage } from '../auth/types';
import { loadOrganizer, organizerAction, downloadResults } from './data';
import type { OrganizerSnapshot } from './data';
interface OrganizerContextValue {
  snapshot: OrganizerSnapshot | null; loading: boolean; busy: boolean; error: string; message: string;
  refresh: () => Promise<void>; selectEvent: (id: string) => Promise<void>;
  saveSettings: (body: { name: string; description: string; registration_close: string; submissions_close: string; tracks: string[] }) => Promise<void>;
  saveRubric: (criteria: OrganizerSnapshot['rubric']) => Promise<void>;
  assignJudges: () => Promise<void>; publish: (published: boolean) => Promise<void>; exportResults: () => Promise<void>;
}
const Context = createContext<OrganizerContextValue | null>(null);
export function OrganizerProvider({ children }: { children: ReactNode }) {
  const { user } = useSession(); const location = useLocation();
  const [snapshot, setSnapshot] = useState<OrganizerSnapshot | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const selected = useRef<string | undefined>(undefined); const generation = useRef(0); const pending = useRef(false); const route = useRef(location.key);
  useEffect(() => { route.current = location.key; setMessage(''); setError(''); }, [location.key]);
  const load = useCallback(async (id = selected.current) => {
    const version = ++generation.current;
    if (!user) throw new Error('Sign in as an organizer.');
    const next = await loadOrganizer(user.id, id);
    if (version === generation.current) { selected.current = next.event?.id; setSnapshot(next); }
  }, [user?.id]);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { await load(); } catch (error) { setSnapshot(null); setError(errorMessage(error)); } finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  async function selectEvent(id: string) {
    if (pending.current) return;
    setLoading(true); setMessage(''); setError('');
    try { await load(id); } catch (error) { setSnapshot(null); setError(errorMessage(error)); } finally { setLoading(false); }
  }
  async function run(action: (eventId: string) => Promise<string>, reload = true) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage(''); const origin = location.key;
    try {
      if (!snapshot?.event) throw new Error('No organizer event is available.');
      const result = await action(snapshot.event.id);
      if (reload) await load();
      if (route.current === origin) setMessage(result);
    } catch (error) { if (route.current === origin) setError(errorMessage(error)); } finally { pending.current = false; setBusy(false); }
  }
  const value: OrganizerContextValue = {
    snapshot, loading, busy, error, message, refresh, selectEvent,
    saveSettings: body => run(async id => {
      if (!body.name.trim()) throw new Error('Enter an event name.');
      if (!Number.isFinite(Date.parse(body.submissions_close)) || !Number.isFinite(Date.parse(body.registration_close))) throw new Error('Enter valid deadlines.');
      if (Date.parse(body.registration_close) > Date.parse(body.submissions_close)) throw new Error('Registration must close by the submission deadline.');
      await organizerAction(id, '', 'PUT', body); return 'Event settings saved.';
    }),
    saveRubric: criteria => run(async id => {
      if (!criteria.length || Math.abs(criteria.reduce((sum, c) => sum + c.weight, 0) - 100) > 0.001) throw new Error('Rubric weights must total 100%.');
      if (criteria.some(c => !c.name.trim() || !Number.isFinite(c.weight) || c.weight < 0 || !Number.isFinite(c.max_score) || c.max_score <= 0)) throw new Error('Provide criterion names, non-negative weights and positive score ranges.');
      await organizerAction(id, 'rubric', 'PUT', criteria); return 'Rubric saved. Judges will receive it on reload.';
    }),
    assignJudges: () => run(async id => { const result = await organizerAction<{created: number; unfilled: string[]}>(id, 'assignments', 'POST', {}); return `${result.created} assignments created. ${result.unfilled.length} projects still need eligible judges.`; }),
    publish: published => run(async id => { await organizerAction(id, 'publish', 'POST', { published }); return published ? 'Results published.' : 'Results made private.'; }),
    exportResults: () => run(async id => { await downloadResults(id); return 'CSV downloaded.'; }, false),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useOrganizer() { const context = useContext(Context); if (!context) throw new Error('OrganizerProvider is required.'); return context; }
