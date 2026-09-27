import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { errorMessage } from '../auth/types';
import { Context } from './ParticipantProvider';
import type { Snapshot } from './ParticipantProvider';
import { acceptInvitation, createRealTeam, eventKey, loadParticipant, projectKey, projectReadOnly, readContext, saveRealProject, submitRealProject, writeContext } from './realData';

export function RealParticipantProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [recovery, setRecovery] = useState('');
  const [, tick] = useState(0);
  const route = useRef(location.key), pending = useRef(false), version = useRef(0);
  useEffect(() => { route.current = location.key; setError(''); setMessage(''); }, [location.key]);
  useEffect(() => { const timer = setInterval(() => tick(value => value + 1), 1000); return () => clearInterval(timer); }, []);
  const load = useCallback(async () => {
    if (!user) return;
    const generation = ++version.current;
    const next = await loadParticipant(user.id);
    if (generation === version.current) { setSnapshot(next); setRecovery(next.recovery); }
  }, [user?.id]);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { await load(); } catch (error) { setSnapshot(null); setError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => { void refresh(); return () => { version.current++; }; }, [refresh]);
  async function run(action: () => Promise<void>, success: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    const origin = location.key;
    try { await action(); if (route.current === origin) setMessage(success); }
    catch (error) { if (route.current === origin) setError(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  const locked = projectReadOnly(snapshot?.event ?? null, snapshot?.team ?? null, snapshot?.project ?? null, user?.id ?? '');
  return <Context.Provider value={{ snapshot, loading, busy, error, message, locked, refresh, recovery,
    selectEvent: id => run(async () => { if (!user) return; writeContext(eventKey(user.id), id); await load(); }, ''),
    selectTeam: async () => {},
    createTeam: name => run(async () => {
      if (!snapshot?.event) throw Error('Select an event from Browse Events first.');
      if (!name.trim()) throw Error('Enter a team name.');
      await createRealTeam(snapshot.event.id, name.trim()); await load();
    }, 'Team created.'),
    joinTeam: token => run(async () => {
      if (!user) return;
      const team = await acceptInvitation(token.trim()); writeContext(eventKey(user.id), team.event_id); await load();
    }, 'Invitation accepted.'),
    saveSubmission: (fields, submit) => run(async () => {
      if (!user || !snapshot?.event || !snapshot.team) throw Error('Create or join a team first.');
      if (locked) throw Error('Only the captain can edit an open draft. Submitted projects are read-only.');
      if (!fields.title.trim()) throw Error('Enter a project title.');
      // Recover a successfully created draft even if a later reload/submit failed.
      const id = snapshot.project?.id ?? readContext(projectKey(user.id, snapshot.event.id, snapshot.team.id));
      const draft = await saveRealProject(user.id, snapshot.event.id, snapshot.team.id, fields, id);
      setSnapshot(current => current && ({ ...current, project: draft }));
      if (submit) {
        const submitted = await submitRealProject(draft.id);
        setSnapshot(current => current && ({ ...current, project: submitted }));
      }
      await load();
    }, 'Project saved.'),
  }}>
    {children}
  </Context.Provider>;
}
