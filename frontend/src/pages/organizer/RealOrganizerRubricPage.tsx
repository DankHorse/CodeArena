import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useOrganizer } from '../../organizer/OrganizerProvider';
import { errorMessage } from '../../auth/types';
import { activateRealRubric, createRealRubricVersion, loadRealRubrics } from '../../organizer/realT2Data';
import { rubricFormInput } from '../../organizer/rubricForm';
import type { RealRubric } from '../../organizer/realT2Data';

export function RealOrganizerRubricPage() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;
  const [data, setData] = useState<Awaited<ReturnType<typeof loadRealRubrics>> | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [count, setCount] = useState(1), [formKey, setFormKey] = useState(0);
  const generation = useRef(0), pending = useRef(false);
  async function reload() {
    if (!event) return;
    const token = ++generation.current;
    setLoading(true); setData(null);
    try { const next = await loadRealRubrics(event.id); if (generation.current === token) setData(next); }
    finally { if (generation.current === token) setLoading(false); }
  }
  useEffect(() => { void reload().catch(error => setError(errorMessage(error))); return () => { generation.current++; }; }, [event?.id]);
  async function run(action: () => Promise<RealRubric>, success: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    let saved = false;
    try { await action(); saved = true; await reload(); setMessage(success); }
    catch (error) { setError(`${saved ? 'Operation succeeded, but refreshing rubrics failed. Retry loading before another action. ' : ''}${errorMessage(error)}`); }
    finally { pending.current = false; setBusy(false); }
  }
  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    try {
      const input = rubricFormInput(new FormData(e.currentTarget), count);
      void run(() => createRealRubricVersion(event.id, input), 'New draft version created. Activate it separately.');
    } catch (error) { setMessage(''); setError(errorMessage(error)); }
  }
  if (!event) return <section className="team-state-panel"><p>Select or create an organizer event first.</p><Link to="/organizer/events">Event settings ↗</Link></section>;
  const active = data?.activeRubric.state === 'available' ? data.activeRubric.data : null;
  return <>
    <section className="workspace-intro">
      <div>
        <p className="eyebrow">[ ORGANIZER / RUBRIC ]</p>
        <h1>SCORING RUBRIC.</h1>
        <p className="workspace-description">{event.name} / Versioned judging criteria</p>
      </div>

      <button
        className="button button-secondary"
        type="button"
        disabled={busy || loading}
        onClick={() => {
          setError('');
          void reload().catch(error => setError(errorMessage(error)));
        }}
      >
        ↻ Refresh rubrics
      </button>
    </section>
    <p className="team-message">Create new draft versions independently. Activation is locked once any project assignments exist. Active versions are not directly editable.</p>
    {error && <p role="alert" className="team-message">{error}</p>}{message && <p role="status" className="team-message">{message}</p>}
    {loading ? <p role="status">Loading rubric versions…</p> : data && <>
      <section className="event-settings-card"><header className="event-settings-card-header"><h2>ACTIVE RUBRIC</h2></header><div className="event-settings-fields">{active ? <RubricDetails rubric={active} /> : <p>No active rubric. Create a draft version, then activate it.</p>}</div></section>
      <section className="event-settings-card">
        <header className="event-settings-card-header">
          <h2>AVAILABLE VERSIONS</h2>
        </header>

        <div className="event-settings-fields">
          {data.rubrics
            .filter(rubric => rubric.id !== active?.id)
            .map(rubric => (
              <article key={rubric.id}>
                <RubricDetails rubric={rubric} />

                {rubric.status === 'draft' && (
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => activateRealRubric(event.id, rubric.id),
                        'Rubric activation confirmed by the backend.',
                      )
                    }
                  >
                    Activate version {rubric.version}
                  </button>
                )}
              </article>
            ))}

          {!data.rubrics.some(rubric => rubric.id !== active?.id) && (
            <p className="rubric-empty-version">
              No additional rubric versions.
            </p>
          )}
        </div>
      </section>
      <form className="event-settings-form" onSubmit={create} key={formKey} aria-busy={busy}><fieldset className="organizer-fields" disabled={busy}>
        <section className="event-settings-card"><header className="event-settings-card-header"><h2>CREATE NEW VERSION</h2></header><div className="event-settings-fields">
          <label className="event-field"><span>RUBRIC TITLE</span><input name="title" required maxLength={160} /></label>
          {Array.from({ length: count }, (_, i) => <fieldset key={i}><legend>Criterion {i + 1}</legend><label className="event-field"><span>NAME</span><input name={`name-${i}`} required maxLength={120} /></label><label className="event-field"><span>DESCRIPTION</span><textarea name={`description-${i}`} maxLength={4000} /></label><label className="event-field"><span>WEIGHT %</span><input name={`weight-${i}`} type="number" min="0.0001" max="100" step="0.0001" required /></label><label className="event-field"><span>MAX SCORE</span><input name={`max-${i}`} type="number" min="0.001" max="99999.999" step="0.001" required /></label></fieldset>)}
          <div><button className="button submission-save-button" type="button" disabled={count >= 50} onClick={() => setCount(c => c + 1)}>Add criterion</button><button className="button submission-save-button" type="button" disabled={count <= 1} onClick={() => setCount(c => c - 1)}>Remove last criterion</button></div>
          <p className="metadata">Weights must total exactly 100%. Each submission creates a new draft version.</p><button className="button button-primary" type="submit">{busy ? 'Working…' : 'Create new version'}</button><button type="button" className="button submission-save-button" onClick={() => { setCount(1); setFormKey(k => k + 1); }}>Clear form</button>
        </div></section>
      </fieldset></form>
    </>}
  </>;
}
function RubricDetails({ rubric }: { rubric: RealRubric }) {
  return (
    <div className="real-rubric-details">
      <div className="real-rubric-title-row">
        <div>
          <h3>{rubric.title} / Version {rubric.version}</h3>
          <p className="metadata">{rubric.status.toUpperCase()}</p>
        </div>
      </div>

      <div className="real-rubric-criteria">
        {rubric.criteria.map((criterion, index) => (
          <article
            className="real-rubric-criterion"
            key={criterion.id}
          >
            <span className="real-rubric-index">
              {String(index + 1).padStart(2, '0')}
            </span>

            <div className="real-rubric-copy">
              <strong>{criterion.name}</strong>

              {criterion.description && (
                <span>{criterion.description}</span>
              )}
            </div>

            <div className="real-rubric-metric">
              <span>WEIGHT</span>
              <strong>{criterion.weight}%</strong>
            </div>

            <div className="real-rubric-metric">
              <span>MAX SCORE</span>
              <strong>{criterion.max_score}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
