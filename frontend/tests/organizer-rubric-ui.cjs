const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const jsx = (type, props) => ({ type, props });
const flatten = n => Array.isArray(n) ? n.flatMap(flatten) : n && typeof n === 'object' ? [n, ...flatten(n.props?.children)] : [];
const load = runtime(false, () => { throw Error('Unexpected fetch'); });
const validate = load('organizer/rubricForm.ts').rubricFormInput;
function form(weights) { const f = new FormData(); f.set('title', '  New version  '); weights.forEach((w, i) => { f.set(`name-${i}`, ` Criterion ${i} `); f.set(`weight-${i}`, w); f.set(`max-${i}`, '5'); }); return f; }
assert.deepEqual(JSON.parse(JSON.stringify(validate(form(['33.3333','33.3333','33.3334']),3))), { title: 'New version', criteria: ['33.3333','33.3333','33.3334'].map((weight, position) => ({ name: `Criterion ${position}`, description: '', weight, max_score: '5', position })) });
assert.throws(() => validate(form(['99.9999']),1), /exactly 100/);
assert.throws(() => validate(form(['100.0001']),1), /Weights/);
(async () => {
 let slots = [], index = 0, effects = [], calls = [], fail = false;
 const draft = { id: 'draft', title: 'Draft', version: 2, status: 'draft', criteria: [] };
 let server = { rubrics: [draft], activeRubric: { state: 'not_active' } };
 const rt = runtime(false, () => {}, {
  FormData: class { constructor() { return form(['100']); } },
  react: { useState: init => { const i = index++; if (!(i in slots)) slots[i] = init; return [slots[i], v => slots[i] = typeof v === 'function' ? v(slots[i]) : v]; }, useRef: init => { const i = index++; return slots[i] ?? (slots[i] = { current: init }); }, useEffect: fn => effects.push(fn) },
  'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-router-dom': { Link: 'Link' },
  '../../organizer/OrganizerProvider': { useOrganizer: () => ({ snapshot: { event: { id: 'event', name: 'Event' } } }) },
  '../../organizer/realT2Data': {
   loadRealRubrics: async id => { assert.equal(id,'event'); calls.push('GET'); return server; },
   activateRealRubric: async (event,id) => { assert.equal(event,'event'); assert.equal(id,'draft'); calls.push('POST activate'); if(fail) throw Error('RUBRIC_LOCKED'); const active = { ...draft, status:'active' }; server={ rubrics:[active], activeRubric:{state:'available',data:active} }; return active; },
   createRealRubricVersion: async (event, input) => { assert.equal(event, 'event'); assert.equal(input.title, 'New version'); assert.equal(input.criteria[0].position, 0); assert.equal(input.criteria[0].weight, '100'); calls.push('POST create'); return draft; },
  },
 });
 const Page = rt('pages/organizer/RealOrganizerRubricPage.tsx').RealOrganizerRubricPage;
 const render = () => { index=0; effects=[]; return Page(); };
 render(); effects[0](); await new Promise(r=>setImmediate(r));
 let nodes=flatten(render());
 nodes.find(n=>n.type==='form').props.onSubmit({preventDefault() {}, currentTarget: {}});
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls.slice(-2), ['POST create','GET']);
 assert(JSON.stringify(render()).includes('New draft version created'));
 nodes=flatten(render()); fail=true;
 await nodes.find(n=>n.type==='button' && Array.isArray(n.props.children) && n.props.children[0]==='Activate version ').props.onClick();
 await new Promise(r=>setImmediate(r));
 assert(JSON.stringify(render()).includes('RUBRIC_LOCKED')); assert.equal(server.rubrics[0].status,'draft');
 fail=false; nodes=flatten(render()); nodes.find(n=>n.type==='button' && Array.isArray(n.props.children) && n.props.children[0]==='Activate version ').props.onClick();
 await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls.slice(-2),['POST activate','GET']);
 assert(JSON.stringify(render()).includes('Rubric activation confirmed'));
 assert(!flatten(render()).some(n=>n.type==='button' && Array.isArray(n.props.children) && n.props.children[0]==='Activate version '));
 console.log('PASS real rubric UI activation/reload, backend failure without optimism, exact weights and positioned create payload.');
})().catch(e=>{console.error(e);process.exitCode=1});
