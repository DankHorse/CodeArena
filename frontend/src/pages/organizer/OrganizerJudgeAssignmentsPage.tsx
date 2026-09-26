import { Search, UserRoundCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

const judges = [
  {
    id: '01',
    name: 'Judge A',
    track: 'Security',
    assigned: 5,
    completed: 4,
  },
  {
    id: '02',
    name: 'Judge B',
    track: 'Climate',
    assigned: 5,
    completed: 5,
  },
  {
    id: '03',
    name: 'Judge C',
    track: 'Data and analytics',
    assigned: 5,
    completed: 3,
  },
  {
    id: '04',
    name: 'Judge D',
    track: 'Developer tools',
    assigned: 5,
    completed: 2,
  },
  {
    id: '05',
    name: 'Judge E',
    track: 'Accessibility',
    assigned: 5,
    completed: 4,
  },
];

export function OrganizerJudgeAssignmentsPage() {
  const [query, setQuery] = useState('');

  const filteredJudges = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return judges;
    }

    return judges.filter(
      (judge) =>
        judge.name.toLowerCase().includes(value) ||
        judge.track.toLowerCase().includes(value),
    );
  }, [query]);

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
            Assign judges and monitor judging coverage.
          </p>
        </div>

        <span className="badge badge-cyan">
          30 JUDGES
        </span>
      </section>

      <section className="organizer-judge-metrics">
        <article>
          <p className="metadata">ASSIGNED REVIEWS</p>
          <strong>150</strong>
          <span>Total judging assignments</span>
        </article>

        <article>
          <p className="metadata">COMPLETED</p>
          <strong>126</strong>
          <span>Reviews submitted</span>
        </article>

        <article>
          <p className="metadata">REMAINING</p>
          <strong>24</strong>
          <span>Reviews still open</span>
        </article>

        <article>
          <p className="metadata">PROGRESS</p>
          <strong>84%</strong>
          <span>Overall completion</span>
        </article>
      </section>

      <section className="organizer-judge-toolbar">
        <div>
          <p className="metadata">JUDGING ROSTER</p>
          <strong>ASSIGNMENT COVERAGE</strong>
        </div>

        <label className="organizer-search">
          <Search size={17} aria-hidden="true" />

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search judges or tracks"
            aria-label="Search judges or tracks"
          />
        </label>
      </section>

      <section className="organizer-judge-table">
        <div className="organizer-judge-header">
          <span>JUDGE</span>
          <span>TRACK</span>
          <span>ASSIGNED</span>
          <span>COMPLETED</span>
          <span>PROGRESS</span>
        </div>

        {filteredJudges.map((judge) => {
          const progress = Math.round(
            (judge.completed / judge.assigned) * 100,
          );

          return (
            <article
              className="organizer-judge-row"
              key={judge.id}
            >
              <div className="organizer-judge-name">
                <span>{judge.id}</span>

                <div>
                  <UserRoundCheck
                    size={17}
                    aria-hidden="true"
                  />

                  <strong>{judge.name}</strong>
                </div>
              </div>

              <span>{judge.track}</span>

              <strong>{judge.assigned}</strong>

              <strong>{judge.completed}</strong>

              <div className="organizer-judge-progress">
                <div className="organizer-progress-track">
                  <span
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <span>{progress}%</span>
              </div>
            </article>
          );
        })}

        {filteredJudges.length === 0 && (
          <div className="organizer-team-empty">
            <p className="metadata">SEARCH / 00</p>
            <h2>NO JUDGES FOUND.</h2>
          </div>
        )}
      </section>

      <p className="team-message">
        Frontend preview only. Judge assignments and progress will come from the backend API.
      </p>
    </>
  );
}
