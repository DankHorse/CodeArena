import { Save, Scale } from 'lucide-react';
import { FormEvent, useState } from 'react';

const initialCriteria = [
  {
    id: 'functionality',
    name: 'Functionality',
    description: 'How effectively does the project work?',
    weight: 40,
    maxScore: 10,
  },
  {
    id: 'quality',
    name: 'Quality',
    description: 'How complete and well-executed is the project?',
    weight: 30,
    maxScore: 10,
  },
  {
    id: 'innovation',
    name: 'Innovation',
    description: 'How original or distinctive is the approach?',
    weight: 30,
    maxScore: 10,
  },
];

export function OrganizerRubricPage() {
  const [criteria, setCriteria] = useState(initialCriteria);
  const [message, setMessage] = useState('');

  const totalWeight = criteria.reduce(
    (total, criterion) => total + criterion.weight,
    0,
  );

  function updateCriterion(
    id: string,
    field: 'weight' | 'maxScore',
    value: number,
  ) {
    setCriteria((current) =>
      current.map((criterion) =>
        criterion.id === id
          ? { ...criterion, [field]: value }
          : criterion,
      ),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (totalWeight !== 100) {
      setMessage('Rubric weights must total 100%.');
      return;
    }

    setMessage(
      'Rubric preview saved. Backend rubric persistence will connect here.',
    );
  }

  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ ORGANIZER / RUBRIC ]</p>

          <h1>
            SCORING RUBRIC
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Configure judging criteria, weights and score ranges.
          </p>
        </div>

        <span
          className={
            totalWeight === 100
              ? 'badge badge-cyan'
              : 'organizer-rubric-warning'
          }
        >
          WEIGHT / {totalWeight}%
        </span>
      </section>

      <form className="organizer-rubric-form" onSubmit={handleSubmit}>
        <section className="organizer-rubric-card">
          <header className="organizer-rubric-title">
            <div>
              <Scale size={20} aria-hidden="true" />

              <div>
                <p className="metadata">EVENT RUBRIC</p>
                <h2>DOGFOOD 2026</h2>
              </div>
            </div>

            <span className="badge badge-cyan">
              {criteria.length} CRITERIA
            </span>
          </header>

          <div className="organizer-rubric-columns">
            <span>CRITERION</span>
            <span>DESCRIPTION</span>
            <span>WEIGHT %</span>
            <span>MAX SCORE</span>
          </div>

          {criteria.map((criterion, index) => (
            <article
              className="organizer-rubric-row"
              key={criterion.id}
            >
              <div className="organizer-rubric-name">
                <span>
                  {String(index + 1).padStart(2, '0')}
                </span>

                <strong>
                  {criterion.name.toUpperCase()}
                </strong>
              </div>

              <p>{criterion.description}</p>

              <label className="organizer-rubric-input">
                <span className="sr-only">
                  {criterion.name} weight
                </span>

                <input
                  type="number"
                  min="0"
                  max="100"
                  value={criterion.weight}
                  onChange={(event) =>
                    updateCriterion(
                      criterion.id,
                      'weight',
                      Number(event.target.value),
                    )
                  }
                  onBlur={(event) => {
                    event.currentTarget.value = String(
                      Number(event.currentTarget.value),
                    );
                  }}
                />
              </label>

              <label className="organizer-rubric-input">
                <span className="sr-only">
                  {criterion.name} maximum score
                </span>

                <input
                  type="number"
                  min="1"
                  max="100"
                  value={criterion.maxScore}
                  onChange={(event) =>
                    updateCriterion(
                      criterion.id,
                      'maxScore',
                      Number(event.target.value),
                    )
                  }
                  onBlur={(event) => {
                    event.currentTarget.value = String(
                      Number(event.currentTarget.value),
                    );
                  }}
                />
              </label>
            </article>
          ))}
        </section>

        <section className="organizer-rubric-footer">
          <div>
            <p className="metadata">TOTAL WEIGHT</p>

            <strong
              className={
                totalWeight === 100
                  ? 'rubric-total-valid'
                  : 'rubric-total-invalid'
              }
            >
              {totalWeight}%
            </strong>

            <span>
              Criterion weights must total exactly 100%.
            </span>
          </div>

          <button
            className="button button-primary"
            type="submit"
          >
            <Save size={16} aria-hidden="true" />
            Save rubric
          </button>
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
