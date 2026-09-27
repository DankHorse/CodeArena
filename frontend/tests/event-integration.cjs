// Contract regressions without a running backend or changes to browser storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src');
function runtime(demo, fetch, overrides = {}) {
  const cache = new Map(), storage = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env.VITE_DEMO', JSON.stringify(String(demo)));
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, {
      exports, require: name => overrides[name] ?? load(path.resolve(path.dirname(file), name)), fetch, URL, Error,
      crypto: require('node:crypto').webcrypto,
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    }, { filename: file });
    return exports;
  }
  return file => load(path.join(root, file));
}
(async () => {
  let event, failure = null; const calls = [];
  const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const load = runtime(false, async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.credentials, 'include');
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (failure) return response(failure, 422);
    if (url === '/api/v1/events' && init.method === 'POST') {
      assert(!('tracks' in body));
      event = { ...body, id: 'event-uuid', slug: 'test-arena', status: 'draft', organizer_id: 'owner' };
      return response(event, 201);
    }
    if (url.startsWith('/api/v1/events?')) {
      // Include a draft deliberately to test the frontend visibility boundary too.
      return response({ items: event ? [event] : [], offset: 0, limit: 100, total: event ? 1 : 0 });
    }
    if (url === '/api/v1/events/event-uuid/transition') {
      assert.equal(body.status, 'published'); event = { ...event, status: body.status }; return response(event);
    }
    if (url === '/api/v1/events/event-uuid') {
      if (init.method === 'PATCH') event = { ...event, ...body };
      return response(event);
    }
    if (url === '/api/v1/auth/logout') return response(null, 204);
    throw new Error('Unexpected endpoint: ' + url);
  });
  const events = load('data/events.ts'), organizer = load('organizer/data.ts'), api = load('api.ts');
  const fields = { title: 'Arena', description: 'Build useful things', registration_opens_at: '2099-01-01T00:00:00Z', registration_deadline: '2099-01-02T00:00:00Z', starts_at: '2099-01-03T00:00:00Z', submission_deadline: '2099-01-04T00:00:00Z', ends_at: '2099-01-05T00:00:00Z', team_min_size: 1, team_max_size: 4 };
  const created = await events.saveEvent(fields);
  assert.equal(created.status, 'draft'); assert.equal((await events.listPublicEvents()).length, 0);
  await events.saveEvent({ ...fields, title: 'Edited arena' }, created.id);
  assert.equal(event.title, 'Edited arena');
  await events.publishEvent(created.id);
  const publicEvents = await events.listPublicEvents();
  const resolved = load('data/publicData.ts').findEvent(publicEvents, created.id);
  assert.equal(resolved.name, 'Edited arena'); assert.equal(resolved.slug, 'test-arena'); assert.equal(resolved.tracks.length, 0);
  const snapshot = await organizer.loadOrganizer('owner', created.id);
  assert.equal(snapshot.event.real.status, 'published');
  assert.equal((await organizer.loadOrganizer('owner')).event.id, created.id);
  await assert.rejects(() => organizer.loadOrganizer('other', created.id), /owner/);
  assert(calls.some(c => c.method === 'PATCH')); assert(calls.every(c => !c.url.includes('bootstrap')));
  const before = calls.length;
  await assert.rejects(() => events.saveEvent({ ...fields, ends_at: fields.registration_opens_at }), /chronological/);
  assert.equal(calls.length, before);
  failure = { error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: [{ location: ['body', 'title'], message: 'Too short' }] } };
  await assert.rejects(() => events.listPublicEvents(), error => {
    assert.equal(error.status, 422); assert.equal(error.code, 'VALIDATION_ERROR'); assert.equal(error.details[0].message, 'Too short');
    assert.match(load('auth/types.ts').errorMessage(error), /body.title: Too short/); return true;
  });
  failure = null; assert.equal(await api.api('/api/auth/logout', 'POST'), undefined);
  assert(load('auth/types.ts').isBackendRole('admin')); assert(!load('auth/types.ts').isBackendRole('judge'));
  assert.equal(load('auth/destination.ts').workspaceFor('admin'), '/organizer');
  const element = (type, props) => ({ type, props });
  let viewEvent = event;
  const render = runtime(false, () => { throw Error('Render must not fetch'); }, {
    'react': { useEffect: () => {}, useRef: value => ({ current: value }), useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'react-router-dom': { useLocation: () => ({ key: 'test' }) },
    '../../organizer/OrganizerProvider': { useOrganizer: () => ({ snapshot: { event: { real: viewEvent } }, selectEvent: async () => {}, loading: false }) },
  })('pages/organizer/RealEventSettings.tsx').RealEventSettings;
  const flatten = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
  assert(flatten(render()).find(node => node.type === 'fieldset').props.disabled);
  assert(!flatten(render()).some(node => node.type === 'button' && node.props.children === 'Publish saved draft ↗'));
  viewEvent = { ...event, status: 'draft' };
  assert(!flatten(render()).find(node => node.type === 'fieldset').props.disabled);
  assert(flatten(render()).some(node => node.type === 'button' && node.props.children === 'Publish saved draft ↗'));
  console.log('PASS editor states: published read-only; draft editable and publishable.');
  console.log('PASS real contract: create/edit/publish, public visibility/details, owner context, errors, cookies, admin types.');

  let pages = 0;
  const paginated = runtime(false, async url => { pages++; const offset = Number(new URL(url, 'http://test').searchParams.get('offset')); return response({ items: [{ ...event, id: String(offset) }], total: 2, offset, limit: 1 }); });
  assert.equal((await paginated('data/events.ts').listPublicEvents()).length, 2); assert.equal(pages, 2);
  const demo = runtime(true, () => { throw Error('Demo must not fetch'); });
  const demoApi = demo('api.ts');
  await demoApi.api('/api/auth/demo', 'POST', { role: 'judge' });
  assert.equal((await demoApi.api('/api/bootstrap')).user.id, 'jdg_01');
  assert((await demo('judge/data.ts').loadJudge('jdg_01')).reviews.length > 0);
  await demoApi.api('/api/auth/demo', 'POST', { role: 'organizer' });
  const original = await demo('organizer/data.ts').loadOrganizer('organizer');
  assert(original.tracks.length > 0);
  await demo('organizer/data.ts').organizerAction(original.event.id, '', 'PUT', { name: 'Demo edited', tracks: original.tracks.map(t => t.name), registration_close: '2099-12-30T18:00:00Z', submissions_close: '2099-12-31T18:00:00Z' });
  assert.equal((await demo('organizer/data.ts').loadOrganizer('organizer')).event.name, 'Demo edited');
  await demoApi.api('/api/auth/demo', 'POST', { role: 'participant' });
  assert((await demo('participant/data.ts').participantData.bootstrap()).teams.some(t => t.mine));
  const catalog = await demo('data/publicData.ts').loadPublicCatalog();
  for (const title of ['Glass Signal', 'Small Meadow', 'Deep Compass']) assert(catalog.projects.some(p => p.title === title));
  assert(!catalog.projects.some(p => p.id === 'demo_prj_0'));
  console.log('PASS pagination and DEMO regressions: roles, judging, organizer track/settings, participant data, fixture visibility, draft privacy.');
})().catch(error => { console.error(error); process.exitCode = 1; });
