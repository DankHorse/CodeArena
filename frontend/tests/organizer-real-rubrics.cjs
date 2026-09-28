const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
const uuid = n => `${n}0000000-0000-4000-8000-000000000001`;
const event = uuid(1), id = uuid(2);
const input = { title: 'Rubric', criteria: [{ name: 'Impact', description: 'Value', weight: '60.0000', max_score: '5.500', position: 0 }, { name: 'Delivery', weight: 40, max_score: 10, position: 1 }] };
const response = { id, event_id: event, title: 'Rubric', version: 7, status: 'draft', created_at: '2026-01-01T00:00:00Z', activated_at: null, criteria: input.criteria.map((c, i) => ({ ...c, description: c.description ?? '', id: uuid(i + 3) })) };
(async () => {
  const calls = []; let failure, active = false, release;
  const load = runtime(false, async (url, init) => {
    calls.push({ url, ...init });
    assert.equal(init.credentials, 'include'); assert.equal(init.method, 'POST');
    assert.equal(init.headers['X-CodeArena-Request'], '1');
    assert([`/api/v1/events/${event}/rubrics`, `/api/v1/events/${event}/rubrics/${id}/activate`].includes(url));
    if (release) await new Promise(resolve => { release.resolve = resolve; });
    return { ok: !failure, status: failure?.status ?? (active ? 200 : 201), json: async () => failure ? { error: { code: failure.code, message: 'Backend error', details: [{ message: 'Invalid weights' }] } } : { ...response, status: active ? 'active' : 'draft', activated_at: active ? '2026-01-02T00:00:00Z' : null } };
  });
  const adapter = load('organizer/realT2Data.ts');
  const original = JSON.stringify(input);
  const created = await adapter.createRealRubricVersion(event, { ...input, published: true, criteria: input.criteria.map(c => ({ ...c, id: 'must-not-send' })) });
  assert.deepEqual(JSON.parse(calls[0].body), input); assert.equal(JSON.stringify(input), original);
  assert.equal(calls.length, 1); assert.equal(created.version, 7); assert.equal(created.status, 'draft'); assert.equal(created.id, id);
  assert.equal(created.criteria[0].weight, 60); assert.equal(created.criteria[0].max_score, 5.5);
  assert.equal(created.criteria[0].id, uuid(3)); assert.equal(created.criteria[1].position, 1);
  active = true; release = {};
  const activation = adapter.activateRealRubric(event, id);
  assert.equal(created.status, 'draft'); assert.equal(created.activated_at, null);
  release.resolve(); release = null;
  const activated = await activation;
  assert.equal(calls[1].body, undefined); assert.equal(activated.status, 'active'); assert.equal(activated.version, 7);
  assert.equal(activated.activated_at, '2026-01-02T00:00:00Z'); assert.equal(created.status, 'draft');
  assert.deepEqual(JSON.parse(JSON.stringify(activated.criteria)), JSON.parse(JSON.stringify(created.criteria)));
  for (const [status, code] of [[422, 'VALIDATION_ERROR'], [409, 'RUBRIC_VERSION_CONFLICT'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN']]) {
    failure = { status, code };
    await assert.rejects(() => adapter.createRealRubricVersion(event, input), e => e.status === status && e.code === code && e.details[0].message === 'Invalid weights');
  }
  for (const [status, code] of [[401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [404, 'RUBRIC_NOT_FOUND'], [409, 'RUBRIC_IMMUTABLE'], [409, 'RUBRIC_LOCKED']]) {
    failure = { status, code };
    await assert.rejects(() => adapter.activateRealRubric(event, id), e => e.status === status && e.code === code);
    assert.equal(created.status, 'draft');
  }
  const count = calls.length;
  await assert.rejects(() => adapter.createRealRubricVersion('', input), /event UUID/);
  await assert.rejects(() => adapter.activateRealRubric(event, ''), /rubric UUID/);
  assert.equal(calls.length, count);
  const demo = runtime(true, () => { throw Error('Demo must not fetch'); });
  await assert.rejects(() => demo('organizer/realT2Data.ts').createRealRubricVersion(event, input), /demo mode/);
  await assert.rejects(() => demo('organizer/realT2Data.ts').activateRealRubric(event, id), /demo mode/);
  await demo('api.ts').api('/api/auth/demo', 'POST', { role: 'organizer' });
  const data = demo('organizer/data.ts'); const snapshot = await data.loadOrganizer('organizer');
  assert(snapshot.rubric.length); assert.equal(JSON.stringify((await data.loadOrganizer('organizer')).rubric), JSON.stringify(snapshot.rubric));
  console.log('PASS rubric create/activate exact paths/payload, cookies, decimal parsing, versions/UUIDs/order, backend errors, no optimistic changes, no unrelated requests, demo isolation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
