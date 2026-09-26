import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

const teams = [
  { id: '01', name: 'Northstar', members: 4, project: 'Glass Signal' },
  { id: '02', name: 'Greenframe', members: 3, project: 'Small Meadow' },
  { id: '03', name: 'Vector Labs', members: 4, project: 'Deep Compass' },
  { id: '04', name: 'ByteForge', members: 2, project: 'Circuit Bloom' },
  { id: '05', name: 'Nova Stack', members: 3, project: 'Quiet Atlas' },
];

export function OrganizerTeamsPage() {
  const [query, setQuery] = useState('');

  const filteredTeams = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return teams;
    }

    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(value) ||
        team.project.toLowerCase().includes(value),
    );
  }, [query]);

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / TEAMS ]</p>

          <h1>
            TEAMS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Review participating teams and memberships.
          </p>
        </div>

        <span className="badge badge-cyan">
          40 REGISTERED
        </span>
      </section>

      <section className="organizer-teams-toolbar">
        <div>
          <p className="metadata">EVENT ROSTER</p>
          <strong>PARTICIPATING TEAMS</strong>
        </div>

        <label className="organizer-search">
          <Search size={17} aria-hidden="true" />

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teams"
            aria-label="Search teams"
          />
        </label>
      </section>

      <section className="organizer-team-table">
        <div className="organizer-team-header">
          <span>TEAM</span>
          <span>MEMBERS</span>
          <span>PROJECT</span>
          <span>STATUS</span>
        </div>

        {filteredTeams.map((team) => (
          <article className="organizer-team-row" key={team.id}>
            <div className="organizer-team-name">
              <span>{team.id}</span>

              <div>
                <strong>{team.name}</strong>
                <p>Team record</p>
              </div>
            </div>

            <div className="organizer-team-members">
              <Users size={16} aria-hidden="true" />
              <span>{team.members}</span>
            </div>

            <strong>{team.project}</strong>

            <span className="badge badge-cyan">
              ACTIVE
            </span>
          </article>
        ))}

        {filteredTeams.length === 0 && (
          <div className="organizer-team-empty">
            <p className="metadata">SEARCH / 00</p>
            <h2>NO TEAMS FOUND.</h2>
          </div>
        )}
      </section>

      <p className="team-message">
        Frontend preview only. Team records will come from the backend API.
      </p>
    </>
  );
}
