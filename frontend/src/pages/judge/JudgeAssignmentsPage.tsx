import { ArrowUpRight, CheckCircle2, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const assignments = [
  {
    id: 'glass-signal',
    title: 'Glass Signal',
    team: 'Northstar',
    track: 'Security',
    status: 'Pending',
  },
  {
    id: 'small-meadow',
    title: 'Small Meadow',
    team: 'Greenframe',
    track: 'Climate',
    status: 'In review',
  },
  {
    id: 'deep-compass',
    title: 'Deep Compass',
    team: 'Vector Labs',
    track: 'Data and analytics',
    status: 'Pending',
  },
];

export function JudgeAssignmentsPage() {
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
            Review projects assigned to your judging queue.
          </p>
        </div>
      </section>

      <section className="assignment-summary">
        <article>
          <p className="metadata">ASSIGNED</p>
          <strong>3</strong>
        </article>

        <article>
          <p className="metadata">IN PROGRESS</p>
          <strong>1</strong>
        </article>

        <article>
          <p className="metadata">COMPLETED</p>
          <strong>1</strong>
        </article>

        <article>
          <p className="metadata">REMAINING</p>
          <strong>2</strong>
        </article>
      </section>

      <section className="assignment-table">
        <div className="assignment-table-header">
          <span>PROJECT</span>
          <span>TEAM</span>
          <span>TRACK</span>
          <span>STATUS</span>
          <span>ACTION</span>
        </div>

        {assignments.map((assignment) => (
          <article className="assignment-table-row" key={assignment.id}>
            <div>
              <strong>{assignment.title}</strong>
            </div>

            <span>{assignment.team}</span>

            <span>{assignment.track}</span>

            <span className="assignment-status">
              {assignment.status === 'In review' ? (
                <>
                  <Clock3 size={14} aria-hidden="true" />
                  In review
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  Pending
                </>
              )}
            </span>

            <Link
              className="assignment-review-link"
              to={`/judge/review/${assignment.id}`}
            >
              Review
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>

      <p className="team-message">
        Frontend preview only. Judge assignments will come from the backend API later.
      </p>
    </>
  );
}
