import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { errorMessage } from '../../auth/types';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import { publishEvent, saveEvent } from '../../data/events';
import type { BackendEvent, EventFields } from '../../data/events';

const schedule = [
  ['registration_opens_at', 'REGISTRATION OPENS'], ['registration_deadline', 'REGISTRATION DEADLINE'],
  ['starts_at', 'EVENT STARTS'], ['submission_deadline', 'SUBMISSION DEADLINE'], ['ends_at', 'EVENT ENDS'],
] as const;
const inputDate = (date?: string) => date ? new Date(date).toISOString().slice(0, 16) : '';

export function RealEventSettings() {
  const { snapshot, selectEvent, loading } = useOrganizer();
  const current = snapshot?.event?.real;
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<BackendEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const location = useLocation();
  const origin = useRef(location.key);
  const pending = useRef(false);
  useEffect(() => { origin.current = location.key; setError(''); setMessage(''); return () => { origin.current = ''; }; }, [location.key]);
  useEffect(() => { setSaved(null); }, [current]);
  const event = creating ? undefined : saved ?? current;
  const readOnly = !!event && event.status !== 'draft';

  async function act(operation: () => Promise<BackendEvent>, confirmation: string) {
    if (pending.current) return;
    const route = location.key;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await operation();
      // Keep the server response even if the following GET fails; never repeat a successful POST.
      setSaved(result); setCreating(false);
      await selectEvent(result.id);
      if (origin.current === route) setMessage(confirmation);
    } catch (error) { if (origin.current === route) setError(errorMessage(error)); }
    finally { pending.current = false; setBusy(false); }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = (key: string) => String(data.get(key) ?? '').trim();
    try {
      const fields: EventFields = {
        title: text('title'), description: text('description'),
        registration_opens_at: new Date(text('registration_opens_at') + 'Z').toISOString(),
        registration_deadline: new Date(text('registration_deadline') + 'Z').toISOString(),
        starts_at: new Date(text('starts_at') + 'Z').toISOString(),
        submission_deadline: new Date(text('submission_deadline') + 'Z').toISOString(),
        ends_at: new Date(text('ends_at') + 'Z').toISOString(),
        team_min_size: Number(text('team_min_size')), team_max_size: Number(text('team_max_size')),
      };
      void act(() => saveEvent(fields, event?.id), event ? 'Draft event saved.' : 'Draft event created.');
    } catch { setError('Enter valid dates for every schedule field.'); }
  }
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ ORGANIZER / EVENT ]</p><h1>EVENT SETTINGS<span className="heading-period">.</span></h1><p className="workspace-description">Create a draft, complete its schedule, then publish it.</p></div>
      {event && <button className="button button-primary" disabled={busy || loading} onClick={() => { setCreating(true); setSaved(null); setError(''); setMessage(''); }}>New event</button>}
    </section>
    {error && <p className="team-message" role="alert">{error}</p>}
    {message && <p className="team-message" role="status">{message}</p>}
    {event && <p className="metadata">{event.status.toUpperCase()} / {event.slug}</p>}
    {readOnly && <p className="metadata">Published events are read-only. The backend only permits draft edits.</p>}
    <form className="event-settings-form" key={`${event?.id ?? 'new'}:${event?.status ?? ''}`} onSubmit={submit}>
      <fieldset className="organizer-fields" disabled={busy || loading || readOnly}>
        <section className="event-settings-card"><header className="event-settings-card-header"><h2>GENERAL INFORMATION</h2></header><div className="event-settings-fields">
          <label className="event-field"><span>EVENT TITLE</span><input name="title" required maxLength={160} defaultValue={event?.title ?? ''} /></label>
          <label className="event-field"><span>DESCRIPTION</span><textarea name="description" required maxLength={20000} rows={4} defaultValue={event?.description ?? ''} /></label>
        </div></section>
        <section className="event-settings-card"><header className="event-settings-card-header"><h2>SCHEDULE / UTC</h2></header><div className="event-settings-fields event-settings-grid">
          {schedule.map(([key, label]) => <label className="event-field" key={key}><span>{label}</span><input name={key} type="datetime-local" required defaultValue={inputDate(event?.[key])} /></label>)}
        </div></section>
        <section className="event-settings-card"><header className="event-settings-card-header"><h2>TEAM SIZE</h2></header><div className="event-settings-fields event-settings-grid">
          <label className="event-field"><span>MINIMUM</span><input name="team_min_size" type="number" min={1} step={1} required defaultValue={event?.team_min_size ?? 1} /></label>
          <label className="event-field"><span>MAXIMUM</span><input name="team_max_size" type="number" min={1} step={1} required defaultValue={event?.team_max_size ?? 4} /></label>
        </div></section>
        <p className="metadata">Track management is not available in the real event API.</p>
        {!readOnly && <button className="button button-primary" type="submit">{busy ? 'Saving…' : event ? 'Save draft' : 'Create draft'}</button>}
      </fieldset>
    </form>
    {event?.status === 'draft' && <button className="button button-primary" disabled={busy || loading} onClick={() => void act(() => publishEvent(event.id), 'Event published. It is now eligible for the public events list.')}>Publish saved draft ↗</button>}
    {creating && current && <button className="button" disabled={busy} onClick={() => setCreating(false)}>Cancel new event</button>}
    <p className="metadata">Only the known current event is loaded. The backend does not provide a list of your draft events.</p>
  </>;
}
