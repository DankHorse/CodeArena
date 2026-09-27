const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');
(async () => {
  const storage = new Map(), calls = [];
  const event = { id: 'event-1', slug: 'arena', title: 'Real Arena', status: 'published', registration_opens_at: '2098-01-01T00:00:00Z', registration_deadline: '2099-01-01T00:00:00Z', submission_deadline: '2099-02-01T00:00:00Z', team_min_size: 1, team_max_size: 4 };
  let registered = false, team = null, project = null, missingProject = false, forced = null;
  const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
  const failure = (code, status = 409) => response({ error: { code, message: code, details: null } }, status);
  const fetch = async (url, options) => {
    calls.push({ url, ...options }); assert.equal(options.credentials, 'include');
    const body = options.body && JSON.parse(options.body);
    assert(!url.includes('bootstrap') && !url.includes('/submissions'));
    if (forced) return failure(forced);
    if (url.endsWith('/registrations')) {
      assert.equal(options.method, 'POST'); assert.equal(body, undefined);
      if (registered) return failure('ALREADY_REGISTERED'); registered = true; return response({ id: 'registration', event_id: event.id }, 201);
    }
    if (url === '/api/v1/events/event-1') return response(event);
    if (url.endsWith('/teams/me')) return team ? response({ team, member_ids: ['captain', 'member'] }) : failure('TEAM_NOT_FOUND', 404);
    if (url === '/api/v1/events/event-1/teams') {
      assert.equal(body.name, 'Real team'); team = { id: 'team-1', event_id: event.id, captain_id: 'captain', name: body.name }; return response(team, 201);
    }
    if (url.endsWith('/invitations')) { assert.equal(body.invitee_id, '00000000-0000-0000-0000-000000000001'); return response({ invitation_id: 'inv-1', invitee_id: body.invitee_id, token: 'x'.repeat(43), expires_at: event.registration_deadline }, 201); }
    if (url === '/api/v1/team-invitations/accept') { assert.equal(body.token, 'x'.repeat(43)); return response(team); }
    if (url === '/api/v1/events/event-1/projects') {
      assert.equal(options.method, 'POST'); assert(!('track_id' in body)); assert(!('state' in body)); assert.equal(body.repository_url, null);
      project = { ...body, id: 'project-1', team_id: team.id, event_id: event.id, status: 'draft', submitted_at: null }; return response(project, 201);
    }
    if (url === '/api/v1/projects/project-1') {
      if (missingProject) return failure('PROJECT_NOT_FOUND', 404);
      if (options.method === 'PATCH') { if (project.status === 'submitted') return failure('SUBMISSION_LOCKED'); project = { ...project, ...body }; }
      return response(project);
    }
    if (url === '/api/v1/projects/project-1/submit') {
      assert.equal(options.method, 'POST'); assert.equal(body, undefined);
      if (!project.description.trim()) return failure('PROJECT_INCOMPLETE', 422);
      project = { ...project, status: 'submitted', submitted_at: '2098-02-01T00:00:00Z' }; return response(project);
    }
    if (url.startsWith('/api/v1/events?')) return response({ items: [event], total: 1, offset: 0, limit: 100 });
    if (url.startsWith('/api/v1/gallery/projects?')) {
      const query = new URL(url, 'http://test').searchParams;
      assert(!query.has('event_id'));
      const offset = Number(query.get('offset'));
      const visible = project?.status === 'submitted' ? [{ id: project.id, event_slug: event.slug, event_title: event.title, title: project.title, description: project.description, repository_url: project.repository_url, demo_url: project.demo_url, submitted_at: project.submitted_at }] : [];
      return response({ items: offset ? visible : [], offset, limit: Number(query.get('limit')), total: visible.length });
    }
    throw Error('Unexpected endpoint ' + url);
  };
  const load = runtime(false, fetch, {}, storage), data = load('participant/realData.ts');
  assert.equal((await data.loadParticipant('captain')).event, null);
  await data.registerParticipant('captain', event.id); assert.equal(storage.get(data.eventKey('captain')), event.id);
  await data.registerParticipant('captain', event.id); assert.equal(storage.get(data.eventKey('captain')), event.id);
  forced = 'JUDGE_CONFLICT'; await assert.rejects(() => data.registerParticipant('other', event.id), error => error.code === forced); assert(!storage.has(data.eventKey('other'))); forced = null;
  assert.equal((await data.loadParticipant('captain')).team, null);
  await data.createRealTeam(event.id, 'Real team'); let snapshot = await data.loadParticipant('captain');
  assert.equal(snapshot.team.captain_id, 'captain'); assert.equal(snapshot.team.members[0].name, undefined);
  const invitation = await data.inviteMember(team.id, '00000000-0000-0000-0000-000000000001'); await data.acceptInvitation(invitation.token);
  const fields = { title: 'Project', summary: '', repo_url: '', demo_url: '', track_id: '' };
  await data.saveRealProject('captain', event.id, team.id, fields);
  const key = data.projectKey('captain', event.id, team.id); assert.equal(storage.get(key), project.id);
  const reload = runtime(false, fetch, {}, storage)('participant/realData.ts');
  snapshot = await reload.loadParticipant('captain'); assert.equal(snapshot.project.id, project.id); assert.equal(snapshot.project.track_id, undefined);
  await assert.rejects(() => data.submitRealProject(project.id), error => error.code === 'PROJECT_INCOMPLETE');
  await data.saveRealProject('captain', event.id, team.id, { ...fields, summary: 'Ready description' }, project.id);
  const boundary = Date.parse(event.submission_deadline);
  assert.equal(data.projectReadOnly(snapshot.event, snapshot.team, snapshot.project, 'captain', boundary), false);
  assert.equal(data.projectReadOnly(snapshot.event, snapshot.team, snapshot.project, 'captain', boundary + 1), true);
  assert.equal(data.projectReadOnly(snapshot.event, snapshot.team, snapshot.project, 'member', boundary), true);
  const submitted = await data.submitRealProject(project.id); assert.equal(submitted.state, 'submitted');
  assert.equal(data.projectReadOnly(snapshot.event, snapshot.team, submitted, 'captain', boundary), true);
  await assert.rejects(() => data.saveRealProject('captain', event.id, team.id, fields, project.id), error => error.code === 'SUBMISSION_LOCKED');
  missingProject = true; snapshot = await reload.loadParticipant('captain'); assert.equal(snapshot.project, null); assert(snapshot.recovery); assert(!storage.has(key)); missingProject = false;
  const gallery = load('data/gallery.ts');
  assert.equal(await gallery.gallerySlug(event.id), event.slug);
  await gallery.galleryPage(20, 'description search', event.slug, 20);
  const query = new URL(calls.at(-1).url, 'http://test').searchParams;
  assert.equal(query.get('offset'), '20'); assert.equal(query.get('limit'), '20'); assert.equal(query.get('search'), 'description search'); assert.equal(query.get('event_slug'), event.slug);
  // Separate anonymous transport: every request must be a public gallery request.
  let pages = 0;
  const anonymous = runtime(false, async (url, options) => {
    assert(url.startsWith('/api/v1/gallery/projects?')); assert.equal(options.method, 'GET'); pages++;
    const offset = Number(new URL(url, 'http://test').searchParams.get('offset'));
    return response({ items: offset === 0 ? [{ id: 'other', event_slug: 'arena', title: 'Other' }] : [{ id: project.id, event_slug: 'arena', event_title: event.title, title: project.title, description: project.description, submitted_at: project.submitted_at }], total: 2, limit: 100, offset });
  })('data/gallery.ts');
  const detail = await anonymous.publicProject(project.id, 'arena'); assert.equal(detail.id, project.id); assert.equal(pages, 2); assert.equal(detail.team_id, undefined);
  assert.equal(await anonymous.publicProject('not-found'), null);
  for (const [key, value] of storage) { assert(!/token|jwt/i.test(key)); assert.equal(typeof value, 'string'); }
  console.log('PASS A–R: registration/recovery, teams/invitations, draft CRUD/submission, captain/lock/optional fields, deadline, ID reload/stale cleanup, gallery pagination/filter/search, public-only details.');
})().catch(error => { console.error(error); process.exitCode = 1; });
