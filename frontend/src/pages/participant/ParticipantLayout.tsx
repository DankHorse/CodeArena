import { DEMO } from '../../api';
import { paths } from '../../routes';
import { Outlet, Link } from 'react-router-dom';
import { ParticipantSidebar } from '../../components/participant/ParticipantSidebar';
import { ParticipantTopbar } from '../../components/participant/ParticipantTopbar';
import { ParticipantProvider, useParticipant } from '../../participant/ParticipantProvider';
import { useSession } from '../../auth/SessionProvider';

function ParticipantWorkspace() {
  const { loading, error, message, snapshot, refresh, recovery, busy, registrationConfirmed, registerCurrentEvent } = useParticipant();
  return (
    <div className="app-shell">
      <ParticipantSidebar />
      <div className="shell-workspace">
        <ParticipantTopbar />
        <main className="workspace" id="main-content">
          {recovery && <p className="team-message" role="status">{recovery}</p>}
          {error && <div className="team-message" role="alert">{error} <button className="button submission-save-button" type="button" onClick={() => void refresh()} disabled={loading}>Retry</button></div>}
          {!DEMO && !loading && !snapshot?.event && <p><Link to={paths.events}>Browse Events to select or register for an event ↗</Link></p>}
          {!DEMO && !loading && snapshot?.event && !snapshot.team && <section className="team-state-panel" aria-label="Event registration">
            <div><p className="metadata">SELECTED EVENT / {snapshot.event.name}</p>
              <p>{registrationConfirmed ? 'Registration confirmed for this event. Create your team in the Team workspace.' : 'Selecting an event does not register you. Register or confirm your existing registration before creating a team.'}</p>
              {!registrationConfirmed && <button className="button button-primary" disabled={busy} onClick={() => void registerCurrentEvent?.()}>Register for this event ↗</button>}
              <Link to={paths.participant.team}>Open Team workspace ↗</Link>
            </div>
          </section>}
          {message && <p className="team-message" role="status">{message}</p>}
          {loading ? <p className="metadata" role="status">Loading participant workspace…</p> : snapshot ? <Outlet /> : !error && <p>No participant data is available.</p>}
        </main>
      </div>
    </div>
  );
}
export function ParticipantLayout() {
  const { user } = useSession();
  return <ParticipantProvider key={user?.id}><ParticipantWorkspace /></ParticipantProvider>;
}
