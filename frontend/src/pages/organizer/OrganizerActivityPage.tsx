import { Activity, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

const activity = [
  {
    id: '01',
    action: 'REVIEW SUBMITTED',
    actor: 'Judge A',
    detail: 'Submitted an evaluation for Glass Signal.',
    time: '18:42 UTC',
    type: 'JUDGING',
  },
  {
    id: '02',
    action: 'PROJECT UPDATED',
    actor: 'Northstar',
    detail: 'Updated the Glass Signal project submission.',
    time: '18:18 UTC',
    type: 'SUBMISSION',
  },
  {
    id: '03',
    action: 'JUDGE ASSIGNED',
    actor: 'Organizer',
    detail: 'Assigned Judge C to Deep Compass.',
    time: '17:54 UTC',
    type: 'ASSIGNMENT',
  },
  {
    id: '04',
    action: 'TEAM CREATED',
    actor: 'Participant',
    detail: 'Created the team ByteForge.',
    time: '17:21 UTC',
    type: 'TEAM',
  },
  {
    id: '05',
    action: 'RUBRIC UPDATED',
    actor: 'Organizer',
    detail: 'Updated judging criterion weights.',
    time: '16:48 UTC',
    type: 'CONFIGURATION',
  },
];

export function OrganizerActivityPage() {
  const [query, setQuery] = useState('');

  const filteredActivity = useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return activity;
    }

    return activity.filter(
      (entry) =>
        entry.action.toLowerCase().includes(value) ||
        entry.actor.toLowerCase().includes(value) ||
        entry.detail.toLowerCase().includes(value) ||
        entry.type.toLowerCase().includes(value),
    );
  }, [query]);

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / ACTIVITY ]</p>

          <h1>
            ACTIVITY LOG
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Review important actions across the event workspace.
          </p>
        </div>

        <span className="badge badge-cyan">EVENT AUDIT</span>
      </section>

      <section className="organizer-activity-toolbar">
        <div>
          <Activity size={18} aria-hidden="true" />

          <div>
            <p className="metadata">EVENT TIMELINE</p>
            <strong>RECENT ACTIVITY</strong>
          </div>
        </div>

        <label className="organizer-search">
          <Search size={17} aria-hidden="true" />

          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activity"
            aria-label="Search activity"
          />
        </label>
      </section>

      <section className="organizer-activity-list">
        <div className="organizer-activity-header">
          <span>EVENT</span>
          <span>ACTION</span>
          <span>ACTOR</span>
          <span>DETAIL</span>
          <span>TIME</span>
        </div>

        {filteredActivity.map((entry) => (
          <article
            key={entry.id}
            className="organizer-activity-row"
          >
            <span className="organizer-activity-number">
              {entry.id}
            </span>

            <div>
              <strong>{entry.action}</strong>
              <span className="organizer-activity-type">
                {entry.type}
              </span>
            </div>

            <strong>{entry.actor}</strong>

            <p>{entry.detail}</p>

            <span>{entry.time}</span>
          </article>
        ))}

        {filteredActivity.length === 0 && (
          <div className="organizer-team-empty">
            <p className="metadata">SEARCH / 00</p>
            <h2>NO ACTIVITY FOUND.</h2>
          </div>
        )}
      </section>

      <p className="team-message">
        Frontend preview only. Audit events will come from the backend activity log.
      </p>
    </>
  );
}
