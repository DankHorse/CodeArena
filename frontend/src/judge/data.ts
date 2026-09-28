import { api, DEMO } from '../api';
import { loadRealJudge } from './realData';
export type AssignmentStatus = 'pending' | 'in_progress' | 'submitted' | 'recused';
export interface JudgeEvent { id: string; name: string; closed: boolean }
export interface Assignment { id: string; judge_id: string; project_id: string; status: AssignmentStatus }
export interface RubricCriterion { id: string; name: string; description: string; weight: number; max_score: number; position: number }
export interface JudgeProject { id: string; event_id: string; title: string; summary: string; team_id: string; track_id: string; repo_url?: string; demo_url?: string }
export interface Evaluation { scores: Record<string, number>; comment: string; status?: 'draft' | 'submitted' }
export interface ReviewRecord { assignment: Assignment; project: JudgeProject; team: string; track: string; evaluation: Evaluation | null }
export interface JudgeSnapshot { events: JudgeEvent[]; event: JudgeEvent | null; rubric: RubricCriterion[]; reviews: ReviewRecord[]; revokedAssignmentIds?: string[] }
interface Bootstrap {
  user: { id: string } | null;
  memberships: { event_id: string; role: string }[];
  events: JudgeEvent[]; projects: JudgeProject[];
  teams: { id: string; name: string }[]; tracks: { id: string; name: string }[];
}
export async function loadJudge(userId: string, eventId?: string): Promise<JudgeSnapshot> {
  if (!DEMO) {
    if (!eventId) throw new Error('Select a known event before loading judge assignments.');
    return loadRealJudge(userId, eventId);
  }
  const bootstrap = await api<Bootstrap>('/api/bootstrap');
  if (bootstrap.user?.id !== userId) throw new Error('Judge session changed. Please sign in again.');
  const events = bootstrap.events.filter(event => bootstrap.memberships.some(membership => membership.event_id === event.id && membership.role === 'judge'));
  const event = events.find(event => event.id === eventId) ?? events.find(event => !event.closed) ?? events[0] ?? null;
  if (!event) return { events, event, rubric: [], reviews: [] };
  const [assigned, rubric] = await Promise.all([
    api<Assignment[]>(`/api/events/${encodeURIComponent(event.id)}/assignments`),
    api<RubricCriterion[]>(`/api/events/${encodeURIComponent(event.id)}/rubric`),
  ]);
  // Filter before fetching evaluations; never request peer evaluations.
  const own = assigned.filter(assignment => assignment.judge_id === userId);
  const reviews = await Promise.all(own.map(async assignment => {
    const project = bootstrap.projects.find(project => project.id === assignment.project_id && project.event_id === event.id);
    if (!project) throw new Error('An assigned project is unavailable. Please retry.');
    let evaluation: Evaluation | null = null;
    if (assignment.status !== 'recused') {
      const result = await api<{ assignment: Assignment; project: JudgeProject; evaluation: Evaluation | null }>(`/api/evaluations/${encodeURIComponent(assignment.id)}`);
      if (result.assignment.judge_id !== userId || result.assignment.id !== assignment.id || result.project.id !== project.id) throw new Error('Review access denied.');
      evaluation = result.evaluation ? { scores: result.evaluation.scores, comment: result.evaluation.comment ?? '' } : null;
    }
    return { assignment, project, evaluation, team: bootstrap.teams.find(team => team.id === project.team_id)?.name ?? 'Unknown team', track: bootstrap.tracks.find(track => track.id === project.track_id)?.name ?? 'Unassigned' };
  }));
  return { events, event, reviews, rubric: [...rubric].sort((a, b) => a.position - b.position) };
}
export async function saveEvaluation(assignmentId: string, scores: Record<string, number>, comment: string, submit: boolean) {
  if (!DEMO) {
    const path = `/api/v1/judge-assignments/${encodeURIComponent(assignmentId)}/evaluation`;
    await api(path, 'PUT', { scores: Object.entries(scores).map(([criterion_id, score]) => ({ criterion_id, score })), feedback: comment });
    if (submit) await api(`${path}/submit`, 'POST');
    return;
  }
  return api(`/api/evaluations/${encodeURIComponent(assignmentId)}`, 'PUT', { scores, comment, submit });
}
export const statusLabel = (status: AssignmentStatus) => ({ pending: 'Pending', in_progress: 'In progress', submitted: 'Completed', recused: 'Recused' })[status];
export function reviewCounts(reviews: ReviewRecord[]) {
  const assigned = reviews.filter(review => review.assignment.status !== 'recused').length;
  const completed = reviews.filter(review => review.assignment.status === 'submitted').length;
  return { assigned, completed, remaining: assigned - completed, inProgress: reviews.filter(review => review.assignment.status === 'in_progress').length, recused: reviews.length - assigned };
}
