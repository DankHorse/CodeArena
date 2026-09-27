const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { runtime } = require('./contract-runtime.cjs');
(async () => {
  const original = 'Real backend integration test project.';
  const edited = original + ' Updated draft.';
  const snapshot = { event: { id: 'event' }, team: { id: 'team' }, project: { id: 'project', title: 'habitIq', summary: original, state: 'draft' }, data: { tracks: [] } };
  let patch, passed, edits, previousDeps;
  const mode = { DEMO: false };
  const load = runtime(false, async (url, options) => {
    assert.equal(url, '/api/v1/projects/project'); assert.equal(options.method, 'PATCH');
    patch = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ ...patch, id: 'project', event_id: 'event', team_id: 'team', status: 'draft' }) };
  });
  const data = load('participant/realData.ts');
  const exports = {};
  const element = (type, props) => ({ type, props });
  let pending;
  const react = {
    useState: initial => { if (edits === undefined) edits = initial; return [edits, value => { edits = typeof value === 'function' ? value(edits) : value; }]; },
    useEffect: (fn, deps) => { if (!previousDeps || deps.some((value, i) => value !== previousDeps[i])) { previousDeps = deps; fn(); } },
  };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../src/pages/participant/SubmissionPage.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, HTMLButtonElement: class {}, require: name => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (name === '../../api') return mode;
      if (name === 'react-router-dom') return { Link: 'link' };
      if (name === 'lucide-react') return {};
      if (name.includes('ParticipantProvider')) return { useParticipant: () => ({ snapshot, locked: !mode.DEMO && snapshot.project.state === 'submitted', busy: false, saveSubmission: fields => { passed = fields; pending = data.saveRealProject('user', 'event', 'team', fields, 'project'); } }) };
      if (name.includes('participant/data')) return { deadlineLabel: () => '' };
      return { paths: { participant: {} } };
    },
  });
  const flatten = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
  let tree = flatten(exports.SubmissionPage());
  tree.find(n => n.props?.name === 'summary').props.onChange({ target: { value: edited } });
  tree = flatten(exports.SubmissionPage());
  tree.find(n => n.props?.name === 'title').props.onChange({ target: { value: 'habitIq edited' } });
  // A provider timer re-render must not replace user edits with snapshot values.
  tree = flatten(exports.SubmissionPage());
  assert.equal(tree.find(n => n.props?.name === 'summary').props.value, edited);
  tree.find(n => n.type === 'form').props.onSubmit({ preventDefault() {}, nativeEvent: { submitter: null } });
  await pending;
  assert.equal(snapshot.project.summary, original);
  assert.equal(passed.summary, edited);
  assert.deepEqual(patch, { title: 'habitIq edited', description: edited, repository_url: null, demo_url: null });
  // Authoritative reload replaces the draft when the provider supplies a new record.
  snapshot.project = { ...snapshot.project, summary: edited, title: patch.title };
  exports.SubmissionPage(); tree = flatten(exports.SubmissionPage());
  assert.equal(tree.find(n => n.props?.name === 'summary').props.value, edited);
  const labels = () => flatten(exports.SubmissionPage()).filter(n => n.type === 'button').map(n => n.props.children.filter(child => typeof child === 'string').join(''));
  assert.deepEqual(labels(), ['Save draft', 'Submit project']);
  snapshot.project = { ...snapshot.project, state: 'submitted' };
  assert.deepEqual(labels(), ['Read only', 'Submitted']);
  assert.equal(flatten(exports.SubmissionPage()).find(n => n.type === 'fieldset').props.disabled, true);
  mode.DEMO = true;
  assert.deepEqual(labels(), ['Save changes', 'Update submission']);
  snapshot.project = { ...snapshot.project, state: 'draft' };
  assert.deepEqual(labels(), ['Save draft', 'Submit project']);
  console.log('PASS real submitted labels/read-only fieldset; real draft and demo labels unchanged.');
  console.log('PASS edited title/summary survive rerender and reach PATCH; optional URLs null; no track; authoritative snapshot sync.');
})().catch(error => { console.error(error); process.exitCode = 1; });
