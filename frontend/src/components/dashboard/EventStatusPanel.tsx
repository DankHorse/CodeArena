import { CalendarDays, Radio } from 'lucide-react';

export function EventStatusPanel() {
  return (
    <section className="panel event-status" aria-labelledby="event-status-title">
      <header className="panel-header"><h2 id="event-status-title"><span>//</span> Event Status</h2><span className="badge badge-cyan"><Radio size={12} aria-hidden="true" /> JUDGING IN PROGRESS</span></header>
      <div className="event-status-body">
        <div className="event-summary">
          <p className="metadata">CURRENT ARENA / 2026</p>
          <h3>DOGFOOD 2026</h3>
          <p>The builds are in. Every project deserves a fair review.</p>
          <span className="event-deadline"><CalendarDays size={14} aria-hidden="true" /> Review deadline · 30 Sep 2026, 18:00 UTC</span>
        </div>
        <div className="review-progress">
          <div className="progress-heading"><span className="metadata">REVIEW COMPLETION</span><strong>84<span>%</span></strong></div>
          <progress value={126} max={150} aria-label="Review completion: 126 of 150 reviews">84%</progress>
          <div className="progress-caption"><span>126 / 150 reviews submitted</span><span>24 remaining</span></div>
        </div>
      </div>
    </section>
  );
}
