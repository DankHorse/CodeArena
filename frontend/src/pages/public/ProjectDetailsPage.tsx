import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PublicShell } from '../../components/public/PublicShell';
import {
  findEvent,
  findProject,
} from '../../data/publicData';
import { usePublicCatalog } from '../../data/usePublicCatalog';
import { paths } from '../../routes';

const safeUrl = (value?: string) =>
  value && /^https?:\/\//i.test(value)
    ? value
    : undefined;

export function ProjectDetailsPage() {
  const { projectId } = useParams();
  const [params] = useSearchParams();
  const { catalog, loading, error, refresh } = usePublicCatalog();

  const requestedEvent = params.get('event') ?? undefined;

  if (loading) {
    return (
      <PublicShell>
        <section className="public-empty">
          <p>Loading project…</p>
        </section>
      </PublicShell>
    );
  }

  if (error || !catalog) {
    return (
      <PublicShell>
        <section className="public-empty">
          <h1>PROJECT UNAVAILABLE.</h1>
          <p>{error}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </section>
      </PublicShell>
    );
  }

  const project = findProject(catalog.projects, projectId);
  const galleryEvent = findEvent(
    catalog.events,
    requestedEvent,
  )?.id;

  if (!project) {
    return (
      <PublicShell>
        <section className="public-empty">
          <h1>PROJECT NOT FOUND.</h1>
          <p>This project is not available in the public gallery.</p>
          <Link to={paths.gallery(galleryEvent)}>
            ← Back to gallery
          </Link>
        </section>
      </PublicShell>
    );
  }

  const event = findEvent(catalog.events, project.eventId);

  return (
    <PublicShell>
      <Link
        className="public-back"
        to={paths.gallery(galleryEvent ?? project.eventId)}
      >
        ← Back to gallery
      </Link>

      <section className="gallery-hero public-hero">
        <p className="eyebrow">[ PUBLIC / PROJECT ]</p>
        <h1>
          {project.title}<span className="heading-period">.</span>
        </h1>
        <p>{project.summary}</p>
      </section>

      <section
        className="panel public-detail-panel"
        aria-label="Project information"
      >
        <span className="badge badge-cyan">
          {project.status}
        </span>

        <dl className="public-facts">
          <div>
            <dt>TEAM</dt>
            <dd>{project.team}</dd>
          </div>

          <div>
            <dt>TRACK</dt>
            <dd>{project.track}</dd>
          </div>

          <div>
            <dt>EVENT</dt>
            <dd>
              {event && (
                <Link to={paths.event(event.id)}>
                  {event.name}
                </Link>
              )}
            </dd>
          </div>
        </dl>

        <div className="public-actions">
          {safeUrl(project.repoUrl) && (
            <a
              className="button public-secondary"
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Repository ↗
            </a>
          )}

          {safeUrl(project.demoUrl) && (
            <a
              className="button public-secondary"
              href={project.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Live demo ↗
            </a>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
