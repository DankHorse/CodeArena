import { CalendarClock, Save, Settings2 } from 'lucide-react';
import { FormEvent, useState } from 'react';

const tracks = [
  'Developer tools',
  'Data and analytics',
  'Accessibility',
  'Security',
  'Climate',
  'Health',
  'Education',
  'Open hardware',
];

export function EventSettingsPage() {
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(
      'Event settings preview saved. Backend event persistence will connect here.',
    );
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / EVENT ]</p>

          <h1>
            EVENT SETTINGS
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Configure the event, tracks and submission deadline.
          </p>
        </div>

        <span className="badge badge-cyan">
          FIXTURE EVENT
        </span>
      </section>

      <form className="event-settings-form" onSubmit={handleSubmit}>
        <section className="event-settings-card">
          <header className="event-settings-card-header">
            <Settings2 size={20} aria-hidden="true" />

            <div>
              <p className="metadata">EVENT / DETAILS</p>
              <h2>GENERAL INFORMATION</h2>
            </div>
          </header>

          <div className="event-settings-fields">
            <label className="event-field event-field-wide">
              <span>EVENT NAME</span>
              <input
                type="text"
                defaultValue="Sample Hack 2026"
                required
              />
            </label>

            <label className="event-field event-field-wide">
              <span>DESCRIPTION</span>
              <textarea
                rows={4}
                defaultValue="Shared fixture event for the CodeArena hackathon platform."
              />
            </label>
          </div>
        </section>

        <section className="event-settings-card">
          <header className="event-settings-card-header">
            <CalendarClock size={20} aria-hidden="true" />

            <div>
              <p className="metadata">EVENT / TIMING</p>
              <h2>SUBMISSION WINDOW</h2>
            </div>
          </header>

          <div className="event-settings-fields event-settings-grid">
            <label className="event-field">
              <span>START DATE</span>
              <input
                type="datetime-local"
                defaultValue="2026-02-27T18:00"
              />
            </label>

            <label className="event-field">
              <span>EVENT END</span>
              <input
                type="datetime-local"
                defaultValue="2026-03-02T18:00"
              />
            </label>

            <label className="event-field">
              <span>SUBMISSION DEADLINE</span>
              <input
                type="datetime-local"
                defaultValue="2026-03-01T18:00"
                required
              />
            </label>
          </div>
        </section>

        <section className="event-settings-card">
          <header className="event-settings-card-header">
            <div>
              <p className="metadata">EVENT / TRACKS</p>
              <h2>AVAILABLE TRACKS</h2>
            </div>

            <span className="badge badge-cyan">
              {tracks.length} TRACKS
            </span>
          </header>

          <div className="event-track-grid">
            {tracks.map((track, index) => (
              <article className="event-track-item" key={track}>
                <span>
                  {String(index + 1).padStart(2, '0')}
                </span>

                <strong>{track}</strong>
              </article>
            ))}
          </div>
        </section>

        <section className="event-settings-actions">
          <div>
            <p className="metadata">CURRENT STATE</p>
            <strong>FRONTEND PREVIEW</strong>
            <span>
              Backend authorization and database persistence will connect later.
            </span>
          </div>

          <button className="button button-primary" type="submit">
            <Save size={16} aria-hidden="true" />
            Save settings
          </button>
        </section>
      </form>

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
