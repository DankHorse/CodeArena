const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const event = '10000000-0000-4000-8000-000000000001';
const assignmentId = '20000000-0000-4000-8000-000000000001';
const projectId = '30000000-0000-4000-8000-000000000001';
const criterion = '40000000-0000-4000-8000-000000000001';
const second = '40000000-0000-4000-8000-000000000002';
const element = (type, props, key) => ({ type, props, key });
const jsx = { jsx: element, jsxs: element };
function harness() {
  let states = [], cursor = 0, context, evaluation = null, assignmentStatus = 'pending', fail, projectParam = projectId;
  const calls = [];
  const assignment = () => ({ id: assignmentId, project_id: projectId, event_id: event, judge_id: 'user', rubric_id: 'rubric', status: assignmentStatus });
  const load = runtime(false, async (url, init) => {
    calls.push({ url, method: init.method, body: init.body && JSON.parse(init.body) });
    assert.equal(init.credentials, 'include');
    if (fail && fail(url, init)) return { ok: false, status: fail.status, json: async () => ({ error: { message: 'Backend refused operation' } }) };
    let body;
    if (url === `/api/v1/events/${event}/judge-assignments/me`) body = { items: [assignment()] };
    else if (url === `/api/v1/events/${event}`) body = { id: event, title: 'Event', status: 'active' };
    else if (url === `/api/v1/judge-assignments/${assignmentId}`) body = { assignment: assignment(), project: { id: projectId, event_id: event, title: 'Project', description: 'Summary', repository_url: null, demo_url: null }, rubric: { id: 'rubric', event_id: event, criteria: [criterion, second].map(id => ({ id, name: id, description: '', weight: '50', max_score: '5', position: id === criterion ? 0 : 1 })) } };
    else if (url === `/api/v1/judge-assignments/${assignmentId}/evaluation`) {
      if (init.method === 'PUT') {
        const payload = JSON.parse(init.body);
        evaluation = { assignment_id: assignmentId, rubric_id: 'rubric', status: 'draft', feedback: payload.feedback.trim(), scores: payload.scores.map(s => ({ criterion_id: s.criterion_id, raw_score: String(s.score) })) };
        assignmentStatus = 'in_progress';
      }
      body = { evaluation };
    } else if (url === `/api/v1/judge-assignments/${assignmentId}/evaluation/submit`) { evaluation.status = 'submitted'; assignmentStatus = 'submitted'; body = { evaluation }; }
    else throw Error('Unexpected endpoint ' + url);
    return { ok: true, status: 200, json: async () => body };
  }, {
    react: { createContext: () => ({ Provider: 'Provider' }), useContext: () => context,
      useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useRef: initial => { const i = cursor++; return states[i] ?? (states[i] = { current: initial }); }, useCallback: fn => fn, useEffect: () => {} },
    'react/jsx-runtime': jsx,
    'react-router-dom': { useLocation: () => ({ key: 'route', search: `?event=${event}` }), useParams: () => ({ projectId: projectParam }), Link: 'Link' },
    '../auth/SessionProvider': { useSession: () => ({ user: { id: 'user', role: 'participant' } }) }, 'lucide-react': {},
  });
  const Provider = load('judge/JudgeProvider.tsx').JudgeProvider;
  function render() { cursor = 0; context = Provider({ eventId: event, children: null }).props.value; return context; }
  return { calls, render, page: () => load('pages/judge/JudgeReviewPage.tsx').JudgeReviewPage(), fail: (predicate, status) => { fail = predicate; if (fail) fail.status = status; } };
}
const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [];
(async () => {
  const h = harness(); await h.render().refresh(); h.render();
  const beforeKey = flatten(h.page()).find(n => n.type === 'form').key;
  await h.render().save(projectId, { [criterion]: 3 }, '  Authoritative feedback  ', false);
  assert.equal(h.render().snapshot.reviews[0].evaluation.comment, 'Authoritative feedback');
  assert.match(h.render().message, /Draft saved/);
  const put = h.calls.find(c => c.method === 'PUT');
  assert.equal(put.url, `/api/v1/judge-assignments/${assignmentId}/evaluation`);
  assert.deepEqual(put.body, { scores: [{ criterion_id: criterion, score: 3 }], feedback: '  Authoritative feedback  ' });
  assert.notEqual(flatten(h.page()).find(n => n.type === 'form').key, beforeKey);
  assert.equal(flatten(h.page()).find(n => n.type === 'textarea').props.defaultValue, 'Authoritative feedback');
  const count = h.calls.length;
  await h.render().save(projectId, { [criterion]: 3 }, '', true);
  assert.equal(h.calls.length, count); assert.match(h.render().error, /every criterion/);
  await h.render().save('unassigned', {}, '', false); assert.equal(h.calls.length, count);
  await h.render().save(projectId, { [criterion]: 6 }, '', false); assert.equal(h.calls.length, count);
  await h.render().save(projectId, { [criterion]: 4, [second]: 5 }, 'Final', true);
  const sequence = h.calls.slice(count);
  assert.equal(sequence[0].method, 'PUT'); assert.equal(sequence[0].body.scores[0].score, 4);
  assert.equal(sequence[1].method, 'POST'); assert.equal(sequence[1].url, put.url + '/submit');
  assert(sequence.slice(2).some(c => c.method === 'GET' && c.url === put.url));
  for (let i = 0; i < 2; i++) {
    assert.equal(h.render().snapshot.reviews[0].assignment.status, 'submitted');
    const nodes = flatten(h.page()); assert(nodes.find(n => n.type === 'fieldset').props.disabled);
    assert(!nodes.some(n => n.type === 'button' && n.props.type === 'submit'));
    await h.render().refresh();
  }
  assert(h.calls.every(c => !c.url.includes(projectId) && !c.url.includes('scores') && !c.url.includes('?judge')));
  for (const status of [401, 403, 500]) {
    for (const phase of ['PUT', 'POST', 'reload']) {
      const test = harness(); await test.render().refresh();
      test.fail((url, init) => phase === 'reload' ? init.method === 'GET' : init.method === phase, status);
      await test.render().save(projectId, { [criterion]: 3, [second]: 4 }, '', phase === 'POST');
      assert.equal(test.render().snapshot, null); assert.equal(test.render().message, '');
      assert.match(test.render().error, /Backend refused/);
      if (phase === 'PUT') assert(!test.calls.some(c => c.method === 'POST'));
    }
  }
  const demo = runtime(true, () => { throw Error('No demo network'); });
  await demo('api.ts').api('/api/auth/demo', 'POST', { role: 'judge' });
  const data = demo('judge/data.ts'); const snapshot = await data.loadJudge('jdg_01');
  const review = snapshot.reviews.find(r => r.assignment.status === 'pending' || r.assignment.status === 'in_progress');
  const scores = Object.fromEntries(snapshot.rubric.map(c => [c.id, c.max_score]));
  await data.saveEvaluation(review.assignment.id, scores, 'Demo final', true);
  assert.equal((await data.loadJudge('jdg_01')).reviews.find(r => r.assignment.id === review.assignment.id).assignment.status, 'submitted');
  console.log('PASS real PUT payload, partial drafts, authoritative reload, PUT→POST, validation, locking/reload, authorization/write failures, unassigned isolation, and demo submit.');
})().catch(error => { console.error(error); process.exitCode = 1; });
