import { Outlet } from 'react-router-dom';
import { JudgeSidebar } from '../../components/judge/JudgeSidebar';
import { JudgeTopbar } from '../../components/judge/JudgeTopbar';
import { JudgeProvider, useJudge } from '../../judge/JudgeProvider';
import { useSession } from '../../auth/SessionProvider';
function JudgeWorkspace() {
  const { snapshot, loading, busy, error, message, refresh } = useJudge();
  return <div className="app-shell"><JudgeSidebar /><div className="shell-workspace"><JudgeTopbar /><main className="workspace" id="main-content">
    {error && <div className="team-message" role="alert">{error} <button className="button submission-save-button" type="button" disabled={loading || busy} onClick={() => void refresh()}>Retry</button></div>}
    {message && <p className="team-message" role="status">{message}</p>}
    {loading ? <p className="metadata" role="status">Loading your judging workspace…</p> : snapshot && <Outlet />}
  </main></div></div>;
}
export function JudgeLayout() { const { user } = useSession(); return <JudgeProvider key={user?.id}><JudgeWorkspace /></JudgeProvider>; }
