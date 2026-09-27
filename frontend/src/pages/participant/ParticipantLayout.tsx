import { Outlet } from 'react-router-dom';
import { ParticipantSidebar } from '../../components/participant/ParticipantSidebar';
import { ParticipantTopbar } from '../../components/participant/ParticipantTopbar';
import { ParticipantProvider, useParticipant } from '../../participant/ParticipantProvider';
import { useSession } from '../../auth/SessionProvider';

function ParticipantWorkspace() {
  const { loading, error, message, snapshot, refresh } = useParticipant();
  return (
    <div className="app-shell">
      <ParticipantSidebar />
      <div className="shell-workspace">
        <ParticipantTopbar />
        <main className="workspace" id="main-content">
          {error && <div className="team-message" role="alert">{error} <button className="button submission-save-button" type="button" onClick={() => void refresh()} disabled={loading}>Retry</button></div>}
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
