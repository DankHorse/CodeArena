import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CodeArenaMark } from '../brand/CodeArenaMark';
import { paths } from '../../routes';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="gallery-page">
      <a className="skip-link" href="#public-content">Skip to content</a>
      <header className="gallery-header">
        <Link className="gallery-brand" to={paths.home} aria-label="CodeArena home">
          <CodeArenaMark />
          <span className="brand-wordmark">CODE<span className="brand-accent">ARENA</span><sup className="brand-registered">®</sup></span>
        </Link>
        <nav className="gallery-header-actions public-navigation" aria-label="Public navigation">
          <Link to={paths.events}>EVENTS</Link>
          <Link to={paths.gallery()}>GALLERY</Link>
          <Link className="button button-primary" to={paths.register}>ENTER ARENA <ArrowUpRight size={15} aria-hidden="true" /></Link>
        </nav>
      </header>
      <main id="public-content" tabIndex={-1}>{children}</main>
      <footer className="gallery-footer"><span>CODEARENA / BUILD WITH INTENT</span></footer>
    </div>
  );
}
