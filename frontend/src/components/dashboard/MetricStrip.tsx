import { ClipboardCheck, Files, Scale, Users } from 'lucide-react';

const metrics = [
  { label: 'PROJECTS', value: '41', detail: 'Submitted to the arena', icon: Files },
  { label: 'TEAMS', value: '40', detail: 'Building together', icon: Users },
  { label: 'JUDGES', value: '30', detail: 'On the review roster', icon: Scale },
  { label: 'REVIEWS', value: '126', detail: 'Of 150 assigned reviews', icon: ClipboardCheck },
];

export function MetricStrip() {
  return (
    <section className="metric-strip" aria-label="Event metrics">
      {metrics.map(({ label, value, detail, icon: Icon }) => (
        <div className="metric" key={label}>
          <div className="metric-label"><span>{label}</span><Icon size={17} aria-hidden="true" /></div>
          <strong className="metric-value">{value}</strong>
          <p>{detail}</p>
        </div>
      ))}
    </section>
  );
}
