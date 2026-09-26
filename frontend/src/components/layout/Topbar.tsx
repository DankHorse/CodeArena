import { ArrowUpRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const breadcrumbLabels: Record<string, string> = {
  '/organizer': 'Arena control',
  '/organizer/events': 'Event settings',
  '/organizer/teams': 'Teams',
  '/organizer/projects': 'Projects',
  '/organizer/rubric': 'Scoring rubric',
  '/organizer/judges': 'Judge assignments',
  '/organizer/results': 'Results & exports',
  '/organizer/activity': 'Activity log',
};

export function Topbar() {
  const location = useLocation();

  const currentLabel =
    breadcrumbLabels[location.pathname] ?? 'Arena control';

  return (
    <header className="topbar">
      <p className="breadcrumb">
        CodeArena
        <span aria-hidden="true">/</span>
        <strong>{currentLabel}</strong>
      </p>

      <div className="topbar-controls">
        <span className="badge badge-cyan">
          FIXTURE EVENT
        </span>

        <button
          className="public-site"
          type="button"
          disabled
          title="Public site coming soon"
        >
          PUBLIC SITE
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
