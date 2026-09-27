const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const jsx = (type, props) => ({ type, props });
const flatten = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
const event = { id: 'real-event', name: 'Real Event', real: { status: 'completed', registration_deadline: '2000-01-01' } };
let snapshot = { event, team: null, data: { events: [event], memberships: [] } };
const common = {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  'react-router-dom': { Link: 'link', NavLink: 'nav', useLocation: () => ({ key: 'page' }) },
  'lucide-react': new Proxy({}, { get: (_, key) => key }),
  '../brand/CodeArenaMark': { CodeArenaMark: 'mark' },
  '../../auth/SessionProvider': { useSession: () => ({ user: { id: 'user' } }) },
  '../../participant/ParticipantProvider': { useParticipant: () => ({ snapshot, busy: false, loading: false }) },
  'react': { useState: v => [v, () => {}] },
};
const noFetch = () => { throw Error('Unexpected fetch'); };
for (const demo of [false, true]) {
  const component = runtime(demo, noFetch, common)('components/participant/ParticipantSidebar.tsx').ParticipantSidebar;
  const tree = flatten(component());
  assert.equal(tree.some(n => n.type === 'option' && n.props.children === 'Real Event'), !demo);
}
const teamPage = runtime(false, noFetch, common)('pages/participant/RealTeamPage.tsx').RealTeamPage;
for (const context of [{ event, team: null }, { event: null, team: null }, { event, team: { id: 'team', captain_id: 'other', members: [] } }]) {
  snapshot = { ...snapshot, ...context };
  const token = flatten(teamPage()).find(n => n.type === 'input' && n.props.name === 'token');
  assert(token); assert.equal(token.props.disabled, false);
}
console.log('PASS sidebar real/demo separation; token acceptance with absent/closed event and existing team.');

(async () => {
  let slots = [], index = 0, effects = [], loaded = 0, registered = false, hasTeam = false;
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
  const react = {
    useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; },
    useRef(initial) { const i = index++; return slots[i] ?? (slots[i] = { current: initial }); },
    useCallback(fn, deps) { const i = index++; if (!slots[i] || !equal(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = index++; if (!equal(slots[i], deps)) { slots[i] = deps; if (deps.length) effects.push(fn); } },
  };
  let ApiError;
  const data = {
    projectReadOnly: () => false,
    loadParticipant: async () => { loaded++; return { event, team: hasTeam ? { id: 'authoritative-team' } : null, recovery: '', data: { memberships: [] } }; },
    registerParticipant: async () => { registered = true; },
    createRealTeam: async () => { if (!registered) throw new ApiError('Only registered participants may create a team', 403); hasTeam = true; },
  };
  const load = runtime(false, noFetch, { ...common, react, 'react': react,
    '../auth/SessionProvider': { useSession: () => ({ user: { id: 'user' } }) },
    './ParticipantProvider': { Context: { Provider: 'context' } }, './realData': data,
  });
  ApiError = load('api.ts').ApiError;
  const Provider = load('participant/RealParticipantProvider.tsx').RealParticipantProvider;
  function render() { index = 0; const tree = Provider({ children: null }); effects.splice(0).forEach(fn => fn()); return tree.props.value; }
  render(); await new Promise(resolve => setImmediate(resolve)); let value = render();
  assert.equal(value.registrationConfirmed, false);
  await value.createTeam('Team'); value = render(); assert.match(value.error, /Register for this event/);
  const before = loaded; await value.registerCurrentEvent(); value = render(); assert(loaded > before); assert.equal(value.registrationConfirmed, true);
  await value.createTeam('Team'); value = render(); assert.equal(value.snapshot.team.id, 'authoritative-team'); assert.equal(value.error, '');
  console.log('PASS provider: unknown registration, actionable 403 recovery, register-refresh, create-refresh authoritative team.');
})().catch(error => { console.error(error); process.exitCode = 1; });
