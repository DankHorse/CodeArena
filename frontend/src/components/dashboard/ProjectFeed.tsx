const projects = [
  { id: '01', title: 'SignalStack', team: 'Northstar', track: 'Developer tools', status: 'In review' },
  { id: '02', title: 'Gridwise', team: 'Current Collective', track: 'Climate', status: 'Reviewed' },
  { id: '03', title: 'OpenCircuit', team: 'Circuit Breakers', track: 'Open hardware', status: 'In review' },
  { id: '04', title: 'Glass Signal', team: 'NorthKiln', track: 'Developer tools', status: 'Awaiting review' },
];

export function ProjectFeed() {
  return (
    <section className="panel" aria-labelledby="project-feed-title">
      <header className="panel-header"><h2 id="project-feed-title"><span>//</span> Project Feed</h2><span className="metadata">04 / 41 PROJECTS</span></header>
      <ul className="project-list">
        {projects.map(project => (
          <li className="project-row" key={project.id}>
            <span className="project-number">{project.id}</span>
            <div className="project-copy"><h3>{project.title}</h3><p>{project.team} <span aria-hidden="true">/</span> {project.track}</p></div>
            <span className={`badge ${project.status === 'Reviewed' ? 'badge-cyan' : project.status === 'Awaiting review' ? 'badge-warning' : 'badge-muted'}`}>{project.status}</span>
          </li>
        ))}
      </ul>
      <footer className="panel-footer">A snapshot of the work in this arena.</footer>
    </section>
  );
}
