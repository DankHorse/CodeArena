import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { DEMO } from '../../api';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage, isRole } from '../../auth/types';
import type { Role } from '../../auth/types';
import { loginDestination } from '../../auth/destination';
import { paths } from '../../routes';

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const loginStarted = useRef(false);
  const previousSessionReset = useRef(false);
  const [demoRole, setDemoRole] = useState<Role>('participant');
  const state: unknown = location.state;

  const workspace =
    state &&
    typeof state === 'object' &&
    'workspace' in state &&
    (state.workspace === 'participant' ||
      state.workspace === 'judge' ||
      state.workspace === 'organizer')
      ? state.workspace
      : undefined;

  const registered =
    !!state &&
    typeof state === 'object' &&
    'registered' in state &&
    state.registered === true;
  useEffect(() => {
    if (
      !session.user ||
      loginStarted.current ||
      previousSessionReset.current
    ) {
      return;
    }

    previousSessionReset.current = true;
    setBusy(true);
    setError('');

    void session.logout()
      .catch(error => {
        setError(errorMessage(error));
        previousSessionReset.current = false;
      })
      .finally(() => {
        setBusy(false);
      });
  }, [session.user?.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    loginStarted.current = true;
    setBusy(true); setError('');
    try {
      const user = await session.login(
        {
          email: String(data.get('email') ?? '').trim(),
          password: String(data.get('password') ?? ''),
        },
        workspace ?? demoRole,
      );
      navigate(loginDestination(user.role, state), { replace: true });
    } catch (error) {
      loginStarted.current = false;
      setError(errorMessage(error));
    }
    finally { setBusy(false); }
  }
  return (
    <AuthShell
      eyebrow={workspace ? `[ CODEARENA / ${workspace.toUpperCase()} ACCESS ]` : '[ ACCESS / LOGIN ]'}
      title={workspace ? `${workspace.toUpperCase()} LOGIN` : 'WELCOME BACK.'}
      description="Authenticate to enter your CodeArena workspace."
      footerText={
        workspace === 'organizer'
          ? 'Organizer accounts are provisioned by CodeArena.'
          : 'New to CodeArena?'
      }
      footerLinkLabel={
        workspace === 'organizer'
          ? 'Choose another workspace'
          : 'Create account ↗'
      }
      footerLinkTo={
        workspace === 'organizer'
          ? paths.home
          : paths.register
      }
    >
      {workspace && (
        <Link className="auth-workspace-switch" to={paths.home}>
          ← Choose another workspace
        </Link>
      )}

      {registered && <p className="auth-message" role="status">Account created. {DEMO ? 'Choose a sample role to explore the preview.' : 'Sign in with your email and password.'}</p>}
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy}>
        {DEMO ? <>
          <p className="auth-message">
            {workspace
              ? `Demo preview: enter the ${workspace} workspace. No real credentials are needed.`
              : 'Demo preview: choose a sample workspace. No real credentials are needed.'}
          </p>

          {!workspace && (
            <label>
              <span>PREVIEW ROLE</span>
              <select
                value={demoRole}
                onChange={event => {
                  if (isRole(event.target.value)) setDemoRole(event.target.value);
                }}
                disabled={busy}
              >
                <option value="participant">Participant</option>
                <option value="judge">Judge</option>
                <option value="organizer">Organizer</option>
              </select>
            </label>
          )}
        </> : <>
          <label><span>EMAIL</span><input type="email" name="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} /></label>
          <label><span>PASSWORD</span><input type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required disabled={busy} /></label>
        </>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy || session.status === 'loading'}>{busy ? 'Signing in…' : session.status === 'loading' ? 'Checking session…' : 'Enter workspace ↗'}</button>
        {(error || session.error) && <p className="auth-message" role="alert">{error || session.error}</p>}
      </form>
    </AuthShell>
  );
}
