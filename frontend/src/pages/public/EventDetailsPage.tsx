import { Link, useParams } from 'react-router-dom';
import { PublicShell } from '../../components/public/PublicShell';
import { findEvent, eventStatus, formatDeadline } from '../../data/publicData';
import { paths } from '../../routes';

export function EventDetailsPage() {
  const { eventId } = useParams();
  const event = findEvent(eventId);
  if (!event) return <PublicShell><section className="public-empty"><h1>EVENT NOT FOUND.</h1><p>This event is not available in the public preview.</p><Link to={paths.events}>← Browse Events</Link></section></PublicShell>;
  return (
    <PublicShell>
      <Link className="public-back" to={paths.events}>← All events</Link>
      <section className="gallery-hero public-hero"><p className="eyebrow">[ PUBLIC / EVENT ]</p><h1>{event.name}<span className="heading-period">.</span></h1><p>{event.description}</p></section>
      <section className="panel public-detail-panel" aria-label="Event information">
        <span className="badge badge-cyan">{eventStatus(event)}</span>
        <dl className="public-facts"><div><dt>SUBMISSION DEADLINE</dt><dd>{formatDeadline(event.submissionsClose)}</dd></div></dl>
        <h2>Tracks</h2><ul className="public-tracks">{event.tracks.map(track => <li key={track.id}>{track.name}</li>)}</ul>
        <Link className="button button-primary" to={paths.gallery(event.id)}>View Project Gallery ↗</Link>
      </section>
    </PublicShell>
  );
}
