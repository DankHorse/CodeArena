import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  exportRealJudgingResultsCsv,
  loadRealOrganizerT2,
  recalculateRealJudgingResults,
  type RealOrganizerT2Snapshot,
} from '../../organizer/realT2Data';

export function RealOrganizerResultsPage() {
  const { snapshot: organizerSnapshot } = useOrganizer();
  const event = organizerSnapshot?.event;

  const [snapshot, setSnapshot] = useState<RealOrganizerT2Snapshot | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!event) {
      setSnapshot(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setSnapshot(await loadRealOrganizerT2(event.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load judging results.');
    } finally {
      setLoading(false);
    }
  }, [event]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const calculate = async () => {
    if (!event || working) return;

    setWorking(true);
    setError('');
    setNotice('');

    try {
      const result = await recalculateRealJudgingResults(event.id);

      if (result.status === 'insufficient_data') {
        setNotice(
          result.insufficient_reason ??
            'The backend does not yet have enough submitted evaluations to normalize results.',
        );
      } else {
        setNotice('A new judging result snapshot was calculated successfully.');
      }

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to calculate results.');
    } finally {
      setWorking(false);
    }
  };

  const exportCsv = async () => {
    if (!event || working) return;

    setWorking(true);
    setError('');

    try {
      await exportRealJudgingResultsCsv(event.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to export results.');
    } finally {
      setWorking(false);
    }
  };

  const results =
    snapshot?.results.state === 'available'
      ? snapshot.results.data
      : null;

  const rows = useMemo(() => {
    if (!results) return [];

    const needle = query.trim().toLowerCase();

    return results.items.filter(item =>
      `${item.project_title} ${item.project_id} ${item.team_id}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query, results]);

  const score = (value: number | null) =>
    value === null ? '—' : value.toFixed(2);

  if (!event) {
    return (
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / RESULTS ]</p>
          <h1>RESULTS & EXPORTS<span className="heading-period">.</span></h1>
          <p className="workspace-description">
            Select an event to view its judging results.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / RESULTS ]</p>
          <h1>RESULTS & EXPORTS<span className="heading-period">.</span></h1>
          <p className="workspace-description">
            Backend-calculated judging results for {event.name}.
          </p>
        </div>

        <span className="badge badge-cyan">
          {results
            ? results.is_stale
              ? 'STALE'
              : results.status.toUpperCase()
            : 'NOT CALCULATED'}
        </span>
      </section>

      {error && <p className="team-message">{error}</p>}
      {notice && <p className="team-message">{notice}</p>}

      <section className="organizer-result-metrics">
        {[
          {
            label: 'SUBMITTED REVIEWS',
            value: snapshot?.progress.completed_evaluations ?? '—',
          },
          {
            label: 'ASSIGNMENTS',
            value: snapshot?.progress.total_assignments ?? '—',
          },
          {
            label: 'COMPLETION',
            value: snapshot
              ? `${snapshot.progress.completion_percentage}%`
              : '—',
          },
          {
            label: 'RESULT PROJECTS',
            value: results?.items.length ?? 0,
          },
        ].map(item => (
          <article key={item.label}>
            <p className="metadata">{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="organizer-results-toolbar">
        <div>
          <p className="metadata">
            {results
              ? `NORMALIZATION / ${results.method} V${results.method_version}`
              : 'NORMALIZATION / NOT CALCULATED'}
          </p>
          <strong>
            {results?.is_stale
              ? 'RESULT SNAPSHOT NEEDS RECALCULATION'
              : results?.status === 'insufficient_data'
                ? 'INSUFFICIENT DATA'
                : results
                  ? 'LATEST RESULT SNAPSHOT'
                  : 'CALCULATE RESULTS TO BEGIN'}
          </strong>
        </div>

        <div className="organizer-results-controls">
          {results && (
            <label className="organizer-search">
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search results"
                aria-label="Search project results"
              />
            </label>
          )}

          <button
            className="button button-primary"
            type="button"
            disabled={loading || working}
            onClick={() => void calculate()}
          >
            {working
              ? 'Working...'
              : results
                ? 'Recalculate results'
                : 'Calculate results'}
          </button>

          <button
            className="button public-secondary"
            type="button"
            disabled={loading || working}
            onClick={() => void exportCsv()}
          >
            Export CSV
          </button>
        </div>
      </section>

      {loading && !snapshot && (
        <p className="team-message">Loading judging results...</p>
      )}

      {snapshot?.results.state === 'not_calculated' && (
        <section className="organizer-normalization-note">
          <p className="metadata">NO RESULT SNAPSHOT YET</p>
          <p>
            Judging progress is available, but results have not been calculated.
            Calculate results to ask the backend to create the first versioned
            normalization snapshot.
          </p>
        </section>
      )}

      {results?.status === 'insufficient_data' && (
        <section className="organizer-normalization-note">
          <p className="metadata">INSUFFICIENT DATA</p>
          <p>
            {results.insufficient_reason ??
              'There are not enough submitted evaluations to produce normalized rankings.'}
          </p>
        </section>
      )}

      {results?.is_stale && (
        <section className="organizer-normalization-note">
          <p className="metadata">STALE SNAPSHOT</p>
          <p>
            Submitted evaluations have changed since this snapshot was
            calculated. Recalculate before treating normalized rankings as
            current.
          </p>
        </section>
      )}

      {results && results.items.length > 0 && (
        <section className="organizer-results-table">
          <div className="organizer-results-header">
            <span>RANK</span>
            <span>PROJECT</span>
            <span>TEAM</span>
            <span>REVIEWS</span>
            <span>RAW / 100</span>
            <span>NORMALIZED / 100</span>
          </div>

          {rows.map(row => (
            <article
              className="organizer-results-row"
              key={row.project_id}
            >
              <strong>{row.rank ?? '—'}</strong>

              <div>
                <strong>{row.project_title}</strong>
                <p className="metadata">{row.project_id}</p>
              </div>

              <span>{row.team_id}</span>
              <span>{row.completed_evaluations}</span>
              <span>{score(row.raw_average)}</span>

              <strong className="organizer-normalized-score">
                {score(row.normalized_score)}
              </strong>
            </article>
          ))}

          {!rows.length && (
            <p className="team-message">No results match your search.</p>
          )}
        </section>
      )}

      {results && (
        <section className="organizer-normalization-note">
          <p className="metadata">
            SNAPSHOT / {results.snapshot_id}
          </p>
          <p>
            Calculated {new Date(results.calculated_at).toLocaleString()} from{' '}
            {results.source_evaluation_count} submitted evaluations. Rankings
            and normalized scores shown here come directly from the backend
            result snapshot.
          </p>
        </section>
      )}

      <section className="organizer-normalization-note">
        <p className="metadata">RESULT PRIVACY</p>
        <p>
          T2 results are organizer-only. This workspace does not publish
          rankings or judge results to participants.
        </p>
      </section>
    </>
  );
}
