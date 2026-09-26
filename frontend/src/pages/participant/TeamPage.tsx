import { FormEvent, useState } from 'react';
import {
  Copy,
  LogIn,
  Plus,
  UserRound,
  Users,
} from 'lucide-react';

type TeamPreview = {
  name: string;
  inviteCode: string;
  members: string[];
};

export function TeamPage() {
  const [team, setTeam] = useState<TeamPreview | null>(null);
  const [message, setMessage] = useState('');

  function handleCreateTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const teamName = String(form.get('teamName') || '').trim();

    if (!teamName) {
      return;
    }

    setTeam({
      name: teamName,
      inviteCode: 'CA-7F3K2',
      members: ['You'],
    });

    setMessage(
      'Frontend preview only. Team creation will persist when the backend is connected.',
    );
  }

  function handleJoinTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const inviteCode = String(form.get('inviteCode') || '').trim();

    if (!inviteCode) {
      return;
    }

    setTeam({
      name: 'Sample Team',
      inviteCode,
      members: ['You', 'Sample teammate'],
    });

    setMessage(
      'Frontend preview only. Team membership will persist when the backend is connected.',
    );
  }

  async function copyInviteCode() {
    if (!team) return;

    try {
      await navigator.clipboard.writeText(team.inviteCode);
      setMessage('Invite code copied.');
    } catch {
      setMessage(`Invite code: ${team.inviteCode}`);
    }
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ PARTICIPANT / TEAM ]</p>

          <h1>
            TEAM CONTROL
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Create, join and manage your hackathon team.
          </p>
        </div>
      </section>

      {!team ? (
        <>
          <section className="team-state-panel">
            <Users size={22} aria-hidden="true" />

            <div>
              <p className="metadata">CURRENT STATUS</p>
              <h2>NO TEAM YET</h2>
              <p>
                Create a new team or join an existing team to continue.
              </p>
            </div>
          </section>

          <div className="team-actions-grid">
            <section className="team-action-panel">
              <div className="team-action-heading">
                <Plus size={20} aria-hidden="true" />

                <div>
                  <p className="metadata">OPTION / 01</p>
                  <h2>CREATE A TEAM</h2>
                </div>
              </div>

              <p className="team-action-description">
                Start a team and invite other participants.
              </p>

              <form className="team-form" onSubmit={handleCreateTeam}>
                <label>
                  <span>TEAM NAME</span>

                  <input
                    type="text"
                    name="teamName"
                    placeholder="Enter team name"
                    required
                  />
                </label>

                <button className="button button-primary" type="submit">
                  Create team ↗
                </button>
              </form>
            </section>

            <section className="team-action-panel">
              <div className="team-action-heading">
                <LogIn size={20} aria-hidden="true" />

                <div>
                  <p className="metadata">OPTION / 02</p>
                  <h2>JOIN A TEAM</h2>
                </div>
              </div>

              <p className="team-action-description">
                Enter a team invite code to join an existing team.
              </p>

              <form className="team-form" onSubmit={handleJoinTeam}>
                <label>
                  <span>INVITE CODE</span>

                  <input
                    type="text"
                    name="inviteCode"
                    placeholder="Enter invite code"
                    required
                  />
                </label>

                <button className="button team-join-button" type="submit">
                  Join team ↗
                </button>
              </form>
            </section>
          </div>
        </>
      ) : (
        <section className="team-workspace-panel">
          <div className="team-workspace-header">
            <div>
              <p className="metadata">ACTIVE TEAM</p>
              <h2>{team.name}</h2>
              <p>Team workspace preview.</p>
            </div>

            <span className="badge badge-cyan">TEAM ACTIVE</span>
          </div>

          <div className="team-workspace-grid">
            <div className="team-members-panel">
              <p className="metadata">MEMBERS / {team.members.length}</p>

              <div className="team-member-list">
                {team.members.map((member) => (
                  <div className="team-member" key={member}>
                    <UserRound size={18} aria-hidden="true" />
                    <span>{member}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="team-invite-panel">
              <p className="metadata">INVITE CODE</p>

              <strong>{team.inviteCode}</strong>

              <button
                className="button team-copy-button"
                type="button"
                onClick={copyInviteCode}
              >
                <Copy size={16} aria-hidden="true" />
                Copy code
              </button>
            </div>
          </div>
        </section>
      )}

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
