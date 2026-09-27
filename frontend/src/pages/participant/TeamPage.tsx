import { DEMO } from '../../api';
import { RealTeamPage } from './RealTeamPage';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Copy, UserRound, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useParticipant } from '../../participant/ParticipantProvider';
import { deadlinePassed } from '../../participant/data';
import { paths } from '../../routes';

export function TeamPage() { return DEMO ? <DemoTeamPage /> : <RealTeamPage />; }
function DemoTeamPage() {
  const { snapshot, busy, createTeam, joinTeam, selectTeam } = useParticipant();
  const [copyMessage, setCopyMessage] = useState('');
  const team = snapshot?.team;
  const event = snapshot?.event;
  const teams = snapshot?.data.teams.filter(item => item.mine && item.event_id === event?.id) ?? [];
  const disabled = busy || !event || deadlinePassed(event);
  function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void createTeam(String(new FormData(event.currentTarget).get('teamName') ?? '')); }
  function join(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void joinTeam(String(new FormData(event.currentTarget).get('inviteCode') ?? '')); }
  async function copy() { if (!team) return; try { await navigator.clipboard.writeText(team.invite_code ?? ''); setCopyMessage('Invite code copied.'); } catch { setCopyMessage(`Invite code: ${team.invite_code}`); } }
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ PARTICIPANT / TEAM ]</p><h1>TEAM CONTROL<span className="heading-period">.</span></h1><p className="workspace-description">Create, join and manage your hackathon team.</p></div><Link to={paths.participant.home}>← Dashboard</Link></section>
    {team ? <section className="team-workspace-panel"><div className="team-workspace-header"><div><p className="metadata">ACTIVE TEAM</p><h2>{team.name}</h2></div><span className="badge badge-cyan">TEAM ACTIVE</span></div>
      {teams.length > 1 && <label className="participant-choice">YOUR TEAMS<select value={team.id} disabled={busy} onChange={event => { setCopyMessage(''); void selectTeam(event.target.value); }}>{teams.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <div className="team-workspace-grid"><div className="team-members-panel"><p className="metadata">MEMBERS / {team.members.length}</p><div className="team-member-list">{team.members.map(member => <div className="team-member" key={member.id}><UserRound size={18} aria-hidden="true" /><span>{member.name}</span></div>)}</div></div><div className="team-invite-panel"><p className="metadata">INVITE CODE</p><strong>{team.invite_code}</strong><button className="button team-copy-button" type="button" onClick={copy}><Copy size={16} aria-hidden="true" />Copy code</button></div></div><Link className="button button-primary" to={paths.participant.submission}>Open submission ↗</Link>
    </section> : <section className="team-state-panel"><Users size={22} aria-hidden="true" /><div><p className="metadata">CURRENT STATUS</p><h2>NO TEAM YET</h2><p>Create or join a team before starting a submission.</p></div></section>}
    {copyMessage && <p role="status" className="team-message">{copyMessage}</p>}
    {disabled && !busy && <p className="team-message">{event ? 'The event deadline has passed. Team changes are locked.' : 'No participant event is available.'}</p>}
    <div className="team-actions-grid"><section className="team-action-panel"><h2>CREATE A TEAM</h2><form className="team-form" onSubmit={create}><label><span>TEAM NAME</span><input name="teamName" placeholder="Enter team name" required disabled={disabled} /></label><button className="button button-primary" type="submit" disabled={disabled}>{busy ? 'Saving…' : 'Create team ↗'}</button></form></section><section className="team-action-panel"><h2>JOIN A TEAM</h2><form className="team-form" onSubmit={join}><label><span>INVITE CODE</span><input name="inviteCode" placeholder="Enter invite code" required disabled={disabled} /></label><button className="button team-join-button" type="submit" disabled={disabled}>{busy ? 'Saving…' : 'Join team ↗'}</button></form></section></div>
  </>;
}
