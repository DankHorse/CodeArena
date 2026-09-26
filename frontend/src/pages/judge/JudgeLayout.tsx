import { Outlet } from 'react-router-dom';
import { JudgeSidebar } from '../../components/judge/JudgeSidebar';
import { JudgeTopbar } from '../../components/judge/JudgeTopbar';

export function JudgeLayout() {
  return (
    <div className="app-shell">
      <JudgeSidebar />

      <div className="shell-workspace">
        <JudgeTopbar />

        <main className="workspace" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
