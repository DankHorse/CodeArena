import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CodeArenaMark } from '../../components/brand/CodeArenaMark';

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footerText: string;
  footerLinkLabel: string;
  footerLinkTo: string;
};

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footerText,
  footerLinkLabel,
  footerLinkTo,
}: AuthShellProps) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link className="auth-brand" to="/" aria-label="CodeArena home">
          <CodeArenaMark />
          <span className="brand-wordmark auth-wordmark">
            CODE<span className="brand-accent">ARENA</span>
            <sup className="brand-registered">®</sup>
          </span>
        </Link>

        <div className="auth-brand-copy">
          <p className="eyebrow">[ CODEARENA / ACCESS ]</p>

          <h1>
            ENTER
            <br />
            THE ARENA<span className="heading-period">.</span>
          </h1>

          <p>
            Build. Submit. Review. Judge.
            <br />
            One workspace for the complete hackathon lifecycle.
          </p>
        </div>

        <p className="auth-system-status">
          <span className="status-dot" /> SYSTEM READY / LOCAL MODE
        </p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-description">{description}</p>

          {children}

          <p className="auth-switch">
            {footerText}{' '}
            <Link to={footerLinkTo}>{footerLinkLabel}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
