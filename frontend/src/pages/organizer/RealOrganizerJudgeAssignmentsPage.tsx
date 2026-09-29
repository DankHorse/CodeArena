import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { errorMessage } from '../../auth/types';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  addRealEventJudge,
  createRealJudgeAssignment,
  loadRealOrganizerT2,
  type RealOrganizerT2Snapshot,
} from '../../organizer/realT2Data';


export function RealOrganizerJudgeAssignmentsPage() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [data, setData] = useState<RealOrganizerT2Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');

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
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / JUDGES ]</p>

          <h1>
            JUDGE ASSIGNMENTS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Assign submitted projects and monitor judging workload for{' '}
            {event.name}.
          </p>
        </div>

        <button
          className="button"
          type="button"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          Refresh assignments ↻
        </button>
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
        className="organizer-judge-metrics"
        aria-label="Judging assignment summary"
      >
        {[
          {
            label: 'ASSIGNED',
            value: progress?.total_assignments ?? 0,
          },
          {
            label: 'COMPLETED',
            value: progress?.completed_evaluations ?? 0,
          },
          {
            label: 'IN PROGRESS',
            value: progress?.in_progress_evaluations ?? 0,
          },
          {
            label: 'PENDING',
            value: progress?.pending_evaluations ?? 0,
          },
          {
            label: 'PROGRESS',
            value: `${progress?.completion_percentage ?? 0}%`,
          },
        ].map(item => (
          <article key={item.label}>
            <p className="metadata">{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>


      <section className="panel">
        <header className="panel-header">
          <div>
            <p className="metadata">MANUAL CONTROL</p>
            <h2>Judge & Project Assignment</h2>
          </div>
        </header>

        <div className="event-status-body">
          <form className="team-form" onSubmit={handleAddJudge}>
            <div>
              <p className="metadata">STEP 01</p>
              <h3>Add event judge</h3>
              <p>
                Promote an existing participant account into this event's
                judging pool.
              </p>
            </div>

            <label>
              <span>JUDGE ACCOUNT UUID</span>
              <input
                type="text"
                value={eventJudgeId}
                onChange={event => setEventJudgeId(event.target.value)}
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
              Add judge ↗
            </button>
          </form>


          <form className="team-form" onSubmit={handleCreateAssignment}>
            <div>
              <p className="metadata">STEP 02</p>
              <h3>Assign project</h3>
              <p>
                Connect an event judge to one submitted project using the
                backend's authoritative assignment rules.
              </p>
            </div>

            <label>
              <span>PROJECT UUID</span>
              <input
                type="text"
                value={projectId}
                onChange={event => setProjectId(event.target.value)}
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
                  setAssignmentJudgeId(event.target.value)
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
              Create assignment ↗
            </button>
          </form>
        </div>

        <p className="team-message">
          The current judging API identifies judges and projects by UUID.
          Names, emails and a zero-assignment judge roster are not exposed by
          this endpoint, so this console does not invent them.
        </p>
      </section>


      <section className="organizer-judge-toolbar">
        <strong>
          JUDGE WORKLOAD / {progress?.judges.length ?? 0} ACTIVE JUDGES
        </strong>

        <label className="organizer-search">
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search judge UUID"
            aria-label="Search judge UUID"
          />
        </label>
      </section>


      <section className="organizer-judge-table">
        <div className="organizer-judge-header">
          <span>JUDGE ID</span>
          <span>ASSIGNED</span>
          <span>COMPLETED</span>
          <span>PENDING</span>
          <span>PROGRESS</span>
        </div>

        {judges.map(judge => (
          <article
            className="organizer-judge-row"
            key={judge.judge_id}
          >
            <code title={judge.judge_id}>
              {judge.judge_id}
            </code>

            <strong>{judge.assignments}</strong>
            <strong>{judge.completed}</strong>
            <strong>{judge.pending}</strong>

            <div>
              <progress
                value={judge.completed}
                max={judge.assignments || 1}
                aria-label={`${judge.judge_id} completion`}
              />

              <span>
                {judge.completion_percentage}% /{' '}
                {Math.max(judge.assignments - judge.completed, 0)} remaining
              </span>
            </div>
          </article>
        ))}

        {!loading && !judges.length && (
          <p className="team-message">
            No judge workload records match this search.
          </p>
        )}
      </section>


      <p className="team-message">
        Assignment status only is shown here. Judge score values and evaluator
        feedback remain private to the appropriate judging endpoints.
      </p>
    </>
  );
}
