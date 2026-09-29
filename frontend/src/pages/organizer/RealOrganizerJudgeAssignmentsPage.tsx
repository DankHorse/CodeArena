import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  Activity,
  CheckCircle2,
  Clock3,
  GitBranch,
  RefreshCw,
  Search,
  UserPlus,
  UsersRound,
} from 'lucide-react';

import { errorMessage } from '../../auth/types';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  addRealEventJudge,
  createRealJudgeAssignment,
  loadRealOrganizerT2,
  type RealOrganizerT2Snapshot,
} from '../../organizer/realT2Data';


function judgeCode(id: string) {
  const compact = id.replace(/-/g, '');

  return `JDG-${compact.slice(0, 6).toUpperCase()}`;
}

export function RealOrganizerJudgeAssignmentsPage() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [data, setData] = useState<RealOrganizerT2Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [showAllJudges, setShowAllJudges] = useState(false);

  const [eventJudgeId, setEventJudgeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assignmentJudgeId, setAssignmentJudgeId] = useState('');


  const refresh = useCallback(async () => {
    if (!event) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setData(await loadRealOrganizerT2(event.id));
    } catch (error) {
      setError(errorMessage(error));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [event?.id]);


  useEffect(() => {
    void refresh();
  }, [refresh]);


  const judges = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return [...(data?.progress.judges ?? [])]
      .filter(judge =>
        !needle || judge.judge_id.toLowerCase().includes(needle)
      )
      .sort((a, b) => {
        if (b.assignments !== a.assignments) {
          return b.assignments - a.assignments;
        }

        return a.judge_id.localeCompare(b.judge_id);
      });
  }, [data?.progress.judges, query]);

  const visibleJudges =
    query.trim() || showAllJudges
      ? judges
      : judges.slice(0, 9);


  async function handleAddJudge(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();

    if (!event) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await addRealEventJudge(event.id, eventJudgeId.trim());

      setMessage('Judge added to this event.');
      setEventJudgeId('');

      await refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }


  async function handleCreateAssignment(
    eventForm: FormEvent<HTMLFormElement>,
  ) {
    eventForm.preventDefault();

    if (!event) return;

    setBusy(true);
    setError('');
    setMessage('');

    try {
      await createRealJudgeAssignment(
        event.id,
        projectId.trim(),
        assignmentJudgeId.trim(),
      );

      setMessage('Project assignment created.');
      setProjectId('');
      setAssignmentJudgeId('');

      await refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }


  if (!event) {
    return (
      <section className="team-state-panel">
        <p className="eyebrow">[ ORGANIZER / JUDGES ]</p>
        <h1>
          NO EVENT
          <span className="heading-period">.</span>
        </h1>
        <p>Select an organizer event before managing judge assignments.</p>
      </section>
    );
  }


  const progress = data?.progress;

  return (
    <>
      <section className="workspace-intro judge-ops-intro">
        <div>
          <p className="eyebrow">
            [ ORGANIZER / JUDGE OPERATIONS ]
          </p>

          <h1>
            JUDGE ASSIGNMENTS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Route projects to evaluators and monitor
            judging workload across {event.name}.
          </p>
        </div>

        <div className="judge-ops-actions">
          <div className="judge-network-state">
            <span className="judge-network-dot" />

            <div>
              <small>JUDGING NETWORK</small>

              <strong>
                {loading ? 'SYNCING' : 'CONNECTED'}
              </strong>
            </div>
          </div>

          <button
            className="button button-secondary judge-refresh-button"
            type="button"
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
            />

            {loading ? 'Syncing…' : 'Sync assignments'}
          </button>
        </div>
      </section>


      {error && (
        <p className="team-message" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}

      {loading && (
        <p className="metadata" role="status">
          Loading real judging assignments…
        </p>
      )}


      <section
        className="judge-status-strip"
        aria-label="Judging assignment summary"
      >
        <header className="judge-status-heading">
          <div>
            <p className="metadata">
              REVIEW NETWORK
            </p>

            <h2>
              JUDGING STATUS
            </h2>
          </div>

          <div className="judge-status-summary">
            <span>OVERALL COMPLETION</span>

            <strong>
              {progress?.completion_percentage ?? 0}%
            </strong>
          </div>
        </header>

        <div className="judge-status-grid">
          <article>
            <UsersRound
              size={17}
              aria-hidden="true"
            />

            <div>
              <span>ASSIGNED</span>

              <strong>
                {progress?.total_assignments ?? 0}
              </strong>
            </div>
          </article>

          <article>
            <CheckCircle2
              size={17}
              aria-hidden="true"
            />

            <div>
              <span>COMPLETED</span>

              <strong>
                {progress?.completed_evaluations ?? 0}
              </strong>
            </div>
          </article>

          <article>
            <Activity
              size={17}
              aria-hidden="true"
            />

            <div>
              <span>IN PROGRESS</span>

              <strong>
                {progress?.in_progress_evaluations ?? 0}
              </strong>
            </div>
          </article>

          <article>
            <Clock3
              size={17}
              aria-hidden="true"
            />

            <div>
              <span>PENDING</span>

              <strong>
                {progress?.pending_evaluations ?? 0}
              </strong>
            </div>
          </article>
        </div>

        <div className="judge-status-progress">
          <div>
            <span
              style={{
                width: `${Math.min(
                  progress?.completion_percentage ?? 0,
                  100,
                )}%`,
              }}
            />
          </div>

          <div className="judge-status-progress-meta">
            <span>
              {progress?.judges.length ?? 0} ACTIVE JUDGES
            </span>

            <span>
              {progress?.completed_evaluations ?? 0}
              {' / '}
              {progress?.total_assignments ?? 0}
              {' '}REVIEWS COMPLETE
            </span>
          </div>
        </div>
      </section>


      <section className="judge-dispatch-console">
        <header className="judge-dispatch-console-header">
          <div>
            <p className="metadata">
              MANUAL ROUTING
            </p>

            <h2>
              ASSIGNMENT STATION
            </h2>

            <p>
              Add evaluators to the event, then
              connect submitted projects to eligible
              judges.
            </p>
          </div>

          <GitBranch
            size={21}
            aria-hidden="true"
          />
        </header>

        <div className="judge-dispatch-console-grid">
          <form
            className="judge-dispatch-station"
            onSubmit={handleAddJudge}
          >
            <div className="judge-dispatch-number">
              01
            </div>

            <div className="judge-dispatch-station-icon">
              <UserPlus
                size={21}
                aria-hidden="true"
              />
            </div>

            <div className="judge-dispatch-station-copy">
              <p className="metadata">
                ROSTER INTAKE
              </p>

              <h3>
                ADD EVENT JUDGE
              </h3>

              <p>
                Promote an existing account into
                this event's judging pool.
              </p>
            </div>

            <label>
              <span>JUDGE ACCOUNT UUID</span>

              <input
                type="text"
                value={eventJudgeId}
                onChange={event =>
                  setEventJudgeId(
                    event.target.value,
                  )
                }
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                disabled={busy}
                required
              />
            </label>

            <button
              className="button button-primary"
              type="submit"
              disabled={busy}
            >
              Add to judging pool ↗
            </button>
          </form>

          <div
            className="judge-dispatch-bridge"
            aria-hidden="true"
          >
            <span />

            <div>
              <GitBranch size={17} />
            </div>

            <span />
          </div>

          <form
            className="judge-dispatch-station is-project"
            onSubmit={handleCreateAssignment}
          >
            <div className="judge-dispatch-number">
              02
            </div>

            <div className="judge-dispatch-station-icon">
              <GitBranch
                size={21}
                aria-hidden="true"
              />
            </div>

            <div className="judge-dispatch-station-copy">
              <p className="metadata">
                PROJECT ROUTING
              </p>

              <h3>
                CREATE ASSIGNMENT
              </h3>

              <p>
                Route one submitted project to an
                event judge using the backend's
                assignment rules.
              </p>
            </div>

            <div className="judge-dispatch-input-grid">
              <label>
                <span>PROJECT UUID</span>

                <input
                  type="text"
                  value={projectId}
                  onChange={event =>
                    setProjectId(
                      event.target.value,
                    )
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={busy}
                  required
                />
              </label>

              <label>
                <span>JUDGE UUID</span>

                <input
                  type="text"
                  value={assignmentJudgeId}
                  onChange={event =>
                    setAssignmentJudgeId(
                      event.target.value,
                    )
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  disabled={busy}
                  required
                />
              </label>
            </div>

            <button
              className="button button-primary"
              type="submit"
              disabled={busy}
            >
              Route project ↗
            </button>
          </form>
        </div>

        <footer className="judge-dispatch-console-footer">
          <span />

          <p>
            JUDGES AND PROJECTS ARE CURRENTLY IDENTIFIED
            BY UUID. ELIGIBILITY, DUPLICATES AND EVENT
            CONSISTENCY REMAIN BACKEND-ENFORCED.
          </p>
        </footer>
      </section>


      <section className="judge-node-console">
        <header className="judge-node-header">
          <div>
            <p className="metadata">
              WORKLOAD NETWORK
            </p>

            <h2>
              JUDGE NODES
            </h2>

            <p>
              {progress?.judges.length ?? 0} active evaluators
              connected to the current judging network.
            </p>
          </div>

          <label className="judge-node-search">
            <span>SEARCH NETWORK</span>

            <div>
              <input
                type="search"
                value={query}
                onChange={event =>
                  setQuery(event.target.value)
                }
                placeholder="Search full judge UUID"
                aria-label="Search judge UUID"
              />
            </div>
          </label>
        </header>

        <div className="judge-node-grid">
          {visibleJudges.map((judge, index) => {
            const remaining = Math.max(
              judge.assignments - judge.completed,
              0,
            );

            const state =
              judge.assignments === 0
                ? 'IDLE'
                : judge.completed === judge.assignments
                  ? 'COMPLETE'
                  : judge.in_progress > 0
                    ? 'ACTIVE'
                    : 'PENDING';

            return (
              <article
                className="judge-node-card"
                key={judge.judge_id}
                title={judge.judge_id}
              >
                <div className="judge-node-top">
                  <span>
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span
                    className={`judge-node-state is-${state.toLowerCase()}`}
                  >
                    {state}
                  </span>
                </div>

                <div className="judge-node-identity">
                  <small>EVALUATOR NODE</small>

                  <h3>
                    {judgeCode(judge.judge_id)}
                  </h3>

                  <code>
                    ID ••••
                    {judge.judge_id.slice(-6)}
                  </code>
                </div>

                <div className="judge-node-load">
                  <div>
                    <span>ASSIGNED</span>
                    <strong>{judge.assignments}</strong>
                  </div>

                  <div>
                    <span>COMPLETED</span>
                    <strong>{judge.completed}</strong>
                  </div>

                  <div>
                    <span>REMAINING</span>
                    <strong>{remaining}</strong>
                  </div>
                </div>

                <div className="judge-node-progress">
                  <div>
                    <span
                      style={{
                        width: `${Math.min(
                          judge.completion_percentage,
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <strong>
                    {judge.completion_percentage}%
                  </strong>
                </div>
              </article>
            );
          })}
        </div>

        {!loading && !judges.length && (
          <p className="team-message">
            No judge workload records match this search.
          </p>
        )}

        {!query.trim() && judges.length > 9 && (
          <div className="judge-node-footer">
            <div>
              <span>
                SHOWING
              </span>

              <strong>
                {showAllJudges ? judges.length : 9}
                {' / '}
                {judges.length}
              </strong>
            </div>

            <button
              className="button button-secondary"
              type="button"
              onClick={() =>
                setShowAllJudges(current => !current)
              }
            >
              {showAllJudges
                ? 'Collapse network'
                : `Show all ${judges.length} judges`}
            </button>
          </div>
        )}
      </section>

      <p className="judge-node-privacy">
        <span />
        FULL JUDGE UUIDS REMAIN AVAILABLE ON HOVER AND
        FOR SEARCH. DISPLAY CODES ARE DERIVED FROM THE UUID
        ONLY FOR A CLEANER OPERATOR VIEW.
      </p>

      <p className="team-message">
        Assignment status only is shown here. Judge score values and evaluator
        feedback remain private to the appropriate judging endpoints.
      </p>
    </>
  );
}
