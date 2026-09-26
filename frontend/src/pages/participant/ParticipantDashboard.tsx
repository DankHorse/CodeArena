import { ArrowUpRight, Clock3, FileText, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ParticipantDashboard() {
  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ PARTICIPANT WORKSPACE ]</p>

          <h1>
            SUBMISSION CONTROL
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Manage your team and project submission from one place.
          </p>
        </div>

        <Link
          className="button button-primary"
          to="/participant/submission"
        >
          Open submission
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </section>

      <section className="participant-status-panel">
        <div>
          <span className="badge badge-cyan">SUBMISSIONS OPEN</span>

          <p className="metadata participant-status-label">CURRENT EVENT</p>

          <h2>DOGFOOD 2026</h2>

          <p>Your project can be edited until the submission deadline.</p>
        </div>

        <div className="participant-deadline">
          <Clock3 size={20} aria-hidden="true" />

          <div>
            <p className="metadata">SUBMISSION DEADLINE / UTC</p>
            <strong>1 MAR 2026</strong>
          </div>
        </div>
      </section>

      <div className="participant-metrics">
        <article>
          <Users size={20} aria-hidden="true" />
          <p className="metadata">TEAM</p>
          <strong>NOT FORMED</strong>
          <span>Create or join a team.</span>
        </article>

        <article>
          <FileText size={20} aria-hidden="true" />
          <p className="metadata">SUBMISSION</p>
          <strong>DRAFT</strong>
          <span>Your project is not submitted yet.</span>
        </article>

        <article>
          <Clock3 size={20} aria-hidden="true" />
          <p className="metadata">DEADLINE STATUS</p>
          <strong>OPEN</strong>
          <span>Editing is currently allowed.</span>
        </article>
      </div>
    </>
  );
}
