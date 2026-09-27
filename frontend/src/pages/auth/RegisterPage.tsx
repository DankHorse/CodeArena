import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { useSession } from '../../auth/SessionProvider';
import { errorMessage } from '../../auth/types';
import { paths } from '../../routes';
import { DEMO } from '../../api';

export function RegisterPage() {
  const { register } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const display_name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (!display_name || !email || password.length < 12) { setError('Enter a name, email, and password of at least 12 characters.'); return; }
    setBusy(true); setError('');
    try { await register({ display_name, email, password }); navigate(paths.login, { replace: true, state: { registered: true, ...(!DEMO && location.state && typeof location.state.from === 'string' ? { from: location.state.from } : {}) } }); }
    catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }
  return (
    <AuthShell eyebrow="[ ACCESS / REGISTER ]" title="JOIN THE ARENA." description="Create your account and enter the event workspace." footerText="Already registered?" footerLinkLabel="Login ↗" footerLinkTo={paths.login}>
      {DEMO && <p className="auth-message">Demo registration creates a local preview profile. Use sample details, not real credentials.</p>}
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy}>
        <label><span>NAME</span><input type="text" name="name" autoComplete="name" placeholder="Your name" required disabled={busy} /></label>
        <label><span>EMAIL</span><input type="email" name="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} /></label>
        <label><span>PASSWORD / 12 CHARACTERS MINIMUM</span><input type="password" name="password" autoComplete="new-password" minLength={12} placeholder="Create a password" required disabled={busy} /></label>
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account ↗'}</button>
        {error && <p className="auth-message" role="alert">{error}</p>}
      </form>
    </AuthShell>
  );
}
