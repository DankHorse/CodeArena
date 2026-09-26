import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to workspace</a>
      <Sidebar />
      <div className="shell-workspace">
        <Topbar />
        <main className="workspace" id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
