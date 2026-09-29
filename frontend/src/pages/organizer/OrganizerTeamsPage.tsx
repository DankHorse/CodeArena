import { useEffect, useMemo, useRef, useState } from 'react';

import { errorMessage } from '../../auth/types';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  loadRealOrganizerTeams,
  type RealOrganizerTeam,
} from '../../organizer/realT2Data';

function shortId(value: string) {
  if (!value) return '—';
  return `••••${value.slice(-6)}`;
}

export function OrganizerTeamsPage() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [teams, setTeams] = useState<RealOrganizerTeam[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;

    if (!event) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    void loadRealOrganizerTeams(event.id)
      .then(items => {
        if (generation.current === token) setTeams(items);
      })
      .catch(err => {
        if (generation.current === token) {
          setError(errorMessage(err));
          setTeams([]);
        }
      })
      .finally(() => {
        if (generation.current === token) setLoading(false);
      });

    return () => {
      generation.current++;
    };
  }, [event?.id]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return teams;

    return teams.filter(team =>
      `${team.name} ${team.captain_id} ${team.member_ids.join(' ')}`
        .toLowerCase()
        .includes(needle),
    );
  }, [teams, query]);

  if (!event) {
    return (
      <section className="team-state-panel">
        <p className="eyebrow">[ ORGANIZER / TEAMS ]</p>
        <h1>
          NO EVENT<span className="heading-period">.</span>
        </h1>
        <p>Select an organizer event to inspect participating teams.</p>
      </section>
    );
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / TEAMS ]</p>
          <h1>
            TEAMS<span className="heading-period">.</span>
          </h1>
          <p className="workspace-description">
            Live team roster for {event.name}.
          </p>
        </div>

        <span className="badge badge-cyan">
          {loading ? 'SYNCING' : `${teams.length} REGISTERED`}
        </span>
      </section>

      {error && <section className="team-message">{error}</section>}

      <section className="organizer-teams-toolbar">
        <strong>PARTICIPATING TEAMS</strong>

        <label className="organizer-search">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search teams"
            aria-label="Search teams"
          />
        </label>
      </section>

      <section className="organizer-team-table">
        <div className="organizer-team-header">
          <span>TEAM</span>
          <span>MEMBERS</span>
          <span>CAPTAIN</span>
          <span>STATUS</span>
        </div>

        {loading && <p className="team-message">Loading team roster…</p>}

        {!loading &&
          filtered.map(team => (
            <article className="organizer-team-row" key={team.id}>
              <strong>{team.name}</strong>
              <span>{team.member_count}</span>
              <span title={team.captain_id}>{shortId(team.captain_id)}</span>
              <span className="badge badge-cyan">ACTIVE</span>
            </article>
          ))}

        {!loading && !filtered.length && !error && (
          <p className="team-message">
            {query.trim()
              ? 'No teams match your search.'
              : 'No teams are registered for this event yet.'}
          </p>
        )}
      </section>
    </>
  );
}
