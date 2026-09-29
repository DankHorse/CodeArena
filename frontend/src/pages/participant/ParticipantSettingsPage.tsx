import { useState } from 'react';
import {
  CalendarDays,
  LogOut,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { useParticipant } from '../../participant/ParticipantProvider';
import { paths } from '../../routes';

function formatDate(value?: string) {
  if (!value) return 'Not available';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export function ParticipantSettingsPage() {
  const session = useSession();
  const { snapshot } = useParticipant();
  const navigate = useNavigate();

  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const user = session.user;

  if (!user) return null;

  async function signOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError('');

    try {
      navigate(paths.home, { replace: true });
      await session.logout();
    } catch (error) {
      setSignOutError(errorMessage(error));
      setSigningOut(false);
    }
  }

  return (
    <>
      <section className="workspace-intro participant-settings-intro">
        <div>
          <p className="eyebrow">[ PARTICIPANT / SETTINGS ]</p>

          <h1>
            ACCOUNT SETTINGS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Your identity, CodeArena account and workspace access.
          </p>
        </div>
      </section>

      <main className="participant-settings-flow">

        <header className="participant-settings-profile-row">
          <div className="participant-profile-summary">
            <p className="metadata">PARTICIPANT PROFILE</p>
            <h2>{user.display_name}</h2>
            <p>{user.email}</p>
          </div>

          <span className="badge badge-cyan participant-account-status">
            {user.is_active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </header>

        <section className="participant-settings-section">
          <header className="participant-settings-section-heading">
            <UserRound size={19} aria-hidden="true" />

            <div>
              <p className="metadata">IDENTITY</p>
              <h2>PROFILE</h2>
            </div>
          </header>

          <dl className="participant-settings-rows">
            <div>
              <dt>DISPLAY NAME</dt>
              <dd>{user.display_name}</dd>
            </div>

            <div>
              <dt>EMAIL ADDRESS</dt>
              <dd>
                <Mail size={16} aria-hidden="true" />
                {user.email}
              </dd>
            </div>
          </dl>

          <p className="participant-settings-note">
            Profile editing is not available in this build.
          </p>
        </section>

        <section className="participant-settings-section">
          <header className="participant-settings-section-heading">
            <ShieldCheck size={19} aria-hidden="true" />

            <div>
              <p className="metadata">CODEARENA ACCOUNT</p>
              <h2>ACCOUNT</h2>
            </div>
          </header>

          <dl className="participant-settings-rows">
            <div>
              <dt>WORKSPACE ROLE</dt>
              <dd>{user.role.toUpperCase()}</dd>
            </div>

            <div>
              <dt>ACCOUNT STATUS</dt>
              <dd>{user.is_active ? 'Active' : 'Inactive'}</dd>
            </div>

            <div>
              <dt>MEMBER SINCE</dt>
              <dd>{formatDate(user.created_at)}</dd>
            </div>

            <div>
              <dt>ACCOUNT ID</dt>
              <dd className="participant-account-id">{user.id}</dd>
            </div>
          </dl>
        </section>

        <section className="participant-settings-section">
          <header className="participant-settings-section-heading">
            <CalendarDays size={19} aria-hidden="true" />

            <div>
              <p className="metadata">CURRENT CONTEXT</p>
              <h2>WORKSPACE</h2>
            </div>
          </header>

          <dl className="participant-settings-rows">
            <div>
              <dt>SELECTED EVENT</dt>
              <dd>{snapshot?.event?.name ?? 'No event selected'}</dd>
            </div>

            <div>
              <dt>TEAM</dt>
              <dd>{snapshot?.team?.name ?? 'No team formed'}</dd>
            </div>

            <div>
              <dt>SUBMISSION</dt>
              <dd>
                {snapshot?.project
                  ? snapshot.project.state === 'submitted'
                    ? 'Submitted'
                    : 'Draft'
                  : 'No submission'}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="participant-settings-signout-row">
          <div>
            <p className="metadata">SESSION</p>
            <strong>Finished for now?</strong>
          </div>

          <button
            className="button participant-settings-signout"
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            <LogOut size={16} aria-hidden="true" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>

          {signOutError && (
            <p className="team-message" role="alert">
              {signOutError}
            </p>
          )}
        </footer>

      </main>
    </>
  );
}
