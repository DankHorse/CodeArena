import { DEMO } from '../api';
import { RealParticipantProvider } from './RealParticipantProvider';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import { errorMessage } from '../auth/types';
import { deadlinePassed, participantData } from './data';
import type { Bootstrap, ParticipantEvent, ParticipantTeam, ParticipantProject, SubmissionFields } from './data';

type Selection = { eventId?: string; teamId?: string; projectId?: string };
export type Snapshot = { data: Bootstrap; event: ParticipantEvent | null; team: ParticipantTeam | null; project: ParticipantProject | null };
interface ParticipantContextValue {
  recovery?: string;
  registrationConfirmed?: boolean;
  registerCurrentEvent?: () => Promise<void>;
  snapshot: Snapshot | null; loading: boolean; busy: boolean; error: string; message: string; locked: boolean;
  refresh: () => Promise<void>;
  selectEvent: (id: string) => Promise<void>;
  selectTeam: (id: string) => Promise<void>;
  createTeam: (name: string) => Promise<void>;
  joinTeam: (code: string) => Promise<void>;
  saveSubmission: (fields: SubmissionFields, submit: boolean) => Promise<void>;
}
export const Context = createContext<ParticipantContextValue | null>(null);

export function ParticipantProvider({ children }: { children: ReactNode }) {
  return DEMO ? <DemoParticipantProvider>{children}</DemoParticipantProvider> : <RealParticipantProvider>{children}</RealParticipantProvider>;
}
function DemoParticipantProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const location = useLocation();
  const messageRoute = useRef(location.key);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [, tick] = useState(0);
  const selection = useRef<Selection>({});
  const generation = useRef(0);
  const actionPending = useRef(false);
  useEffect(() => {
    messageRoute.current = location.key;
    setMessage(''); setError('');
  }, [location.key]);

  const load = useCallback(async (preferred: Selection = selection.current) => {
    const version = ++generation.current;
    const data = await participantData.bootstrap();
    if (!user || data.user?.id !== user.id) throw new Error('Participant session changed. Please sign in again.');
    const events = data.events.filter(event => data.memberships.some(member => member.event_id === event.id && member.role === 'participant'));
    const event = events.find(event => event.id === preferred.eventId) ?? events.find(event => !deadlinePassed(event)) ?? events[0] ?? null;
    const teams = data.teams.filter(team => team.mine && team.event_id === event?.id);
    const summary = teams.find(team => team.id === preferred.teamId) ?? teams[0];
    const team = summary ? await participantData.team(summary.id) : null;
    const projects = data.projects.filter(project => project.event_id === event?.id && project.team_id === team?.id);
    const project = projects.find(project => project.id === preferred.projectId) ?? projects.find(project => project.state === 'draft') ?? projects[0] ?? null;
    if (version !== generation.current) return;
    selection.current = { eventId: event?.id, teamId: team?.id, projectId: project?.id };
    setSnapshot({ data, event, team, project });
  }, [user?.id]);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { await load(); } catch (error) { setError(errorMessage(error)); }
    finally { setLoading(false); }
  }, [load]);
  useEffect(() => {
    selection.current = {}; setSnapshot(null); setMessage('');
    void refresh();
    return () => { generation.current++; };
  }, [refresh]);
  useEffect(() => { const timer = setInterval(() => tick(value => value + 1), 1000); return () => clearInterval(timer); }, []);

  async function run(action: () => Promise<void>, success = '') {
    if (actionPending.current) return;
    const origin = location.key;
    actionPending.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); if (messageRoute.current === origin) setMessage(success); }
    catch (error) { if (messageRoute.current === origin) setError(errorMessage(error)); }
    finally { actionPending.current = false; setBusy(false); }
  }
  function editableEvent() {
    if (!snapshot?.event) throw new Error('No participant event is available.');
    if (deadlinePassed(snapshot.event)) throw new Error('The event deadline has passed. This workspace is locked.');
    return snapshot.event;
  }
  const locked = deadlinePassed(snapshot?.event ?? null) || snapshot?.project?.status === 'locked';
  const value: ParticipantContextValue = {
    snapshot, loading, busy, error, message, locked, refresh,
    selectEvent: id => run(async () => { await load({ eventId: id }); }),
    selectTeam: id => run(async () => { await load({ eventId: snapshot?.event?.id, teamId: id }); }),
    createTeam: name => run(async () => {
      const event = editableEvent();
      if (!name.trim()) throw new Error('Enter a team name.');
      const team = await participantData.createTeam(event.id, name.trim());
      await load({ eventId: team.event_id, teamId: team.id });
    }, 'Team created. Your dashboard is up to date.'),
    joinTeam: code => run(async () => {
      editableEvent();
      if (!code.trim()) throw new Error('Enter an invite code.');
      const team = await participantData.joinTeam(code.trim());
      await load({ eventId: team.event_id, teamId: team.id });
    }, 'Team joined. Your dashboard is up to date.'),
    saveSubmission: (fields, submit) => run(async () => {
      const event = editableEvent();
      if (snapshot?.project?.status === 'locked') throw new Error('This project is locked.');
      if (!snapshot?.team) throw new Error('Create or join a team before submitting.');
      if (!fields.title.trim()) throw new Error('Enter a project title.');
      if ((submit || snapshot.project?.state === 'submitted') && (!fields.summary.trim() || !fields.repo_url.trim() || !fields.track_id.trim())) throw new Error('Submitted projects require a summary, track and repository URL.');
      if (fields.track_id && !snapshot.data.tracks.some(track => track.id === fields.track_id && track.event_id === event.id)) throw new Error('Select a track for this event.');
      for (const url of [fields.repo_url, fields.demo_url]) {
        if (url) {
          let parsed: URL;
          try { parsed = new URL(url); } catch { throw new Error('Project links must be valid HTTP or HTTPS URLs.'); }
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Project links must use HTTP or HTTPS.');
        }
      }
      const project = await participantData.saveProject(event.id, snapshot.team.id, fields, submit, snapshot.project?.id);
      await load({ eventId: event.id, teamId: snapshot.team.id, projectId: project.id });
    }, 'Submission saved. Your dashboard is up to date.'),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useParticipant() {
  const value = useContext(Context);
  if (!value) throw new Error('ParticipantProvider is required.');
  return value;
}
