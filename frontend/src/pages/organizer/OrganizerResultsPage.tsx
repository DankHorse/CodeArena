import { Download, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';

const results = [
  {
    rank: 1,
    project: 'Glass Signal',
    team: 'Northstar',
    track: 'Security',
    reviews: 5,
    rawScore: 8.76,
    normalizedScore: 8.91,
  },
  {
    rank: 2,
    project: 'Small Meadow',
    team: 'Greenframe',
    track: 'Climate',
    reviews: 5,
    rawScore: 8.61,
    normalizedScore: 8.74,
  },
  {
    rank: 3,
    project: 'Deep Compass',
    team: 'Vector Labs',
    track: 'Data and analytics',
    reviews: 5,
    rawScore: 8.42,
    normalizedScore: 8.55,
  },
  {
    rank: 4,
    project: 'Circuit Bloom',
    team: 'ByteForge',
    track: 'Developer tools',
    reviews: 4,
    rawScore: 8.13,
    normalizedScore: 8.21,
  },
];

export function OrganizerResultsPage() {
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  const filteredResults = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return results;
    }

    return results.filter(
      (result) =>
        result.project.toLowerCase().includes(value) ||
        result.team.toLowerCase().includes(value) ||
        result.track.toLowerCase().includes(value),
    );
  }, [query]);

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / RESULTS ]</p>

          <h1>
            RESULTS & EXPORTS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Review judging outcomes and prepare event data exports.
          </p>
        </div>

        <span className="badge badge-cyan">
          126 REVIEWS
        </span>
      </section>

      <section className="organizer-result-metrics">
        <article>
          <p className="metadata">PROJECTS</p>
          <strong>41</strong>
          <span>Project records</span>
        </article>

        <article>
          <p className="metadata">REVIEWS</p>
          <strong>126</strong>
          <span>Submitted reviews</span>
        </article>

        <article>
          <p className="metadata">ASSIGNED</p>
          <strong>150</strong>
          <span>Total expected reviews</span>
        </article>

        <article>
          <p className="metadata">COMPLETION</p>
          <strong>84%</strong>
          <span>Judging progress</span>
        </article>
      </section>

      <section className="organizer-results-toolbar">
        <div>
          <p className="metadata">RESULTS BOARD</p>
          <strong>NORMALIZED RANKING PREVIEW</strong>
        </div>

        <div className="organizer-results-controls">
          <label className="organizer-search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search results"
              aria-label="Search project results"
            />
          </label>

          <button
            type="button"
            className="button button-primary"
            onClick={() =>
              setMessage(
                'CSV export UI ready. Backend organizer-only export will connect here.',
              )
            }
          >
            <Download size={16} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </section>

      <section className="organizer-results-table">
        <div className="organizer-results-header">
          <span>RANK</span>
          <span>PROJECT</span>
          <span>TEAM</span>
          <span>TRACK</span>
          <span>REVIEWS</span>
          <span>RAW</span>
          <span>NORMALIZED</span>
        </div>

        {filteredResults.map((result) => (
          <article
            className="organizer-results-row"
            key={result.project}
          >
            <div className="organizer-result-rank">
              {result.rank === 1 && (
                <Trophy size={17} aria-hidden="true" />
              )}

              <strong>
                {String(result.rank).padStart(2, '0')}
              </strong>
            </div>

            <strong>{result.project}</strong>

            <span>{result.team}</span>

            <span>{result.track}</span>

            <span>{result.reviews}</span>

            <span>{result.rawScore.toFixed(2)}</span>

            <strong className="organizer-normalized-score">
              {result.normalizedScore.toFixed(2)}
            </strong>
          </article>
        ))}

        {filteredResults.length === 0 && (
          <div className="organizer-team-empty">
            <p className="metadata">SEARCH / 00</p>
            <h2>NO RESULTS FOUND.</h2>
          </div>
        )}
      </section>

      <section className="organizer-normalization-note">
        <p className="metadata">NORMALIZATION</p>

        <strong>FAIR-SCORING PIPELINE</strong>

        <p>
          Raw and normalized scores are shown separately so organizers can
          inspect judging adjustments without modifying the judges&apos;
          original evaluations.
        </p>
      </section>

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
