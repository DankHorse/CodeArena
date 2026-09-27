import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Save, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useJudge } from '../../judge/JudgeProvider';
import { paths } from '../../routes';
export function JudgeReviewPage() {
  const { projectId } = useParams();
  const { snapshot, busy, save } = useJudge();
  const review = snapshot?.reviews.find(review => review.project.id === projectId);
  if (!review || review.assignment.status === 'recused') return <section className="judge-review-missing"><p className="eyebrow">[ JUDGE / REVIEW ]</p><h1>REVIEW UNAVAILABLE.</h1><p>{review ? 'You have recused yourself from this assignment.' : 'This project is not assigned to you in the current event.'}</p><Link to={paths.judge.assignments}>← Return to assignments</Link></section>;
  const { project, assignment, evaluation } = review;
  const rubric = snapshot?.rubric ?? [];
  const locked = assignment.status === 'submitted';
  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const submit = submitter instanceof HTMLButtonElement && submitter.value === 'submit';
    const scores: Record<string, number> = {};
    for (const criterion of rubric) {
      const value = form.get(criterion.id);
      if (typeof value === 'string' && value.trim() !== '') scores[criterion.id] = Number(value);
    }
    void save(project.id, scores, String(form.get('comment') ?? ''), submit);
  }
  return <>
    <div className="judge-review-back"><Link to={paths.judge.assignments}>← Back to assignments</Link></div>
    <section className="workspace-intro"><div><p className="eyebrow">[ JUDGE / PROJECT REVIEW ]</p><h1>{project.title.toUpperCase()}<span className="heading-period">.</span></h1><p className="workspace-description">Score this project independently using the event rubric.</p></div><span className="badge badge-cyan">{locked ? 'COMPLETED / LOCKED' : 'REVIEW OPEN'}</span></section>
    <section className="review-project-panel"><div><p className="metadata">PROJECT</p><h2>{project.title}</h2><p>{project.summary}</p></div><div className="review-project-meta"><div><p className="metadata">TEAM</p><strong>{review.team}</strong></div><div><p className="metadata">TRACK</p><strong>{review.track}</strong></div>{project.repo_url && /^https?:\/\//i.test(project.repo_url) && <a className="review-demo-button" href={project.repo_url} target="_blank" rel="noopener noreferrer">Repository ↗</a>}</div></section>
    <section className="review-isolation-note"><ShieldCheck size={19} aria-hidden="true" /><div><p className="metadata">INDEPENDENT REVIEW</p><span>Only your own evaluation is shown.</span></div><Link to={paths.judge.rubric}>Scoring guide ↗</Link></section>
    <form className="review-form" key={assignment.id} onSubmit={handleSave} aria-busy={busy}>
      <div className="review-form-heading"><h2>EVALUATION</h2><span className="badge badge-cyan">{locked ? 'COMPLETED' : assignment.status === 'in_progress' ? 'IN PROGRESS' : 'DRAFT'}</span></div>
      <fieldset className="judge-review-fields" disabled={locked || busy || !rubric.length}>
        <div className="review-criteria-list">{rubric.map((criterion,index) => <section className="review-criterion" key={criterion.id}><div className="review-criterion-info"><span className="review-criterion-number">{String(index+1).padStart(2,'0')}</span><div><h3>{criterion.name}</h3><p>{criterion.description}</p><p className="metadata">WEIGHT / {criterion.weight}%</p></div></div><label className="review-score-field"><span>{criterion.name} / 0–{criterion.max_score}</span><input type="number" name={criterion.id} min={0} max={criterion.max_score} step="any" defaultValue={evaluation?.scores[criterion.id] ?? ''} placeholder="—" /></label></section>)}</div>
        <label className="review-comment-field"><span>OVERALL COMMENT</span><textarea name="comment" rows={5} defaultValue={evaluation?.comment ?? ''} placeholder="Add concise judging feedback" /></label>
        <div className="review-actions"><div><p className="metadata">REVIEW STATE</p><strong>{locked ? 'COMPLETED / LOCKED' : 'DRAFT / EDITABLE'}</strong><span>{locked ? 'Submitted evaluations cannot be changed.' : 'Score every criterion to submit. Partial drafts can be saved.'}</span></div>{!locked && <div className="review-action-buttons"><button className="button submission-save-button" type="submit" value="draft"><Save size={16} aria-hidden="true" />Save draft</button><button className="button button-primary" type="submit" value="submit"><CheckCircle2 size={16} aria-hidden="true" />{busy ? 'Saving…' : 'Submit review'}</button></div>}</div>
      </fieldset>
      {!rubric.length && <p className="team-message">The scoring rubric is unavailable. Review actions are disabled.</p>}
    </form>
  </>;
}
