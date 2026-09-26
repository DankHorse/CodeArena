import { ExternalLink, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const projects = [
  {
    id: '01',
    title: 'Glass Signal',
    team: 'Northstar',
    track: 'Security',
    status: 'Submitted',
  },
  {
    id: '02',
    title: 'Small Meadow',
    team: 'Greenframe',
    track: 'Climate',
    status: 'Submitted',
  },
  {
    id: '03',
    title: 'Deep Compass',
    team: 'Vector Labs',
    track: 'Data and analytics',
    status: 'Submitted',
  },
  {
    id: '04',
    title: 'Circuit Bloom',
    team: 'ByteForge',
    track: 'Developer tools',
    status: 'Submitted',
  },
  {
    id: '05',
    title: 'Quiet Atlas',
    team: 'Nova Stack',
    track: 'Accessibility',
    status: 'Draft',
  },
];

export function OrganizerProjectsPage() {
  const [query, setQuery] = useState('');

  const filteredProjects = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return projects;
    }

    return projects.filter(
      (project) =>
        project.title.toLowerCase().includes(value) ||
        project.team.toLowerCase().includes(value) ||
        project.track.toLowerCase().includes(value),
    );
  }, [query]);

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / PROJECTS ]</p>

          <h1>
            PROJECTS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Review submitted projects across the event.
          </p>
        </div>

        <span className="badge badge-cyan">
          41 RECORDS
        </span>
      </section>

      <section className="organizer-projects-toolbar">
        <div>
          <p className="metadata">PROJECT ROSTER</p>
          <strong>EVENT SUBMISSIONS</strong>
        </div>

        <label className="organizer-search">
          <Search size={17} aria-hidden="true" />

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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

        {filteredProjects.map((project) => (
          <article className="organizer-project-row" key={project.id}>
            <div className="organizer-project-name">
              <span>{project.id}</span>

              <strong>{project.title}</strong>
            </div>

            <span>{project.team}</span>

            <span>{project.track}</span>

            <span
              className={
                project.status === 'Submitted'
                  ? 'badge badge-cyan'
                  : 'organizer-project-draft'
              }
            >
              {project.status.toUpperCase()}
            </span>

            <button
              type="button"
              className="organizer-project-view"
              disabled
              title="Project detail view will connect later"
            >
              View
              <ExternalLink size={14} aria-hidden="true" />
            </button>
          </article>
        ))}

        {filteredProjects.length === 0 && (
          <div className="organizer-team-empty">
            <p className="metadata">SEARCH / 00</p>
            <h2>NO PROJECTS FOUND.</h2>
          </div>
        )}
      </section>

      <p className="team-message">
        Frontend preview only. Project records will come from the backend API.
      </p>
    </>
  );
}
