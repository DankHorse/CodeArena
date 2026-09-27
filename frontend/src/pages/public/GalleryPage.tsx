import { useState } from 'react';
import { Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicShell } from '../../components/public/PublicShell';
import { publicProjects, findEvent } from '../../data/publicData';
import { paths } from '../../routes';

export function GalleryPage() {
  const [query, setQuery] = useState('');
  const [params] = useSearchParams();
  const eventId = params.get('event') || undefined;
  const event = findEvent(eventId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProjects = publicProjects.filter(project =>
    (!eventId || project.eventId === eventId) && project.title.toLowerCase().includes(normalizedQuery),
  );
  return (
    <PublicShell>
      <Link className="public-back" to={event ? paths.event(event.id) : paths.events}>{event ? '← Back to event' : '← Browse Events'}</Link>
      <section className="gallery-hero">
        <p className="eyebrow">[ PUBLIC / PROJECT ARENA ]</p>
        <h1>PROJECT<br />GALLERY<span className="heading-period">.</span></h1>
        <p>Explore projects submitted to the arena.</p>
      </section>
      <section className="gallery-toolbar">
        <div><p className="metadata">CURRENT EVENT</p><strong>{event?.name ?? (eventId ? 'Unknown event' : 'All events')}</strong></div>
        <label className="gallery-search"><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" /></label>
      </section>
      <section className="gallery-projects" aria-label="Submitted projects">
        {filteredProjects.map(project => (
          <Link className="gallery-card public-project-link" key={project.id} to={paths.project(project.id, eventId)}>
            <div className="gallery-card-number">{project.id}</div>
            <div className="gallery-card-content"><p className="metadata">{project.track}</p><h2>{project.title}</h2><p>{project.summary}</p></div>
            <span className="gallery-card-arrow" aria-hidden="true">↗</span>
          </Link>
        ))}
        {filteredProjects.length === 0 && <div className="gallery-empty"><p className="metadata">SEARCH / 00</p><h2>{eventId && !event ? 'EVENT NOT FOUND.' : 'NO PROJECTS FOUND.'}</h2><p>Try a different project name or browse another event.</p><Link to={paths.events}>Browse Events ↗</Link></div>}
      </section>
    </PublicShell>
  );
}
