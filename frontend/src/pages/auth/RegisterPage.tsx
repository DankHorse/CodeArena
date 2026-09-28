import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthShell } from './AuthShell';
import { useSession } from '../../auth/SessionProvider';
import { paths } from '../../routes';
import { DEMO } from '../../api';
import { authValidationField, isValidEmail, safeRegisterError } from './validation';

export function RegisterPage() {
  const { register } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const display_name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const nextErrors: typeof fieldErrors = {};
    if (!display_name) nextErrors.name = 'Please enter your name.';
    if (!isValidEmail(email)) nextErrors.email = 'Please enter a valid email address.';
    if (password.length < 12) nextErrors.password = 'Password must be at least 12 characters.';
    if (Object.keys(nextErrors).length) { setFieldErrors(nextErrors); setError(''); return; }
    setBusy(true); setError(''); setFieldErrors({});
    try { await register({ display_name, email, password }); navigate(paths.login, { replace: true, state: { registered: true, ...(!DEMO && location.state && typeof location.state.from === 'string' ? { from: location.state.from } : {}) } }); }
    catch (error) { const result = safeRegisterError(error); if (result.field) setFieldErrors({ [result.field]: result.message }); else setError(result.message); }
    finally { setBusy(false); }
  }
  return (
    <AuthShell eyebrow="[ ACCESS / REGISTER ]" title="JOIN THE ARENA." description="Create your account and enter the event workspace." footerText="Already registered?" footerLinkLabel="Login ↗" footerLinkTo={paths.login}>
      {DEMO && <p className="auth-message">Demo registration creates a local preview profile. Use sample details, not real credentials.</p>}
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={busy} noValidate>
        <label><span>NAME</span><input id="register-name" type="text" name="name" autoComplete="name" placeholder="Your name" required disabled={busy} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? 'register-name-error' : undefined} />{fieldErrors.name && <p className="auth-message" id="register-name-error" role="alert">{fieldErrors.name}</p>}</label>
        <label><span>EMAIL</span><input id="register-email" type="email" name="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? 'register-email-error' : undefined} />{fieldErrors.email && <p className="auth-message" id="register-email-error" role="alert">{fieldErrors.email}</p>}</label>
        <label><span>PASSWORD / 12 CHARACTERS MINIMUM</span><input id="register-password" type="password" name="password" autoComplete="new-password" minLength={12} placeholder="Create a password" required disabled={busy} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'register-password-error' : undefined} />{fieldErrors.password && <p className="auth-message" id="register-password-error" role="alert">{fieldErrors.password}</p>}</label>
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account ↗'}</button>
        {error && <p className="auth-message" role="alert">{error}</p>}
      </form>
    </AuthShell>
  );
}
