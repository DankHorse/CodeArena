import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import type { PublicEvent } from '../../data/publicData';
import { registerParticipant, writeContext, eventKey } from '../../participant/realData';
import { paths } from '../../routes';
export function EventRegistration({ event }: { event: PublicEvent }) {
  const { user, status } = useSession(); const navigate = useNavigate();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const open = event.lifecycle === 'published' && !!event.registrationOpens && !!event.registrationClose && now >= Date.parse(event.registrationOpens) && now <= Date.parse(event.registrationClose);
  const state = { from: paths.event(event.id) };
  async function register() {
    if (!user || busy) return;
    setBusy(true); setError('');
    try { await registerParticipant(user.id, event.id); navigate(paths.participant.home); }
    catch (error) { setError(errorMessage(error)); } finally { setBusy(false); }
  }
  return <section className="public-actions">
    {status === 'loading' ? <p role="status">Checking session…</p> : !user ? <><Link className="button button-primary" to={paths.login} state={state}>Login to register ↗</Link><Link to={paths.register} state={state}>Create account ↗</Link></> : user.role === 'participant' ? <><button className="button button-primary" disabled={busy || !open} onClick={() => void register()}>{busy ? 'Registering…' : 'Register for event ↗'}</button><Link to={paths.participant.home} onClick={() => writeContext(eventKey(user.id), event.id)}>Open workspace for this event</Link></> : <p>Participant access is required to register.</p>}
    {!open && <p>Event registration is closed or has not opened yet.</p>}
    {error && <p className="team-message" role="alert">{error}</p>}
  </section>;
}
