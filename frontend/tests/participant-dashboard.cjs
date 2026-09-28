const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const jsx = (type, props) => ({ type, props });
const flatten = n => Array.isArray(n) ? n.flatMap(flatten) : n && typeof n === 'object' ? [n, ...flatten(n.props?.children)] : [];
let value = {}, registrations = 0;
const load = runtime(false, () => { throw Error('Dashboard must use provider'); }, {
  'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-router-dom': { Link: 'Link' },
  '../../participant/ParticipantProvider': { useParticipant: () => value },
});
const render = load('pages/participant/RealParticipantDashboard.tsx').RealParticipantDashboard;
const event = { id: 'event', name: 'Real Event', real: { status: 'published', slug: 'real-event' } };
for (const [team, project, confirmed, label, to] of [
  [null, null, false, 'Register / confirm registration ↗', null],
  [null, null, true, 'Create Team', '/participant/team'],
  [{ name: 'Backend Team' }, null, true, 'Create Submission', '/participant/submission'],
  [{ name: 'Backend Team' }, { title: 'Draft', state: 'draft' }, true, 'Continue Submission', '/participant/submission'],
  [{ name: 'Backend Team' }, { title: 'Submitted', state: 'submitted' }, true, 'View Submission', '/participant/submission'],
]) {
  value = { snapshot: { event, team, project }, registrationConfirmed: confirmed, registerCurrentEvent: () => registrations++ };
  const nodes = flatten(render()), text = JSON.stringify(nodes);
  assert(text.includes('Real Event')); assert(text.includes(label));
  if (to) assert(nodes.some(n => n.type === 'Link' && n.props.to === to));
  else { nodes.find(n => n.type === 'button').props.onClick(); assert.equal(registrations, 1); assert(!nodes.some(n => n.props?.to === '/participant/team')); }
  assert(!/prize|technology|track|member name/i.test(text));
  if (project?.state === 'submitted') { assert(text.includes('SUBMITTED / READ ONLY')); assert(!/edit/i.test(text)); }
  assert(nodes.some(n => n.props?.to === '/gallery?event=event&event_slug=real-event'));
}
value = { snapshot: { event: null } }; let nodes = flatten(render());
assert(JSON.stringify(nodes).includes('NO EVENT SELECTED')); assert(nodes.some(n => n.props?.to === '/events'));
value = { loading: true }; assert(JSON.stringify(render()).includes('Loading participant'));
value = { error: 'Forbidden', snapshot: null }; assert.equal(render().props.role, 'alert');
console.log('PASS real dashboard states, registration action, team/submission CTAs, gallery, read-only wording, loading/errors, and no fabricated metadata.');
