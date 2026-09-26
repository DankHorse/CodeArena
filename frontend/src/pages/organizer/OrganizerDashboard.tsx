import { ArrowUpRight } from 'lucide-react';
import { EventStatusPanel } from '../../components/dashboard/EventStatusPanel';
import { MetricStrip } from '../../components/dashboard/MetricStrip';
import { ProjectFeed } from '../../components/dashboard/ProjectFeed';
import { NextMoves } from '../../components/dashboard/NextMoves';

export function OrganizerDashboard() {
  return (
    <>
      <section className="workspace-intro" aria-labelledby="workspace-title">
        <div>
          <p className="eyebrow">[ ORGANIZER WORKSPACE ]</p>

          <h1 id="workspace-title">
            ARENA CONTROL<span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Monitor submissions, judging and event progress from one place.
          </p>
        </div>

        <button
          className="button button-primary"
          type="button"
          disabled
          title="Judging management coming soon"
        >
          Manage judging
          <ArrowUpRight size={17} aria-hidden="true" />
        </button>
      </section>

      <EventStatusPanel />
      <MetricStrip />

      <div className="dashboard-lower">
        <ProjectFeed />
        <NextMoves />
      </div>

      <p className="preview-note">
        FIXTURE PREVIEW / Static sample data
      </p>
    </>
  );
}
