import { useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CodeArenaMark } from '../../components/brand/CodeArenaMark';

const projects = [
  {
    title: 'Glass Signal',
    label: 'FIXTURE / 01',
  },
  {
    title: 'Small Meadow',
    label: 'FIXTURE / 02',
  },
  {
    title: 'Deep Compass',
    label: 'FIXTURE / 03',
  },
];

export function GalleryPage() {
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const filteredProjects = projects.filter((project) =>
    project.title.toLowerCase().includes(normalizedQuery),
  );

  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <Link className="gallery-brand" to="/" aria-label="CodeArena home">
          <CodeArenaMark />

          <span className="brand-wordmark">
            CODE
            <span className="brand-accent">ARENA</span>
            <sup className="brand-registered">®</sup>
          </span>
        </Link>

        <nav className="gallery-header-actions" aria-label="Public navigation">
          <Link to="/login">LOGIN</Link>

          <Link className="button button-primary" to="/register">
            ENTER ARENA
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <section className="gallery-hero">
        <p className="eyebrow">[ PUBLIC / PROJECT ARENA ]</p>

        <h1>
          PROJECT
          <br />
          GALLERY<span className="heading-period">.</span>
        </h1>

        <p>Explore projects submitted to the arena.</p>
      </section>

      <section className="gallery-toolbar">
        <div>
          <p className="metadata">CURRENT EVENT</p>
          <strong>DOGFOOD 2026</strong>
        </div>

        <label className="gallery-search">
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

      <section className="gallery-projects" aria-label="Submitted projects">
        {filteredProjects.map((project) => (
          <article className="gallery-card" key={project.title}>
            <div className="gallery-card-number">
              {project.label.slice(-2)}
            </div>

            <div className="gallery-card-content">
              <p className="metadata">{project.label}</p>

              <h2>{project.title}</h2>

              <p>
                Shared fixture project available in the public CodeArena gallery.
              </p>
            </div>

            <span className="gallery-card-arrow" aria-hidden="true">
              ↗
            </span>
          </article>
        ))}

        {filteredProjects.length === 0 && (
          <div className="gallery-empty">
            <p className="metadata">SEARCH / 00</p>
            <h2>NO PROJECTS FOUND.</h2>
            <p>Try a different project name.</p>
          </div>
        )}
      </section>

      <footer className="gallery-footer">
        <span>
          <span className="status-dot" /> PUBLIC GALLERY ONLINE
        </span>

        <span>CODEARENA / 2026</span>
      </footer>
    </main>
  );
}
