const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const eventId = '10000000-0000-4000-8000-000000000001';
const uuid = n => `${n}0000000-0000-4000-8000-000000000001`;
const base = `/api/v1/events/${eventId}`;
const endpoints = ['/rubrics', '/rubric', '/judge-assignments', '/judging/progress', '/judging/results'];
const rubric = { id: uuid(2), event_id: eventId, version: 2, title: 'Impact', status: 'active', created_at: '2026-01-01T00:00:00Z', activated_at: '2026-01-02T00:00:00Z', criteria: [{ id: uuid(3), name: 'Impact', description: 'Value', weight: '100.0000', max_score: '5.500', position: 0 }] };
const assignment = { id: uuid(4), event_id: eventId, project_id: uuid(5), judge_id: uuid(6), rubric_id: rubric.id, status: 'revoked', created_at: rubric.created_at, updated_at: rubric.created_at };
const progress = { event_id: eventId, total_assignments: 17, completed_evaluations: 9, pending_evaluations: 3, in_progress_evaluations: 5, completion_percentage: '52.941', judges: [{ judge_id: uuid(6), assignments: 17, completed: 9, pending: 3, in_progress: 5, completion_percentage: '52.941' }] };
const results = { event_id: eventId, snapshot_id: uuid(7), status: 'insufficient_data', method: 'zscore', method_version: '1', calculated_at: rubric.created_at, source_evaluation_count: 8, is_stale: true, insufficient_reason: 'Not enough reviews', items: [{ rank: null, project_id: uuid(5), project_title: 'Project', team_id: uuid(8), raw_average: '72.500', normalized_score: null, completed_evaluations: 2 }] };
function setup(failure, changes = {}) {
  const calls = [];
  const bodies = { '/rubrics': { items: [rubric, { ...rubric, id: uuid(9), version: 1, status: 'archived' }] }, '/rubric': rubric, '/judge-assignments': { items: [assignment] }, '/judging/progress': progress, '/judging/results': results, ...changes };
  const load = runtime(false, async (url, init) => {
    calls.push(url); assert.equal(init.method, 'GET'); assert.equal(init.credentials, 'include'); assert.equal(init.body, undefined);
    assert.equal(init.headers['X-CodeArena-Request'], '1');
    assert(endpoints.some(path => url === base + path), 'Unexpected/peer endpoint: ' + url);
    const suffix = url.slice(base.length);
    const error = failure?.path === suffix ? failure : null;
    return { ok: !error, status: error?.status ?? 200, json: async () => error ? { error: { code: error.code, message: 'Backend message', details: { reason: 'retained' } } } : bodies[suffix] };
  });
  return { calls, adapter: load('organizer/realT2Data.ts') };
}
(async () => {
  const test = setup();
  await assert.rejects(() => test.adapter.loadRealOrganizerT2(''), /explicit event UUID/); assert.equal(test.calls.length, 0);
  const value = await test.adapter.loadRealOrganizerT2(eventId);
  assert.deepEqual(test.calls, endpoints.map(p => base + p));
  assert.equal(value.rubrics.length, 2); assert.equal(value.rubrics[1].version, 1); assert.equal(value.rubrics[1].status, 'archived');
  assert.equal(value.activeRubric.state, 'available'); assert.equal(value.activeRubric.data.id, rubric.id);
  assert.equal(value.activeRubric.data.title, rubric.title);
  assert.equal(value.rubrics[0].criteria[0].id, uuid(3)); assert.equal(value.rubrics[0].criteria[0].weight, 100); assert.equal(value.rubrics[0].criteria[0].max_score, 5.5);
  assert.deepEqual(JSON.parse(JSON.stringify(value.assignments[0])), assignment);
  assert.equal(value.progress.total_assignments, 17); assert.equal(value.progress.completion_percentage, 52.941); assert.equal(value.progress.judges[0].completion_percentage, 52.941);
  assert.deepEqual(JSON.parse(JSON.stringify(value.results.data)), { ...results, items: [{ ...results.items[0], raw_average: 72.5 }] });
  for (const field of ['published', 'complete', 'required', 'track']) assert(!(field in value.results.data) && !(field in value.results.data.items[0]));
  const missing = await setup({ path: '/judging/results', status: 404, code: 'RESULTS_NOT_CALCULATED' }).adapter.loadRealOrganizerT2(eventId);
  assert.equal(missing.results.state, 'not_calculated'); assert.equal(missing.results.error.status, 404); assert.equal(missing.results.error.code, 'RESULTS_NOT_CALCULATED'); assert.equal(missing.results.error.details.reason, 'retained');
  const inactive = await setup({ path: '/rubric', status: 409, code: 'ACTIVE_RUBRIC_REQUIRED' }).adapter.loadRealOrganizerT2(eventId);
  assert.equal(inactive.activeRubric.state, 'not_active'); assert.equal(inactive.activeRubric.error.code, 'ACTIVE_RUBRIC_REQUIRED');
  for (const path of endpoints) for (const status of [401, 403, 500]) {
    await assert.rejects(() => setup({ path, status, code: 'FORBIDDEN' }).adapter.loadRealOrganizerT2(eventId), e => e.status === status && e.code === 'FORBIDDEN');
  }
  await assert.rejects(() => setup({ path: '/judging/results', status: 404, code: 'EVENT_NOT_FOUND' }).adapter.loadRealOrganizerT2(eventId), e => e.code === 'EVENT_NOT_FOUND');
  await assert.rejects(() => setup(null, { '/judging/progress': { ...progress, event_id: uuid(9) } }).adapter.loadRealOrganizerT2(eventId), /requested event/);
  const demo = runtime(true, () => { throw Error('Demo must not fetch'); });
  await assert.rejects(() => demo('organizer/realT2Data.ts').loadRealOrganizerT2(eventId), /demo mode/);
  await demo('api.ts').api('/api/auth/demo', 'POST', { role: 'organizer' });
  const data = demo('organizer/data.ts'); const snapshot = await data.loadOrganizer('organizer');
  assert(snapshot.event && snapshot.rubric.length && snapshot.projects.length); assert.equal(typeof snapshot.results.published, 'boolean');
  const next = await data.loadOrganizer('organizer', snapshot.event.id);
  assert.equal(JSON.stringify(next), JSON.stringify(snapshot));
  console.log('PASS organizer T2 exact GET paths/cookies, explicit UUID, rubric versions/active rubric, numeric parsing, revoked assignments, authoritative progress/results, absence/errors, no peer calls, and demo isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
