const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const uuid = n => `${n}0000000-0000-4000-8000-000000000001`;
const events = [1,2,3,4,5].map(n => ({ id: uuid(n), title: 'Event '+n, status: 'active' }));
const jsx = (type, props) => ({ type, props });
const flatten = n => Array.isArray(n) ? n.flatMap(flatten) : n && typeof n === 'object' ? [n, ...flatten(n.props?.children)] : [];
(async () => {
 const calls = []; let failure = false;
 const load = runtime(false, async (url, init) => {
  calls.push(url); assert.equal(init.credentials, 'include'); assert.equal(init.method, 'GET');
  let body, status = 200;
  if (url === '/api/v1/events?offset=0&limit=100') body = { items: events, total: 5 };
  else {
   const event = events.find(e => url === `/api/v1/events/${e.id}/judge-assignments/me`); assert(event, 'Unexpected endpoint '+url);
   const n = events.indexOf(event)+1;
   if (n === 4 || n === 5) { status = n === 4 ? 401 : 403; body = { error: { message: 'Denied' } }; }
   else body = { items: (n === 1 ? ['pending','in_progress','submitted'] : n === 2 ? [] : ['revoked']).map(status => ({ event_id: event.id, judge_id: 'user', status })) };
   if (failure) { status = 500; body = { error: { message: 'Unavailable' } }; }
  }
  return { ok: status === 200, status, json: async () => body };
 });
 const choices = await load('judge/discovery.ts').discoverJudgeEvents('user');
 assert.equal(choices.length, 1); assert.equal(choices[0].assignmentCount, 3); assert.equal(choices[0].event.id, uuid(1));
 assert.equal(calls.length, 6); assert(!calls.some(c => /evaluation|scores|results/.test(c)));
 failure = true; await assert.rejects(() => load('judge/discovery.ts').discoverJudgeEvents('user'), /Unavailable/);
 assert.equal(load('auth/destination.ts').loginDestination('participant', { from: '/judge' }), '/judge');
 assert.equal(load('auth/destination.ts').loginDestination('participant', null), '/participant');
 let slots = [], cursor = 0, effects = [], found = choices;
 let pathname = '/judge';
 const user = { id: 'user', role: 'participant' };
 const renderLoad = runtime(false, () => {}, {
  react: { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v]; }, useEffect: fn => effects.push(fn) },
  'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-router-dom': {
   Link: 'Link',
   Navigate: 'Navigate',
   useLocation: () => ({ pathname, search: '' }),
  },
  'lucide-react': {
   ClipboardCheck: 'ClipboardCheck',
   CheckCircle2: 'CheckCircle2',
   Clock3: 'Clock3',
  },
  '../../components/judge/JudgeSidebar': { JudgeSidebar: 'JudgeSidebar' },
  '../../components/judge/JudgeTopbar': { JudgeTopbar: 'JudgeTopbar' },
  '../../auth/SessionProvider': { useSession: () => ({ user }) }, '../../judge/discovery': { discoverJudgeEvents: async () => found },
 });
 const Page = renderLoad('pages/judge/JudgeEntryPage.tsx').JudgeEntryPage;
 const render = () => { cursor = 0; effects = []; return Page(); };
 assert(JSON.stringify(render()).includes('Loading judge workspace'));
 effects[0](); await new Promise(resolve => setImmediate(resolve));
 let nodes = flatten(render()); assert(nodes.some(n => n.props?.to === `/judge?event=${uuid(1)}`));
 assert.equal(user.role, 'participant');
 found = [];
 effects[0]();
 await new Promise(resolve => setImmediate(resolve));

 function emptyStateName() {
  const tree = render();
  const component = flatten(tree).find(
   node => typeof node.type === 'function' &&
    node.type.name.startsWith('EmptyJudge')
  );
  assert(component, 'Expected a route-specific judge empty state.');
  return component.type.name;
 }

 pathname = '/judge';
 assert.equal(emptyStateName(), 'EmptyJudgeDashboard');

 pathname = '/judge/assignments';
 assert.equal(emptyStateName(), 'EmptyJudgeAssignments');

 pathname = '/judge/rubric';
 assert.equal(emptyStateName(), 'EmptyJudgeScoringGuide');

 const counts = load('judge/data.ts').reviewCounts(['pending','in_progress','submitted'].map(status => ({ assignment: { status } })));
 assert.equal(counts.completed, 1); assert.equal(counts.remaining, 2);
 console.log('PASS judge discovery: own assignments, route-specific empty states, excluded zero/revoked/401/403, exact event links, login, no peer calls, unchanged role.');
})().catch(error => { console.error(error); process.exitCode = 1; });
