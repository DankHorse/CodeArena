import { DEMO } from '../../api';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SubmissionFields } from '../../participant/data';
import { CheckCircle2, Clock3, FileCode2, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useParticipant } from '../../participant/ParticipantProvider';
import { deadlineLabel } from '../../participant/data';
import { paths } from '../../routes';

export function SubmissionPage() {
  const { snapshot, locked, busy, saveSubmission } = useParticipant();
  const event = snapshot?.event;
  const team = snapshot?.team;
  const project = snapshot?.project;
  const [edits, setEdits] = useState<Partial<SubmissionFields>>({});
  useEffect(() => { setEdits({}); }, [event?.id, team?.id, project]);
  const fields: SubmissionFields = { title: project?.title ?? '', summary: project?.summary ?? '', repo_url: project?.repo_url ?? '', demo_url: project?.demo_url ?? '', track_id: '', ...edits };
  const control = (name: 'title' | 'summary' | 'repo_url' | 'demo_url', initial: string) => DEMO
    ? { defaultValue: initial }
    : { value: fields[name], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEdits(current => ({ ...current, [name]: e.target.value })) };
  const tracks = snapshot?.data.tracks.filter(track => track.event_id === event?.id) ?? [];
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const submit = submitter instanceof HTMLButtonElement && submitter.value === 'submit';
    if (!DEMO) {
      void saveSubmission({ ...fields, title: fields.title.trim(), summary: fields.summary.trim(), repo_url: fields.repo_url.trim(), demo_url: fields.demo_url.trim() }, submit);
      return;
    }
    const form = new FormData(event.currentTarget);
    void saveSubmission({ title: String(form.get('title') ?? '').trim(), summary: String(form.get('summary') ?? '').trim(), track_id: String(form.get('track') ?? ''), repo_url: String(form.get('repoUrl') ?? '').trim(), demo_url: String(form.get('demoUrl') ?? '').trim() }, submit);
  }
  if (!team || !event) return <section className="team-state-panel"><div><h1>TEAM REQUIRED.</h1><p>Create or join a team before creating a submission.</p><div className="public-actions"><Link className="button button-primary" to={paths.participant.team}>Create or join team ↗</Link><Link to={paths.participant.home}>← Dashboard</Link></div></div></section>;
  const state = !DEMO && project?.state === 'submitted' ? 'SUBMITTED' : locked ? 'LOCKED' : project?.state.toUpperCase() ?? 'NO SUBMISSION';
  return <>
    <section className="workspace-intro"><div><p className="eyebrow">[ PARTICIPANT / SUBMISSION ]</p><h1>PROJECT SUBMISSION<span className="heading-period">.</span></h1><p className="workspace-description">{team.name} / {event.name}</p></div><Link to={paths.participant.home}>← Dashboard</Link><span className="badge badge-cyan">{state}</span></section>
    <section className="submission-deadline-panel"><Clock3 size={20} aria-hidden="true" /><div><p className="metadata">SUBMISSION WINDOW</p><strong>{locked ? 'LOCKED' : 'OPEN'}</strong><span>Deadline: {deadlineLabel(event)}</span></div></section>
    <form className="submission-form" key={`${event.id}:${team.id}:${project?.id ?? 'new'}`} onSubmit={save} aria-busy={busy}>
      <fieldset className="participant-fieldset" disabled={locked || busy}>
        <section className="submission-panel"><div className="submission-panel-heading"><FileCode2 size={20} aria-hidden="true" /><div><p className="metadata">PROJECT / DETAILS</p><h2>PROJECT INFORMATION</h2></div></div>
          <div className="submission-fields">
            <label className="submission-field submission-field-wide"><span>PROJECT TITLE</span><input name="title" {...control('title', project?.title ?? '')} required placeholder="Enter project title" /></label>
            <label className="submission-field submission-field-wide"><span>SUMMARY</span><textarea name="summary" {...control('summary', project?.summary ?? '')} rows={5} placeholder="Describe what your project does" /></label>
            {DEMO && <label className="submission-field"><span>TRACK</span><select name="track" defaultValue={project?.track_id ?? ''}><option value="">Select track</option>{tracks.map(track => <option key={track.id} value={track.id}>{track.name}</option>)}</select></label>}
            <label className="submission-field"><span>REPOSITORY URL</span><input name="repoUrl" type="url" {...control('repo_url', project?.repo_url ?? '')} placeholder="https://github.com/..." /></label>
            <label className="submission-field submission-field-wide"><span>DEMO URL</span><input name="demoUrl" type="url" {...control('demo_url', project?.demo_url ?? '')} placeholder="https://..." /></label>
          </div>
        </section>
        <section className="submission-actions"><div><p className="metadata">CURRENT STATE</p><strong>{state} / {locked ? 'READ ONLY' : 'EDITABLE'}</strong><span>{locked ? (DEMO ? 'The deadline has passed or this project is locked.' : 'Read-only: editing requires an open event, a draft project and team captain access.') : !DEMO ? 'Only the captain can edit drafts. Submission requires a description and the minimum team size. Submitted projects are read-only.' : project?.state === 'submitted' ? 'Submitted. You may update your project until the deadline.' : 'Drafts are saved to your current team. Submission requires a summary, track and repository.'}</span></div><div className="submission-action-buttons"><button className="button submission-save-button" type="submit" value="draft"><Save size={16} aria-hidden="true" />{!DEMO && project?.state === 'submitted' ? 'Read only' : project?.state === 'submitted' ? 'Save changes' : 'Save draft'}</button><button className="button button-primary" type="submit" value="submit"><CheckCircle2 size={16} aria-hidden="true" />{!DEMO && project?.state === 'submitted' ? 'Submitted' : busy ? 'Saving…' : project?.state === 'submitted' ? 'Update submission' : 'Submit project'}</button></div></section>
      </fieldset>
    </form>
  </>;
}
