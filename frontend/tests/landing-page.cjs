const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const jsx = (type, props) => ({ type, props });
const flat = n => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n,...flat(n.props?.children)] : [];
let publicState = { catalog: null, loading: true, error: '', refresh: () => {} };
const load = runtime(false, () => { throw Error('Landing must not fetch'); }, {
 '../../data/usePublicCatalog': { usePublicCatalog: eventsOnly => { assert.equal(eventsOnly, true); return publicState; } },
 '../../auth/SessionProvider': { useSession: () => ({ user: null, logout: async () => {} }) },
 react: { useRef: () => ({ current: null }), useEffect: () => {} },
 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-router-dom': { Link:'Link' },
 '../../components/brand/CodeArenaMark': { CodeArenaMark:'Mark' },
});
const nodes = flat(load('pages/public/LandingPage.tsx').LandingPage());
const entries = nodes.filter(n=>n.type==='Link'&&n.props.state);
assert.equal(entries.length,3);
assert.deepEqual(entries.map(n=>n.props.state.workspace),['participant','judge','organizer']);
assert.deepEqual(entries.map(n=>n.props.state.from),['/participant','/judge','/organizer']);
assert(entries.every(n=>n.props.to==='/login'));
assert(nodes.some(n => n.type === 'Link' && n.props.to === '/register' && n.props.className?.includes('landing-major-cta')));
for (const id of ['platform','participants','judges','organizers','capabilities']) {
 assert(nodes.some(n=>n.props.id===id));
 assert(nodes.some(n=>n.type==='a' && n.props.href==='#'+id));
}
assert(nodes.some(n=>n.props.to==='/events')); assert(nodes.some(n=>n.props.to==='/gallery'));
assert.equal(nodes.filter(n=>n.props.className==='landing-capability').length,7);
assert.equal(nodes.filter(n=>n.type==='figure' && n.props.className?.startsWith('landing-product-visual ')).length,3);
assert.deepEqual(nodes.filter(n=>n.props.className?.includes('landing-role-story')).map(n=>n.props.id),['participants','judges','organizers']);
assert(nodes.find(n=>n.props.id==='judges').props.className.includes('landing-role-reverse'));
assert(!nodes.some(n=>/landing-pipeline|landing-workflow|landing-panel|landing-grid/.test(n.props.className ?? '')));
const css = require('node:fs').readFileSync(require('node:path').join(__dirname,'../src/styles.css'),'utf8');
assert(css.includes('.arena-landing a, .arena-landing a * { text-decoration: none; }'));
assert(!/2pxsolid|1pxsolid|solidvar\(|24px0|\.landing-workspaceh3/.test(css));
assert(!css.includes('.landing-pipeline'));

const map = nodes.find(n => n.props.className === 'landing-platform-map');
assert(map);
const mapNodes = flat(map);
assert.equal(mapNodes.filter(n => n.props.className === 'landing-map-role').length, 3);
for (const label of ['Teams', 'Projects', 'Rubrics', 'Judging', 'Results', 'Event Control']) assert(JSON.stringify(map).includes(label));
assert(!nodes.some(n => n.props.className === 'landing-system-map'));
console.log('PASS product sections, platform map, illustrative figures, exact login state, public routes and landing CSS cleanup.');

const render = () => load('pages/public/LandingPage.tsx').LandingPage();
assert(JSON.stringify(render()).includes('Loading public events'));
let retries = 0;
publicState = { catalog: null, loading: false, error: 'Backend unavailable', refresh: () => { retries++; } };
assert(JSON.stringify(render()).includes('Backend unavailable'));
flat(render()).find(n => n.type === 'button').props.onClick();
assert.equal(retries, 1);
publicState = { ...publicState, error: '', catalog: { events: [], projects: [] } };
assert(JSON.stringify(render()).includes('No public events are available right now.'));
publicState.catalog.events = Array.from({ length: 4 }, (_, i) => ({ id: `event-${i}`, name: `Live event ${i}`, lifecycle: 'published', submissionsClose: '', tracks: [] }));
const eventLinks = flat(render()).filter(n => n.type === 'Link' && n.props.to.startsWith('/events/'));
assert.deepEqual(eventLinks.map(n => n.props.to), ['/events/event-0', '/events/event-1', '/events/event-2']);

// Exercise the actual real-mode hook and adapter: only public event requests.
(async () => {
 const requests = [];
 const states = [];
 const real = runtime(false, async (url) => {
  requests.push(url);
  assert.equal(url, '/api/v1/events?offset=0&limit=100');
  return { ok: true, json: async () => ({ items: [{ id: 'real-uuid', title: 'Real arena', status: 'published', submission_deadline: '2027-01-01T00:00:00Z' }], total: 1 }) };
 }, { react: { useState: initial => [initial, value => states.push(value)], useCallback: fn => fn, useEffect: () => {} } });
 await real('data/usePublicCatalog.ts').usePublicCatalog(true).refresh();
 assert.equal(requests.length, 1);
 const catalog = states.find(value => value?.events);
 assert.equal(catalog.events[0].id, 'real-uuid');
 assert.equal(catalog.projects.length, 0);
 console.log('PASS live public adapter, event limit/navigation, loading/error/retry/empty states; no protected requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
