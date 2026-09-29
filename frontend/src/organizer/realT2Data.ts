import { api, ApiError, DEMO } from '../api';

type Decimal = number | string;
export interface RealRubricCriterion {
  id: string; name: string; description: string; weight: number; max_score: number; position: number;
}
export interface RealRubric {
  id: string; event_id: string; version: number; title: string; status: string;
  created_at: string; activated_at: string | null; criteria: RealRubricCriterion[];
}
export interface RealOrganizerAssignment {
  id: string; event_id: string; project_id: string; judge_id: string; rubric_id: string;
  status: 'pending' | 'in_progress' | 'submitted' | 'revoked'; created_at: string; updated_at: string;
}
export interface RealJudgeProgress {
  judge_id: string; assignments: number; completed: number; in_progress: number; pending: number; completion_percentage: number;
}
export interface RealJudgingProgress {
  event_id: string; total_assignments: number; completed_evaluations: number;
  pending_evaluations: number; in_progress_evaluations: number; completion_percentage: number; judges: RealJudgeProgress[];
}
export interface RealResultItem {
  rank: number | null; project_id: string; project_title: string; team_id: string;
  raw_average: number; normalized_score: number | null; completed_evaluations: number;
}
export interface RealJudgingResults {
  event_id: string; snapshot_id: string; status: string; method: string; method_version: string;
  calculated_at: string; source_evaluation_count: number; is_stale: boolean; insufficient_reason: string | null;
  items: RealResultItem[];
}
export type RealActiveRubric = { state: 'available'; data: RealRubric } | { state: 'not_active'; error: ApiError };
export type RealResultsState = { state: 'available'; data: RealJudgingResults } | { state: 'not_calculated'; error: ApiError };
export interface RealOrganizerT2Snapshot {
  eventId: string; rubrics: RealRubric[]; activeRubric: RealActiveRubric;
  assignments: RealOrganizerAssignment[]; progress: RealJudgingProgress; results: RealResultsState;
}
type RubricResponse = Omit<RealRubric, 'criteria'> & { criteria: (Omit<RealRubricCriterion, 'weight' | 'max_score'> & { weight: Decimal; max_score: Decimal })[] };
type ProgressResponse = Omit<RealJudgingProgress, 'completion_percentage' | 'judges'> & {
  completion_percentage: Decimal; judges: (Omit<RealJudgeProgress, 'completion_percentage'> & { completion_percentage: Decimal })[];
};
type ResultsResponse = Omit<RealJudgingResults, 'items'> & { items: (Omit<RealResultItem, 'raw_average' | 'normalized_score'> & { raw_average: Decimal; normalized_score: Decimal | null })[] };
function numeric(value: Decimal): number {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value))) throw new Error('Invalid numeric value in organizer T2 response.');
  return Number(value);
}
function rubric(value: RubricResponse): RealRubric {
  return { ...value, criteria: value.criteria.map(c => ({ ...c, weight: numeric(c.weight), max_score: numeric(c.max_score) })).sort((a, b) => a.position - b.position) };
}
function assertEvent(eventId: string, values: { event_id: string }[]) {
  if (values.some(value => value.event_id !== eventId)) throw new Error('Organizer T2 response does not match the requested event.');
}

// Standalone, uncached loader. Only the two documented absence states are recoverable;
// authentication, authorization, other 404s and server errors reject the entire load.
export async function loadRealOrganizerT2(eventId: string): Promise<RealOrganizerT2Snapshot> {
  if (DEMO) throw new Error('The real organizer T2 adapter is unavailable in demo mode.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) throw new Error('Provide an explicit event UUID.');
  const base = `/api/v1/events/${encodeURIComponent(eventId)}`;
  const { rubrics, activeRubric } = await loadRealRubrics(eventId);
  const { items: assignments } = await api<{ items: RealOrganizerAssignment[] }>(`${base}/judge-assignments`);
  assertEvent(eventId, assignments);
  const progress = await api<ProgressResponse>(`${base}/judging/progress`);
  assertEvent(eventId, [progress]);
  let results: RealResultsState;
  try {
    const data = await api<ResultsResponse>(`${base}/judging/results`);
    assertEvent(eventId, [data]);
    results = { state: 'available', data: { ...data, items: data.items.map(item => ({ ...item, raw_average: numeric(item.raw_average), normalized_score: item.normalized_score === null ? null : numeric(item.normalized_score) })) } };
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404 && error.code === 'RESULTS_NOT_CALCULATED')) throw error;
    results = { state: 'not_calculated', error };
  }
  return { eventId, rubrics, activeRubric, assignments,
    progress: { ...progress, completion_percentage: numeric(progress.completion_percentage), judges: progress.judges.map(judge => ({ ...judge, completion_percentage: numeric(judge.completion_percentage) })) }, results };
}

