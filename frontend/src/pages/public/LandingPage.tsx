import { Link } from 'react-router-dom';
import { PublicShell } from '../../components/public/PublicShell';
import { paths } from '../../routes';

export function LandingPage() {
  return (
    <PublicShell>
      <section className="gallery-hero public-hero">
        <p className="eyebrow">[ CODEARENA / HACKATHONS FOR BUILDERS ]</p>
        <h1>ENTER THE<br />ARENA<span className="heading-period">.</span></h1>
        <p>Find your next hackathon. Build with a team. Share your project and get a fair review.</p>
        <div className="public-actions">
          <Link className="button button-primary" to={paths.events}>Browse Events ↗</Link>
          <Link className="button public-secondary" to={paths.gallery()}>Explore Projects ↗</Link>
        </div>
      </section>
      <section className="public-introduction" aria-label="About CodeArena">
        <p className="metadata">BUILD / SUBMIT / REVIEW</p>
        <h2>One arena. Every stage of the hackathon.</h2>
        <p>Discover events, explore community projects, and bring your next idea to life.</p>
      </section>
    </PublicShell>
  );
}
