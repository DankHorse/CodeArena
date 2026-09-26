import { FormEvent, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileCode2,
  Github,
  Save,
} from 'lucide-react';

export function SubmissionPage() {
  const [message, setMessage] = useState('');

  function handleSaveDraft() {
    setMessage(
      'Draft preview saved in the frontend only. Backend persistence will connect here.',
    );
  }

  function handleSubmitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage(
      'Submission action ready. Backend deadline validation and submission will connect here.',
    );
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ PARTICIPANT / SUBMISSION ]</p>

          <h1>
            PROJECT SUBMISSION
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Build and manage your project submission before the deadline.
          </p>
        </div>

        <span className="badge badge-cyan">
          DRAFT
        </span>
      </section>

      <section className="submission-deadline-panel">
        <Clock3 size={20} aria-hidden="true" />

        <div>
          <p className="metadata">SUBMISSION WINDOW</p>
          <strong>OPEN</strong>
          <span>Deadline: 1 Mar 2026 · 18:00 UTC</span>
        </div>
      </section>

      <form className="submission-form" onSubmit={handleSubmitProject}>
        <section className="submission-panel">
          <div className="submission-panel-heading">
            <FileCode2 size={20} aria-hidden="true" />

            <div>
              <p className="metadata">PROJECT / DETAILS</p>
              <h2>PROJECT INFORMATION</h2>
            </div>
          </div>

          <div className="submission-fields">
            <label className="submission-field submission-field-wide">
              <span>PROJECT TITLE</span>

              <input
                type="text"
                name="title"
                placeholder="Enter project title"
                required
              />
            </label>

            <label className="submission-field submission-field-wide">
              <span>SUMMARY</span>

              <textarea
                name="summary"
                rows={5}
                placeholder="Describe what your project does"
                required
              />
            </label>

            <label className="submission-field">
              <span>TRACK</span>

              <select name="track" defaultValue="">
                <option value="" disabled>
                  Select track
                </option>
                <option value="developer-tools">Developer tools</option>
                <option value="data-analytics">Data and analytics</option>
                <option value="accessibility">Accessibility</option>
                <option value="security">Security</option>
                <option value="climate">Climate</option>
                <option value="health">Health</option>
                <option value="education">Education</option>
                <option value="open-hardware">Open hardware</option>
              </select>
            </label>

            <label className="submission-field">
              <span>REPOSITORY URL</span>

              <div className="submission-input-icon">
                <Github size={17} aria-hidden="true" />
                <input
                  type="url"
                  name="repoUrl"
                  placeholder="https://github.com/..."
                />
              </div>
            </label>

            <label className="submission-field submission-field-wide">
              <span>DEMO URL</span>

              <input
                type="url"
                name="demoUrl"
                placeholder="https://..."
              />
            </label>
          </div>
        </section>

        <section className="submission-actions">
          <div>
            <p className="metadata">CURRENT STATE</p>
            <strong>DRAFT / EDITABLE</strong>
            <span>
              Saving here is a frontend preview until the API is connected.
            </span>
          </div>

          <div className="submission-action-buttons">
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
              Submit project
            </button>
          </div>
        </section>
      </form>

      {message && (
        <p className="team-message" role="status">
          {message}
        </p>
      )}
    </>
  );
}
