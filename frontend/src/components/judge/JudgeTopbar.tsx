import { useLocation } from 'react-router-dom';

const labels: Record<string, string> = {
  '/judge': 'Dashboard',
  '/judge/assignments': 'Assignments',
  '/judge/rubric': 'Scoring guide',
};

export function JudgeTopbar() {
  const location = useLocation();

  const label =
    labels[location.pathname] ??
    (location.pathname.startsWith('/judge/review/')
      ? 'Project review'
      : 'Judge');

  return (
    <header className="topbar">
      <p className="breadcrumb">
        CodeArena
        <span aria-hidden="true">/</span>
        <strong>{label}</strong>
      </p>

      <div className="topbar-controls">
        <span className="badge badge-cyan">JUDGE</span>
      </div>
    </header>
  );
}
