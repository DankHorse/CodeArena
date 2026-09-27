import { api, DEMO } from '../api';

export interface ParticipantEvent { real?: import('../data/events').BackendEvent; id: string; name: string; submissions_close: string; closed: boolean }
export interface TeamSummary { id: string; name: string; event_id: string; mine: boolean }
export interface ParticipantTeam extends TeamSummary { captain_id?: string; invite_code?: string; members: { id: string; name?: string; email?: string }[] }
export interface ParticipantProject {
  id: string; event_id: string; team_id: string; track_id?: string; submitted_at?: string | null; title: string;
  summary: string; repo_url?: string; demo_url?: string; state: 'draft' | 'submitted'; status: string;
}
export interface Bootstrap {
  user: { id: string } | null;
  memberships: { event_id: string; role: string }[];
  events: ParticipantEvent[];
  teams: TeamSummary[];
  projects: ParticipantProject[];
  tracks: { id: string; name: string; event_id: string }[];
}
export interface SubmissionFields { title: string; summary: string; track_id: string; repo_url: string; demo_url: string }

// Only the existing demo contract is known for participant data. Keep real auth
// working without sending requests to speculative real participant endpoints.
function requireParticipantApi() {
  if (!DEMO) throw new Error('Participant event, team and submission APIs are not connected in real mode yet.');
}
export const participantData = {
  bootstrap: () => { requireParticipantApi(); return api<Bootstrap>('/api/bootstrap'); },
  team: (id: string) => { requireParticipantApi(); return api<ParticipantTeam>(`/api/teams/${encodeURIComponent(id)}`); },
  createTeam: (eventId: string, name: string) => { requireParticipantApi(); return api<ParticipantTeam>('/api/teams', 'POST', { event_id: eventId, name }); },
  joinTeam: (code: string) => { requireParticipantApi(); return api<ParticipantTeam>('/api/teams/join', 'POST', { code }); },
  saveProject: (eventId: string, teamId: string, fields: SubmissionFields, submit: boolean, projectId?: string) => {
    requireParticipantApi();
    return api<ParticipantProject>(projectId ? `/api/submissions/${encodeURIComponent(projectId)}` : '/api/submissions', projectId ? 'PUT' : 'POST', { ...fields, event_id: eventId, team_id: teamId, submit });
  },
};
export const deadlinePassed = (event: ParticipantEvent | null) =>
  !!event && (event.closed || (event.real ? Date.now() > Date.parse(event.submissions_close) : Date.now() >= Date.parse(event.submissions_close)));
export const deadlineLabel = (event: ParticipantEvent) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(event.submissions_close)) + ' UTC';
