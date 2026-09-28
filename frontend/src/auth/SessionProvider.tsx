import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, DEMO } from '../api';
import { errorMessage, isRole, isBackendRole } from './types';
import type { AuthUser, Credentials, Registration, Role, SessionStatus } from './types';

type Session = { user: AuthUser | null; status: SessionStatus; error: string; isJudge: boolean; judgeEventIds: string[] };
type SessionContextValue = Session & {
  role: Role | null;
  login: (credentials: Credentials, demoRole?: Role) => Promise<AuthUser>;
  register: (registration: Registration) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshJudgeCapability: () => Promise<boolean>;
};
const emptySession = (): Session => ({ user: null, status: 'anonymous', error: '', isJudge: false, judgeEventIds: [] });
const SessionContext = createContext<SessionContextValue | null>(null);

async function readSession(): Promise<Pick<Session, 'user' | 'isJudge' | 'judgeEventIds'>> {
  let user: AuthUser | null;
  if (DEMO) {
    const bootstrap = await api<{ user: { id: string; name: string; email: string } | null; memberships: { role: string; event_id?: string }[] }>('/api/bootstrap');
    if (!bootstrap.user) return { user: null, isJudge: false, judgeEventIds: [] };
    const roles = bootstrap.memberships.map(item => item.role);
    const role = roles.includes('organizer') ? 'organizer' : roles.includes('admin') ? 'admin' : 'participant';
    user = { ...bootstrap.user, display_name: bootstrap.user.name, role, is_active: true };
  } else {
    try {
      user = await api<AuthUser>('/api/auth/me');
      if (!user || !isBackendRole(user.role)) throw new Error('This account has no supported workspace role.');
      if (!user.is_active) throw new Error('This account is inactive.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return { user: null, isJudge: false, judgeEventIds: [] };
      throw error;
    }
  }
  const capability = await api<{ is_judge: boolean; event_ids: string[] }>('/api/judging/me');
  return { user, isJudge: capability.is_judge === true, judgeEventIds: capability.is_judge === true ? capability.event_ids ?? [] : [] };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ ...emptySession(), status: 'loading' });
  const requestVersion = useRef(0);
  const refreshSession = useCallback(async () => {
    const version = ++requestVersion.current;
    setSession({ ...emptySession(), status: 'loading' });
    try {
      const value = await readSession();
      if (version === requestVersion.current) setSession({ ...value, status: value.user ? 'authenticated' : 'anonymous', error: '' });
    } catch (error) {
      if (version === requestVersion.current) setSession({ ...emptySession(), error: errorMessage(error) });
    }
  }, []);
  useEffect(() => { void refreshSession(); return () => { requestVersion.current++; }; }, [refreshSession]);

  async function login(credentials: Credentials, demoRole: Role = 'participant') {
    const version = ++requestVersion.current;
    if (DEMO) await api('/api/auth/demo', 'POST', { role: demoRole });
    else await api('/api/auth/login', 'POST', credentials);
    const value = await readSession();
    if (!value.user) throw new Error('Sign-in did not establish a session. Please try again.');
    if (version === requestVersion.current) setSession({ ...value, status: 'authenticated', error: '' });
    return value.user;
  }
  async function refreshJudgeCapability() {
    const capability = await api<{ is_judge: boolean; event_ids: string[] }>('/api/judging/me');
    setSession(current => ({ ...current, isJudge: capability.is_judge === true, judgeEventIds: capability.is_judge === true ? capability.event_ids ?? [] : [] }));
    return capability.is_judge === true;
  }
  async function register(registration: Registration) {
    if (!DEMO) { await api('/api/auth/register', 'POST', registration); return; }
    requestVersion.current++;
    await api('/api/auth/register', 'POST', { name: registration.display_name, email: registration.email });
    await api('/api/auth/logout', 'POST');
    setSession(emptySession());
  }
  async function logout() {
    requestVersion.current++;
    try { await api('/api/auth/logout', 'POST'); }
    catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    setSession(emptySession());
  }
  return <SessionContext.Provider value={{ ...session, role: session.user?.role ?? null, login, register, logout, refreshSession, refreshJudgeCapability }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider.');
  return session;
}
