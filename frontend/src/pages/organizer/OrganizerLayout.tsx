import { Outlet } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';
import { OrganizerProvider, useOrganizer } from '../../organizer/OrganizerProvider';
import { useSession } from '../../auth/SessionProvider';
function OrganizerWorkspace() {
  const { snapshot, loading, busy, error, message, refresh } = useOrganizer();
  return <AppShell>
    <div className="organizer-refresh"><button className="public-site" type="button" disabled={loading || busy} onClick={() => void refresh()}>REFRESH EVENT ↻</button></div>
    {error && <p className="team-message" role="alert">{error}</p>}
    {message && <p className="team-message" role="status">{message}</p>}
    {loading ? <p role="status" className="metadata">Loading organizer workspace…</p> : snapshot?.event ? <Outlet key={snapshot.event.id} /> : !error && <p>No organizer event is available.</p>}
  </AppShell>;
}
export function OrganizerLayout() { const { user } = useSession(); return <OrganizerProvider key={user?.id}><OrganizerWorkspace /></OrganizerProvider>; }
