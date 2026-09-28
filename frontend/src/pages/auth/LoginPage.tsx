import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { DEMO } from '../../api';
import { useSession } from '../../auth/SessionProvider';
import { isRole } from '../../auth/types';
import type { Role } from '../../auth/types';
import { loginDestination } from '../../auth/destination';
import { paths } from '../../routes';
import { authValidationField, isValidEmail, safeLoginError } from './validation';

type LoginMode = 'participant' | 'judge' | 'organizer';

export function LoginPage({ mode = 'participant' }: { mode?: LoginMode }) {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoRole, setDemoRole] = useState<Role>(mode);
  const [emailError, setEmailError] = useState('');

  const state: unknown = location.state;
  const registered =
    !!state &&
    typeof state === 'object' &&
    'registered' in state &&
    state.registered === true;

  if (session.user) {
    const destination =
      mode === 'judge'
        ? paths.judge.home
        : mode === 'organizer'
          ? paths.organizer.home
          : loginDestination(session.user.role, state);

    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '').trim();
    if (!DEMO && !isValidEmail(email)) { setEmailError('Please enter a valid email address.'); setError(''); return; }
    setEmailError('');

    setBusy(true);
    setError('');

    try {
      const user = await session.login(
        {
          email,
          password: String(data.get('password') ?? ''),
        },
        demoRole,
      );

      const judgeCapability = await session.refreshJudgeCapability();

      if (mode === 'judge' && !judgeCapability) {
        await session.logout();
        throw new Error('This account is not assigned as a judge.');
      }

      if (mode === 'participant' && user.role !== 'participant') {
        await session.logout();
        throw new Error('This account is not a participant account.');
      }
      if (mode === 'organizer' && user.role !== 'organizer' && user.role !== 'admin') {
        await session.logout();
        throw new Error('This account is not an organizer or admin account.');
      }

      navigate(
        mode === 'judge'
          ? paths.judge.home
          : mode === 'organizer'
            ? paths.organizer.home
            : judgeCapability
              ? paths.judge.home
              : loginDestination(user.role, state),
        { replace: true },
      );
    } catch (error) {
      if (authValidationField(error) === 'email') {
        setEmailError('Please enter a valid email address.');
        setError('');
      } else {
        setError(safeLoginError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  const isJudge = mode === 'judge';
  const isOrganizer = mode === 'organizer';

  return (
    <AuthShell
      eyebrow={isJudge ? '[ JUDGE / LOGIN ]' : isOrganizer ? '[ ORGANIZER / LOGIN ]' : '[ PARTICIPANT / LOGIN ]'}
      title={isJudge ? 'JUDGE ACCESS.' : isOrganizer ? 'ORGANIZER ACCESS.' : 'WELCOME BACK.'}
      description={
        isJudge ? 'Authenticate with your assigned judge account to review projects.' : isOrganizer ? 'Authenticate to enter your organizer workspace.' : 'Authenticate to enter your participant workspace.'
      }
      footerText={isJudge || isOrganizer ? 'Need participant access?' : 'New to CodeArena?'}
      footerLinkLabel={isJudge || isOrganizer ? 'Participant login ↗' : 'Create account ↗'}
      footerLinkTo={isJudge || isOrganizer ? paths.participantLogin : paths.register}
    >
      {registered && (
        <p className="auth-message" role="status">
          Account created. Sign in with your email and password.
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy} noValidate>
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
                <option value={mode}>
                  {mode === 'judge' ? 'Judge' : mode === 'organizer' ? 'Organizer' : 'Participant'}
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
                id="login-email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                disabled={busy}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'login-email-error' : undefined}
                onChange={() => setEmailError('')}
              />
              {emailError && <p className="auth-message" id="login-email-error" role="alert">{emailError}</p>}
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
                : isOrganizer ? 'Enter organizer workspace ↗' : 'Enter participant workspace ↗'}
        </button>

        {(error || session.error) && (
          <p className="auth-message" role="alert">
            {error || safeLoginError(new Error(session.error))}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
