import { api, ApiError } from '../api';
import { getEvent } from '../data/events';
import type { AssignmentStatus, JudgeSnapshot, ReviewRecord, RubricCriterion } from './data';

type Decimal = number | string;
interface RealAssignment {
  id: string; event_id: string; project_id: string; judge_id: string; rubric_id: string;
  status: Exclude<AssignmentStatus, 'recused'> | 'revoked';
}
interface RealRubric {
  id: string; event_id: string;
  criteria: (Omit<RubricCriterion, 'weight' | 'max_score'> & { weight: Decimal; max_score: Decimal })[];
}
interface AssignmentDetail {
  assignment: RealAssignment;
  project: { id: string; event_id: string; title: string; description: string; repository_url: string | null; demo_url: string | null };
  rubric: RealRubric;
}
interface RealEvaluation {
  assignment_id: string; rubric_id: string; status: 'draft' | 'submitted'; feedback: string;
  scores: { criterion_id: string; raw_score: Decimal }[];
}
function denied(): never { throw new ApiError('Judge assignment access denied. Reload your event assignments.', 403); }
function numeric(value: Decimal): number {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value))) {
    throw new Error('The judge response contains an invalid numeric value.');
  }
  return Number(value);
}

// Stateless and all-or-nothing: failures propagate without returning partial or cached reviews.
export async function loadRealJudge(userId: string, eventId: string): Promise<JudgeSnapshot> {
  if (!eventId) throw new Error('Select a known event before loading judge assignments.');
  const { items } = await api<{ items: RealAssignment[] }>(`/api/v1/events/${encodeURIComponent(eventId)}/judge-assignments/me`);
  if (items.some(item => item.judge_id !== userId || item.event_id !== eventId)) denied();
  const revokedAssignmentIds = items.filter(item => item.status === 'revoked').map(item => item.id);
  const reviews: ReviewRecord[] = [];
  let pinnedRubricId: string | undefined;
  let rubric: RubricCriterion[] = [];
  for (const listed of items) {
    if (listed.status === 'revoked') continue;
    const path = `/api/v1/judge-assignments/${encodeURIComponent(listed.id)}`;
    const detail = await api<AssignmentDetail>(path);
    const { assignment, project } = detail;
    if (assignment.id !== listed.id || assignment.judge_id !== userId || assignment.event_id !== eventId ||
        assignment.project_id !== listed.project_id || project.id !== listed.project_id || project.event_id !== eventId) denied();
    if (assignment.status === 'revoked') { revokedAssignmentIds.push(assignment.id); continue; }
    if (!['pending', 'in_progress', 'submitted'].includes(assignment.status)) throw new Error('Unsupported judge assignment state.');
    if (assignment.rubric_id !== listed.rubric_id || detail.rubric.id !== assignment.rubric_id || detail.rubric.event_id !== eventId) {
      throw new Error('The pinned assignment rubric is unavailable or mismatched. Reload assignments.');
    }
    // The current view model has one rubric. Never silently replace a pinned version.
    if (pinnedRubricId && pinnedRubricId !== detail.rubric.id) {
      throw new Error('Assignments use different pinned rubrics. The current judge view supports one rubric per event.');
    }
    pinnedRubricId = detail.rubric.id;
    rubric = detail.rubric.criteria.map(criterion => ({ ...criterion, weight: numeric(criterion.weight), max_score: numeric(criterion.max_score) })).sort((a, b) => a.position - b.position);
    const { evaluation } = await api<{ evaluation: RealEvaluation | null }>(`${path}/evaluation`);
    if (evaluation && (evaluation.assignment_id !== assignment.id || evaluation.rubric_id !== pinnedRubricId)) denied();
    if (evaluation && !['draft', 'submitted'].includes(evaluation.status)) throw new Error('Unsupported evaluation state.');
    const scores: Record<string, number> = {};
    for (const score of evaluation?.scores ?? []) {
      const criterion = rubric.find(item => item.id === score.criterion_id);
      const value = numeric(score.raw_score);
      if (!criterion || value < 0 || value > criterion.max_score || Object.hasOwn(scores, score.criterion_id)) throw new Error('Evaluation scores do not match the pinned rubric.');
      scores[score.criterion_id] = value;
    }
    reviews.push({
      assignment: { id: assignment.id, judge_id: assignment.judge_id, project_id: assignment.project_id,
        status: evaluation?.status === 'submitted' ? 'submitted' : assignment.status },
      project: { id: project.id, event_id: project.event_id, title: project.title, summary: project.description,
        repo_url: project.repository_url ?? undefined, demo_url: project.demo_url ?? undefined, team_id: '', track_id: '' },
      team: '', track: '', evaluation: evaluation ? { scores, comment: evaluation.feedback, status: evaluation.status } : null,
    });
  }
  // Event metadata is not included in assignment responses; reuse the existing event API.
  const realEvent = await getEvent(eventId);
  if (realEvent.id !== eventId) denied();
  const event = { id: realEvent.id, name: realEvent.title, closed: ['completed', 'cancelled'].includes(realEvent.status) };
  return { events: [event], event, rubric, reviews, revokedAssignmentIds };
}
