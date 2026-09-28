import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ClipboardCheck, CheckCircle2, Clock3 } from 'lucide-react';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { discoverJudgeEvents } from '../../judge/discovery';
import type { JudgeEventChoice } from '../../judge/discovery';
import { judgePath } from '../../judge/navigation';
import { paths } from '../../routes';
import { JudgeSidebar } from '../../components/judge/JudgeSidebar';
import { JudgeTopbar } from '../../components/judge/JudgeTopbar';

export function JudgeEntryPage() {
  const { user } = useSession();

  const [events, setEvents] = useState<JudgeEventChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;

    if (!user) {
      setLoading(false);
      return;
    }

    void discoverJudgeEvents(user.id)
      .then(value => {
        if (current) setEvents(value);
      })
      .catch(error => {
        if (current) setError(errorMessage(error));
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="session-state" role="status">
        CODEARENA / Loading judge workspace…
      </div>
    );
  }

  if (events.length > 0) {
    return (
      <Navigate
        to={judgePath(paths.judge.home, events[0].event.id)}
        replace
      />
    );
  }

  return (
    <div className="app-shell">
      <JudgeSidebar />

      <div className="shell-workspace">
        <JudgeTopbar />

        <main className="workspace" id="main-content">
          {error && (
            <p className="team-message" role="alert">
              {error}
            </p>
          )}

          <section className="workspace-intro">
            <div>
              <p className="eyebrow">[ JUDGE WORKSPACE ]</p>

              <h1>
                REVIEW DESK
                <span className="heading-period">.</span>
              </h1>

              <p className="workspace-description">
                Review your assigned projects independently and track your progress.
              </p>
            </div>
          </section>

          <section className="judge-status-panel">
            <div>
              <span className="badge badge-cyan">NO ASSIGNMENTS</span>

              <p className="metadata judge-status-label">
                CURRENT EVENT
              </p>

              <h2>No assigned judging event</h2>

              <p>
                Projects assigned to you will appear here automatically.
              </p>
            </div>

            <div className="judge-progress">
              <p className="metadata">YOUR REVIEW PROGRESS</p>
              <strong>0 / 0</strong>
              <progress
                value={0}
                max={1}
                aria-label="Your review completion"
              />
              <p>0 reviews remaining</p>
            </div>
          </section>

          <div className="judge-metrics">
            {[
              { label: 'ASSIGNED', value: 0, icon: ClipboardCheck },
              { label: 'COMPLETED', value: 0, icon: CheckCircle2 },
              { label: 'REMAINING', value: 0, icon: Clock3 },
            ].map(({ label, value, icon: Icon }) => (
              <article key={label}>
                <Icon size={20} aria-hidden="true" />
                <p className="metadata">{label}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>

          <section className="judge-assignment-preview">
            <div className="judge-section-heading">
              <div>
                <p className="metadata">CURRENT QUEUE</p>
                <h2>ASSIGNED PROJECTS</h2>
              </div>
            </div>

            <div className="judge-assignment-list">
              <p className="team-message">
                No projects are assigned to you yet.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
