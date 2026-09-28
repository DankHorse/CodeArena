const assert = require('node:assert/strict');
const { runtime } = require('./contract-runtime.cjs');

const element = (type, props, key) => ({ type, props, key });
const jsx = { jsx: element, jsxs: element };
const Navigate = 'Navigate';
const makeLogin = ({ mode, user, judge = false, loginError, judgeResult = judge }) => {
  let nav;
  const calls = [];
  let stateIndex = 0;
  const states = [];
  const session = {
    user: null, status: 'anonymous', error: '', isJudge: false,
    login: async (...args) => { calls.push(['login', ...args]); if (loginError) throw loginError; session.user = user; return user; },
    refreshJudgeCapability: async () => { calls.push(['capability']); session.isJudge = judgeResult; return judgeResult; },
    logout: async () => { calls.push(['logout']); session.user = null; },
  };
  const load = runtime(false, () => {}, {
    react: { useState: initial => { const i = stateIndex++; return [states[i] ?? initial, value => { states[i] = value; }]; } },
    FormData: class { get(key) { return key === 'email' ? 'person@example.com' : 'a-long-enough-password'; } },
    'react/jsx-runtime': jsx,
    'react-router-dom': { Navigate, useNavigate: () => path => { nav = path; }, useLocation: () => ({ state: null }), },
    './AuthShell': { AuthShell: props => props.children },
    '../../api': { DEMO: false, ApiError: class ApiError extends Error {} },
    '../../auth/SessionProvider': { useSession: () => session },
  });
  const LoginPage = load('pages/auth/LoginPage.tsx').LoginPage;
  const shell = LoginPage({ mode });
  const tree = shell.type(shell.props);
  const form = (Array.isArray(tree) ? tree : [tree]).find(node => node?.type === 'form');
  return { form, calls, session, destination: () => nav, submit: async () => {
    stateIndex = 0;
    await form.props.onSubmit({ preventDefault() {}, currentTarget: { elements: {}, }, });
    return nav;
  }};
};

function protectedResult(role, userRole, isJudge) {
  const load = runtime(false, () => {}, {
    'react/jsx-runtime': jsx,
    'react-router-dom': { Navigate, useLocation: () => ({ pathname: '/'+role, search: '', hash: '' }) },
    '../routes': { paths: { login: '/login', judge: { home: '/judge' }, participant: { home: '/participant' }, organizer: { home: '/organizer' } } },
    './SessionProvider': { useSession: () => ({ user: { role: userRole }, status: 'authenticated', error: '', isJudge, refreshSession() {} }) },
    './destination': { workspaceFor: value => value === 'judge' ? '/judge' : value === 'organizer' || value === 'admin' ? '/organizer' : '/participant' },
  });
  const node = load('auth/ProtectedRoute.tsx').ProtectedRoute({ role, children: 'ok' });
  return node?.type === Navigate ? node.props.to : node?.props?.children;
}

(async () => {
  const participant = makeLogin({ mode: 'participant', user: { role: 'participant' } });
  assert.equal(await participant.submit(), '/participant');
  const judge = makeLogin({ mode: 'judge', user: { role: 'participant' }, judge: true });
  assert.equal(await judge.submit(), '/judge');
  assert(judge.calls.some(call => call[0] === 'capability'));
  const denied = makeLogin({ mode: 'judge', user: { role: 'participant' }, judgeResult: false });
  await denied.submit();
  assert(denied.calls.some(call => call[0] === 'logout'));
  assert.equal(denied.session.user, null);
  const organizer = makeLogin({ mode: 'organizer', user: { role: 'admin' } });
  assert.equal(await organizer.submit(), '/organizer');
  assert.equal(protectedResult('judge', 'participant', false), '/participant');
  assert.equal(protectedResult('organizer', 'participant', false), '/participant');
  assert.equal(protectedResult('judge', 'participant', true), 'ok');
  assert.equal(protectedResult('organizer', 'admin', false), 'ok');
  console.log('PASS participant/judge/organizer login destinations and protected workspace capability checks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
