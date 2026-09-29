import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  Scale,
  Trophy,
  Users,
} from 'lucide-react';

import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  loadRealOrganizerT2,
  type RealOrganizerT2Snapshot,
} from '../../organizer/realT2Data';
import { errorMessage } from '../../auth/types';
import { paths } from '../../routes';

function formatUtc(value?: string) {
  if (!value) return 'NOT SET';

  return new Date(value)
    .toLocaleString('en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .toUpperCase();
}

function countdown(deadline: string | undefined, now: number) {
  if (!deadline) return 'NO DEADLINE';

  const remaining = new Date(deadline).getTime() - now;

  if (remaining <= 0) return 'WINDOW CLOSED';

  const total = Math.floor(remaining / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return [
    `${String(days).padStart(2, '0')}D`,
    `${String(hours).padStart(2, '0')}H`,
    `${String(minutes).padStart(2, '0')}M`,
    `${String(seconds).padStart(2, '0')}S`,
  ].join(' ');
}

export function RealOrganizerDashboard() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [data, setData] =
    useState<RealOrganizerT2Snapshot | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const generation = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

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
          setSyncedAt(Date.now());
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

        <p>
          Create or select an organizer event to open Arena Control.
        </p>

        <Link
          className="button button-primary"
          to={paths.organizer.events}
        >
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
  const pendingCount = progress?.pending_evaluations ?? 0;

  const completion = Math.max(
    0,
    Math.min(progress?.completion_percentage ?? 0, 100),
  );

  const remainingAssignments = Math.max(
    assignmentCount - completedCount,
    0,
  );

  const judgingState =
    loading && !data
      ? 'SYNCING'
      : assignmentCount === 0
        ? 'WAITING'
        : completion >= 100
          ? 'COMPLETE'
          : 'IN PROGRESS';

  const rubricState = activeRubric ? 'ACTIVE' : 'MISSING';

  const resultsState =
    loading && !data
      ? 'SYNCING'
      : results
        ? results.is_stale
          ? 'STALE'
          : results.status.toUpperCase()
        : 'NOT CALCULATED';

  const syncLabel = syncedAt
    ? new Date(syncedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : loading
      ? 'SYNCING'
      : 'NOT SYNCED';

  const controls = [
    {
      index: '01',
      label: 'EVENT CONTROL',
      state: realEvent?.status?.toUpperCase() ?? 'EVENT',
      copy: 'Schedule, lifecycle and publishing configuration.',
      to: paths.organizer.events,
      tone: 'cyan',
    },
    {
      index: '02',
      label: 'SCORING SYSTEM',
      state: rubricState,
      copy: activeRubric
        ? `${activeRubric.criteria.length} active criteria / version ${activeRubric.version}`
        : 'No scoring rubric is currently active.',
      to: paths.organizer.rubric,
      tone: activeRubric ? 'cyan' : 'pink',
    },
    {
      index: '03',
      label: 'JUDGING NETWORK',
      state: judgingState,
      copy: `${judgeCount} judges / ${assignmentCount} assignments / ${remainingAssignments} remaining`,
      to: paths.organizer.judges,
      tone: completion >= 100 ? 'cyan' : 'pink',
    },
    {
      index: '04',
      label: 'RESULT ENGINE',
      state: resultsState,
      copy: results
        ? `${results.items.length} projects in result snapshot`
        : 'Waiting for a calculated backend result snapshot.',
      to: paths.organizer.results,
      tone: results && !results.is_stale ? 'cyan' : 'pink',
    },
  ];

  return (
    <div className="arena-control-live">
      <section className="workspace-intro arena-control-intro">
        <div>
          <p className="eyebrow">
            [ ORGANIZER / LIVE OPERATIONS ]
          </p>

          <h1>
            ARENA CONTROL
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Real-time event operations, judging readiness and
            result state for {event.name}.
          </p>
        </div>

        <div className="arena-live-status">
          <span className="arena-live-dot" />

          <div>
            <span>CONTROL DATA</span>
            <strong>{loading ? 'SYNCING' : 'LIVE'}</strong>
          </div>

          <div>
            <span>LAST SYNC</span>
            <strong>{syncLabel}</strong>
          </div>
        </div>
      </section>

      {error && (
        <p className="team-message" role="alert">
          {error}
        </p>
      )}

      <section
        className="arena-command-deck"
        aria-label="Current event command deck"
      >
        <div className="arena-command-copy">
          <div className="arena-command-kicker">
            <span className="arena-live-dot" />
            CURRENT ARENA
          </div>

          <h2>{event.name}</h2>

          <p>{event.description}</p>

          <div className="arena-command-tags">
            <span>
              STATUS /{' '}
              {realEvent?.status?.toUpperCase() ?? 'UNKNOWN'}
            </span>

            {realEvent?.slug && (
              <span>SLUG / {realEvent.slug}</span>
            )}
          </div>

          <div className="arena-deadline-block">
            <CalendarClock size={18} aria-hidden="true" />

            <div>
              <span>SUBMISSION WINDOW</span>

              <strong>
                {countdown(
                  realEvent?.submission_deadline,
                  now,
                )}
              </strong>

              <small>
                DEADLINE /{' '}
                {formatUtc(realEvent?.submission_deadline)} UTC
              </small>
            </div>
          </div>

          <div className="arena-command-actions">
            <Link
              className="button button-primary"
              to={paths.organizer.judges}
            >
              Manage judging ↗
            </Link>

            <Link
              className="button button-secondary"
              to={paths.organizer.events}
            >
              Event settings
            </Link>
          </div>
        </div>

        <div
          className="arena-completion-console"
          aria-label={`Judging ${completion}% complete`}
        >
          <div className="arena-completion-label">
            <Gauge size={18} aria-hidden="true" />
            JUDGING COMPLETION
          </div>

          <div className="arena-gauge">
            <svg
              viewBox="0 0 120 120"
              role="img"
              aria-label={`${completion}% judging completion`}
            >
              <circle
                className="arena-gauge-track"
                cx="60"
                cy="60"
                r="50"
                pathLength="100"
              />

              <circle
                className="arena-gauge-value"
                cx="60"
                cy="60"
                r="50"
                pathLength="100"
                strokeDasharray="100"
                strokeDashoffset={100 - completion}
              />
            </svg>

            <div className="arena-gauge-number">
              <strong>{completion}</strong>
              <span>%</span>
            </div>
          </div>

          <div className="arena-gauge-stats">
            <div>
              <span>COMPLETED</span>
              <strong>{completedCount}</strong>
            </div>

            <div>
              <span>REMAINING</span>
              <strong>{remainingAssignments}</strong>
            </div>

            <div>
              <span>PENDING</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>
        </div>
      </section>

      <section
        className="arena-metric-grid"
        aria-label="Organizer metrics"
      >
        {[
          {
            label: 'ASSIGNMENTS',
            value: loading && !data ? '—' : assignmentCount,
            icon: ClipboardCheck,
          },
          {
            label: 'COMPLETED',
            value: loading && !data ? '—' : completedCount,
            icon: CheckCircle2,
          },
          {
            label: 'JUDGES',
            value: loading && !data ? '—' : judgeCount,
            icon: Users,
          },
          {
            label: 'RUBRIC CRITERIA',
            value:
              loading && !data
                ? '—'
                : activeRubric?.criteria.length ?? 0,
            icon: Scale,
          },
        ].map(({ label, value, icon: Icon }) => (
          <article className="arena-metric-card" key={label}>
            <div>
              <span>{label}</span>
              <Icon size={18} aria-hidden="true" />
            </div>

            <strong>{value}</strong>

            <span className="arena-metric-line" />
          </article>
        ))}
      </section>

      <section className="arena-control-section">
        <header className="arena-section-heading">
          <div>
            <p className="metadata">OPERATIONS MAP</p>
            <h2>CONTROL MODULES</h2>
          </div>

          <span>
            04 SYSTEMS /{' '}
            {loading ? 'SYNCING' : 'CONNECTED'}
          </span>
        </header>

        <div className="arena-control-grid">
          {controls.map(control => (
            <Link
              className={`arena-control-card tone-${control.tone}`}
              key={control.label}
              to={control.to}
            >
              <div className="arena-control-card-top">
                <span>{control.index}</span>

                <span className="arena-control-state">
                  {control.state}
                </span>
              </div>

              <div>
                <h3>{control.label}</h3>
                <p>{control.copy}</p>
              </div>

              <span className="arena-control-open">
                OPEN MODULE ↗
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="arena-operations-grid">
        <section className="arena-operation-panel">
          <header>
            <div>
              <p className="metadata">
                SCORING READINESS
              </p>

              <h2>ACTIVE RUBRIC</h2>
            </div>

            <Scale size={20} aria-hidden="true" />
          </header>

          <div className="arena-operation-body">
            <strong>
              {activeRubric
                ? `${activeRubric.title} / V${activeRubric.version}`
                : 'NO ACTIVE RUBRIC'}
            </strong>

            <p>
              {activeRubric
                ? `${activeRubric.criteria.length} criteria currently govern judge evaluations.`
                : 'Judging cannot use a scoring configuration until a rubric is activated.'}
            </p>

            {activeRubric && (
              <div className="arena-rubric-mini">
                {activeRubric.criteria.map(criterion => (
                  <div key={criterion.id}>
                    <span>{criterion.name}</span>
                    <strong>{criterion.weight}%</strong>
                  </div>
                ))}
              </div>
            )}

            <Link to={paths.organizer.rubric}>
              Open scoring system ↗
            </Link>
          </div>
        </section>

        <section className="arena-operation-panel">
          <header>
            <div>
              <p className="metadata">
                RESULT ENGINE
              </p>

              <h2>CURRENT SNAPSHOT</h2>
            </div>

            <Trophy size={20} aria-hidden="true" />
          </header>

          <div className="arena-operation-body">
            <strong>{resultsState}</strong>

            <p>
              {results
                ? results.is_stale
                  ? 'Submitted evaluations changed after this snapshot. Recalculation is required.'
                  : `${results.items.length} projects are present in the current backend result snapshot.`
                : 'No calculated result snapshot is currently available.'}
            </p>

            {results && (
              <div className="arena-result-meta">
                <span>
                  METHOD / {results.method}
                </span>

                <span>
                  SOURCE REVIEWS /{' '}
                  {results.source_evaluation_count}
                </span>
              </div>
            )}

            <Link to={paths.organizer.results}>
              Open result engine ↗
            </Link>
          </div>
        </section>
      </div>

      <p className="arena-authority-note">
        <span />
        LIVE UI STATUS IS INFORMATIONAL — BACKEND
        AUTHORIZATION, DEADLINES AND RESULT CALCULATION
        REMAIN AUTHORITATIVE.
      </p>
    </div>
  );
}
