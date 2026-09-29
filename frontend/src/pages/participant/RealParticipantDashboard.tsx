import { Link } from 'react-router-dom';
import { useParticipant } from '../../participant/ParticipantProvider';
import { paths } from '../../routes';

export function RealParticipantDashboard() {
  const { snapshot, registrationConfirmed, busy, registerCurrentEvent, loading, error } = useParticipant();
  if (loading) return <p role="status">Loading participant workspace…</p>;
  if (error && !snapshot) return <p role="alert">Participant data could not be loaded. Retry or open an event from Browse Events.</p>;
  const event = snapshot?.event, team = snapshot?.team, project = snapshot?.project;
  if (!event) return (
    <section className="team-state-panel">
      <h1>NO EVENT SELECTED.</h1>
      <p>Choose an event to open your participant workspace.</p>
    </section>
  );
  const registered = !!team || registrationConfirmed;
  const action = !team ? 'Create Team' : !project ? 'Create Submission' : project.state === 'submitted' ? 'View Submission' : 'Continue Submission';
  const gallery = paths.gallery(event.id) + (event.real?.slug ? `&event_slug=${encodeURIComponent(event.real.slug)}` : '');
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ PARTICIPANT WORKSPACE ]</p><h1>SUBMISSION CONTROL<span className="heading-period">.</span></h1><p className="workspace-description">Register, form your team and submit your project.</p></div>
      {registered ? <Link className="button button-primary" to={!team ? paths.participant.team : paths.participant.submission}>{action} ↗</Link> : <button className="button button-primary" disabled={busy} onClick={() => void registerCurrentEvent?.()}>Register / confirm registration ↗</button>}
    </section>
    <section className="participant-status-panel"><div><p className="metadata">CURRENT EVENT</p><h2>{event.name}</h2><span className="badge badge-cyan">{event.real?.status.toUpperCase() ?? 'STATUS UNAVAILABLE'}</span><p>{registered ? 'Registration confirmed.' : 'Registration not confirmed. Selecting an event does not register you. Confirm an existing registration or register now.'}</p></div>
      <Link
        className="button button-secondary participant-secondary-button"
        to={paths.events}
      >
        Browse Events ↗
      </Link>
    </section>
    {registered && <div className="participant-metrics"><article><p className="metadata">TEAM</p><strong>{team?.name ?? 'NO TEAM'}</strong>{team && (
      <Link
        className="participant-card-link"
        to={paths.participant.team}
      >
        View Team ↗
      </Link>
    )}</article><article><p className="metadata">SUBMISSION</p><strong>{project ? project.state === 'submitted' ? 'SUBMITTED / READ ONLY' : 'DRAFT' : 'NO SUBMISSION YET'}</strong><span>{project?.title ?? 'Create a submission after forming your team.'}</span></article></div>}
    <div className="participant-footer-actions">
      <Link
        className="button button-secondary participant-secondary-button"
        to={gallery}
      >
        Public Gallery ↗
      </Link>
    </div>
  </>;
}
