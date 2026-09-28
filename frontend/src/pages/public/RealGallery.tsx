import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PublicShell } from '../../components/public/PublicShell';
import { galleryPage, gallerySlug, publicProject } from '../../data/gallery';
import type { GalleryProject } from '../../data/gallery';
import { paths } from '../../routes';
import { errorMessage } from '../../auth/types';
const galleryUrl = (slug?: string) => slug ? `/gallery?event_slug=${encodeURIComponent(slug)}` : paths.gallery();
export function RealGalleryPage() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get('event') ?? undefined;
  const suppliedSlug = params.get('event_slug') ?? undefined;
  const search = (params.get('search') ?? '').slice(0, 100);
  const offset = Math.max(0, Number(params.get('offset')) || 0);

  const [query, setQuery] = useState(search);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState<Awaited<ReturnType<typeof galleryPage>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQuery(search);
  }, [search]);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed === search) return;

    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      next.set('offset', '0');

      if (trimmed) next.set('search', trimmed);
      else next.delete('search');

      setParams(next, { replace: true });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query, search, params, setParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    void (async () => {
      const slug = await gallerySlug(eventId, suppliedSlug);
      return galleryPage(offset, search, slug);
    })()
      .then(result => {
        if (active) setPage(result);
      })
      .catch(error => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventId, suppliedSlug, offset, search, retry]);

  function update(nextOffset: number, nextSearch = search) {
    const next = new URLSearchParams(params);
    next.set('offset', String(nextOffset));

    if (nextSearch) next.set('search', nextSearch);
    else next.delete('search');

    setParams(next);
  }

  function changePage(nextOffset: number) {
    update(nextOffset);

    requestAnimationFrame(() => {
      document.querySelector('.gallery-toolbar')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  const currentPage = page
    ? Math.floor(page.offset / page.limit) + 1
    : 1;

  const totalPages = page
    ? Math.max(1, Math.ceil(page.total / page.limit))
    : 1;

  const canGoPrevious = !!page && page.offset > 0;
  const canGoNext =
    !!page &&
    page.items.length > 0 &&
    page.offset + page.items.length < page.total;

  return (
    <PublicShell>
      <Link
        className="public-back"
        to={eventId ? paths.event(eventId) : paths.events}
      >
        {eventId ? '← Back to event' : '← Browse Events'}
      </Link>

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
          <strong>
            {suppliedSlug ?? (eventId ? 'Selected event' : 'All events')}
          </strong>
        </div>

        <form
          className="gallery-search"
          onSubmit={event => {
            event.preventDefault();
            update(0, query);
          }}
        >
          <Search size={18} aria-hidden="true" />

          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
          />

          <button
            className="public-search-button"
            type="submit"
          >
            Search →
          </button>
        </form>
      </section>

      {loading && !page && <p role="status">Loading projects…</p>}

      {error && (
        <section className="public-empty">
          <h2>GALLERY UNAVAILABLE.</h2>
          <p role="alert">{error}</p>
          <button
            className="button button-primary"
            onClick={() => setRetry(value => value + 1)}
          >
            Retry
          </button>
        </section>
      )}

      {page && (
        <>
          <section
            className="gallery-projects public-project-grid"
            aria-label="Submitted projects"
          >
            {page.items.map((project, index) => (
              <Link
                className="gallery-card public-project-link"
                key={project.id}
                to={`${paths.project(project.id)}?event_slug=${encodeURIComponent(project.eventSlug)}`}
              >
                <div className="public-project-card-top">
                  <span className="metadata">SUBMITTED PROJECT</span>
                  <span className="public-project-index">
                    {String(page.offset + index + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="gallery-card-content">
                  <p className="metadata public-project-event">
                    {project.eventTitle}
                  </p>

                  <h2>{project.title}</h2>

                  {project.summary && (
                    <p className="public-project-summary">
                      {project.summary}
                    </p>
                  )}
                </div>

                <div className="public-project-card-footer">
                  <span className="metadata">
                    SUBMITTED / {new Date(project.submittedAt).toLocaleDateString()}
                  </span>

                  <strong>VIEW PROJECT →</strong>
                </div>
              </Link>
            ))}

            {!page.items.length && (
              <div className="gallery-empty">
                <h2>NO PROJECTS FOUND.</h2>
                <p>Try a different search or browse another event.</p>
                <Link
                  className="button public-browse-events"
                  to={paths.events}
                >
                  Browse Events ↗
                </Link>
              </div>
            )}
          </section>

          <nav
            className="public-gallery-pagination"
            aria-label="Gallery pages"
          >
            <button
              className="public-page-button"
              disabled={!canGoPrevious}
              onClick={() =>
                changePage(Math.max(0, page.offset - page.limit))
              }
            >
              ← Previous
            </button>

            <div className="public-page-status">
              <strong>
                {currentPage} / {totalPages}
              </strong>
              <span>PAGE</span>
              <small>{page.total} TOTAL PROJECTS</small>
            </div>

            <button
              className="public-page-button"
              disabled={!canGoNext}
              onClick={() =>
                changePage(page.offset + page.limit)
              }
            >
              Next →
            </button>
          </nav>
        </>
      )}
    </PublicShell>
  );
}

export function RealProjectDetails() {
  const { projectId } = useParams(); const [params] = useSearchParams();
  const eventId = params.get('event') ?? undefined, slug = params.get('event_slug') ?? undefined;
  const [project, setProject] = useState<GalleryProject | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setProject(null); setError('');
    void (async () => publicProject(projectId ?? '', await gallerySlug(eventId, slug)))()
      .then(project => { if (active) setProject(project); }).catch(error => { if (active) setError(errorMessage(error)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, eventId, slug, retry]);
  const safe = (url?: string) => url && /^https?:\/\//i.test(url);
  return <PublicShell><Link className="public-back" to={galleryUrl(slug ?? project?.eventSlug)}>← Back to gallery</Link>
    {loading ? <p role="status">Loading project…</p> : error ? <section className="public-empty"><h1>PROJECT UNAVAILABLE.</h1><p role="alert">{error}</p><button className="button button-primary" onClick={() => setRetry(value => value + 1)}>Retry</button></section> : !project ? <section className="public-empty"><h1>PROJECT NOT FOUND.</h1><p>This project is not available in the public gallery.</p></section> : <>
      <section className="gallery-hero public-hero"><p className="eyebrow">[ PUBLIC / PROJECT ]</p><h1>{project.title}<span className="heading-period">.</span></h1><p>{project.summary}</p></section>
      <section className="panel public-detail-panel"><span className="badge badge-cyan">Submitted</span><dl className="public-facts"><div><dt>EVENT</dt><dd>{project.eventTitle}</dd></div><div><dt>SUBMITTED</dt><dd>{new Date(project.submittedAt).toLocaleString()}</dd></div></dl><div className="public-actions">{safe(project.repoUrl) && <a className="button public-secondary" href={project.repoUrl} target="_blank" rel="noopener noreferrer">Repository ↗</a>}{safe(project.demoUrl) && <a className="button public-secondary" href={project.demoUrl} target="_blank" rel="noopener noreferrer">Live demo ↗</a>}</div></section>
    </>}
  </PublicShell>;
}
