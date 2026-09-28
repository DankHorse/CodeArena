import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { DEMO, api, ApiError } from '../../api';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage, isRole } from '../../auth/types';
import type { Role } from '../../auth/types';
import { loginDestination } from '../../auth/destination';
import { paths } from '../../routes';

type LoginMode = 'participant' | 'judge';

export function LoginPage({ mode = 'participant' }: { mode?: LoginMode }) {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoRole, setDemoRole] = useState<Role>(mode === 'judge' ? 'judge' : 'participant');

  const state: unknown = location.state;
  const registered =
    !!state &&
    typeof state === 'object' &&
    'registered' in state &&
    state.registered === true;

  if (session.user) {
    return <Navigate to={loginDestination(session.user.role, state)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setBusy(true);
    setError('');

    try {
      const user = await session.login(
        {
          email: String(data.get('email') ?? '').trim(),
          password: String(data.get('password') ?? ''),
        },
        demoRole,
      );

      if (!DEMO && mode === 'judge') {
        const capability = await api<{
          is_judge: boolean;
          event_ids: string[];
        }>('/api/judging/me');

        if (!capability.is_judge) {
          await session.logout();
          throw new Error('This account is not assigned as a judge.');
        }
      }

      if (!DEMO && mode === 'participant' && user.role !== 'participant') {
        await session.logout();
        throw new Error('This account is not a participant account.');
      }

      navigate(
        mode === 'judge'
          ? paths.judge.home
          : loginDestination(user.role, state),
        { replace: true },
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  const isJudge = mode === 'judge';

  return (
    <AuthShell
      eyebrow={isJudge ? '[ JUDGE / LOGIN ]' : '[ PARTICIPANT / LOGIN ]'}
      title={isJudge ? 'JUDGE ACCESS.' : 'WELCOME BACK.'}
      description={
        isJudge
          ? 'Authenticate with your assigned judge account to review projects.'
          : 'Authenticate to enter your participant workspace.'
      }
      footerText={isJudge ? 'Need participant access?' : 'New to CodeArena?'}
      footerLinkLabel={isJudge ? 'Participant login ↗' : 'Create account ↗'}
      footerLinkTo={isJudge ? paths.participantLogin : paths.register}
    >
      {registered && (
        <p className="auth-message" role="status">
          Account created. Sign in with your email and password.
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy}>
        {DEMO ? (
          <>
            <p className="auth-message">
              Demo preview: choose a sample workspace. No real credentials are needed.
            </p>

            <label>
              <span>PREVIEW ROLE</span>
              <select
                value={demoRole}
                onChange={(event) => {
                  if (isRole(event.target.value)) {
                    setDemoRole(event.target.value);
                  }
                }}
                disabled={busy}
              >
                <option value={isJudge ? 'judge' : 'participant'}>
                  {isJudge ? 'Judge' : 'Participant'}
                </option>
              </select>
            </label>
          </>
        ) : (
          <>
            <label>
              <span>EMAIL</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={busy}
              />
            </label>

            <label>
              <span>PASSWORD</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                disabled={busy}
              />
            </label>
          </>
        )}

        <button
          className="button button-primary auth-submit"
          type="submit"
          disabled={busy || session.status === 'loading'}
        >
          {busy
            ? 'Signing in…'
            : session.status === 'loading'
              ? 'Checking session…'
              : isJudge
                ? 'Enter judge workspace ↗'
                : 'Enter participant workspace ↗'}
        </button>

        {(error || session.error) && (
          <p className="auth-message" role="alert">
            {error || session.error}
          </p>
        )}
      </form>
    </AuthShell>
  );
}