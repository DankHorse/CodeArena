import { useLocation } from 'react-router-dom';
import { judgePath, judgeEventId } from '../../judge/navigation';
import { useOptionalJudge } from '../../judge/JudgeProvider';
import {
  ClipboardCheck,
  LayoutDashboard,
  Scale,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { CodeArenaMark } from '../brand/CodeArenaMark';

const navigation = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/judge',
    end: true,
  },
  {
    label: 'Assignments',
    icon: ClipboardCheck,
    to: '/judge/assignments',
  },
  {
    label: 'Scoring guide',
    icon: Scale,
    to: '/judge/rubric',
  },
];

export function JudgeSidebar() {
  const eventId = judgeEventId(useLocation().search);
  const judge = useOptionalJudge();
  const snapshot = judge?.snapshot ?? null;
  const loading = judge?.loading ?? false;
  const busy = judge?.busy ?? false;
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
        <label className="metadata" htmlFor="judge-event">CURRENT EVENT</label>
        <select
          id="judge-event"
          value={snapshot?.event?.id ?? ''}
          disabled={!judge || loading || busy || !snapshot?.events.length}
          onChange={event => {
            if (judge) void judge.selectEvent(event.target.value);
          }}
        >
          {!snapshot?.events.length && <option value="">No event available</option>}
          {snapshot?.events.map(event => <option key={event.id} value={event.id}>{event.name}</option>)}
        </select>
      </div>

      <nav className="sidebar-nav" aria-label="Judge workspace">
        <p className="nav-label">// JUDGE WORKSPACE</p>

        <ul>
          {navigation.map(({ label, icon: Icon, to, end }) => (
            <li key={label}>
              <NavLink
                to={judgePath(to, eventId)}
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
                      <span
                        className="nav-active-mark"
                        aria-hidden="true"
                      >
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
        <span className="status-dot" /> JUDGE CONSOLE
        <p>Review independently. Score fairly.</p>
      </div>
    </aside>
  );
}
