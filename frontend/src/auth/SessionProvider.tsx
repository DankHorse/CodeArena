import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, DEMO } from '../api';
import { errorMessage, isRole } from './types';
import type { AuthUser, Credentials, Registration, Role, SessionStatus } from './types';

type Session = { user: AuthUser | null; status: SessionStatus; error: string };
type SessionContextValue = Session & {
  role: Role | null;
  login: (credentials: Credentials, demoRole?: Role) => Promise<AuthUser>;
  register: (registration: Registration) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};
const SessionContext = createContext<SessionContextValue | null>(null);

async function readUser(): Promise<AuthUser | null> {
  if (DEMO) {
    const bootstrap = await api<{
      user: { id: string; name: string; email: string } | null;
      memberships: { role: string }[];
    }>('/api/bootstrap');
    if (!bootstrap.user) return null;
    const role = bootstrap.memberships[0]?.role ?? 'participant';
    if (!isRole(role)) throw new Error('This account has no supported workspace role.');
    return { ...bootstrap.user, display_name: bootstrap.user.name, role, is_active: true };
  }
  try {
    const user = await api<AuthUser>('/api/auth/me');
    if (!user || !isRole(user.role)) throw new Error('This account has no supported workspace role.');
    if (!user.is_active) throw new Error('This account is inactive.');
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null, status: 'loading', error: '' });
  const requestVersion = useRef(0);
  const refreshSession = useCallback(async () => {
    const version = ++requestVersion.current;
    setSession({ user: null, status: 'loading', error: '' });
    try {
      const user = await readUser();
      if (version === requestVersion.current) setSession({ user, status: user ? 'authenticated' : 'anonymous', error: '' });
    } catch (error) {
      if (version === requestVersion.current) setSession({ user: null, status: 'anonymous', error: errorMessage(error) });
    }
  }, []);
  useEffect(() => {
    void refreshSession();
    return () => { requestVersion.current++; };
  }, [refreshSession]);

  async function login(credentials: Credentials, demoRole: Role = 'participant') {
    const version = ++requestVersion.current;
    if (DEMO) await api('/api/auth/demo', 'POST', { role: demoRole });
    else await api('/api/auth/login', 'POST', credentials);
    const user = await readUser();
    if (!user) throw new Error('Sign-in did not establish a session. Please try again.');
    if (version === requestVersion.current) setSession({ user, status: 'authenticated', error: '' });
    return user;
  }
  async function register(registration: Registration) {
    if (!DEMO) {
      await api('/api/auth/register', 'POST', registration);
      return;
    }
    // The existing preview creates and signs in a user; sign out without clearing its database.
    requestVersion.current++;
    await api('/api/auth/register', 'POST', { name: registration.display_name, email: registration.email });
    await api('/api/auth/logout', 'POST');
    setSession({ user: null, status: 'anonymous', error: '' });
  }
  async function logout() {
    requestVersion.current++;
    try { await api('/api/auth/logout', 'POST'); }
    catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
    setSession({ user: null, status: 'anonymous', error: '' });
  }
  return <SessionContext.Provider value={{ ...session, role: session.user?.role ?? null, login, register, logout, refreshSession }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider.');
  return session;
}
