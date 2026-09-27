const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const eventId = '10000000-0000-4000-8000-000000000001';
const assignmentId = '20000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const judgeId = '40000000-0000-4000-8000-000000000001';
const rubricId = '50000000-0000-4000-8000-000000000001';
const criterionId = '60000000-0000-4000-8000-000000000001';
const assignment = { id: assignmentId, event_id: eventId, project_id: projectId, judge_id: judgeId, rubric_id: rubricId, status: 'in_progress' };
const detail = { assignment, project: { id: projectId, event_id: eventId, title: 'Project', description: 'Description', repository_url: null, demo_url: 'https://example.org' }, rubric: { id: rubricId, event_id: eventId, criteria: [{ id: criterionId, name: 'Impact', description: '', position: 0, weight: '100.0000', max_score: '10.000' }] } };
const evaluation = { assignment_id: assignmentId, rubric_id: rubricId, status: 'draft', feedback: 'Restored feedback', scores: [{ criterion_id: criterionId, raw_score: '7.125' }] };
function setup(options = {}) {
  const calls = [];
  const load = runtime(false, async (url, init) => {
    calls.push(url);
    assert.equal(init.credentials, 'include'); assert.equal(init.method, 'GET');
    const bodies = {
      [`/api/v1/events/${eventId}/judge-assignments/me`]: { items: options.items ?? [assignment] },
      [`/api/v1/judge-assignments/${assignmentId}`]: options.detail ?? detail,
      [`/api/v1/judge-assignments/${assignmentId}/evaluation`]: { evaluation: options.evaluation === undefined ? evaluation : options.evaluation },
      [`/api/v1/events/${eventId}`]: { id: eventId, title: 'Event', status: 'active' },
    };
    assert(Object.hasOwn(bodies, url), 'Unexpected or peer endpoint: ' + url);
    const status = options.failure?.url === url ? options.failure.status : 200;
    return { ok: status === 200, status, json: async () => status === 200 ? bodies[url] : { error: { message: 'Forbidden' } } };
  });
  return { calls, data: load('judge/data.ts') };
}
(async () => {
  const first = setup();
  await assert.rejects(() => first.data.loadJudge(judgeId), /known event/);
  assert.equal(first.calls.length, 0);
  const snapshot = await first.data.loadJudge(judgeId, eventId);
  assert.equal(first.calls[0], `/api/v1/events/${eventId}/judge-assignments/me`);
  assert.equal(first.calls[1], `/api/v1/judge-assignments/${assignmentId}`);
  assert.equal(first.calls[2], `/api/v1/judge-assignments/${assignmentId}/evaluation`);
  const review = snapshot.reviews[0];
  assert.equal(review.assignment.id, assignmentId); assert.equal(review.project.id, projectId);
  assert.equal(review.project.summary, 'Description'); assert.equal(review.project.repo_url, undefined);
  assert.equal(review.project.demo_url, 'https://example.org'); assert.equal(review.team, ''); assert.equal(review.track, '');
  assert.equal(review.evaluation.scores[criterionId], 7.125);
  assert.equal(review.evaluation.comment, 'Restored feedback'); assert.equal(review.evaluation.status, 'draft');
  assert.equal(snapshot.rubric[0].weight, 100); assert.equal(snapshot.rubric[0].max_score, 10);
  assert(!first.calls.some(url => url.includes(projectId) || url.includes('scores') || url.includes('?judge') || url.endsWith('/rubric')));
  const completed = setup({ evaluation: { ...evaluation, status: 'submitted' } });
  assert.equal((await completed.data.loadJudge(judgeId, eventId)).reviews[0].assignment.status, 'submitted');
  assert.equal((await completed.data.loadJudge(judgeId, eventId)).reviews[0].evaluation.status, 'submitted');
  const empty = setup({ evaluation: null });
  assert.equal((await empty.data.loadJudge(judgeId, eventId)).reviews[0].evaluation, null);
  for (const options of [{ items: [{ ...assignment, status: 'revoked' }] }, { detail: { ...detail, assignment: { ...assignment, status: 'revoked' } } }]) {
    const revoked = setup(options); const result = await revoked.data.loadJudge(judgeId, eventId);
    assert.equal(result.reviews.length, 0); assert.equal(result.revokedAssignmentIds[0], assignmentId);
    assert(!revoked.calls.some(url => url.endsWith('/evaluation')));
  }
  const mismatched = setup({ detail: { ...detail, rubric: { ...detail.rubric, id: 'different' } } });
  await assert.rejects(() => mismatched.data.loadJudge(judgeId, eventId), /pinned/);
  const peer = setup({ items: [{ ...assignment, judge_id: 'peer' }] });
  await assert.rejects(() => peer.data.loadJudge(judgeId, eventId), error => error.status === 403);
  assert.equal(peer.calls.length, 1);
  const wrongEvaluation = setup({ evaluation: { ...evaluation, assignment_id: 'peer-assignment' } });
  await assert.rejects(() => wrongEvaluation.data.loadJudge(judgeId, eventId), error => error.status === 403);
  for (const status of [401, 403]) {
    for (const url of first.calls) {
      const options = {}; const context = setup(options);
      await context.data.loadJudge(judgeId, eventId);
      options.failure = { url, status };
      await assert.rejects(() => context.data.loadJudge(judgeId, eventId), error => error.status === status);
    }
  }
  const demo = runtime(true, () => { throw Error('Demo must not fetch'); });
  await demo('api.ts').api('/api/auth/demo', 'POST', { role: 'judge' });
  const data = demo('judge/data.ts'); const initial = await data.loadJudge('jdg_01');
  const editable = initial.reviews.find(item => ['pending', 'in_progress'].includes(item.assignment.status));
  assert(editable); const scores = { [initial.rubric[0].id]: 1 };
  await data.saveEvaluation(editable.assignment.id, scores, 'Demo draft', false);
  const restored = (await data.loadJudge('jdg_01', initial.event.id)).reviews.find(item => item.assignment.id === editable.assignment.id);
  assert.equal(restored.evaluation.comment, 'Demo draft'); assert.equal(restored.assignment.status, 'in_progress');
  assert.equal(restored.evaluation.scores[initial.rubric[0].id], 1);
  console.log('PASS real judge loading: UUID authorization, cookies, decimal scores, feedback, submitted/null evaluations, revocation, pinned rubric, isolation, 401/403, and demo draft regression.');
})().catch(error => { console.error(error); process.exitCode = 1; });
