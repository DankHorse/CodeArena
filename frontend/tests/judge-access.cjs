const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const event = '10000000-0000-4000-8000-000000000001';
const other = '10000000-0000-4000-8000-000000000002';
const element = (type, props, key) => ({ type, props, key });
const jsx = { jsx: element, jsxs: element };
const snapshot = { event: { id: event }, reviews: [{ assignment: { status: 'pending' }, project: { id: 'assigned-project' } }] };
function providerHarness(demo, eventId, result, failure) {
  let states = [], cursor = 0, effects = [], context;
  const calls = [];
  const load = runtime(demo, () => { throw Error('Unexpected fetch'); }, {
    react: {
      createContext: () => ({ Provider: 'Provider' }),
      useContext: () => context,
      useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useRef: value => { const i = cursor++; return states[i] ?? (states[i] = { current: value }); },
      useCallback: fn => fn, useEffect: fn => effects.push(fn),
    },
    'react/jsx-runtime': jsx,
    'react-router-dom': { useLocation: () => ({ key: 'route' }) },
    '../auth/SessionProvider': { useSession: () => ({ user: { id: 'user', role: demo ? 'judge' : 'participant' } }) },
    './data': { loadJudge: async (...args) => { calls.push(args); if (failure) throw failure; return result; } },
  });
  const Provider = load('judge/JudgeProvider.tsx').JudgeProvider;
  function render() { cursor = 0; effects = []; context = Provider({ children: 'content', eventId }).props.value; return context; }
  return { render, calls, effects: () => effects };
}
(async () => {
  for (const [id, result, failure, allowed] of [
    [event, snapshot, null, true], [event, { ...snapshot, reviews: [] }, null, false],
    [undefined, snapshot, null, false], [event, snapshot, { message: 'Unauthorized', status: 401 }, false],
    [event, snapshot, { message: 'Forbidden', status: 403 }, false],
    [event, { ...snapshot, reviews: [], revokedAssignmentIds: ['revoked'] }, null, false],
  ]) {
    const harness = providerHarness(false, id, result, failure);
    assert.equal(harness.render().snapshot, null); assert.equal(harness.render().loading, true);
    await harness.render().refresh();
    const state = harness.render();
    assert.equal(!!state.snapshot, allowed); assert.equal(state.loading, false);
    if (!allowed) assert(state.error);
    if (!id) assert.equal(harness.calls.length, 0);
    else assert.equal(harness.calls[0][1], event);
  }
  // Layout's keyed provider is the event boundary: changing events remounts all state.
  let search = `?event=${event}`;
  const layoutRuntime = runtime(false, () => {}, {
    'react/jsx-runtime': jsx,
    'react-router-dom': { useLocation: () => ({ search }) },
    '../../auth/SessionProvider': { useSession: () => ({ user: { id: 'user' } }) },
    '../../judge/JudgeProvider': { JudgeProvider: 'Provider' },
    './JudgeEntryPage': { JudgeEntryPage: 'JudgeEntry' },
    '../../components/judge/JudgeSidebar': {}, '../../components/judge/JudgeTopbar': {},
  });
  const layout = layoutRuntime('pages/judge/JudgeLayout.tsx').JudgeLayout;
  const before = layout(); search = `?event=${other}`; const after = layout();
  assert.notEqual(before.key, after.key); assert.equal(after.props.eventId, other);
  const next = providerHarness(false, other, { ...snapshot, event: { id: other } });
  assert.equal(next.render().snapshot, null); await next.render().refresh(); assert.equal(next.calls[0][1], other);
  const real = runtime(false, () => {}), demo = runtime(true, () => {});
  const nav = real('judge/navigation.ts');
  for (const path of ['/judge', '/judge/assignments', '/judge/rubric', '/judge/review/project']) {
    const destination = `${path}?event=${event}`;
    assert.equal(nav.judgePath(path, event), destination);
    assert.equal(real('auth/destination.ts').loginDestination('participant', { from: destination }), destination);
  }
  assert.equal(nav.judgeEventId('?event=invalid'), undefined);
  assert.equal(nav.judgeEventId(`?event=${event}&event=${other}`), undefined);
  assert.equal(real('auth/destination.ts').loginDestination('participant', null), '/participant');
  assert.equal(real('auth/destination.ts').loginDestination('participant', { from: '//evil/judge?event=' + event }), '/participant');
  assert.equal(demo('judge/navigation.ts').judgePath('/judge', event), '/judge');
  assert.equal(demo('auth/destination.ts').loginDestination('participant', { from: '/judge?event=' + event }), '/participant');
  assert.equal(demo('auth/destination.ts').loginDestination('judge', { from: '/judge/assignments' }), '/judge/assignments');
  const demoProvider = providerHarness(true, undefined, snapshot); await demoProvider.render().refresh(); assert(demoProvider.render().snapshot);
  // An arbitrary project URL cannot produce a review form, even after event access.
  const reviewRuntime = runtime(false, () => {}, {
    'react/jsx-runtime': jsx, 'react-router-dom': { useLocation: () => ({ search: `?event=${event}` }), useParams: () => ({ projectId: 'unassigned' }), Link: 'Link' },
    'lucide-react': {}, '../../judge/JudgeProvider': { useJudge: () => ({ snapshot }) },
  });
  const missing = reviewRuntime('pages/judge/JudgeReviewPage.tsx').JudgeReviewPage();
  assert.equal(missing.props.className, 'judge-review-missing');
  assert.equal(missing.props.children.at(-1).props.to, `/judge/assignments?event=${event}`);
  // Inspect every rendered internal Link/NavLink, including the loading sidebar.
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : node && typeof node === 'object' ? [node, ...flatten(node.props?.children)] : [];
  for (const demoMode of [false, true]) {
    let currentSearch = `?event=${event}`, currentSnapshot = null, projectId = 'assigned-project';
    const renderRuntime = runtime(demoMode, () => { throw Error('No render fetch'); }, {
      'react/jsx-runtime': jsx,
      'react-router-dom': { useLocation: () => ({ search: currentSearch }), useParams: () => ({ projectId }), Link: 'Link', NavLink: 'NavLink' },
      'lucide-react': {},
      '../brand/CodeArenaMark': {},
      '../common/LogoutButton': { LogoutButton: 'LogoutButton' },
      '../../auth/SessionProvider': { useSession: () => ({ user: { id: 'user' } }) },
      './JudgeEntryPage': { JudgeEntryPage: 'JudgeEntry' },
    '../../components/judge/JudgeSidebar': {}, '../../components/judge/JudgeTopbar': {},
      '../../judge/JudgeProvider': {
        JudgeProvider: 'Provider',
        useJudge: () => ({ snapshot: currentSnapshot, loading: false }),
        useOptionalJudge: () => ({
          snapshot: currentSnapshot,
          loading: false,
          busy: false,
          selectEvent: async () => {},
        }),
      },
    });
    const components = [
      ['components/judge/JudgeSidebar.tsx', 'JudgeSidebar', ['/judge', '/judge/assignments', '/judge/rubric']],
      ['pages/judge/JudgeDashboard.tsx', 'JudgeDashboard', ['/judge/assignments', '/judge/assignments', '/judge/review/assigned-project']],
      ['pages/judge/JudgeAssignmentsPage.tsx', 'JudgeAssignmentsPage', ['/judge/review/assigned-project']],
      ['pages/judge/JudgeScoringGuidePage.tsx', 'JudgeScoringGuidePage', ['/judge/assignments']],
      ['pages/judge/JudgeReviewPage.tsx', 'JudgeReviewPage', ['/judge/assignments', '/judge/rubric']],
    ];
    function check(file, name, expected) {
      const links = flatten(renderRuntime(file)[name]()).filter(node => ['Link', 'NavLink'].includes(node.type));
      assert.deepEqual(links.map(node => node.props.to), expected.map(path => path + (!demoMode && currentSearch ? currentSearch : '')));
    }
    check(...components[0]); // No snapshot yet: the original bug.
    currentSnapshot = { ...snapshot, events: [], rubric: [], reviews: [{ ...snapshot.reviews[0], project: { id: 'assigned-project', title: 'Assigned' } }] };
    for (const component of components) check(...component);
    currentSearch = `?event=${other}`; // URL is authoritative even with stale snapshot.
    for (const component of components) check(...component);
    projectId = 'unassigned'; check('pages/judge/JudgeReviewPage.tsx', 'JudgeReviewPage', ['/judge/assignments']);
    currentSearch = ''; currentSnapshot = null; check(...components[0]);
    if (!demoMode) {
      const layoutNode = renderRuntime('pages/judge/JudgeLayout.tsx').JudgeLayout();
      assert.equal(layoutNode.type, 'JudgeEntry');
    }
  }
  console.log('PASS judge capability, missing/denied/revoked access, event remount/loading, event links, unassigned review, login destinations, and demo behavior.');
})().catch(error => { console.error(error); process.exitCode = 1; });
