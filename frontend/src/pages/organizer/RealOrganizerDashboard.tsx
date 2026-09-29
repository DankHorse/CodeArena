import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck,
  CheckCircle2,
  Scale,
  Users,
} from 'lucide-react';

import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  loadRealOrganizerT2,
  type RealOrganizerT2Snapshot,
} from '../../organizer/realT2Data';
import { errorMessage } from '../../auth/types';
import { paths } from '../../routes';


export function RealOrganizerDashboard() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [data, setData] = useState<RealOrganizerT2Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;

    if (!event) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    void loadRealOrganizerT2(event.id)
      .then(next => {
        if (generation.current === token) {
          setData(next);
        }
      })
      .catch(error => {
        if (generation.current === token) {
          setError(errorMessage(error));
          setData(null);
        }
      })
      .finally(() => {
        if (generation.current === token) {
          setLoading(false);
        }
      });

    return () => {
      generation.current++;
    };
  }, [event?.id]);

  if (!event) {
    return (
      <section className="team-state-panel">
        <p className="eyebrow">[ ORGANIZER WORKSPACE ]</p>
        <h1>
          NO EVENT
          <span className="heading-period">.</span>
        </h1>

        <p>Create or select an organizer event to open Arena Control.</p>

        <Link className="button button-primary" to={paths.organizer.events}>
          Event settings ↗
        </Link>
      </section>
    );
  }

  const realEvent = event.real;

  const progress = data?.progress;

  const activeRubric =
    data?.activeRubric.state === 'available'
      ? data.activeRubric.data
      : null;

  const results =
    data?.results.state === 'available'
      ? data.results.data
      : null;

  const judgeCount = progress?.judges.length ?? 0;
  const assignmentCount = progress?.total_assignments ?? 0;
  const completedCount = progress?.completed_evaluations ?? 0;
  const completion = progress?.completion_percentage ?? 0;

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER WORKSPACE ]</p>

          <h1>
            ARENA CONTROL
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Monitor judging readiness, review progress and event status from one place.
          </p>
        </div>

        <Link
          className="button button-primary"
          to={paths.organizer.judges}
        >
          Manage judging ↗
        </Link>
      </section>


      {error && (
        <p className="team-message" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="metadata" role="status">
          Loading organizer control data…
        </p>
      )}


      <section className="panel event-status">
        <header className="panel-header">
          <h2>
            <span>//</span> Event Status
          </h2>

          <span className="badge badge-cyan">
            {realEvent?.status?.toUpperCase() ?? 'EVENT'}
          </span>
        </header>

        <div className="event-status-body">
          <div className="event-summary">
            <p className="metadata">CURRENT ARENA</p>

            <h3>{event.name}</h3>

            <p>{event.description}</p>

            {realEvent?.submission_deadline && (
              <p>
                Submission deadline:{' '}
                {new Date(realEvent.submission_deadline).toLocaleString(
                  'en-GB',
                  { timeZone: 'UTC' },
                )}{' '}
                UTC
              </p>
            )}

            <Link to={paths.organizer.events}>
              Event settings ↗
            </Link>
          </div>


          <div className="review-progress">
            <div className="progress-heading">
              <span className="metadata">JUDGING COMPLETION</span>

              <strong>
                {completion}
                <span>%</span>
              </strong>
            </div>

            <progress
              value={completedCount}
              max={assignmentCount || 1}
              aria-label="Judging completion"
            />

            <div className="progress-caption">
              <span>
                {completedCount} / {assignmentCount} completed
              </span>

              <span>
                {Math.max(assignmentCount - completedCount, 0)} remaining
              </span>
            </div>
          </div>
        </div>
      </section>


      <section className="metric-strip" aria-label="Organizer metrics">
        {[
          {
            label: 'ASSIGNMENTS',
            value: assignmentCount,
            icon: ClipboardCheck,
          },
          {
            label: 'COMPLETED',
            value: completedCount,
            icon: CheckCircle2,
          },
          {
            label: 'JUDGES',
            value: judgeCount,
            icon: Users,
          },
          {
            label: 'RUBRIC CRITERIA',
            value: activeRubric?.criteria.length ?? 0,
            icon: Scale,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div className="metric" key={label}>
            <Icon size={18} aria-hidden="true" />

            <p className="metric-label">{label}</p>

            <strong className="metric-value">{value}</strong>
          </div>
        ))}
      </section>


      <div className="dashboard-lower">
        <section className="panel">
          <header className="panel-header">
            <h2>
              <span>//</span> Judging Readiness
            </h2>

            <Link to={paths.organizer.judges}>
              ASSIGNMENTS ↗
            </Link>
          </header>

          <div className="event-status-body">
            <div className="event-summary">
              <p className="metadata">ACTIVE RUBRIC</p>

              <h3>
                {activeRubric
                  ? `${activeRubric.title} / V${activeRubric.version}`
                  : 'No active rubric'}
              </h3>

              <p>
                {activeRubric
                  ? `${activeRubric.criteria.length} scoring criteria are active for judging.`
                  : 'Activate a rubric before assigning projects to judges.'}
              </p>

              <Link to={paths.organizer.rubric}>
                Scoring rubric ↗
              </Link>
            </div>
          </div>
        </section>


        <section className="panel">
          <header className="panel-header">
            <h2>
              <span>//</span> Results
            </h2>

            <Link to={paths.organizer.results}>
              RESULTS ↗
            </Link>
          </header>

          <div className="event-status-body">
            <div className="event-summary">
              <p className="metadata">RESULT SNAPSHOT</p>

              <h3>
                {!data
                  ? 'Waiting for judging data'
                  : results
                    ? results.is_stale
                      ? 'Results need recalculation'
                      : 'Results calculated'
                    : 'Results not calculated'}
              </h3>

              <p>
                {results
                  ? `${results.items.length} projects in the current result snapshot.`
                  : 'Results become available after judging data is sufficient and calculation is run.'}
              </p>

              <Link to={paths.organizer.results}>
                Open results ↗
              </Link>
            </div>
          </div>
        </section>
      </div>


      <section className="panel">
        <header className="panel-header">
          <h2>
            <span>//</span> Next Moves
          </h2>
        </header>

        <ol className="next-moves">
          {[
            {
              title: 'Review event settings',
              to: paths.organizer.events,
            },
            {
              title: 'Configure scoring rubric',
              to: paths.organizer.rubric,
            },
            {
              title: 'Manage judge assignments',
              to: paths.organizer.judges,
            },
            {
              title: 'Review judging results',
              to: paths.organizer.results,
            },
          ].map((item, index) => (
            <li key={item.to}>
              <span className="move-number">
                {String(index + 1).padStart(2, '0')}
              </span>

              <Link to={item.to}>
                {item.title} ↗
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
