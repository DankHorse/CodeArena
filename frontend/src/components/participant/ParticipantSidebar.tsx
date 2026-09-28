import { DEMO } from '../../api';
import { useParticipant } from '../../participant/ParticipantProvider';
import {
  FileText,
  Images,
  LayoutDashboard,
  Users,
  Vote,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { CodeArenaMark } from '../brand/CodeArenaMark';

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/participant', end: true },
  { label: 'Team', icon: Users, to: '/participant/team' },
  { label: 'Submission', icon: FileText, to: '/participant/submission' },
  { label: 'Community voting', icon: Vote, to: '/participant/voting' },
  { label: 'Project gallery', icon: Images, to: '/gallery' },
];

export function ParticipantSidebar() {
  const { snapshot, loading, busy, selectEvent } = useParticipant();
  const events = !DEMO ? (snapshot?.event ? [snapshot.event] : []) : snapshot?.data.events.filter(event => snapshot.data.memberships.some(member => member.event_id === event.id && member.role === 'participant')) ?? [];
  return (
    <aside className="sidebar">
      <div className="brand" aria-label="CodeArena">
        <CodeArenaMark />

        <span className="brand-wordmark">
          CODE
          <span className="brand-accent">ARENA</span>
          <sup className="brand-registered">®</sup>
        </span>
      </div>

      <div className="event-context">
        <label className="metadata" htmlFor="participant-event">CURRENT EVENT</label>
        <select id="participant-event" value={snapshot?.event?.id ?? ''} disabled={loading || busy || !events.length} onChange={event => void selectEvent(event.target.value)}>
          {!events.length && <option value="">No event available</option>}
          {events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
      </div>

      <nav className="sidebar-nav" aria-label="Participant workspace">
        <p className="nav-label">// PARTICIPANT WORKSPACE</p>

        <ul>
          {navigation.map(({ label, icon: Icon, to, end }) => (
            <li key={label}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `nav-item${isActive ? ' is-active' : ''}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} aria-hidden="true" />
                    <span>{label}</span>

                    {isActive && (
                      <span className="nav-active-mark" aria-hidden="true">
                        /
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot" /> PARTICIPANT CONSOLE
        <p>Build it. Submit it. Ship it.</p>
      </div>
    </aside>
  );
}
