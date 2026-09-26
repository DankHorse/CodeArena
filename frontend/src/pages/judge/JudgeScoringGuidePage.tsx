import { Info, Scale, ShieldCheck } from 'lucide-react';

const criteria = [
  {
    number: '01',
    name: 'FUNCTIONALITY',
    weight: '40%',
    maxScore: '10',
    description:
      'Evaluate how effectively the project works and whether the core experience is functional.',
  },
  {
    number: '02',
    name: 'QUALITY',
    weight: '30%',
    maxScore: '10',
    description:
      'Evaluate completeness, execution quality, usability and overall implementation.',
  },
  {
    number: '03',
    name: 'INNOVATION',
    weight: '30%',
    maxScore: '10',
    description:
      'Evaluate originality, distinctiveness and the strength of the project approach.',
  },
];

export function JudgeScoringGuidePage() {
  return (
    <>
      <section className="workspace-intro">
        <div>
          <p className="eyebrow">[ JUDGE / SCORING GUIDE ]</p>

          <h1>
            SCORING GUIDE
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Review the judging criteria and weights before evaluating projects.
          </p>
        </div>

        <span className="badge badge-cyan">
          3 CRITERIA
        </span>
      </section>

      <section className="scoring-guide-notice">
        <ShieldCheck size={20} aria-hidden="true" />

        <div>
          <p className="metadata">INDEPENDENT JUDGING</p>
          <strong>Score the project based on your own evaluation.</strong>
          <span>
            Other judges&apos; scores remain hidden while you review.
          </span>
        </div>
      </section>

      <section className="scoring-guide-table">
        <div className="scoring-guide-header">
          <div>
            <Scale size={20} aria-hidden="true" />

            <div>
              <p className="metadata">EVENT RUBRIC</p>
              <h2>DOGFOOD 2026</h2>
            </div>
          </div>

          <span className="badge badge-cyan">
            MAX / 30
          </span>
        </div>

        <div className="scoring-guide-columns">
          <span>CRITERION</span>
          <span>DESCRIPTION</span>
          <span>WEIGHT</span>
          <span>MAX SCORE</span>
        </div>

        {criteria.map((criterion) => (
          <article
            className="scoring-guide-row"
            key={criterion.name}
          >
            <div className="scoring-guide-name">
              <span>{criterion.number}</span>
              <strong>{criterion.name}</strong>
            </div>

            <p>{criterion.description}</p>

            <strong className="scoring-guide-weight">
              {criterion.weight}
            </strong>

            <strong className="scoring-guide-max">
              {criterion.maxScore}
            </strong>
          </article>
        ))}
      </section>

      <section className="scoring-guide-info">
        <Info size={19} aria-hidden="true" />

        <div>
          <p className="metadata">FRONTEND PREVIEW</p>
          <span>
            Rubric values will come from the event configuration when the backend API is connected.
          </span>
        </div>
      </section>
    </>
  );
}
