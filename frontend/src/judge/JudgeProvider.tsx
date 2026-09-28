import { DEMO } from '../api';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { errorMessage } from '../auth/types';
import { loadJudge, saveEvaluation } from './data';
import type { JudgeSnapshot } from './data';
interface JudgeContextValue {
  snapshot: JudgeSnapshot | null; loading: boolean; busy: boolean; error: string; message: string;
  refresh: () => Promise<void>; selectEvent: (id: string) => Promise<void>;
  save: (projectId: string, scores: Record<string, number>, comment: string, submit: boolean) => Promise<void>;
}
const Context = createContext<JudgeContextValue | null>(null);
export function JudgeProvider({ children, eventId }: { children: ReactNode; eventId?: string }) {
  const { user } = useSession();
  const location = useLocation();
  const messageRoute = useRef(location.key);
  const [snapshot, setSnapshot] = useState<JudgeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    messageRoute.current = location.key;
    setMessage(''); setError('');
  }, [location.key]);
  const selectedEvent = useRef<string | undefined>(eventId);
  const generation = useRef(0);
  const pending = useRef(false);
  const load = useCallback(async (id = selectedEvent.current) => {
    const version = ++generation.current;
    if (!user) throw new Error('Sign in as a judge to continue.');
    if (!DEMO && !eventId) throw new Error('Judge access requires a valid event UUID in the URL. Open an event-specific judge link.');
    const next = await loadJudge(user.id, DEMO ? id : eventId);
    if (!DEMO && !next.reviews.some(review => review.assignment.status !== 'recused')) throw new Error('No active judge assignments are available to you for this event.');
    if (version === generation.current) { selectedEvent.current = next.event?.id; setSnapshot(next); }
  }, [user?.id, eventId]);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    if (!DEMO) setSnapshot(null);
    try { await load(); } catch (error) { setSnapshot(null); setError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  async function selectEvent(id: string) {
    if (pending.current) return;
    setLoading(true); setMessage(''); setError('');
    try { await load(id); } catch (error) { setSnapshot(null); setError(errorMessage(error)); }
    finally { setLoading(false); }
  }
  async function save(projectId: string, scores: Record<string, number>, comment: string, submit: boolean) {
    if (pending.current) return;
    const originRoute = location.key;
    let writeStarted = false;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const review = snapshot?.reviews.find(review => review.project.id === projectId && review.assignment.judge_id === user?.id);
      if (!review) throw new Error('This project is not assigned to you.');
      if (review.assignment.status === 'submitted' || review.assignment.status === 'recused') throw new Error('This evaluation is locked.');
      const rubric = snapshot?.rubric ?? [];
      if (!rubric.length) throw new Error('The rubric is unavailable. Retry before scoring.');
      if (Object.keys(scores).some(id => !rubric.some(criterion => criterion.id === id))) throw new Error('Scores must match the current rubric.');
      for (const criterion of rubric) {
        const score = scores[criterion.id];
        if (submit && score === undefined) throw new Error('Score every criterion before submitting.');
        if (score !== undefined && (!Number.isFinite(score) || score < 0 || score > criterion.max_score)) throw new Error(`${criterion.name} must be between 0 and ${criterion.max_score}.`);
      }
      writeStarted = true;
      await saveEvaluation(review.assignment.id, scores, comment, submit);
      // Lock immediately after successful submission, even if the subsequent refresh fails.
      if (DEMO) setSnapshot(current => current && ({ ...current, reviews: current.reviews.map(item => item.assignment.id === review.assignment.id ? { ...item, assignment: { ...item.assignment, status: submit ? 'submitted' : 'in_progress' }, evaluation: { scores, comment } } : item) }));
      await load();
      if (messageRoute.current === originRoute) {
        setMessage(submit ? 'Review submitted and locked. Your progress is updated.' : 'Draft saved. You can continue this review later.');
      }
    } catch (error) {
      // A failed write/reload may mean revocation or an already-finalized evaluation.
      // Require a fresh authorized load before allowing another edit.
      if (!DEMO && writeStarted) setSnapshot(null);
      if (messageRoute.current === originRoute) setError(errorMessage(error));
    }
    finally { pending.current = false; setBusy(false); }
  }
  return <Context.Provider value={{ snapshot, loading, busy, error, message, refresh, selectEvent, save }}>{children}</Context.Provider>;
}
export function useJudge() { const context = useContext(Context); if (!context) throw new Error('JudgeProvider is required.'); return context; }
