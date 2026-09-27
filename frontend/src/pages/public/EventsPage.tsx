import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/public/PublicShell';
import { publicEvents, eventStatus, formatDeadline } from '../../data/publicData';
import { paths } from '../../routes';

export function EventsPage() {
  return (
    <PublicShell>
      <section className="gallery-hero public-hero"><p className="eyebrow">[ PUBLIC / EVENTS ]</p><h1>FIND YOUR ARENA<span className="heading-period">.</span></h1><p>Explore the fixture hackathon or start with a practice event.</p></section>
      <div className="public-event-grid">
        {publicEvents.map(event => (
          <Link className="panel public-event-card" to={paths.event(event.id)} key={event.id}>
            <span className="badge badge-cyan">{eventStatus(event)}</span>
            <h2>{event.name}</h2><p>{event.description}</p>
            <p className="metadata">SUBMISSION DEADLINE / {formatDeadline(event.submissionsClose)}</p>
            <span className="public-card-action">Explore event ↗</span>
          </Link>
        ))}
      </div>
    </PublicShell>
  );
}