export interface RealRubricCreateInput {
  title: string;
  criteria: { name: string; description?: string; weight: Decimal; max_score: Decimal; position: number }[];
}

function requireRealUuid(value: string, label: string) {
  if (DEMO) throw new Error('The real organizer T2 adapter is unavailable in demo mode.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error(`Provide an explicit ${label} UUID.`);
}

// Creation never activates or alters an existing version. Decimal strings can be
// passed without losing precision; validation and version allocation belong to the backend.
export async function createRealRubricVersion(eventId: string, input: RealRubricCreateInput): Promise<RealRubric> {
  requireRealUuid(eventId, 'event');
  const body: RealRubricCreateInput = {
    title: input.title,
    criteria: input.criteria.map(criterion => ({
      name: criterion.name,
      ...(criterion.description === undefined ? {} : { description: criterion.description }),
      weight: criterion.weight, max_score: criterion.max_score, position: criterion.position,
    })),
  };
  const response = await api<RubricResponse>(`/api/v1/events/${encodeURIComponent(eventId)}/rubrics`, 'POST', body);
  assertEvent(eventId, [response]);
  return rubric(response);
}

export async function activateRealRubric(eventId: string, rubricId: string): Promise<RealRubric> {
  requireRealUuid(eventId, 'event');
  requireRealUuid(rubricId, 'rubric');
  const response = await api<RubricResponse>(`/api/v1/events/${encodeURIComponent(eventId)}/rubrics/${encodeURIComponent(rubricId)}/activate`, 'POST');
  assertEvent(eventId, [response]);
  if (response.id !== rubricId) throw new Error('Activation response does not match the requested rubric.');
  return rubric(response);
}

export async function loadRealRubrics(eventId: string): Promise<{ rubrics: RealRubric[]; activeRubric: RealActiveRubric }> {
  requireRealUuid(eventId, 'event');
  const base = `/api/v1/events/${encodeURIComponent(eventId)}`;
  const versions = await api<{ items: RubricResponse[] }>(`${base}/rubrics`);
  assertEvent(eventId, versions.items);
  let activeRubric: RealActiveRubric;
  try {
    const active = await api<RubricResponse>(`${base}/rubric`);
    assertEvent(eventId, [active]);
    activeRubric = { state: 'available', data: rubric(active) };
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 409 && error.code === 'ACTIVE_RUBRIC_REQUIRED')) throw error;
    activeRubric = { state: 'not_active', error };
  }
  return { rubrics: versions.items.map(rubric), activeRubric };
}


export interface RealJudgeEventAssignment {
  event_id: string;
  judge_id: string;
  status: string;
  created_at: string;
}


export async function addRealEventJudge(
  eventId: string,
  judgeId: string,
): Promise<RealJudgeEventAssignment> {
  requireRealUuid(eventId, 'event');
  requireRealUuid(judgeId, 'judge');

  const response = await api<RealJudgeEventAssignment>(
    `/api/v1/events/${encodeURIComponent(eventId)}/judges`,
    'POST',
    { judge_id: judgeId },
  );

  if (response.event_id !== eventId) {
    throw new Error(
      'Judge assignment response does not match the requested event.',
    );
  }

  if (response.judge_id !== judgeId) {
    throw new Error(
      'Judge assignment response does not match the requested judge.',
    );
  }

  return response;
}


export async function createRealJudgeAssignment(
  eventId: string,
  projectId: string,
  judgeId: string,
): Promise<RealOrganizerAssignment> {
  requireRealUuid(eventId, 'event');
  requireRealUuid(projectId, 'project');
  requireRealUuid(judgeId, 'judge');

  const response = await api<RealOrganizerAssignment>(
    `/api/v1/events/${encodeURIComponent(eventId)}/judge-assignments`,
    'POST',
    {
      project_id: projectId,
      judge_id: judgeId,
    },
  );

  assertEvent(eventId, [response]);

  if (response.project_id !== projectId) {
    throw new Error(
      'Assignment response does not match the requested project.',
    );
  }

  if (response.judge_id !== judgeId) {
    throw new Error(
      'Assignment response does not match the requested judge.',
    );
  }

  return response;
}
