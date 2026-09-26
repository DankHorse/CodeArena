import { Outlet } from 'react-router-dom';
import { ParticipantSidebar } from '../../components/participant/ParticipantSidebar';
import { ParticipantTopbar } from '../../components/participant/ParticipantTopbar';

export function ParticipantLayout() {
  return (
    <div className="app-shell">
      <ParticipantSidebar />

      <div className="shell-workspace">
        <ParticipantTopbar />

        <main className="workspace" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
