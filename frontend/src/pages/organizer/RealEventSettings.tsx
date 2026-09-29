import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CalendarDays,
  FileCheck2,
  LockKeyhole,
  Rocket,
  Save,
  UsersRound,
} from 'lucide-react';

import { errorMessage } from '../../auth/types';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import { publishEvent, saveEvent } from '../../data/events';
import type { BackendEvent, EventFields } from '../../data/events';

const schedule = [
  ['registration_opens_at', 'REGISTRATION OPENS'],
  ['registration_deadline', 'REGISTRATION DEADLINE'],
  ['starts_at', 'EVENT STARTS'],
  ['submission_deadline', 'SUBMISSION DEADLINE'],
  ['ends_at', 'EVENT ENDS'],
] as const;

const inputDate = (date?: string) =>
  date ? new Date(date).toISOString().slice(0, 16) : '';

const displayDate = (date?: string) =>
  date
    ? new Date(date)
        .toLocaleString('en-GB', {
          timeZone: 'UTC',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
        .toUpperCase()
    : 'NOT SET';

export function RealEventSettings() {
  const { snapshot, selectEvent, loading } = useOrganizer();
  const current = snapshot?.event?.real;

  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<BackendEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [now, setNow] = useState(() => Date.now());

  const location = useLocation();
  const origin = useRef(location.key);
  const pending = useRef(false);

  useEffect(() => {
    origin.current = location.key;
    setError('');
    setMessage('');

    return () => {
      origin.current = '';
    };
  }, [location.key]);

  useEffect(() => {
    setSaved(null);
    setDirty(false);
  }, [current]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const event = creating ? undefined : saved ?? current;
  const readOnly = !!event && event.status !== 'draft';

  async function act(
    operation: () => Promise<BackendEvent>,
    confirmation: string,
  ) {
    if (pending.current) return;

    const route = location.key;

    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await operation();

      // Preserve a successful server response even if the follow-up GET fails.
      setSaved(result);
      setCreating(false);
      setDirty(false);

      await selectEvent(result.id);

      if (origin.current === route) {
        setMessage(confirmation);
      }
    } catch (error) {
      if (origin.current === route) {
        setError(errorMessage(error));
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const data = new FormData(e.currentTarget);
    const text = (key: string) =>
      String(data.get(key) ?? '').trim();

    try {
      const fields: EventFields = {
        title: text('title'),
        description: text('description'),

        registration_opens_at: new Date(
          text('registration_opens_at') + 'Z',
        ).toISOString(),

        registration_deadline: new Date(
          text('registration_deadline') + 'Z',
        ).toISOString(),

        starts_at: new Date(
          text('starts_at') + 'Z',
        ).toISOString(),

        submission_deadline: new Date(
          text('submission_deadline') + 'Z',
        ).toISOString(),

        ends_at: new Date(
          text('ends_at') + 'Z',
        ).toISOString(),

        team_min_size: Number(text('team_min_size')),
        team_max_size: Number(text('team_max_size')),
      };

      void act(
        () => saveEvent(fields, event?.id),
        event
          ? 'Draft event saved.'
          : 'Draft event created.',
      );
    } catch {
      setError('Enter valid dates for every schedule field.');
    }
  }

  const milestones = schedule.map(([key, label]) => {
    const raw = event?.[key];
    const value = typeof raw === 'string' ? raw : undefined;
    const time = value
      ? new Date(value).getTime()
      : null;

    return {
      key,
      label,
      value,
      time,
    };
  });

  const nextMilestone = milestones.findIndex(
    item => item.time !== null && item.time > now,
  );

  const saveState = readOnly
    ? 'READ ONLY'
    : busy
      ? 'SYNCING'
      : dirty
        ? 'UNSAVED CHANGES'
        : creating
          ? 'NEW DRAFT'
          : event
            ? 'SAVED'
            : 'NEW DRAFT';

  const lifecycleState = creating
    ? 'DRAFT'
    : event?.status?.toUpperCase() ?? 'DRAFT';

  return (
    <div className="event-console">
      <section className="workspace-intro event-console-intro">
        <div>
          <p className="eyebrow">
            [ ORGANIZER / EVENT CONFIGURATION ]
          </p>

          <h1>
            EVENT SETTINGS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Configure the arena lifecycle, schedule and team
            requirements before publishing.
          </p>
        </div>

        <div className="event-console-state">
          <div>
            <span>EVENT STATE</span>
            <strong>{lifecycleState}</strong>
          </div>

          <div>
            <span>EDITOR</span>
            <strong
              className={
                dirty
                  ? 'event-state-warning'
                  : undefined
              }
            >
              {saveState}
            </strong>
          </div>
        </div>
      </section>

      {error && (
        <p className="team-message" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}

      <section className="event-console-overview">
        <article className="event-console-dossier">
          <div className="event-console-dossier-top">
            <span className="event-console-index">
              EVT / 01
            </span>

            <span
              className={`event-console-status ${
                readOnly ? 'is-locked' : 'is-editable'
              }`}
            >
              {readOnly ? 'LOCKED' : 'EDITABLE'}
            </span>
          </div>

          <p className="metadata">CURRENT CONFIGURATION</p>

          <h2>
            {creating
              ? 'NEW EVENT DRAFT'
              : event?.title ?? 'UNTITLED EVENT'}
          </h2>

          <p className="event-console-description">
            {creating
              ? 'Define a new hackathon event and save it as a draft before publishing.'
              : event?.description ||
                'No event description has been provided.'}
          </p>

          <div className="event-console-tags">
            <span>
              STATUS / {lifecycleState}
            </span>

            {event?.slug && (
              <span>
                SLUG / {event.slug}
              </span>
            )}

            {event?.id && (
              <span title={event.id}>
                ID / {event.id.slice(0, 8)}
              </span>
            )}
          </div>

          <div className="event-console-dossier-actions">
            {!creating && event && (
              <button
                className="button button-primary"
                type="button"
                disabled={busy || loading}
                onClick={() => {
                  setCreating(true);
                  setSaved(null);
                  setDirty(false);
                  setError('');
                  setMessage('');
                }}
              >
                New event
              </button>
            )}

            {creating && current && (
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setCreating(false);
                  setDirty(false);
                }}
              >
                Cancel new event
              </button>
            )}
          </div>
        </article>

        <article className="event-lifecycle">
          <header>
            <div>
              <p className="metadata">
                EVENT LIFECYCLE
              </p>

              <h2>SCHEDULE / UTC</h2>
            </div>

            <CalendarDays
              size={20}
              aria-hidden="true"
            />
          </header>

          <div className="event-lifecycle-list">
            {milestones.map((item, index) => {
              const complete =
                item.time !== null &&
                item.time <= now;

              const next =
                !complete &&
                index === nextMilestone;

              const state = complete
                ? 'COMPLETE'
                : next
                  ? 'NEXT'
                  : item.time === null
                    ? 'NOT SET'
                    : 'UPCOMING';

              return (
                <div
                  className={[
                    'event-lifecycle-step',
                    complete ? 'is-complete' : '',
                    next ? 'is-next' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={item.key}
                >
                  <div className="event-lifecycle-marker">
                    <span>
                      {String(index + 1).padStart(
                        2,
                        '0',
                      )}
                    </span>
                  </div>

                  <div className="event-lifecycle-copy">
                    <strong>{item.label}</strong>

                    <span>
                      {displayDate(item.value)} UTC
                    </span>
                  </div>

                  <span className="event-lifecycle-state">
                    {state}
                  </span>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      {readOnly && (
        <section className="event-console-lock">
          <LockKeyhole
            size={20}
            aria-hidden="true"
          />

          <div>
            <p className="metadata">
              PUBLISHED EVENT
            </p>

            <strong>
              CONFIGURATION LOCKED
            </strong>

            <p>
              Published events are read-only.
              The backend only permits draft edits.
            </p>
          </div>
        </section>
      )}

      <form
        className="event-settings-form event-console-form"
        key={`${event?.id ?? 'new'}:${event?.status ?? ''}:${creating}`}
        onSubmit={submit}
        onChange={() => {
          if (!readOnly) {
            setDirty(true);
            setMessage('');
          }
        }}
      >
        <fieldset
          className="organizer-fields event-console-fields"
          disabled={busy || loading || readOnly}
        >
          <section className="event-settings-card event-console-card">
            <header className="event-settings-card-header">
              <div>
                <span>01</span>
                <h2>GENERAL INFORMATION</h2>
              </div>

              <FileCheck2
                size={18}
                aria-hidden="true"
              />
            </header>

            <div className="event-settings-fields">
              <label className="event-field">
                <span>EVENT TITLE</span>

                <input
                  name="title"
                  required
                  maxLength={160}
                  defaultValue={event?.title ?? ''}
                />
              </label>

              <label className="event-field">
                <span>DESCRIPTION</span>

                <textarea
                  name="description"
                  required
                  maxLength={20000}
                  rows={5}
                  defaultValue={event?.description ?? ''}
                />
              </label>
            </div>
          </section>

          <section className="event-settings-card event-console-card">
            <header className="event-settings-card-header">
              <div>
                <span>02</span>
                <h2>SCHEDULE / UTC</h2>
              </div>

              <CalendarDays
                size={18}
                aria-hidden="true"
              />
            </header>

            <div className="event-settings-fields event-settings-grid">
              {schedule.map(([key, label], index) => (
                <label
                  className="event-field event-schedule-field"
                  key={key}
                >
                  <span>
                    <small>
                      {String(index + 1).padStart(
                        2,
                        '0',
                      )}
                    </small>
                    {label}
                  </span>

                  <input
                    name={key}
                    type="datetime-local"
                    required
                    defaultValue={inputDate(
                      event?.[key],
                    )}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="event-settings-card event-console-card">
            <header className="event-settings-card-header">
              <div>
                <span>03</span>
                <h2>TEAM CONFIGURATION</h2>
              </div>

              <UsersRound
                size={18}
                aria-hidden="true"
              />
            </header>

            <div className="event-settings-fields event-settings-grid">
              <label className="event-field">
                <span>MINIMUM TEAM SIZE</span>

                <input
                  name="team_min_size"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={
                    event?.team_min_size ?? 1
                  }
                />
              </label>

              <label className="event-field">
                <span>MAXIMUM TEAM SIZE</span>

                <input
                  name="team_max_size"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={
                    event?.team_max_size ?? 4
                  }
                />
              </label>
            </div>

            <div className="event-console-api-note">
              <span />
              TRACK MANAGEMENT IS NOT AVAILABLE
              IN THE CURRENT REAL EVENT API.
            </div>
          </section>

          {!readOnly && (
            <section className="event-console-savebar">
              <div>
                <Save
                  size={18}
                  aria-hidden="true"
                />

                <div>
                  <span>EDITOR STATE</span>

                  <strong>
                    {dirty
                      ? 'UNSAVED CHANGES'
                      : creating
                        ? 'NEW DRAFT'
                        : 'UP TO DATE'}
                  </strong>
                </div>
              </div>

              <button
                className="button button-primary"
                type="submit"
              >
                {busy
                  ? 'Saving…'
                  : event
                    ? 'Save draft'
                    : 'Create draft'}
              </button>
            </section>
          )}
        </fieldset>
      </form>

      {event?.status === 'draft' && (
        <section className="event-publish-console">
          <div className="event-publish-icon">
            <Rocket
              size={24}
              aria-hidden="true"
            />
          </div>

          <div className="event-publish-copy">
            <p className="metadata">
              FINAL LIFECYCLE ACTION
            </p>

            <h2>READY TO GO LIVE?</h2>

            <p>
              Publishing changes this event from
              an editable draft into an active
              event. Published events become
              read-only in the current backend.
            </p>
          </div>

          <button
            className="button button-primary"
            type="button"
            disabled={busy || loading || dirty}
            onClick={() =>
              void act(
                () => publishEvent(event.id),
                'Event published. It is now eligible for the public events list.',
              )
            }
          >
            {dirty
              ? 'Save changes first'
              : busy
                ? 'Publishing…'
                : 'Publish event ↗'}
          </button>
        </section>
      )}

      <p className="event-console-footnote">
        <span />
        ONLY THE KNOWN CURRENT EVENT IS LOADED.
        THE BACKEND DOES NOT CURRENTLY PROVIDE
        AN ORGANIZER LIST OF DRAFT EVENTS.
      </p>
    </div>
  );
}
