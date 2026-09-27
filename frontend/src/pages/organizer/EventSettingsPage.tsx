import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useOrganizer } from '../../organizer/OrganizerProvider';

export function EventSettingsPage() {
  const { snapshot, busy, saveSettings } = useOrganizer();

  if (!snapshot?.event) return null;

  const { event, tracks, projects } = snapshot;

  const [keptTrackIds, setKeptTrackIds] = useState<string[]>(
    () => tracks.map(track => track.id)
  );

  useEffect(() => {
    setKeptTrackIds(tracks.map(track => track.id));
  }, [event.id, tracks]);

  const usedTrackIds = new Set(
    projects.map(project => project.track_id).filter(Boolean)
  );

  const visibleTracks = tracks.filter(track =>
    keptTrackIds.includes(track.id)
  );

  function removeTrack(trackId: string) {
    if (usedTrackIds.has(trackId)) return;

    setKeptTrackIds(current =>
      current.filter(id => id !== trackId)
    );
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const form = new FormData(e.currentTarget);

    const additions = String(form.get('tracks') ?? '')
      .split('\n')
      .map(name => name.trim())
      .filter(Boolean);

    const retained = tracks
      .filter(track => keptTrackIds.includes(track.id))
      .map(track => track.name);

    void saveSettings({
      name: String(form.get('name') ?? '').trim(),
      description: String(form.get('description') ?? ''),
      registration_close: new Date(
        String(form.get('registration')) + 'Z'
      ).toISOString(),
      submissions_close: new Date(
        String(form.get('deadline')) + 'Z'
      ).toISOString(),
      tracks: [...new Set([...retained, ...additions])],
    });
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / EVENT ]</p>
          <h1>
            EVENT SETTINGS<span className="heading-period">.</span>
          </h1>
          <p className="workspace-description">
            Configure the event, tracks and submission deadline.
          </p>
        </div>
      </section>

      <form
        className="event-settings-form"
        onSubmit={save}
        key={event.id}
      >
        <fieldset className="organizer-fields" disabled={busy}>
          <section className="event-settings-card">
            <header className="event-settings-card-header">
              <h2>GENERAL INFORMATION</h2>
            </header>

            <div className="event-settings-fields">
              <label className="event-field">
                <span>EVENT NAME</span>
                <input
                  name="name"
                  required
                  defaultValue={event.name}
                />
              </label>

              <label className="event-field">
                <span>DESCRIPTION</span>
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={event.description}
                />
              </label>
            </div>
          </section>

          <section className="event-settings-card">
            <header className="event-settings-card-header">
              <h2>DEADLINES / UTC</h2>
            </header>

            <div className="event-settings-fields event-settings-grid">
              <label className="event-field">
                <span>REGISTRATION CLOSES</span>
                <input
                  name="registration"
                  type="datetime-local"
                  required
                  defaultValue={event.registration_close.slice(0, 16)}
                />
              </label>

              <label className="event-field">
                <span>SUBMISSIONS CLOSE</span>
                <input
                  name="deadline"
                  type="datetime-local"
                  required
                  defaultValue={event.submissions_close.slice(0, 16)}
                />
              </label>
            </div>
          </section>

          <section className="event-settings-card">
            <header className="event-settings-card-header">
              <h2>AVAILABLE TRACKS</h2>
              <span className="badge badge-cyan">
                {visibleTracks.length} TRACKS
              </span>
            </header>

            <div className="event-track-grid">
              {visibleTracks.map(track => {
                const used = usedTrackIds.has(track.id);

                return (
                  <article
                    className="event-track-item"
                    key={track.id}
                  >
                    <strong>{track.name}</strong>

                    <button
                      className="event-track-remove"
                      type="button"
                      disabled={used}
                      onClick={() => removeTrack(track.id)}
                      title={
                        used
                          ? 'This track is used by a project and cannot be removed.'
                          : 'Remove track'
                      }
                    >
                      {used ? 'IN USE' : 'REMOVE'}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="event-settings-fields">
              <label className="event-field">
                <span>ADD TRACKS / ONE PER LINE</span>
                <textarea
                  name="tracks"
                  rows={3}
                  placeholder="New track name"
                />
              </label>

              <p className="metadata">
                Tracks used by existing projects are protected from deletion.
              </p>
            </div>
          </section>

          <section className="event-settings-actions">
            <p>Changes update the shared event.</p>

            <button
              className="button button-primary"
              type="submit"
            >
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </section>
        </fieldset>
      </form>
    </>
  );
}
