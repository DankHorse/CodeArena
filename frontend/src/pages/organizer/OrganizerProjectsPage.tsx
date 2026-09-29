import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { errorMessage } from '../../auth/types';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  loadRealOrganizerProjects,
  type RealOrganizerProject,
} from '../../organizer/realT2Data';
import { paths } from '../../routes';

export function OrganizerProjectsPage() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [projects, setProjects] = useState<RealOrganizerProject[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;

    if (!event) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    void loadRealOrganizerProjects(event.id)
      .then(items => {
        if (generation.current === token) setProjects(items);
      })
      .catch(err => {
        if (generation.current === token) {
          setError(errorMessage(err));
          setProjects([]);
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

    if (!needle) return projects;

    return projects.filter(project =>
      [
        project.title,
        project.team_name,
        project.track_name,
        project.status,
        project.summary,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [projects, query]);

  if (!event) {
    return (
      <section className="team-state-panel">
        <p className="eyebrow">[ ORGANIZER / PROJECTS ]</p>
        <h1>
          NO EVENT<span className="heading-period">.</span>
        </h1>
        <p>Select an organizer event to inspect project submissions.</p>
      </section>
    );
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / PROJECTS ]</p>
          <h1>
            PROJECTS<span className="heading-period">.</span>
          </h1>
          <p className="workspace-description">
            Live project records for {event.name}.
          </p>
        </div>

        <span className="badge badge-cyan">
          {loading ? 'SYNCING' : `${projects.length} RECORDS`}
        </span>
      </section>

      {error && <section className="team-message">{error}</section>}

      <section className="organizer-projects-toolbar">
        <strong>EVENT SUBMISSIONS</strong>

        <label className="organizer-search">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
          />
        </label>
      </section>

      <section className="organizer-project-table">
        <div className="organizer-project-header">
          <span>PROJECT</span>
          <span>TEAM</span>
          <span>TRACK</span>
          <span>STATUS</span>
          <span>ACTION</span>
        </div>

        {loading && <p className="team-message">Loading project registry…</p>}

        {!loading &&
          filtered.map(project => {
            const submitted =
              String(project.state).toLowerCase() === 'submitted';

            return (
              <article className="organizer-project-row" key={project.id}>
                <strong>{project.title}</strong>
                <span>{project.team_name || 'Unknown team'}</span>
                <span>{project.track_name || 'Unassigned'}</span>
                <span
                  className={
                    submitted ? 'badge badge-cyan' : 'badge badge-muted'
                  }
                >
                  {project.status}
                </span>

                {submitted ? (
                  <Link
                    className="organizer-project-view"
                    to={paths.project(project.id, project.event_id)}
                  >
                    View ↗
                  </Link>
                ) : (
                  <span className="metadata">Private draft</span>
                )}
              </article>
            );
          })}

        {!loading && !filtered.length && !error && (
          <p className="team-message">
            {query.trim()
              ? 'No projects match your search.'
              : 'No project records exist for this event yet.'}
          </p>
        )}
      </section>
    </>
  );
}
