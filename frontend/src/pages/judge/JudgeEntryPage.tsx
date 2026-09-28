import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { discoverJudgeEvents } from '../../judge/discovery';
import type { JudgeEventChoice } from '../../judge/discovery';
import { judgePath } from '../../judge/navigation';
import { paths } from '../../routes';

export function JudgeEntryPage() {
  const { user } = useSession();
  const [events, setEvents] = useState<JudgeEventChoice[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setEvents([]); setLoading(true); setError('');
    if (!user) { setLoading(false); return; }
    void discoverJudgeEvents(user.id).then(value => { if (current) setEvents(value); }).catch(error => { if (current) setError(errorMessage(error)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [user?.id, attempt]);
  return <main className="workspace judge-entry" id="main-content">
    <section className="workspace-intro"><div><p className="eyebrow">[ CODEARENA / JUDGE ACCESS ]</p><h1>YOUR JUDGING EVENTS<span className="heading-period">.</span></h1><p className="workspace-description">Select an event to enter your review workspace.</p></div></section>
    <div className="judge-entry-composition">
    <div className="judge-entry-grid" aria-busy={loading}>
      {loading ? <section className="judge-entry-state" role="status"><p className="metadata">ASSIGNMENTS / LOADING</p><p>Checking your judging events…</p></section>
        : error ? <section className="judge-entry-state" role="alert"><p className="metadata">ASSIGNMENTS / UNAVAILABLE</p><p>{error}</p></section>
        : events.length ? events.map(({ event, assignmentCount }, index) => <section className="judge-entry-card" key={event.id} aria-labelledby={`judge-event-${event.id}`}>
          <header><p className="metadata">EVENT / {String(index + 1).padStart(2, '0')}</p>{event.lifecycle && <span className="badge badge-cyan">{event.lifecycle}</span>}</header>
          <h2 id={`judge-event-${event.id}`}>{event.name}</h2>
          <p className="judge-entry-count"><strong>{assignmentCount}</strong><span className="metadata">OWN ASSIGNMENTS</span></p>
          <Link className="button button-primary" to={judgePath(paths.judge.home, event.id)}>Open Judge Workspace →</Link>
        </section>)
        : <section className="judge-entry-state"><p className="metadata">ASSIGNMENTS / EMPTY</p><h2>No judging assignments available.</h2><p>Your assigned events will appear here when available.</p></section>}
    </div>
    <aside className="judge-entry-protocol" aria-labelledby="judging-protocol-title">
      <h2 className="metadata" id="judging-protocol-title">JUDGING PROTOCOL</h2>
      <ol>{['Open your assigned workspace', 'Review only your assigned projects', 'Score every rubric criterion', 'Submit to lock your review'].map((step, index) => <li key={step}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{step}</li>)}</ol>
      <p>Reviews are private. Only your assigned projects are visible.</p>
    </aside>
    </div>
    <section className="judge-entry-summary" aria-label="Judging event summary">
      <dl><div><dt className="metadata">JUDGING EVENTS</dt><dd>{loading || error ? '—' : events.length}</dd></div><div><dt className="metadata">OWN ASSIGNMENTS</dt><dd>{loading || error ? '—' : events.reduce((sum, event) => sum + event.assignmentCount, 0)}</dd></div></dl>
    <nav className="judge-entry-actions" aria-label="Judge entry controls">
      <button type="button" disabled={loading} onClick={() => setAttempt(value => value + 1)}>Refresh assignments</button>
      <Link to={paths.events}>Browse public events →</Link>
    </nav>
    </section>
  </main>;
}
