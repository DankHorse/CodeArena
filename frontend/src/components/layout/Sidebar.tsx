import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Files,
  LayoutDashboard,
  Scale,
  Settings,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { CodeArenaMark } from '../brand/CodeArenaMark';

const navigation = [
  { label: 'Arena control', icon: LayoutDashboard, to: '/organizer', end: true },
  { label: 'Event settings', icon: Settings, to: '/organizer/events' },
  { label: 'Teams', icon: Users, to: '/organizer/teams' },
  { label: 'Projects', icon: Files, to: '/organizer/projects' },
  { label: 'Scoring rubric', icon: Scale, to: '/organizer/rubric' },
  { label: 'Judge assignments', icon: ClipboardCheck, to: '/organizer/judges' },
  { label: 'Results & exports', icon: BarChart3, to: '/organizer/results' },
  { label: 'Activity log', icon: Activity, to: '/organizer/activity' },
];

export function Sidebar() {
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
        <label className="metadata" htmlFor="current-event">
          CURRENT EVENT
        </label>

        <select id="current-event" defaultValue="dogfood-2026">
          <option value="dogfood-2026">DOGFOOD 2026</option>
        </select>
      </div>

      <nav className="sidebar-nav" aria-label="Organizer workspace">
        <p className="nav-label">// ORGANIZER WORKSPACE</p>

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
        <span className="status-dot" /> ORGANIZER CONSOLE
        <p>Build with intent. Judge with integrity.</p>
      </div>
    </aside>
  );
}
