import { DEMO } from '../../api';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import { LogoutButton } from '../common/LogoutButton';
import { paths } from '../../routes';
import { ArrowUpRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

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
  const { snapshot } = useOrganizer();
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
        <LogoutButton />
        <span className="badge badge-cyan">
          {!DEMO ? snapshot?.event?.real?.status.toUpperCase() ?? 'REAL MODE' : snapshot?.event?.practice ? 'PRACTICE EVENT' : 'FIXTURE EVENT'}
        </span>

        <Link className="public-site" to={paths.home}>
          PUBLIC SITE
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
