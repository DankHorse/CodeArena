import { useEffect, useMemo, useRef, useState } from 'react';

import { errorMessage } from '../../auth/types';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import {
  loadRealOrganizerActivity,
  type RealOrganizerActivity,
} from '../../organizer/realT2Data';

function shortId(value: string) {
  if (!value) return '—';
  return value.length > 14 ? `••••${value.slice(-8)}` : value;
}

function formatUtc(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'UNKNOWN';

  return date
    .toLocaleString('en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .toUpperCase();
}

export function OrganizerActivityPage() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [activity, setActivity] = useState<RealOrganizerActivity[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    const token = ++generation.current;

    if (!event) {
      setActivity([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    void loadRealOrganizerActivity(event.id)
      .then(items => {
        if (generation.current === token) setActivity(items);
      })
      .catch(err => {
        if (generation.current === token) {
          setError(errorMessage(err));
          setActivity([]);
        }
      })
      .finally(() => {
        if (generation.current === token) setLoading(false);
      });

    return () => {
      generation.current++;
    };
  }, [event?.id]);

  const entries = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return activity;

    return activity.filter(entry =>
      `${entry.action} ${entry.actor_id} ${entry.target} ${entry.outcome}`
        .toLowerCase()
        .includes(needle),
    );
  }, [activity, query]);

  if (!event) {
    return (
      <section className="team-state-panel">
        <p className="eyebrow">[ ORGANIZER / ACTIVITY ]</p>
        <h1>
          NO EVENT<span className="heading-period">.</span>
        </h1>
        <p>Select an organizer event to inspect its activity stream.</p>
      </section>
    );
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / ACTIVITY ]</p>
          <h1>
            ACTIVITY LOG<span className="heading-period">.</span>
          </h1>
          <p className="workspace-description">
            Backend-recorded event activity for {event.name}.
          </p>
        </div>

        <span className="badge badge-cyan">
          {loading ? 'SYNCING' : `${activity.length} EVENTS`}
        </span>
      </section>

      {error && <section className="team-message">{error}</section>}

      <section className="organizer-activity-toolbar">
        <strong>RECENT ACTIVITY</strong>

        <label className="organizer-search">
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
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
          <span>TARGET</span>
          <span>TIME / UTC</span>
        </div>

        {loading && <p className="team-message">Loading activity stream…</p>}

        {!loading &&
          entries.map((entry, index) => (
            <article className="organizer-activity-row" key={entry.id}>
              <span className="organizer-activity-number">
                {String(index + 1).padStart(2, '0')}
              </span>

              <strong title={entry.outcome}>
                {entry.action}
              </strong>

              <span title={entry.actor_id}>
                {shortId(entry.actor_id)}
              </span>

              <span title={entry.target}>
                {shortId(entry.target)}
              </span>

              <time dateTime={entry.created_at}>
                {formatUtc(entry.created_at)}
              </time>
            </article>
          ))}

        {!loading && !entries.length && !error && (
          <p className="team-message">
            {query.trim()
              ? 'No activity matches your search.'
              : 'No backend activity has been recorded for this event yet.'}
          </p>
        )}
      </section>
    </>
  );
}
