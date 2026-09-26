import { Outlet } from 'react-router-dom';
import { AppShell } from '../../components/layout/AppShell';

export function OrganizerLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
