import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useParticipant } from '../../participant/ParticipantProvider';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { inviteMember, teamChangesClosed } from '../../participant/realData';
import type { Invitation } from '../../participant/realData';
import { paths } from '../../routes';
export function RealTeamPage() {
  const { snapshot, busy, createTeam, joinTeam } = useParticipant();
  const { user } = useSession();
  const [invitation, setInvitation] = useState<Invitation | null>(null), [error, setError] = useState(''), [sending, setSending] = useState(false);
  const team = snapshot?.team, event = snapshot?.event;
  const closed = teamChangesClosed(event ?? null);
  async function invite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!team || sending) return;
    const id = String(new FormData(e.currentTarget).get('invitee') ?? '').trim();
    setSending(true); setError(''); setInvitation(null);
    try { setInvitation(await inviteMember(team.id, id)); } catch (error) { setError(errorMessage(error)); } finally { setSending(false); }
  }
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ PARTICIPANT / TEAM ]</p><h1>TEAM CONTROL<span className="heading-period">.</span></h1><p className="workspace-description">{event?.name ?? 'Select an event to begin.'}</p></div><Link to={paths.participant.home}>← Dashboard</Link></section>
    {team && <section className="team-workspace-panel"><h2>{team.name}</h2><p className="metadata">CAPTAIN / {team.captain_id}</p><p className="metadata">MEMBERS / {team.members.length}</p>{team.members.map(member => <p key={member.id}>{member.id}</p>)}<Link to={paths.participant.submission}>Open submission ↗</Link></section>}
    {closed && <p className="team-message">Team changes require a published event within its registration deadline.</p>}
    {!team && <div className="team-actions-grid"><section className="team-action-panel"><h2>CREATE A TEAM</h2><form className="team-form" onSubmit={e => { e.preventDefault(); void createTeam(String(new FormData(e.currentTarget).get('name') ?? '')); }}><label><span>TEAM NAME</span><input name="name" required maxLength={100} disabled={busy || closed} /></label><button className="button button-primary" disabled={busy || closed}>Create team ↗</button></form></section>
      <section className="team-action-panel"><h2>ACCEPT INVITATION</h2><form className="team-form" onSubmit={e => { e.preventDefault(); void joinTeam(String(new FormData(e.currentTarget).get('token') ?? '')); }}><label><span>RECIPIENT-SPECIFIC TOKEN</span><input name="token" required minLength={32} maxLength={128} disabled={busy || closed} /></label><p>Use the token your captain created for your account.</p><button className="button team-join-button" disabled={busy || closed}>Accept invitation ↗</button></form></section></div>}
    {team?.captain_id === user?.id && <section className="team-action-panel"><h2>INVITE A MEMBER</h2><form className="team-form" onSubmit={invite}><label><span>REGISTERED INVITEE UUID</span><input name="invitee" required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" disabled={sending || closed} /></label><p>The invitee must register for this event first. Account lookup is not available.</p><button className="button button-primary" disabled={sending || closed}>Create invitation ↗</button></form>
      {invitation && <div className="team-message" role="status"><label>Invitation token<textarea readOnly value={invitation.token} /></label><p>For {invitation.invitee_id}; expires {invitation.expires_at}.</p></div>}
      {error && <p role="alert" className="team-message">{error}</p>}
    </section>}
  </>;
}
