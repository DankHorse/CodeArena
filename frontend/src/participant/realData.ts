import { api, ApiError } from '../api';
import { getEvent } from '../data/events';
import type { BackendEvent } from '../data/events';
import type { ParticipantEvent, ParticipantTeam, ParticipantProject, SubmissionFields } from './data';

const memory = new Map<string, string>();
export function readContext(key: string) { try { return localStorage.getItem(key) ?? memory.get(key); } catch { return memory.get(key); } }
export function writeContext(key: string, id?: string) {
  if (id) memory.set(key, id); else memory.delete(key);
  try { if (id) localStorage.setItem(key, id); else localStorage.removeItem(key); } catch { /* Navigation still works within this session. */ }
}
export const eventKey = (user: string) => `codearena-participant-event:${user}`;
export const projectKey = (user: string, event: string, team: string) => `codearena-project:${user}:${event}:${team}`;
export async function registerParticipant(user: string, event: string) {
  try { await api(`/api/v1/events/${encodeURIComponent(event)}/registrations`, 'POST'); }
  catch (error) { if (!(error instanceof ApiError && error.code === 'ALREADY_REGISTERED')) throw error; }
  writeContext(eventKey(user), event);
}
interface TeamRecord { id: string; event_id: string; name: string; captain_id: string }
interface ProjectRecord { id: string; event_id: string; team_id: string; title: string; description: string; repository_url: string | null; demo_url: string | null; status: 'draft' | 'submitted'; submitted_at: string | null }
export interface Invitation { invitation_id: string; invitee_id: string; expires_at: string; token: string }
export const participantEvent = (event: BackendEvent): ParticipantEvent => ({
  id: event.id, name: event.title, submissions_close: event.submission_deadline,
  closed: !['published', 'active'].includes(event.status), real: event,
});
export const participantProject = (project: ProjectRecord): ParticipantProject => ({
  id: project.id, event_id: project.event_id, team_id: project.team_id, title: project.title,
  summary: project.description, repo_url: project.repository_url ?? undefined, demo_url: project.demo_url ?? undefined,
  state: project.status, status: project.status, submitted_at: project.submitted_at,
});
export const projectReadOnly = (event: ParticipantEvent | null, team: ParticipantTeam | null, project: ParticipantProject | null, user: string, now = Date.now()) =>
  !event || !team || team.captain_id !== user || event.closed || now > Date.parse(event.submissions_close) || project?.state === 'submitted';
export const teamChangesClosed = (event: ParticipantEvent | null, now = Date.now()) =>
  !event?.real || event.real.status !== 'published' || now > Date.parse(event.real.registration_deadline);
export async function loadParticipant(user: string, eventId = readContext(eventKey(user))) {
  const event = eventId ? participantEvent(await getEvent(eventId)) : null;
  let team: ParticipantTeam | null = null, project: ParticipantProject | null = null, recovery = '';
  if (event) {
    try {
      const response = await api<{ team: TeamRecord; member_ids: string[] }>(`/api/v1/events/${encodeURIComponent(event.id)}/teams/me`);
      team = { ...response.team, mine: true, members: response.member_ids.map(id => ({ id })) };
    } catch (error) { if (!(error instanceof ApiError && error.code === 'TEAM_NOT_FOUND')) throw error; }
    if (team) {
      const key = projectKey(user, event.id, team.id), id = readContext(key);
      if (id) {
        try {
          const record = await api<ProjectRecord>(`/api/v1/projects/${encodeURIComponent(id)}`);
          if (record.event_id !== event.id || record.team_id !== team.id) throw new ApiError('Saved project does not belong to this team.', 404);
          project = participantProject(record);
        } catch (error) {
          if (!(error instanceof ApiError && [403, 404].includes(error.status))) throw error;
          writeContext(key); recovery = 'The saved project is no longer accessible. Its local ID was cleared. If your team already has a project, recover its UUID before creating another draft.';
        }
      }
    }
  }
  return { event, team, project, recovery, data: { user: { id: user }, memberships: [], events: event ? [event] : [], teams: team ? [team] : [], projects: project ? [project] : [], tracks: [] } };
}
export const createRealTeam = (event: string, name: string) => api<TeamRecord>(`/api/v1/events/${encodeURIComponent(event)}/teams`, 'POST', { name });
export const acceptInvitation = (token: string) => api<TeamRecord>('/api/v1/team-invitations/accept', 'POST', { token });
export const inviteMember = (team: string, invitee_id: string) => api<Invitation>(`/api/v1/teams/${encodeURIComponent(team)}/invitations`, 'POST', { invitee_id });
export async function saveRealProject(user: string, event: string, team: string, fields: SubmissionFields, id?: string) {
  const record = await api<ProjectRecord>(id ? `/api/v1/projects/${encodeURIComponent(id)}` : `/api/v1/events/${encodeURIComponent(event)}/projects`, id ? 'PATCH' : 'POST', {
    title: fields.title, description: fields.summary, repository_url: fields.repo_url || null, demo_url: fields.demo_url || null,
  });
  writeContext(projectKey(user, event, team), record.id);
  return participantProject(record);
}
export async function submitRealProject(id: string) { return participantProject(await api<ProjectRecord>(`/api/v1/projects/${encodeURIComponent(id)}/submit`, 'POST')); }
