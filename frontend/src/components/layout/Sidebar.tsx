import { Activity, BarChart3, ClipboardCheck, Files, LayoutDashboard, Scale, Settings, Users } from 'lucide-react';
import { CodeArenaMark } from '../brand/CodeArenaMark';

const navigation = [
  { label: 'Arena control', icon: LayoutDashboard },
  { label: 'Event settings', icon: Settings },
  { label: 'Teams', icon: Users },
  { label: 'Projects', icon: Files },
  { label: 'Scoring rubric', icon: Scale },
  { label: 'Judge assignments', icon: ClipboardCheck },
  { label: 'Results & exports', icon: BarChart3 },
  { label: 'Activity log', icon: Activity },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand" aria-label="CodeArena">
        <CodeArenaMark />
        <span className="brand-wordmark">CODE<span className="brand-accent">ARENA</span><sup className="brand-registered">®</sup></span>
      </div>
      <div className="event-context">
        <label className="metadata" htmlFor="current-event">CURRENT EVENT</label>
        <select id="current-event" defaultValue="dogfood-2026">
          <option value="dogfood-2026">DOGFOOD 2026</option>
        </select>
      </div>
      <nav className="sidebar-nav" aria-label="Organizer workspace">
        <p className="nav-label">// ORGANIZER WORKSPACE</p>
        <ul>
          {navigation.map(({ label, icon: Icon }, index) => (
            <li key={label}>
              {index === 0 ? (
                <a href="#main-content" className="nav-item is-active" aria-current="page">
                  <Icon size={18} aria-hidden="true" /><span>{label}</span><span className="nav-active-mark" aria-hidden="true">/</span>
                </a>
              ) : (
                <button type="button" className="nav-item" disabled title={`${label} — coming soon`}>
                  <Icon size={18} aria-hidden="true" /><span>{label}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer"><span className="status-dot" /> ORGANIZER CONSOLE <p>Build with intent. Judge with integrity.</p></div>
    </aside>
  );
}
