import { Outlet, useLocation } from 'react-router-dom';

import { DEMO } from '../../api';
import { useSession } from '../../auth/SessionProvider';
import { AppShell } from '../../components/layout/AppShell';
import {
  OrganizerProvider,
  useOrganizer,
} from '../../organizer/OrganizerProvider';

import { RealEventSettings } from './RealEventSettings';
import { RealOrganizerDashboard } from './RealOrganizerDashboard';
import { RealOrganizerJudgeAssignmentsPage } from './RealOrganizerJudgeAssignmentsPage';
import { RealOrganizerResultsPage } from './RealOrganizerResultsPage';
import { RealOrganizerRubricPage } from './RealOrganizerRubricPage';


function OrganizerWorkspace() {
  const location = useLocation();

  const {
    snapshot,
    loading,
    error,
    message,
  } = useOrganizer();

  let content;

  if (loading) {
    content = (
      <p role="status" className="metadata">
        Loading organizer workspace…
      </p>
    );
  } else if (!DEMO) {
    if (location.pathname === '/organizer') {
      content = (
        <RealOrganizerDashboard key={snapshot?.event?.id} />
      );
    } else if (location.pathname === '/organizer/events') {
      content = <RealEventSettings />;
    } else if (location.pathname === '/organizer/rubric') {
      content = (
        <RealOrganizerRubricPage key={snapshot?.event?.id} />
      );
    } else if (location.pathname === '/organizer/judges') {
      content = (
        <RealOrganizerJudgeAssignmentsPage key={snapshot?.event?.id} />
      );
    } else if (location.pathname === '/organizer/results') {
      content = (
        <RealOrganizerResultsPage key={snapshot?.event?.id} />
      );
    } else {
      content = (
        <p>This workspace is not connected to the real backend yet.</p>
      );
    }
  } else if (snapshot?.event) {
    content = <Outlet key={snapshot.event.id} />;
  } else if (!error) {
    content = <p>No organizer event is available.</p>;
  }

  return (
    <AppShell>

      {error && (
        <p className="team-message" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}

      {content}
    </AppShell>
  );
}


export function OrganizerLayout() {
  const { user } = useSession();

  return (
    <OrganizerProvider key={user?.id}>
      <OrganizerWorkspace />
    </OrganizerProvider>
  );
}
