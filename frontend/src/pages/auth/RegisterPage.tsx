import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { paths } from '../../routes';
import { DEMO } from '../../api';

type EntryWorkspace = 'participant' | 'judge' | 'organizer';

const workspaceOptions: {
  id: EntryWorkspace;
  label: string;
  description: string;
}[] = [
  {
    id: 'participant',
    label: 'PARTICIPANT',
    description: 'Build & submit',
  },
  {
    id: 'judge',
    label: 'JUDGE',
    description: 'Review & score',
  },
  {
    id: 'organizer',
    label: 'ORGANIZER',
    description: 'Manage event',
  },
];

function workspaceFromState(state: unknown): EntryWorkspace | null {
  if (!state || typeof state !== 'object' || !('workspace' in state)) return null;

  const workspace = state.workspace;

  return workspace === 'participant' ||
    workspace === 'judge' ||
    workspace === 'organizer'
    ? workspace
    : null;
}

function workspaceDestination(workspace: EntryWorkspace) {
  if (workspace === 'judge') return paths.judge.home;
  if (workspace === 'organizer') return paths.organizer.home;
  return paths.participant.home;
}

export function RegisterPage() {
  const { register, login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [workspace, setWorkspace] = useState<EntryWorkspace | null>(
    workspaceFromState(location.state),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function chooseWorkspace(nextWorkspace: EntryWorkspace) {
    setError('');

    if (nextWorkspace === 'organizer' && !DEMO) {
      navigate(paths.login, {
        state: {
          workspace: 'organizer',
          from: paths.organizer.home,
        },
      });
      return;
    }

    setWorkspace(nextWorkspace);

    const previousState =
      location.state && typeof location.state === 'object'
        ? location.state
        : {};

    navigate(paths.register, {
      replace: true,
      state: {
        ...previousState,
        workspace: nextWorkspace,
        from: workspaceDestination(nextWorkspace),
      },
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspace) {
      setError('Choose a workspace before creating your account.');
      return;
    }

    /*
     * Real organizer accounts are provisioned by the backend.
     * Public registration must never grant organizer permissions.
     */
    if (workspace === 'organizer' && !DEMO) {
      navigate(paths.login, {
        state: {
          workspace: 'organizer',
          from: paths.organizer.home,
        },
      });
      return;
    }

    const data = new FormData(event.currentTarget);
    const display_name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!display_name || !email || password.length < 12) {
      setError('Enter a name, email, and password of at least 12 characters.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await register({ display_name, email, password });

      const demoRole =
        workspace === 'judge'
          ? 'judge'
          : workspace === 'organizer'
            ? 'organizer'
            : 'participant';

      await login({ email, password }, demoRole);

      navigate(workspaceDestination(workspace), {
        replace: true,
      });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const title = workspace
    ? `${workspace.toUpperCase()} ACCESS`
    : 'JOIN THE ARENA.';

  const description = workspace
    ? workspace === 'organizer'
      ? 'Enter the event management workspace.'
      : `Create your account and enter the ${workspace} workspace.`
    : 'Choose how you want to enter CodeArena.';

  return (
    <AuthShell
      eyebrow={
        workspace
          ? `[ CODEARENA / ${workspace.toUpperCase()} ]`
          : '[ ACCESS / REGISTER ]'
      }
      title={title}
      description={description}
      footerText="Already registered?"
      footerLinkLabel="Login ↗"
      footerLinkTo={paths.login}
    >
      <section
        className="auth-access-selector"
        aria-label="Choose CodeArena workspace"
      >
        <div className="auth-access-heading">
          <span>ACCESS MODE</span>
          <span>SELECT ONE</span>
        </div>

        <div className="auth-access-tabs">
          {workspaceOptions.map((option, index) => {
            const selected = workspace === option.id;

            return (
              <button
                key={option.id}
                type="button"
                className={`auth-access-tab${selected ? ' is-active' : ''}`}
                aria-pressed={selected}
                disabled={busy}
                onClick={() => chooseWorkspace(option.id)}
              >
                <span className="auth-access-number">
                  0{index + 1}
                </span>

                <span className="auth-access-content">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>

                <span
                  className="auth-access-indicator"
                  aria-hidden="true"
                >
                  {selected ? '●' : '○'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {DEMO && workspace && (
        <p className="auth-message">
          Demo registration creates a local preview profile. Use sample details,
          not real credentials.
        </p>
      )}

      {workspace === 'organizer' && !DEMO ? (
        <section className="auth-organizer-access">
          <p className="metadata">AUTHORIZED ORGANIZER ACCESS</p>

          <p>
            Organizer permissions are assigned by CodeArena. Sign in with an
            existing organizer account to continue.
          </p>

          <button
            className="button button-primary auth-submit"
            type="button"
            onClick={() =>
              navigate(paths.login, {
                state: {
                  workspace: 'organizer',
                  from: paths.organizer.home,
                },
              })
            }
          >
            Continue to organizer login ↗
          </button>
        </section>
      ) : workspace ? (
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          aria-busy={busy}
        >
          <label>
            <span>NAME</span>
            <input
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Your name"
              required
              disabled={busy}
            />
          </label>

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
            <span>PASSWORD / 12 CHARACTERS MINIMUM</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              placeholder="Create a password"
              required
              disabled={busy}
            />
          </label>

          <button
            className="button button-primary auth-submit"
            type="submit"
            disabled={busy}
          >
            {busy
              ? 'Entering arena…'
              : workspace === 'judge'
                ? 'Create account & enter judge workspace ↗'
                : 'Create account & enter arena ↗'}
          </button>

          {error && (
            <p className="auth-message" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="auth-workspace-prompt">
          Select Participant, Judge, or Organizer to continue.
        </p>
      )}
    </AuthShell>
  );
}
