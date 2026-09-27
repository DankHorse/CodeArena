import { useLocation } from 'react-router-dom';
import { judgePath, judgeEventId } from '../../judge/navigation';
import { ArrowUpRight, ClipboardCheck, CheckCircle2, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useJudge } from '../../judge/JudgeProvider';
import { reviewCounts, statusLabel } from '../../judge/data';
import { paths } from '../../routes';
export function JudgeDashboard() {
  const eventId = judgeEventId(useLocation().search);
  const { snapshot } = useJudge();
  if (!snapshot) return null;
  const counts = reviewCounts(snapshot.reviews);
  const queue = [...snapshot.reviews].sort((a, b) => Number(['submitted','recused'].includes(a.assignment.status)) - Number(['submitted','recused'].includes(b.assignment.status))).slice(0, 3);
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ JUDGE WORKSPACE ]</p><h1>REVIEW DESK<span className="heading-period">.</span></h1><p className="workspace-description">Review your assigned projects independently and track your progress.</p></div><Link className="button button-primary" to={judgePath(paths.judge.assignments, eventId)}>View assignments <ArrowUpRight size={17} aria-hidden="true" /></Link></section>
    <section className="judge-status-panel"><div><span className="badge badge-cyan">{counts.remaining ? 'JUDGING IN PROGRESS' : counts.assigned ? 'REVIEWS COMPLETE' : 'NO ASSIGNMENTS'}</span><p className="metadata judge-status-label">CURRENT EVENT</p><h2>{snapshot.event?.name ?? 'No judge event available'}</h2><p>Only your own assigned reviews are visible in this workspace.</p></div><div className="judge-progress"><p className="metadata">YOUR REVIEW PROGRESS</p><strong>{counts.completed} / {counts.assigned}</strong><progress value={counts.completed} max={counts.assigned || 1} aria-label="Your review completion" /><p>{counts.remaining} reviews remaining</p></div></section>
    <div className="judge-metrics">{[{label:'ASSIGNED',value:counts.assigned,icon:ClipboardCheck},{label:'COMPLETED',value:counts.completed,icon:CheckCircle2},{label:'REMAINING',value:counts.remaining,icon:Clock3}].map(({label,value,icon:Icon}) => <article key={label}><Icon size={20} aria-hidden="true" /><p className="metadata">{label}</p><strong>{value}</strong></article>)}</div>
    <section className="judge-assignment-preview"><div className="judge-section-heading"><div><p className="metadata">CURRENT QUEUE</p><h2>ASSIGNED PROJECTS</h2></div><Link to={judgePath(paths.judge.assignments, eventId)}>VIEW ALL ↗</Link></div><div className="judge-assignment-list">{queue.map(review => <article className="judge-assignment-row" key={review.assignment.id}><div>{review.assignment.status === 'recused' ? <strong>{review.project.title}</strong> : <Link to={judgePath(paths.judge.review(review.project.id), eventId)}>{review.project.title} ↗</Link>}<p>{review.track}</p></div><span className="judge-assignment-status">{statusLabel(review.assignment.status)}</span></article>)}{!queue.length && <p className="team-message">No projects are assigned to you for this event.</p>}</div></section>
  </>;
}
