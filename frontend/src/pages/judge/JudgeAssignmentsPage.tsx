import { Link } from 'react-router-dom';
import { useJudge } from '../../judge/JudgeProvider';
import { reviewCounts, statusLabel } from '../../judge/data';
import { paths } from '../../routes';
export function JudgeAssignmentsPage() {
  const { snapshot } = useJudge();
  if (!snapshot) return null;
  const counts = reviewCounts(snapshot.reviews);
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ JUDGE / ASSIGNMENTS ]</p><h1>ASSIGNMENTS<span className="heading-period">.</span></h1><p className="workspace-description">Your judging queue for {snapshot.event?.name ?? 'this event'}.</p></div></section>
    <section className="assignment-summary">{[{label:'ASSIGNED',value:counts.assigned},{label:'IN PROGRESS',value:counts.inProgress},{label:'COMPLETED',value:counts.completed},{label:'REMAINING',value:counts.remaining}].map(item => <article key={item.label}><p className="metadata">{item.label}</p><strong>{item.value}</strong></article>)}</section>
    {counts.recused > 0 && <p className="team-message">{counts.recused} recused assignments excluded from active totals.</p>}
    <section className="assignment-table"><div className="assignment-table-header"><span>PROJECT</span><span>TEAM</span><span>TRACK</span><span>STATUS</span><span>ACTION</span></div>
      {snapshot.reviews.map(({assignment,project,team,track}) => <article className="assignment-table-row" key={assignment.id}><strong>{project.title}</strong><span>{team}</span><span>{track}</span><span className="assignment-status">{statusLabel(assignment.status)}</span>{assignment.status === 'recused' ? <span>Unavailable</span> : <Link className="assignment-review-link" to={paths.judge.review(project.id)}>{assignment.status === 'submitted' ? 'View completed review' : assignment.status === 'in_progress' ? 'Continue review' : 'Start review'} ↗</Link>}</article>)}
      {!snapshot.reviews.length && <p className="team-message">No assignments for this event.</p>}
    </section>
  </>;
}
