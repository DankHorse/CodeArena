import { DEMO } from '../../api';
import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/public/PublicShell';
import {
  eventStatus,
  formatDeadline,
} from '../../data/publicData';
import { usePublicCatalog } from '../../data/usePublicCatalog';
import { paths } from '../../routes';

export function EventsPage() {
  const { catalog, loading, error, refresh } = usePublicCatalog(true);

  return (
    <PublicShell>
      <section className="gallery-hero public-hero">
        <p className="eyebrow">[ PUBLIC / EVENTS ]</p>
        <h1>
          FIND YOUR ARENA<span className="heading-period">.</span>
        </h1>
        <p>{DEMO ? 'Explore the fixture hackathon or start with a practice event.' : 'Explore upcoming and active hackathons.'}</p>
      </section>

      {loading && (
        <section className="public-empty">
          <p>Loading arenas…</p>
        </section>
      )}

      {!loading && error && (
        <section className="public-empty">
          <h2>EVENTS UNAVAILABLE.</h2>
          <p>{error}</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </section>
      )}

      {!DEMO && !loading && catalog?.events.length === 0 && <section className="public-empty"><p>No public events are available yet.</p></section>}

      {!loading && catalog && (
        <div className="public-event-grid">
          {catalog.events.map(event => (
            <Link
              className="panel public-event-card"
              to={paths.event(event.id)}
              key={event.id}
            >
              <span className="badge badge-cyan">
                {eventStatus(event)}
              </span>

              <h2>{event.name}</h2>
              <p>{event.description}</p>

              <p className="metadata">
                SUBMISSION DEADLINE / {formatDeadline(event.submissionsClose)}
              </p>

              <span className="public-card-action">
                Explore event ↗
              </span>
            </Link>
          ))}
        </div>
      )}
    </PublicShell>
  );
}
