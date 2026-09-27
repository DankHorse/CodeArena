import { DEMO } from '../../api';
import { ArrowUpRight, Clock3, FileText, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useParticipant } from '../../participant/ParticipantProvider';
import { deadlineLabel } from '../../participant/data';
import { paths } from '../../routes';

export function ParticipantDashboard() {
  const { snapshot, locked } = useParticipant();
  const event = snapshot?.event;
  const team = snapshot?.team;
  const project = snapshot?.project;
  if (!event) return <section className="team-state-panel"><h1>NO EVENT YET.</h1><p>You are not registered as a participant in an available event.</p><Link to={paths.events}>Browse events ↗</Link></section>;
  const state = !DEMO && project?.state === 'submitted' ? 'SUBMITTED' : locked ? 'LOCKED' : project?.state.toUpperCase() ?? 'NO SUBMISSION';
  const action = !team ? 'Create or join team' : locked ? 'View submission status' : !project ? 'Start submission' : project.state === 'draft' ? 'Continue submission' : 'View submitted project';
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ PARTICIPANT WORKSPACE ]</p><h1>SUBMISSION CONTROL<span className="heading-period">.</span></h1><p className="workspace-description">Manage your team and project submission from one place.</p></div><Link className="button button-primary" to={!team ? paths.participant.team : paths.participant.submission}>{action}<ArrowUpRight size={17} aria-hidden="true" /></Link></section>
    <section className="participant-status-panel"><div><span className="badge badge-cyan">{locked ? (DEMO ? 'SUBMISSIONS LOCKED' : 'READ ONLY') : 'SUBMISSIONS OPEN'}</span><p className="metadata participant-status-label">CURRENT EVENT</p><h2>{event.name}</h2><p>{locked ? DEMO ? 'The deadline has passed or this project is locked.' : 'Project editing requires an open event, a draft and captain access.' : DEMO ? 'Your project can be edited until the submission deadline.' : 'The captain can edit drafts until the deadline. Submitted projects are read-only.'}</p></div><div className="participant-deadline"><Clock3 size={20} aria-hidden="true" /><div><p className="metadata">SUBMISSION DEADLINE / UTC</p><strong>{deadlineLabel(event)}</strong></div></div></section>
    <div className="participant-metrics"><article><Users size={20} aria-hidden="true" /><p className="metadata">TEAM</p><strong>{team?.name ?? 'NOT FORMED'}</strong><span>{team ? 'Active team' : 'Create or join a team.'}</span><Link to={paths.participant.team}>Team workspace ↗</Link></article><article><FileText size={20} aria-hidden="true" /><p className="metadata">SUBMISSION</p><strong>{state}</strong><span>{project?.title ?? 'No project saved yet.'}</span></article><article><Clock3 size={20} aria-hidden="true" /><p className="metadata">DEADLINE STATUS</p><strong>{locked ? 'LOCKED' : 'OPEN'}</strong><span>{locked ? 'Editing is unavailable.' : 'Editing is currently allowed.'}</span></article></div>
  </>;
}
