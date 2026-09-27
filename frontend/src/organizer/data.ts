import { api, DEMO, exportCSV } from '../api';
import { getEvent } from '../data/events';
import type { BackendEvent } from '../data/events';
import type { Assignment, RubricCriterion } from '../judge/data';
export interface OrganizerEvent { real?: BackendEvent; id: string; name: string; description: string; submissions_close: string; registration_close: string; closed: boolean; practice: boolean; published: boolean; required_judges: number }
export interface Track { id: string; event_id: string; name: string }
export interface Team { id: string; event_id: string; name: string; members: { id: string; name: string; email: string }[] }
export interface Project { id: string; event_id: string; title: string; summary: string; team_id: string; track_id: string; state: string; status: string; repo_url?: string; demo_url?: string }
export interface Judge { id: string; name: string; track_ids: string[]; assigned: number; completed: number }
export interface Result { project_id: string; title: string; team_id: string; track_id: string; reviews: number; required: number; complete: boolean; raw_score: number | null; score: number | null; rank: number | null }
export interface AuditEntry { id: string; action: string; actor_id: string; target: string; created_at: string }
export interface OrganizerSnapshot { events: OrganizerEvent[]; event: OrganizerEvent | null; tracks: Track[]; teams: Team[]; projects: Project[]; rubric: RubricCriterion[]; judges: Judge[]; assignments: Assignment[]; results: { items: Result[]; published: boolean; method: string }; audit: AuditEntry[] }
interface Bootstrap { user: { id: string } | null; memberships: { event_id: string; role: string }[]; events: OrganizerEvent[]; tracks: Track[]; teams: Omit<Team, 'members'>[]; projects: Project[] }
function supported() { if (!DEMO) throw new Error('Organizer event, judging and results APIs are not connected in real mode yet.'); }
export async function loadOrganizer(userId: string, eventId?: string): Promise<OrganizerSnapshot> {
  if (!DEMO) {
    let knownId = eventId;
    if (!knownId) { try { knownId = localStorage.getItem(`codearena-event:${userId}`) ?? undefined; } catch { /* optional navigation context */ } }
    const real = knownId ? await getEvent(knownId) : null;
    if (real && real.organizer_id !== userId) throw new Error('Only the event owner can manage this event.');
    const event: OrganizerEvent | null = real ? {
      id: real.id, name: real.title, description: real.description,
      submissions_close: real.submission_deadline, registration_close: real.registration_deadline,
      closed: !['published', 'active'].includes(real.status) || Date.now() > Date.parse(real.submission_deadline),
      practice: false, published: false, required_judges: 0, real,
    } : null;
    if (real) { try { localStorage.setItem(`codearena-event:${userId}`, real.id); } catch { /* optional navigation context */ } }
    return { events: event ? [event] : [], event, tracks: [], teams: [], projects: [], rubric: [], judges: [], assignments: [], results: { items: [], published: false, method: '' }, audit: [] };
  }
  supported();
  const bootstrap = await api<Bootstrap>('/api/bootstrap');
  if (bootstrap.user?.id !== userId) throw new Error('Organizer session changed. Please sign in again.');
  const events = bootstrap.events.filter(event => bootstrap.memberships.some(m => m.event_id === event.id && m.role === 'organizer'));
  const event = events.find(event => event.id === eventId) ?? events.find(event => !event.closed) ?? events[0] ?? null;
  if (!event) return { events, event, tracks: [], teams: [], projects: [], rubric: [], judges: [], assignments: [], results: { items: [], published: false, method: '' }, audit: [] };
  const base = `/api/events/${encodeURIComponent(event.id)}`;
  const [rubric, judges, assignments, results, audit, teams] = await Promise.all([
    api<RubricCriterion[]>(`${base}/rubric`), api<Judge[]>(`${base}/judges`), api<Assignment[]>(`${base}/assignments`),
    api<OrganizerSnapshot['results']>(`${base}/results`), api<AuditEntry[]>(`${base}/audit`),
    Promise.all(bootstrap.teams.filter(team => team.event_id === event.id).map(team => api<Team>(`/api/teams/${encodeURIComponent(team.id)}`))),
  ]);
  return { events, event, tracks: bootstrap.tracks.filter(t => t.event_id === event.id), teams, projects: bootstrap.projects.filter(p => p.event_id === event.id), rubric, judges, assignments, results, audit };
}
export function organizerProgress(assignments: Assignment[]) {
  const active = assignments.filter(a => a.status !== 'recused');
  const completed = active.filter(a => a.status === 'submitted').length;
  return { assigned: active.length, completed, remaining: active.length - completed, percentage: active.length ? Math.round(completed / active.length * 100) : 0 };
}
export async function organizerAction<T = unknown>(eventId: string, action: string, method: string, body: unknown): Promise<T> {
  supported(); return api<T>(`/api/events/${encodeURIComponent(eventId)}${action ? '/' + action : ''}`, method, body);
}
export async function downloadResults(eventId: string) { supported(); await exportCSV(eventId); }
