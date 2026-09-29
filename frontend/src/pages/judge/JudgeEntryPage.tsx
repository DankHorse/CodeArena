import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  Clock3,
} from 'lucide-react';

import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { discoverJudgeEvents } from '../../judge/discovery';
import type { JudgeEventChoice } from '../../judge/discovery';
import { judgePath } from '../../judge/navigation';
import { paths } from '../../routes';

import { JudgeSidebar } from '../../components/judge/JudgeSidebar';
import { JudgeTopbar } from '../../components/judge/JudgeTopbar';


function EmptyJudgeDashboard() {
  return (
    <>
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
    </>
  );
}


function EmptyJudgeAssignments() {
  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ JUDGE / ASSIGNMENTS ]</p>

          <h1>
            ASSIGNMENTS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Your judging queue and review progress.
          </p>
        </div>
      </section>

      <section className="assignment-summary">
        {[
          { label: 'ASSIGNED', value: 0 },
          { label: 'IN PROGRESS', value: 0 },
          { label: 'COMPLETED', value: 0 },
          { label: 'REMAINING', value: 0 },
        ].map(item => (
          <article key={item.label}>
            <p className="metadata">{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="assignment-table">
        <div className="assignment-table-header">
          <span>PROJECT</span>
          <span>TEAM</span>
          <span>TRACK</span>
          <span>STATUS</span>
          <span>ACTION</span>
        </div>

        <div className="judge-empty-route-state">
          <p className="metadata">ASSIGNMENT QUEUE / EMPTY</p>
          <h2>No projects assigned yet.</h2>
          <p>
            Projects assigned to your judge account will appear here automatically.
          </p>
        </div>
      </section>
    </>
  );
}


function EmptyJudgeScoringGuide() {
  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ JUDGE / SCORING GUIDE ]</p>

          <h1>
            SCORING GUIDE
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Review the rubric used to evaluate your assigned projects.
          </p>
        </div>
      </section>

      <section className="scoring-guide-notice">
        <div>
          <p className="metadata">INDEPENDENT JUDGING</p>
          <strong>Score projects based on your own evaluation.</strong>
          <span>Other judges' scores are never displayed here.</span>
        </div>
      </section>

      <section className="scoring-guide-table">
        <div className="scoring-guide-header">
          <h2>No assigned judging event</h2>
          <span className="badge badge-cyan">0 CRITERIA</span>
        </div>

        <div className="scoring-guide-columns">
          <span>CRITERION</span>
          <span>DESCRIPTION</span>
          <span>WEIGHT</span>
          <span>SCORE RANGE</span>
        </div>

        <div className="judge-empty-route-state">
          <p className="metadata">RUBRIC / UNAVAILABLE</p>
          <h2>No scoring guide available yet.</h2>
          <p>
            The event rubric will appear when a project is assigned to you.
          </p>
        </div>
      </section>
    </>
  );
}


function EmptyReviewState() {
  return (
    <section className="team-state-panel">
      <p className="eyebrow">[ JUDGE / REVIEW ]</p>
      <h1>
        REVIEW UNAVAILABLE
        <span className="heading-period">.</span>
      </h1>
      <p>No project is currently assigned to this judge account.</p>
    </section>
  );
}


export function JudgeEntryPage() {
  const { user } = useSession();
  const location = useLocation();

  const [events, setEvents] = useState<JudgeEventChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

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

  /*
   * A real judge account is still a backend participant account.
   * Judge capability comes from event-specific assignments.
   *
   * If an assignment exists, preserve the page the judge requested
   * and attach the authorized event UUID.
   */
  if (events.length > 0) {
    const destination =
      location.pathname === paths.judge.assignments ||
      location.pathname === paths.judge.rubric ||
      location.pathname.startsWith('/judge/review/')
        ? location.pathname
        : paths.judge.home;

    return (
      <Navigate
        to={judgePath(destination, events[0].event.id)}
        replace
      />
    );
  }

  let content;

  if (location.pathname === paths.judge.assignments) {
    content = <EmptyJudgeAssignments />;
  } else if (location.pathname === paths.judge.rubric) {
    content = <EmptyJudgeScoringGuide />;
  } else if (location.pathname.startsWith('/judge/review/')) {
    content = <EmptyReviewState />;
  } else {
    content = <EmptyJudgeDashboard />;
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

          {content}
        </main>
      </div>
    </div>
  );
}
