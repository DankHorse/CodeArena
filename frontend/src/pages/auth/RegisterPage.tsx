import { FormEvent, useState } from 'react';
import { AuthShell } from './AuthShell';

export function RegisterPage() {
  const [message, setMessage] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(
      'Registration UI ready. Backend account creation will connect here.',
    );
  }

  return (
    <AuthShell
      eyebrow="[ ACCESS / REGISTER ]"
      title="JOIN THE ARENA."
      description="Create your account and enter the event workspace."
      footerText="Already registered?"
      footerLinkLabel="Login ↗"
      footerLinkTo="/login"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          <span>NAME</span>

          <input
            type="text"
            name="name"
            placeholder="Your name"
            autoComplete="name"
            required
          />
        </label>

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
            placeholder="Create a password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <button
          className="button button-primary auth-submit"
          type="submit"
        >
          Create account ↗
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
