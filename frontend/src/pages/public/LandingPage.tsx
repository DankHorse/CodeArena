import { useEffect, useRef } from 'react';
import { useSession } from '../../auth/SessionProvider';
import { Link } from 'react-router-dom';
import { usePublicCatalog } from '../../data/usePublicCatalog';
import { eventStatus, formatDeadline } from '../../data/publicData';
import { paths } from '../../routes';
import { CodeArenaMark } from '../../components/brand/CodeArenaMark';
const roles = [
  { id: 'participant', name: 'Participant', heading: ['BUILD.', 'SUBMIT.', 'COMPETE.'], subtitle: 'Turn an idea into a competition-ready project.', audience: 'For hackers, builders, students, and teams taking part in a hackathon.', description: 'Manage your event participation, team, project information, and final submission in one place instead of spreading everything across disconnected tools.', capabilities: ['Discover events', 'Create or manage a team', 'Maintain project details', 'Submit repository / demo information', 'Track submission status', 'View the public project gallery'] },
  { id: 'judge', name: 'Judge', heading: ['REVIEW.', 'SCORE.', 'DECIDE.'], subtitle: 'Structured judging without the spreadsheet chaos.', audience: 'For mentors, experts, technical reviewers, and invited judges.', description: 'Focus on your assigned projects. Score against the official event rubric, provide feedback, and submit an independent evaluation.', capabilities: ['Assigned projects', 'Versioned rubrics', 'Criterion-based scoring', 'Draft evaluations', 'Written feedback', 'Final submission', 'Scoring guide'] },
  { id: 'organizer', name: 'Organizer', heading: ['RUN', 'THE ARENA.'], subtitle: 'One control center for the event behind the competition.', audience: 'For hackathon hosts, universities, communities, companies, and event teams.', description: 'Bring event configuration, projects, judging structure, rubrics, assignments, progress, results, exports, and operations into one control surface.', capabilities: ['Create + configure events', 'Manage teams + projects', 'Create versioned rubrics', 'Activate judging criteria', 'Manage judges', 'Assign projects', 'Monitor judging progress', 'Calculate results', 'Export results', 'Review event activity'] },
] as const;
const capabilities = ['Event management', 'Team + project management', 'Role-based workspaces', 'Versioned judging rubrics', 'Judge assignments', 'Results + exports', 'Auditable event operations'];
const principles = [
  ['Clear responsibilities', 'Participant, Judge and Organizer experiences stay intentionally separated.'],
  ['Authoritative backend', 'Permissions and scoring rules live behind the interface.'],
  ['Versioned judging', 'Rubrics evolve deliberately, without silently changing existing evaluations.'],
  ['Self-hostable', 'Run the platform as infrastructure your event controls.'],
];
export function LandingPage() {
  const { catalog, loading, error, refresh } = usePublicCatalog(true);
  const session = useSession();
  const logoutStarted = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session.user || logoutStarted.current) return;

    logoutStarted.current = true;

    void session.logout().finally(() => {
      logoutStarted.current = false;
    });
  }, [session.user?.id]);
  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sections = root.current.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); }
    }, { threshold: 0.08 });
    sections.forEach(section => { section.classList.add('reveal-ready'); observer.observe(section); });
    return () => { observer.disconnect(); sections.forEach(section => section.classList.remove('reveal-ready')); };
  }, []);
  return <div className="arena-landing" ref={root}>
    <a className="skip-link" href="#landing-main">Skip to content</a>
    <header className="landing-nav">
      <Link className="gallery-brand" to={paths.home} aria-label="CodeArena home"><CodeArenaMark /><span className="brand-wordmark">CODE<span className="brand-accent">ARENA</span><sup className="brand-registered">®</sup></span></Link>
      <nav aria-label="Main navigation">{['Platform', 'Participants', 'Judges', 'Organizers', 'Capabilities'].map(label => <a key={label} href={`#${label.toLowerCase()}`}>{label}</a>)}<Link to={paths.events}>Public Events ↗</Link></nav>
    </header>
    <main id="landing-main">
      <section className="landing-hero landing-container">
        <div><p className="eyebrow">[ PLATFORM / CODEARENA ]</p><h1>THE PLATFORM<br />HACKATHONS<br />RUN ON<span className="heading-period">.</span></h1><p className="landing-lead">CodeArena is a self-hostable hackathon platform that brings event management, teams, project submissions, judging, scoring, results, and operations into one connected system.</p><div className="landing-actions"><Link className="button button-primary landing-major-cta" to={paths.register}>Enter the arena <span aria-hidden="true">→</span></Link><Link className="landing-text-link" to={paths.events}>Explore public events <span aria-hidden="true">↗</span></Link></div><p className="landing-meta-strip">SELF-HOSTABLE <span>ROLE-BASED</span> BUILT FOR REAL EVENTS</p></div>
        <figure className="landing-dossier"><figcaption className="metadata">SYS / CODEARENA · FIG. 01</figcaption><strong className="landing-dossier-number">03</strong><span className="metadata">WORKSPACES</span><div className="landing-dossier-roles">{roles.map((role,i)=><span key={role.id}>0{i+1} / {role.name.toUpperCase()}</span>)}</div><p>ONE EVENT.<br />ONE SYSTEM.</p><span className="metadata">ACCESS / ROLE-BASED<br />MODE / SELF-HOSTED</span></figure>
      </section>
      <section className="landing-section landing-container" id="platform" data-reveal>
        <p className="eyebrow">[ 01 / PRODUCT PURPOSE ]</p><h2>HACKATHONS ARE COMPLEX.<br />THE PLATFORM SHOULDN’T BE.</h2>
        <div className="landing-purpose"><div><p className="landing-lead">Running a hackathon means coordinating registrations, teams, projects, deadlines, judges, scoring rules, evaluations, results, and event history.</p><p className="landing-lead">CodeArena brings those responsibilities together so builders can focus on building, judges on evaluating, and organizers on running the event.</p></div><figure className="landing-platform-map" aria-labelledby="platform-map-title">
          <figcaption id="platform-map-title"><span className="metadata">FIG. 02 / PLATFORM MAP</span><span className="metadata">ONE CONNECTED SYSTEM</span></figcaption>
          <div className="landing-map-branches">{[
            { role: 'Participant', target: 'participants', action: 'BUILD', nodes: ['Teams', 'Projects'] },
            { role: 'Judge', target: 'judges', action: 'EVALUATE', nodes: ['Rubrics', 'Judging'] },
            { role: 'Organizer', target: 'organizers', action: 'OPERATE', nodes: ['Results', 'Event Control'] },
          ].map((branch,i)=><div className="landing-map-branch" key={branch.role}>
            <a className="landing-map-role" href={`#${branch.target}`}><span className="metadata">0{i+1} / {branch.action}</span><strong>{branch.role}</strong><span className="landing-map-arrow" aria-hidden="true">↗</span></a>
            <ul className="landing-map-nodes" aria-label={`${branch.role} responsibilities`}>{branch.nodes.map(node=><li key={node}><span aria-hidden="true" />{node}</li>)}</ul>
          </div>)}</div>
          <p className="landing-map-note"><span aria-hidden="true">+</span> Clear responsibilities. Shared event context.</p>
        </figure></div>
      </section>
      <section className="landing-section landing-audience landing-container" id="workspaces" data-reveal><p className="eyebrow">[ 02 / PEOPLE + RESPONSIBILITIES ]</p><h2>BUILT FOR EVERY SIDE<br />OF THE HACKATHON.</h2><p className="landing-lead">Builders create. Judges evaluate. Organizers make the whole event possible. Each has a workspace built around their responsibility.</p><nav className="landing-role-divider" aria-label="Explore workspaces">{roles.map((role,i)=><a key={role.id} href={`#${role.id === 'judge' ? 'judges' : role.id+'s'}`}><span>0{i+1}</span>{role.name.toUpperCase()}<span aria-hidden="true">↘</span></a>)}</nav></section>
      {roles.map((role,i)=><section className={`landing-section landing-container landing-role-story${role.id==='judge'?' landing-role-reverse':''}`} id={role.id==='judge'?'judges':role.id+'s'} key={role.id} data-reveal>
        <div className="landing-role-copy"><p className="eyebrow">0{i+1} / {role.name.toUpperCase()}</p><h2>{role.heading.map(line=><span key={line}>{line}</span>)}</h2><h3>{role.subtitle}</h3><p className="landing-lead">{role.audience}</p><p className="landing-role-description">{role.description}</p><ul className="landing-role-capabilities">{role.capabilities.map(item=><li key={item}>{item}</li>)}</ul><Link className="landing-text-link landing-role-entry landing-major-link" to={
  role.id === 'judge'
    ? paths.judgeLogin
    : role.id === 'organizer'
      ? paths.organizerLogin
      : paths.participantLogin
} state={{
  workspace: role.id,
  from:
    role.id === 'judge'
      ? paths.judge.home
      : role.id === 'organizer'
        ? paths.organizer.home
        : paths.participant.home,
}}>Enter {role.name} {role.id==='organizer'?'Console':'Workspace'} <span aria-hidden="true">→</span></Link></div>
        <figure className={`landing-product-visual landing-product-${role.id}`}><figcaption className="metadata">DEMO / {role.name.toUpperCase()} SYSTEM VIEW<br />ILLUSTRATIVE INTERFACE · NOT LIVE DATA</figcaption><span className="landing-visual-number" aria-hidden="true">0{i+1}</span>
          {role.id==='participant' ? <div className="landing-fragments"><p className="metadata">TEAM / HYPERION</p><div className="landing-project-fragment"><span className="metadata">PROJECT / READY</span><strong>BUILT WITH<br />INTENT.</strong><p className="metadata">REPOSITORY / ATTACHED<br />DEMO / ATTACHED</p></div><p className="landing-final-fragment">✓ SUBMISSION / FINAL<br /><span className="metadata">STATUS / SUBMITTED</span></p></div> : role.id==='judge' ? <div className="landing-scoring"><p className="metadata">PROJECT / ASSIGNED</p>{[['FUNCTIONALITY',4],['QUALITY',5],['INNOVATION',4]].map(([label,value])=><div className="landing-score-row" key={label}><span>{label}</span><span className="landing-score-markers" aria-hidden="true">{Array.from({length:5},(_,n)=><i key={n} className={n<Number(value)?'filled':''} />)}</span><strong>{value} / 5</strong></div>)}<p className="metadata">FEEDBACK / READY</p><p className="landing-final-fragment">EVALUATION / COMPLETE</p></div> : <div className="landing-command"><div><span>EVENT</span><strong>● ACTIVE</strong></div><div><span>PROJECTS</span><strong>READY</strong></div><div><span>RUBRIC</span><strong>V2</strong></div><div className="landing-command-meter"><span>JUDGING</span><span className="landing-demo-meter" aria-label="Illustrative judging progress"><i /></span></div><p className="landing-final-fragment">RESULTS / PENDING</p></div>}
        </figure>
      </section>)}
      <section className="landing-section landing-container landing-why" data-reveal><p className="eyebrow">[ 06 / WHY CODEARENA ]</p><h2>RUN THE EVENT.<br />NOT THE TOOLCHAIN.</h2><p className="landing-lead">Hackathons often rely on disconnected forms, spreadsheets, chat messages, manual scoring sheets, and one-off scripts. CodeArena centralizes the core operational surface while preserving clear responsibilities.</p><div className="landing-consolidation"><div>{['FORMS','SHEETS','EMAIL','CHAT','SCRIPTS','CSV'].map(item=><span key={item}>{item}</span>)}</div><span className="landing-connector" aria-hidden="true">→</span><strong>CODEARENA<span className="metadata">ONE EVENT SYSTEM</span></strong></div></section>
      <section className="landing-section landing-container" id="capabilities" data-reveal><p className="eyebrow">[ 07 / SYSTEM CAPABILITIES ]</p><h2>BUILT FOR REAL EVENTS.</h2><div className="landing-capabilities">{capabilities.map((label,i)=><div className="landing-capability" key={label}><span className="metadata">0{i+1}</span><h3>{label}</h3><span className="landing-dot-leader" aria-hidden="true" /><span className="metadata landing-ready">READY</span></div>)}</div><p className="landing-meta-strip">SELF-HOSTABLE <span>LOCAL DEPLOYMENT</span> BACKEND-AUTHORIZED ACCESS</p></section>
      <section className="landing-section landing-container landing-principles" data-reveal><div><p className="eyebrow">[ 08 / PRODUCT PRINCIPLES ]</p><h2>BUILT<br />WITH INTENT.</h2></div><dl>{principles.map(([title,description])=><div key={title}><dt>{title}</dt><dd>{description}</dd></div>)}</dl></section>
      <section className="landing-section landing-container landing-live" aria-labelledby="landing-live-title" data-reveal>
        <p className="eyebrow">[ LIVE / CODEARENA ]</p>
        <h2 id="landing-live-title">LIVE ON CODEARENA.</h2>
        {loading ? <p className="landing-live-state" role="status">Loading public events…</p>
          : error ? <div className="landing-live-state" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void refresh()}>Retry events</button></div>
          : !catalog?.events.length ? <p className="landing-live-state" role="status">No public events are available right now.</p>
          : <ul className="landing-live-events">{catalog.events.slice(0, 3).map(event => <li key={event.id}>
            <div><span className="metadata">{event.lifecycle ?? eventStatus(event)}</span><h3>{event.name}</h3>
              {event.submissionsClose && Number.isFinite(Date.parse(event.submissionsClose)) && <p className="metadata">SUBMISSION DEADLINE / {formatDeadline(event.submissionsClose)}</p>}
            </div>
            <Link className="landing-text-link landing-live-event-link" to={paths.event(event.id)} aria-label={`View event: ${event.name}`}>View event <span aria-hidden="true">→</span></Link>
          </li>)}</ul>}
        <Link className="landing-text-link" to={paths.events}>View all events <span aria-hidden="true">→</span></Link>
      </section>
      <section className="landing-finale landing-container" data-reveal><p className="eyebrow">[ YOUR NEXT CHAPTER ]</p><h2>MAKE SOMETHING<br />THAT MATTERS<span className="heading-period">.</span></h2><p className="landing-lead">Whether you’re building, judging, or running the event, there’s a CodeArena workspace designed around your role.</p><div className="landing-actions"><a className="button button-primary landing-major-cta" href="#workspaces">Choose your workspace <span aria-hidden="true">→</span></a></div></section>
    </main><footer className="landing-footer landing-container"><span>CODEARENA / BUILD WITH INTENT</span><Link to={paths.gallery()}>Public project gallery ↗</Link></footer>
  </div>;
}
