import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileBarChart2,
  RefreshCw,
  Search,
  Trophy,
} from 'lucide-react';

import { useOrganizer } from '../../organizer/OrganizerProvider';

import {
  exportRealJudgingResultsCsv,
  loadRealOrganizerT2,
  recalculateRealJudgingResults,
  type RealOrganizerT2Snapshot,
} from '../../organizer/realT2Data';

function shortId(value: string) {
  return value.length > 14
    ? `${value.slice(0, 7)}…${value.slice(-5)}`
    : value;
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  );
}

export function RealOrganizerResultsPage() {
  const { snapshot: organizerSnapshot } =
    useOrganizer();

  const event = organizerSnapshot?.event;

  const [snapshot, setSnapshot] =
    useState<RealOrganizerT2Snapshot | null>(
      null,
    );

  const [query, setQuery] = useState('');
  const [loading, setLoading] =
    useState(false);

  const [working, setWorking] =
    useState(false);

  const [error, setError] =
    useState('');

  const [notice, setNotice] =
    useState('');

  const refresh = useCallback(
    async () => {
      if (!event) {
        setSnapshot(null);
        return;
      }

      setLoading(true);
      setError('');

      try {
        setSnapshot(
          await loadRealOrganizerT2(
            event.id,
          ),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load judging results.',
        );
      } finally {
        setLoading(false);
      }
    },
    [event],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const calculate = async () => {
    if (!event || working) return;

    setWorking(true);
    setError('');
    setNotice('');

    try {
      const result =
        await recalculateRealJudgingResults(
          event.id,
        );

      if (
        result.status ===
        'insufficient_data'
      ) {
        setNotice(
          'Result snapshot refreshed. The backend still reports insufficient data.',
        );
      } else {
        setNotice(
          'A new judging result snapshot was calculated successfully.',
        );
      }

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to calculate results.',
      );
    } finally {
      setWorking(false);
    }
  };

  const exportCsv = async () => {
    if (!event || working) return;

    setWorking(true);
    setError('');

    try {
      await exportRealJudgingResultsCsv(
        event.id,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to export results.',
      );
    } finally {
      setWorking(false);
    }
  };

  const results =
    snapshot?.results.state ===
    'available'
      ? snapshot.results.data
      : null;

  const rows = useMemo(() => {
    if (!results) return [];

    const needle =
      query.trim().toLowerCase();

    return results.items.filter(
      item =>
        `${item.project_title} ${item.project_id} ${item.team_id}`
          .toLowerCase()
          .includes(needle),
    );
  }, [query, results]);

  const score = (
    value: number | null,
  ) =>
    value === null
      ? '—'
      : value.toFixed(2);

  if (!event) {
    return (
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">
            [ ORGANIZER / RESULTS ]
          </p>

          <h1>
            RESULTS & EXPORTS
            <span className="heading-period">
              .
            </span>
          </h1>

          <p className="workspace-description">
            Select an event to view its
            judging results.
          </p>
        </div>
      </section>
    );
  }

  const statusLabel =
    loading && !snapshot
      ? 'SYNCING'
      : !results
        ? 'NOT CALCULATED'
        : results.is_stale
          ? 'STALE SNAPSHOT'
          : results.status
              .replaceAll('_', ' ')
              .toUpperCase();

  const statusTone =
    !results
      ? 'empty'
      : results.is_stale
        ? 'stale'
        : results.status ===
            'insufficient_data'
          ? 'warning'
          : 'ready';

  const completion =
    snapshot?.progress
      .completion_percentage ?? 0;

  return (
    <div className="results-lab">
      <section className="workspace-intro results-lab-intro">
        <div>
          <p className="eyebrow">
            [ ORGANIZER / RESULT ENGINE ]
          </p>

          <h1>
            RESULTS & EXPORTS
            <span className="heading-period">
              .
            </span>
          </h1>

          <p className="workspace-description">
            Inspect backend-calculated
            judging snapshots, rankings
            and exports for {event.name}.
          </p>
        </div>

        <div
          className={`results-engine-status is-${statusTone}`}
        >
          <span className="results-engine-dot" />

          <div>
            <small>RESULT ENGINE</small>

            <strong>
              {statusLabel}
            </strong>
          </div>
        </div>
      </section>

      {error && (
        <p
          className="team-message"
          role="alert"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          className="team-message"
          role="status"
        >
          {notice}
        </p>
      )}

      <section className="results-engine-console">
        <div className="results-engine-main">
          <div className="results-engine-heading">
            <div>
              <p className="metadata">
                CURRENT SNAPSHOT
              </p>

              <h2>
                {!results
                  ? 'RESULTS NOT CALCULATED'
                  : results.is_stale
                    ? 'RECALCULATION REQUIRED'
                    : results.status ===
                        'insufficient_data'
                      ? 'INSUFFICIENT DATA'
                      : 'RESULT SNAPSHOT READY'}
              </h2>

              <p>
                {!results
                  ? 'Run the backend result engine to create the first versioned judging snapshot.'
                  : results.is_stale
                    ? 'Submitted evaluations changed after this snapshot was produced.'
                    : results.status ===
                        'insufficient_data'
                      ? results.insufficient_reason ??
                        'The backend does not yet have enough evaluation data to produce rankings.'
                      : 'The current rankings and scores were returned by the backend result engine.'}
              </p>
            </div>

            <Database
              size={24}
              aria-hidden="true"
            />
          </div>

          <div className="results-engine-meta">
            <div>
              <span>METHOD</span>

              <strong>
                {results
                  ? results.method
                  : '—'}
              </strong>
            </div>

            <div>
              <span>VERSION</span>

              <strong>
                {results
                  ? `V${results.method_version}`
                  : '—'}
              </strong>
            </div>

            <div>
              <span>SOURCE REVIEWS</span>

              <strong>
                {results
                  ? results.source_evaluation_count
                  : snapshot?.progress
                      .completed_evaluations ??
                    '—'}
              </strong>
            </div>

            <div>
              <span>RESULT PROJECTS</span>

              <strong>
                {results?.items.length ?? 0}
              </strong>
            </div>
          </div>

          <div className="results-completion-rail">
            <div>
              <span>
                JUDGING COMPLETION
              </span>

              <strong>
                {completion}%
              </strong>
            </div>

            <div className="results-completion-track">
              <span
                style={{
                  width: `${Math.min(
                    completion,
                    100,
                  )}%`,
                }}
              />
            </div>

            <small>
              {snapshot?.progress
                .completed_evaluations ?? 0}
              {' / '}
              {snapshot?.progress
                .total_assignments ?? 0}
              {' '}ASSIGNED REVIEWS COMPLETE
            </small>
          </div>
        </div>

        <aside className="results-engine-actions">
          <div>
            <p className="metadata">
              ENGINE CONTROL
            </p>

            <strong>
              BACKEND AUTHORITATIVE
            </strong>

            <p>
              Recalculation creates or
              refreshes the official result
              snapshot. The frontend never
              computes official scores.
            </p>
          </div>

          <button
            className="button button-primary results-calculate-button"
            type="button"
            disabled={
              loading || working
            }
            onClick={() =>
              void calculate()
            }
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
            />

            {working
              ? 'Processing…'
              : results
                ? 'Recalculate snapshot'
                : 'Calculate snapshot'}
          </button>

          <button
            className="button button-secondary results-export-button"
            type="button"
            disabled={
              loading ||
              working ||
              !results
            }
            onClick={() =>
              void exportCsv()
            }
          >
            <Download
              size={15}
              aria-hidden="true"
            />

            Export CSV
          </button>
        </aside>
      </section>

      <section className="results-stat-strip">
        <article>
          <span>
            SUBMITTED REVIEWS
          </span>

          <strong>
            {snapshot?.progress
              .completed_evaluations ??
              '—'}
          </strong>
        </article>

        <article>
          <span>ASSIGNMENTS</span>

          <strong>
            {snapshot?.progress
              .total_assignments ??
              '—'}
          </strong>
        </article>

        <article>
          <span>COMPLETION</span>

          <strong>
            {snapshot
              ? `${completion}%`
              : '—'}
          </strong>
        </article>

        <article>
          <span>RANKED PROJECTS</span>

          <strong>
            {results?.items.length ?? 0}
          </strong>
        </article>
      </section>

      {loading && !snapshot && (
        <section className="results-state-panel">
          <Database
            size={24}
            aria-hidden="true"
          />

          <div>
            <p className="metadata">
              RESULT ENGINE
            </p>

            <h2>
              SYNCHRONIZING
            </h2>

            <p>
              Loading the current judging
              snapshot from the backend.
            </p>
          </div>
        </section>
      )}

      {snapshot?.results.state ===
        'not_calculated' && (
        <section className="results-state-panel is-empty">
          <FileBarChart2
            size={27}
            aria-hidden="true"
          />

          <div>
            <p className="metadata">
              NO RESULT SNAPSHOT
            </p>

            <h2>
              READY FOR FIRST CALCULATION
            </h2>

            <p>
              Judging progress exists, but
              no versioned result snapshot
              has been created yet.
            </p>
          </div>
        </section>
      )}

      {results?.is_stale && (
        <section className="results-state-panel is-stale">
          <RefreshCw
            size={27}
            aria-hidden="true"
          />

          <div>
            <p className="metadata">
              SNAPSHOT HEALTH
            </p>

            <h2>
              STALE SNAPSHOT
            </h2>

            <p>
              Submitted evaluations changed
              after this snapshot was
              calculated. Recalculate before
              treating rankings as current.
            </p>
          </div>
        </section>
      )}

      {results &&
        results.items.length > 0 && (
          <section className="results-ledger">
            <header className="results-ledger-heading">
              <div>
                <p className="metadata">
                  NORMALIZED RANKING
                </p>

                <h2>
                  RESULT LEDGER
                </h2>
              </div>

              <label className="results-search">
                <span>
                  SEARCH RESULTS
                </span>

                <div>
                  <Search
                    size={14}
                    aria-hidden="true"
                  />

                  <input
                    type="search"
                    value={query}
                    onChange={event =>
                      setQuery(
                        event.target.value,
                      )
                    }
                    placeholder="Project or team"
                    aria-label="Search project results"
                  />
                </div>
              </label>
            </header>

            <div className="results-ledger-header">
              <span>RANK</span>
              <span>PROJECT</span>
              <span>TEAM</span>
              <span>REVIEWS</span>
              <span>RAW / 100</span>
              <span>NORMALIZED / 100</span>
            </div>

            <div className="results-ledger-body">
              {rows.map(row => (
                <article
                  className={`results-ledger-row ${
                    row.rank &&
                    row.rank <= 3
                      ? 'is-podium'
                      : ''
                  }`}
                  key={row.project_id}
                >
                  <div className="results-rank">
                    {row.rank &&
                      row.rank <= 3 && (
                        <Trophy
                          size={15}
                          aria-hidden="true"
                        />
                      )}

                    <strong>
                      {row.rank ?? '—'}
                    </strong>
                  </div>

                  <div className="results-project">
                    <strong>
                      {row.project_title}
                    </strong>

                    <code
                      title={
                        row.project_id
                      }
                    >
                      {shortId(
                        row.project_id,
                      )}
                    </code>
                  </div>

                  <code
                    className="results-team"
                    title={row.team_id}
                  >
                    {shortId(
                      row.team_id,
                    )}
                  </code>

                  <span>
                    {
                      row.completed_evaluations
                    }
                  </span>

                  <span>
                    {score(
                      row.raw_average,
                    )}
                  </span>

                  <strong className="results-normalized-score">
                    {score(
                      row.normalized_score,
                    )}
                  </strong>
                </article>
              ))}

              {!rows.length && (
                <p className="team-message">
                  No results match your
                  search.
                </p>
              )}
            </div>
          </section>
        )}

      {results &&
        results.items.length === 0 &&
        results.status !==
          'insufficient_data' && (
          <section className="results-state-panel is-empty">
            <FileBarChart2
              size={27}
              aria-hidden="true"
            />

            <div>
              <p className="metadata">
                RESULT LEDGER
              </p>

              <h2>
                NO RANKED PROJECTS
              </h2>

              <p>
                The current backend snapshot
                does not contain any result
                rows.
              </p>
            </div>
          </section>
        )}

      {results && (
        <section className="results-snapshot-record">
          <div className="results-snapshot-icon">
            <CheckCircle2
              size={19}
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="metadata">
              SNAPSHOT RECORD
            </p>

            <strong>
              {shortId(
                results.snapshot_id,
              )}
            </strong>

            <p>
              Calculated{' '}
              {formatTimestamp(
                results.calculated_at,
              )}{' '}
              from{' '}
              {
                results.source_evaluation_count
              }{' '}
              submitted evaluations.
            </p>
          </div>

          <div className="results-snapshot-tags">
            <span>
              METHOD / {results.method}
            </span>

            <span>
              VERSION / V
              {results.method_version}
            </span>

            <span>
              {
                results.is_stale
                  ? 'STALE'
                  : 'CURRENT'
              }
            </span>
          </div>
        </section>
      )}

      <section className="results-privacy-note">
        <span />

        <div>
          <strong>
            ORGANIZER-ONLY RESULTS
          </strong>

          <p>
            This T2 workspace does not
            publish rankings or judge
            results to participants.
          </p>
        </div>
      </section>
    </div>
  );
}
