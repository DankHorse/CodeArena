import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const assignments = [
  {
    title: 'Glass Signal',
    track: 'Security',
    status: 'Pending',
  },
  {
    title: 'Small Meadow',
    track: 'Climate',
    status: 'In review',
  },
  {
    title: 'Deep Compass',
    track: 'Data and analytics',
    status: 'Pending',
  },
];

export function JudgeDashboard() {
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

        <Link
          className="button button-primary"
          to="/judge/assignments"
        >
          View assignments
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="judge-status-panel">
        <div>
          <span className="badge badge-cyan">
            JUDGING IN PROGRESS
          </span>

          <p className="metadata judge-status-label">
            CURRENT EVENT
          </p>

          <h2>DOGFOOD 2026</h2>

          <p>
            Only your own assigned reviews are visible in this workspace.
          </p>
        </div>

        <div className="judge-progress">
          <p className="metadata">YOUR REVIEW PROGRESS</p>

          <strong>1 / 3</strong>

          <div className="judge-progress-bar">
            <span />
          </div>

          <p>2 reviews remaining</p>
        </div>
      </section>

      <div className="judge-metrics">
        <article>
          <ClipboardCheck size={20} aria-hidden="true" />
          <p className="metadata">ASSIGNED</p>
          <strong>3</strong>
          <span>Projects in your queue.</span>
        </article>

        <article>
          <CheckCircle2 size={20} aria-hidden="true" />
          <p className="metadata">COMPLETED</p>
          <strong>1</strong>
          <span>Reviews submitted.</span>
        </article>

        <article>
          <Clock3 size={20} aria-hidden="true" />
          <p className="metadata">REMAINING</p>
          <strong>2</strong>
          <span>Reviews still open.</span>
        </article>
      </div>

      <section className="judge-assignment-preview">
        <div className="judge-section-heading">
          <div>
            <p className="metadata">CURRENT QUEUE</p>
            <h2>ASSIGNED PROJECTS</h2>
          </div>

          <Link to="/judge/assignments">
            VIEW ALL ↗
          </Link>
        </div>

        <div className="judge-assignment-list">
          {assignments.map((assignment, index) => (
            <article
              className="judge-assignment-row"
              key={assignment.title}
            >
              <span className="judge-assignment-number">
                {String(index + 1).padStart(2, '0')}
              </span>

              <div>
                <strong>{assignment.title}</strong>
                <p>{assignment.track}</p>
              </div>

              <span className="judge-assignment-status">
                {assignment.status}
              </span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
