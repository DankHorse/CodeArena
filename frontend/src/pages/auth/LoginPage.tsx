import { FormEvent, useState } from 'react';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(
      'Frontend ready. Backend authentication will connect here.',
    );
  }

  return (
    <AuthShell
      eyebrow="[ ACCESS / LOGIN ]"
      title="WELCOME BACK."
      description="Authenticate to enter your CodeArena workspace."
      footerText="New to CodeArena?"
      footerLinkLabel="Create account ↗"
      footerLinkTo="/register"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>EMAIL</span>

          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          <span>PASSWORD</span>

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          className="button button-primary auth-submit"
          type="submit"
        >
          Enter workspace ↗
        </button>

        {message && (
          <p className="auth-message" role="status">
            {message}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
