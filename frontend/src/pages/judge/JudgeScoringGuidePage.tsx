import { useLocation } from 'react-router-dom';
import { judgePath, judgeEventId } from '../../judge/navigation';
import { Link } from 'react-router-dom';
import { useJudge } from '../../judge/JudgeProvider';
import { paths } from '../../routes';
export function JudgeScoringGuidePage() {
  const eventId = judgeEventId(useLocation().search);
  const { snapshot } = useJudge();
  if (!snapshot) return null;
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ JUDGE / SCORING GUIDE ]</p><h1>SCORING GUIDE<span className="heading-period">.</span></h1><p className="workspace-description">Use this event rubric for every assigned review.</p></div><Link to={judgePath(paths.judge.assignments, eventId)}>← Assignments</Link></section>
    <section className="scoring-guide-notice"><div><p className="metadata">INDEPENDENT JUDGING</p><strong>Score the project based on your own evaluation.</strong><span>Other judges’ scores are not displayed.</span></div></section>
    <section className="scoring-guide-table"><div className="scoring-guide-header"><h2>{snapshot.event?.name ?? 'No event available'}</h2><span className="badge badge-cyan">{snapshot.rubric.length} CRITERIA</span></div><div className="scoring-guide-columns"><span>CRITERION</span><span>DESCRIPTION</span><span>WEIGHT</span><span>SCORE RANGE</span></div>{snapshot.rubric.map((criterion,index) => <article className="scoring-guide-row" key={criterion.id}><div className="scoring-guide-name"><span>{String(index+1).padStart(2,'0')}</span><strong>{criterion.name}</strong></div><p>{criterion.description}</p><strong className="scoring-guide-weight">{criterion.weight}%</strong><strong className="scoring-guide-max">0–{criterion.max_score}</strong></article>)}{!snapshot.rubric.length && <p className="team-message">No scoring rubric is available for this event.</p>}</section>
  </>;
}
