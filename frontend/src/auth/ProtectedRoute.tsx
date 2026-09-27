import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { paths } from '../routes';
import { useSession } from './SessionProvider';
import { workspaceFor } from './destination';
import type { Role } from './types';

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading') return <div className="session-state" role="status">CODEARENA / Loading your session…</div>;
  if (session.error) return <div className="session-state"><p role="alert">{session.error}</p><button className="button button-primary" onClick={() => void session.refreshSession()}>Retry session</button></div>;
  if (!session.user) return <Navigate to={paths.login} replace state={{ from: location.pathname + location.search + location.hash }} />;
  if (session.user.role !== role && !(role === 'organizer' && session.user.role === 'admin')) return <Navigate to={workspaceFor(session.user.role)} replace />;
  return <>{children}</>;
}
