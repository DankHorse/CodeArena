import { FormEvent, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

const projects = {
  'glass-signal': {
    title: 'Glass Signal',
    team: 'Northstar',
    track: 'Security',
    summary:
      'A shared fixture project assigned to this judge for independent review.',
  },
  'small-meadow': {
    title: 'Small Meadow',
    team: 'Greenframe',
    track: 'Climate',
    summary:
      'A shared fixture project assigned to this judge for independent review.',
  },
  'deep-compass': {
    title: 'Deep Compass',
    team: 'Vector Labs',
    track: 'Data and analytics',
    summary:
      'A shared fixture project assigned to this judge for independent review.',
  },
} as const;

type ProjectId = keyof typeof projects;

const criteria = [
  {
    key: 'functionality',
    title: 'FUNCTIONALITY',
    description: 'How effectively does the project work?',
  },
  {
    key: 'quality',
    title: 'QUALITY',
    description: 'How complete and well-executed is the project?',
  },
  {
    key: 'innovation',
    title: 'INNOVATION',
    description: 'How original or distinctive is the approach?',
  },
];

export function JudgeReviewPage() {
  const { projectId } = useParams();
  const [message, setMessage] = useState('');

  const project =
    projectId && projectId in projects
      ? projects[projectId as ProjectId]
      : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(
      'Review submission ready. Backend evaluation persistence will connect here.',
    );
  }

  function handleSaveDraft() {
    setMessage(
      'Review draft preview saved in the frontend only.',
    );
  }

  if (!project) {
    return (
      <section className="judge-review-missing">
        <p className="eyebrow">[ JUDGE / REVIEW ]</p>
        <h1>
          PROJECT NOT FOUND
          <span className="heading-period">.</span>
        </h1>

        <Link to="/judge/assignments">
          ← Return to assignments
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="judge-review-back">
        <Link to="/judge/assignments">
          <ArrowLeft size={15} aria-hidden="true" />
          Back to assignments
        </Link>
      </div>

      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ JUDGE / PROJECT REVIEW ]</p>

          <h1>
            {project.title.toUpperCase()}
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Score this project independently using the event rubric.
          </p>
        </div>

        <span className="badge badge-cyan">
          REVIEW OPEN
        </span>
      </section>

      <section className="review-project-panel">
        <div>
          <p className="metadata">PROJECT</p>
          <h2>{project.title}</h2>
          <p>{project.summary}</p>
        </div>

        <div className="review-project-meta">
          <div>
            <p className="metadata">TEAM</p>
            <strong>{project.team}</strong>
          </div>

          <div>
            <p className="metadata">TRACK</p>
            <strong>{project.track}</strong>
          </div>

          <button
            className="review-demo-button"
            type="button"
            disabled
            title="Project links will come from the backend"
          >
            Project links
            <ExternalLink size={15} aria-hidden="true" />
          </button>
        </div>
      </section>

      <section className="review-isolation-note">
        <ShieldCheck size={19} aria-hidden="true" />

        <div>
          <p className="metadata">INDEPENDENT REVIEW</p>
          <span>
            Other judges&apos; scores are not shown in this workspace.
          </span>
        </div>
      </section>

      <form className="review-form" onSubmit={handleSubmit}>
        <div className="review-form-heading">
          <div>
            <p className="metadata">SCORING / RUBRIC</p>
            <h2>EVALUATION</h2>
          </div>

          <span className="badge badge-cyan">DRAFT</span>
        </div>

        <div className="review-criteria-list">
          {criteria.map((criterion, index) => (
            <section
              className="review-criterion"
              key={criterion.key}
            >
              <div className="review-criterion-info">
                <span className="review-criterion-number">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <div>
                  <h3>{criterion.title}</h3>
                  <p>{criterion.description}</p>
                </div>
              </div>

              <label className="review-score-field">
                <span>SCORE / 10</span>

                <input
                  type="number"
                  name={criterion.key}
                  min="0"
                  max="10"
                  step="1"
                  placeholder="0"
                  required
                />
              </label>
            </section>
          ))}
        </div>

        <label className="review-comment-field">
          <span>OVERALL COMMENT</span>

          <textarea
            name="comment"
            rows={5}
            placeholder="Add concise judging feedback"
          />
        </label>

        <div className="review-actions">
          <div>
            <p className="metadata">REVIEW STATE</p>
            <strong>DRAFT / EDITABLE</strong>
            <span>
              Final authorization and persistence will be enforced by the backend.
            </span>
          </div>

          <div className="review-action-buttons">
            <button
              className="button submission-save-button"
              type="button"
              onClick={handleSaveDraft}
            >
              <Save size={16} aria-hidden="true" />
              Save draft
            </button>

            <button
              className="button button-primary"
              type="submit"
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              Submit review
            </button>
          </div>
        </div>
      </form>

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
