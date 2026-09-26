import { useLocation } from 'react-router-dom';

const labels: Record<string, string> = {
  '/participant': 'Dashboard',
  '/participant/team': 'Team',
  '/participant/submission': 'Submission',
};

export function ParticipantTopbar() {
  const location = useLocation();
  const label = labels[location.pathname] ?? 'Participant';

  return (
    <header className="topbar">
      <p className="breadcrumb">
        CodeArena
        <span aria-hidden="true">/</span>
        <strong>{label}</strong>
      </p>

      <div className="topbar-controls">
        <span className="badge badge-cyan">PARTICIPANT</span>
      </div>
    </header>
  );
}
