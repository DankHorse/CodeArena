const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const jsx = (type, props) => ({ type, props });
const flat = n => Array.isArray(n) ? n.flatMap(flat) : n && typeof n === 'object' ? [n,...flat(n.props?.children)] : [];
const load = runtime(false, () => { throw Error('Landing must not fetch'); }, {
 react: { useRef: () => ({ current: null }), useEffect: () => {} },
 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-router-dom': { Link:'Link' },
 '../../components/brand/CodeArenaMark': { CodeArenaMark:'Mark' },
});
const nodes = flat(load('pages/public/LandingPage.tsx').LandingPage());
const entries = nodes.filter(n=>n.type==='Link'&&n.props.state);
assert.equal(entries.length,3);
assert.deepEqual(entries.map(n=>n.props.state.workspace),['participant','judge','organizer']);
assert(entries.every(n=>n.props.to==='/login'));
for (const id of ['platform','participants','judges','organizers','capabilities','workspaces']) {
 assert(nodes.some(n=>n.props.id===id)); assert(nodes.some(n=>n.props.to==='#'+id));
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
