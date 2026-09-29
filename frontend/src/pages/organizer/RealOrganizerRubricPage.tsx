import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ChangeEvent,
  FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  CopyPlus,
  Layers3,
  LockKeyhole,
  Plus,
  RotateCcw,
  Scale,
  Trash2,
} from 'lucide-react';

import { useOrganizer } from '../../organizer/OrganizerProvider';
import { errorMessage } from '../../auth/types';
import {
  activateRealRubric,
  createRealRubricVersion,
  loadRealOrganizerT2,
} from '../../organizer/realT2Data';

import { rubricFormInput } from '../../organizer/rubricForm';

import type {
  RealOrganizerT2Snapshot,
  RealRubric,
} from '../../organizer/realT2Data';

function weightTone(total: number) {
  if (Math.abs(total - 100) < 0.0001) return 'complete';
  if (total > 100) return 'over';
  return 'incomplete';
}

export function RealOrganizerRubricPage() {
  const { snapshot } = useOrganizer();
  const event = snapshot?.event;

  const [data, setData] =
    useState<RealOrganizerT2Snapshot | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [count, setCount] = useState(1);
  const [formKey, setFormKey] = useState(0);

  const [weights, setWeights] =
    useState<string[]>(['']);

  const [draft, setDraft] = useState({
    title: '',
    criteria: [
      {
        name: '',
        description: '',
        weight: '',
        maxScore: '',
      },
    ],
  });

  const generation = useRef(0);
  const pending = useRef(false);

  async function reload() {
    if (!event) return;

    const token = ++generation.current;

    setLoading(true);
    setData(null);

    try {
      const next = await loadRealOrganizerT2(event.id);

      if (generation.current === token) {
        setData(next);
      }
    } finally {
      if (generation.current === token) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void reload().catch(error =>
      setError(errorMessage(error)),
    );

    return () => {
      generation.current++;
    };
  }, [event?.id]);

  async function run(
    action: () => Promise<RealRubric>,
    success: string,
  ) {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError('');
    setMessage('');

    let saved = false;

    try {
      await action();
      saved = true;

      await reload();

      setMessage(success);
    } catch (error) {
      setError(
        `${
          saved
            ? 'Operation succeeded, but refreshing rubrics failed. Retry loading before another action. '
            : ''
        }${errorMessage(error)}`,
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function create(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (!event) return;

    try {
      const input = rubricFormInput(
        new FormData(e.currentTarget),
        count,
      );

      void run(
        () =>
          createRealRubricVersion(
            event.id,
            input,
          ),
        'New draft version created. Activate it separately.',
      );
    } catch (error) {
      setMessage('');
      setError(errorMessage(error));
    }
  }

  function addCriterion() {
    if (count >= 50) return;

    setCount(current => current + 1);

    setWeights(current => [
      ...current,
      '',
    ]);

    setDraft(current => ({
      ...current,
      criteria: [
        ...current.criteria,
        {
          name: '',
          description: '',
          weight: '',
          maxScore: '',
        },
      ],
    }));
  }

  function removeCriterion() {
    if (count <= 1) return;

    setCount(current => current - 1);

    setWeights(current =>
      current.slice(0, -1),
    );

    setDraft(current => ({
      ...current,
      criteria: current.criteria.slice(0, -1),
    }));
  }

  function updateWeight(
    index: number,
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const value = event.target.value;

    setWeights(current => {
      const next = [...current];

      next[index] = value;

      return next;
    });

    setDraft(current => ({
      ...current,
      criteria: current.criteria.map(
        (criterion, criterionIndex) =>
          criterionIndex === index
            ? {
                ...criterion,
                weight: value,
              }
            : criterion,
      ),
    }));
  }

  function clearEditor() {
    setCount(1);
    setWeights(['']);

    setDraft({
      title: '',
      criteria: [
        {
          name: '',
          description: '',
          weight: '',
          maxScore: '',
        },
      ],
    });

    setFormKey(current => current + 1);
    setError('');
    setMessage('');
  }

  const weightTotal = useMemo(
    () =>
      weights.reduce(
        (total, value) => {
          const numeric = Number(value);

          return Number.isFinite(numeric)
            ? total + numeric
            : total;
        },
        0,
      ),
    [weights],
  );

  if (!event) {
    return (
      <section className="team-state-panel">
        <p>
          Select or create an organizer event first.
        </p>

        <Link to="/organizer/events">
          Event settings ↗
        </Link>
      </section>
    );
  }

  const active =
    data?.activeRubric.state === 'available'
      ? data.activeRubric.data
      : null;

  const alternatives =
    data?.rubrics.filter(
      rubric => rubric.id !== active?.id,
    ) ?? [];

  const assignmentCount =
    data?.progress.total_assignments ?? 0;

  const activationLocked =
    assignmentCount > 0;

  function cloneActiveRubric() {
    if (!active) return;

    const criteria = active.criteria.map(
      criterion => ({
        name: criterion.name,
        description:
          criterion.description ?? '',
        weight: String(criterion.weight),
        maxScore: String(
          criterion.max_score,
        ),
      }),
    );

    setCount(criteria.length);

    setWeights(
      criteria.map(
        criterion => criterion.weight,
      ),
    );

    setDraft({
      title: `${active.title} copy`,
      criteria,
    });

    setFormKey(current => current + 1);

    setError('');
    setMessage(
      `Active rubric V${active.version} copied into the workbench. Creating it will make a new draft version.`,
    );

    window.setTimeout(() => {
      document
        .querySelector('.rubric-builder')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
    }, 50);
  }

  return (
    <div className="rubric-console">
      <section className="workspace-intro rubric-console-intro">
        <div>
          <p className="eyebrow">
            [ ORGANIZER / SCORING SYSTEM ]
          </p>

          <h1>
            SCORING RUBRIC
            <span className="heading-period">.</span>
          </h1>

          <p className="workspace-description">
            Configure versioned judging criteria
            and control the active scoring system
            for {event.name}.
          </p>
        </div>

        <div className="rubric-console-actions">
          <div className="rubric-console-state">
            <div>
              <span>SYSTEM</span>

              <strong>
                {loading
                  ? 'SYNCING'
                  : active
                    ? 'ACTIVE'
                    : 'NO ACTIVE RUBRIC'}
              </strong>
            </div>

            <div>
              <span>VERSIONS</span>

              <strong>
                {data?.rubrics.length ?? '—'}
              </strong>
            </div>
          </div>

          <button
            className="button button-secondary rubric-sync-button"
            type="button"
            disabled={busy || loading}
            onClick={() => {
              setError('');

              void reload().catch(error =>
                setError(
                  errorMessage(error),
                ),
              );
            }}
          >
            <RotateCcw
              size={14}
              aria-hidden="true"
            />

            Sync rubrics
          </button>
        </div>
      </section>

      <section className="rubric-system-note">
        <Activity
          size={18}
          aria-hidden="true"
        />

        <p>
          Draft versions are independent.
          Activation is locked by the backend once
          project assignments exist. Active versions
          are not edited in place.
        </p>
      </section>

      {error && (
        <p
          role="alert"
          className="team-message"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="team-message"
        >
          {message}
        </p>
      )}

      {loading ? (
        <section className="rubric-loading">
          <span className="arena-live-dot" />

          <div>
            <p className="metadata">
              SCORING SYSTEM
            </p>

            <strong>
              SYNCHRONIZING RUBRIC VERSIONS
            </strong>
          </div>
        </section>
      ) : (
        data && (
          <>
            <section className="rubric-active-console rubric-command-deck">
              <header>
                <div>
                  <p className="metadata">
                    ACTIVE SCORING MODEL
                  </p>

                  <h2>
                    {active
                      ? `${active.title} / V${active.version}`
                      : 'NO ACTIVE RUBRIC'}
                  </h2>
                </div>

                <div className="rubric-active-badge">
                  <CheckCircle2
                    size={16}
                    aria-hidden="true"
                  />

                  {active
                    ? 'ACTIVE'
                    : 'REQUIRED'}
                </div>
              </header>

              {active ? (
                <RubricDetails
                  rubric={active}
                  featured
                />
              ) : (
                <div className="rubric-empty-active">
                  <Scale
                    size={28}
                    aria-hidden="true"
                  />

                  <div>
                    <strong>
                      SCORING SYSTEM NOT ACTIVE
                    </strong>

                    <p>
                      Create a draft rubric below,
                      then activate it before
                      assigning projects to judges.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="rubric-version-console">
              <header className="rubric-console-heading">
                <div>
                  <p className="metadata">
                    VERSION REGISTRY
                  </p>

                  <h2>
                    AVAILABLE VERSIONS
                  </h2>
                </div>

                <Layers3
                  size={20}
                  aria-hidden="true"
                />
              </header>

              {alternatives.length ? (
                <div className="rubric-version-grid">
                  {alternatives.map(rubric => (
                    <article
                      className="rubric-version-card"
                      key={rubric.id}
                    >
                      <div className="rubric-version-card-top">
                        <span>
                          VERSION{' '}
                          {String(
                            rubric.version,
                          ).padStart(
                            2,
                            '0',
                          )}
                        </span>

                        <span
                          className={`rubric-version-status ${
                            rubric.status ===
                            'draft'
                              ? 'is-draft'
                              : ''
                          }`}
                        >
                          {rubric.status.toUpperCase()}
                        </span>
                      </div>

                      <h3>{rubric.title}</h3>

                      <div className="rubric-version-stats">
                        <div>
                          <span>CRITERIA</span>

                          <strong>
                            {
                              rubric.criteria
                                .length
                            }
                          </strong>
                        </div>

                        <div>
                          <span>TOTAL WEIGHT</span>

                          <strong>
                            {rubric.criteria.reduce(
                              (
                                sum,
                                criterion,
                              ) =>
                                sum +
                                criterion.weight,
                              0,
                            )}
                            %
                          </strong>
                        </div>
                      </div>

                      {rubric.status ===
                        'draft' && (
                        activationLocked ? (
                          <div className="rubric-activation-locked">
                            <div>
                              <LockKeyhole
                                size={17}
                                aria-hidden="true"
                              />

                              <div>
                                <strong>
                                  ACTIVATION LOCKED
                                </strong>

                                <span>
                                  {assignmentCount} project assignments
                                  already exist. Rubric versions cannot
                                  be switched after judging assignments
                                  begin.
                                </span>
                              </div>
                            </div>

                            <button
                              className="button button-primary"
                              type="button"
                              disabled
                            >
                              Locked after assignments
                            </button>
                          </div>
                        ) : (
                          <button
                            className="button button-primary"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () =>
                                  activateRealRubric(
                                    event.id,
                                    rubric.id,
                                  ),
                                'Rubric activation confirmed by the backend.',
                              )
                            }
                          >
                            Activate V
                            {rubric.version} ↗
                          </button>
                        )
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rubric-version-empty">
                  <span>00</span>

                  <div>
                    <strong>
                      NO ADDITIONAL VERSIONS
                    </strong>

                    <p>
                      The active rubric is currently
                      the only registered version.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <form
              className="rubric-builder"
              onSubmit={create}
              key={formKey}
              aria-busy={busy}
            >
              <fieldset
                className="organizer-fields"
                disabled={busy}
              >
                <section className="rubric-builder-shell">
                  <header className="rubric-builder-header">
                    <div>
                      <p className="metadata">
                        NEW SCORING MODEL
                      </p>

                      <h2>
                        CREATE NEW VERSION
                      </h2>

                      <p>
                        Build a new immutable draft
                        without altering the active
                        rubric.
                      </p>
                    </div>

                    <div className="rubric-builder-header-actions">
                      {active && (
                        <button
                          className="button button-secondary rubric-clone-button"
                          type="button"
                          onClick={cloneActiveRubric}
                        >
                          <CopyPlus
                            size={15}
                            aria-hidden="true"
                          />

                          Clone active
                        </button>
                      )}

                      <Scale
                        size={22}
                        aria-hidden="true"
                      />
                    </div>
                  </header>

                  <div className="rubric-builder-overview">
                    <label className="event-field">
                      <span>RUBRIC TITLE</span>

                      <input
                        name="title"
                        required
                        maxLength={160}
                        placeholder="e.g. Finals judging rubric"
                        value={draft.title}
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div
                      className={`rubric-weight-console is-${weightTone(
                        weightTotal,
                      )}`}
                    >
                      <div className="rubric-weight-console-head">
                        <div>
                          <span>
                            WEIGHT DISTRIBUTION
                          </span>

                          <strong>
                            {weightTotal.toFixed(
                              weightTotal % 1
                                ? 1
                                : 0,
                            )}
                            %
                          </strong>
                        </div>

                        <span>
                          {Math.abs(
                            weightTotal - 100,
                          ) < 0.0001
                            ? 'VALID'
                            : weightTotal > 100
                              ? 'OVER LIMIT'
                              : `${(
                                  100 -
                                  weightTotal
                                ).toFixed(
                                  1,
                                )}% REMAINING`}
                        </span>
                      </div>

                      <div
                        className="rubric-weight-track"
                        aria-label={`Rubric weight total ${weightTotal}%`}
                      >
                        <span
                          style={{
                            width: `${Math.min(
                              Math.max(
                                weightTotal,
                                0,
                              ),
                              100,
                            )}%`,
                          }}
                        />
                      </div>

                      <p>
                        Backend validation requires
                        all criterion weights to total
                        exactly 100%.
                      </p>
                    </div>
                  </div>

                  <div className="rubric-builder-list">
                    {Array.from(
                      { length: count },
                      (_, index) => (
                        <fieldset
                          className="rubric-builder-criterion"
                          key={index}
                        >
                          <legend>
                            <span>
                              CRITERION{' '}
                              {String(
                                index + 1,
                              ).padStart(
                                2,
                                '0',
                              )}
                            </span>
                          </legend>

                          <div className="rubric-builder-criterion-grid">
                            <label className="event-field">
                              <span>NAME</span>

                              <input
                                name={`name-${index}`}
                                required
                                maxLength={120}
                                value={
                                  draft.criteria[index]
                                    ?.name ?? ''
                                }
                                onChange={event =>
                                  setDraft(current => ({
                                    ...current,
                                    criteria:
                                      current.criteria.map(
                                        (
                                          criterion,
                                          criterionIndex,
                                        ) =>
                                          criterionIndex ===
                                          index
                                            ? {
                                                ...criterion,
                                                name:
                                                  event
                                                    .target
                                                    .value,
                                              }
                                            : criterion,
                                      ),
                                  }))
                                }
                              />
                            </label>

                            <label className="event-field">
                              <span>
                                WEIGHT %
                              </span>

                              <input
                                name={`weight-${index}`}
                                type="number"
                                min="0.0001"
                                max="100"
                                step="0.0001"
                                placeholder="e.g. 40"
                                required
                                value={
                                  weights[
                                    index
                                  ] ?? ''
                                }
                                onChange={event =>
                                  updateWeight(
                                    index,
                                    event,
                                  )
                                }
                              />
                            </label>

                            <label className="event-field">
                              <span>
                                MAX SCORE
                              </span>

                              <input
                                name={`max-${index}`}
                                type="number"
                                min="0.001"
                                max="99999.999"
                                step="0.001"
                                required
                                value={
                                  draft.criteria[index]
                                    ?.maxScore ?? ''
                                }
                                onChange={event =>
                                  setDraft(current => ({
                                    ...current,
                                    criteria:
                                      current.criteria.map(
                                        (
                                          criterion,
                                          criterionIndex,
                                        ) =>
                                          criterionIndex ===
                                          index
                                            ? {
                                                ...criterion,
                                                maxScore:
                                                  event
                                                    .target
                                                    .value,
                                              }
                                            : criterion,
                                      ),
                                  }))
                                }
                              />
                            </label>

                            <label className="event-field rubric-description-field">
                              <span>
                                DESCRIPTION
                              </span>

                              <textarea
                                name={`description-${index}`}
                                maxLength={4000}
                                rows={3}
                                value={
                                  draft.criteria[index]
                                    ?.description ?? ''
                                }
                                onChange={event =>
                                  setDraft(current => ({
                                    ...current,
                                    criteria:
                                      current.criteria.map(
                                        (
                                          criterion,
                                          criterionIndex,
                                        ) =>
                                          criterionIndex ===
                                          index
                                            ? {
                                                ...criterion,
                                                description:
                                                  event
                                                    .target
                                                    .value,
                                              }
                                            : criterion,
                                      ),
                                  }))
                                }
                              />
                            </label>
                          </div>
                        </fieldset>
                      ),
                    )}
                  </div>

                  <div className="rubric-builder-controls">
                    <div>
                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={count >= 50}
                        onClick={addCriterion}
                      >
                        <Plus
                          size={15}
                          aria-hidden="true"
                        />

                        Add criterion
                      </button>

                      <button
                        className="button button-secondary"
                        type="button"
                        disabled={count <= 1}
                        onClick={removeCriterion}
                      >
                        <Trash2
                          size={15}
                          aria-hidden="true"
                        />

                        Remove last
                      </button>

                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={clearEditor}
                      >
                        <RotateCcw
                          size={15}
                          aria-hidden="true"
                        />

                        Clear
                      </button>
                    </div>

                    <div className="rubric-create-action">
                      {Math.abs(weightTotal - 100) >= 0.0001 && (
                        <span className="rubric-create-requirement">
                          WEIGHTS MUST TOTAL 100% / CURRENT {weightTotal.toFixed(4)}%
                        </span>
                      )}

                      <button
                        className="button button-primary"
                        type="submit"
                        disabled={
                          busy ||
                          Math.abs(
                            weightTotal - 100,
                          ) >= 0.0001
                        }
                      >
                        {busy
                          ? 'Creating…'
                          : Math.abs(weightTotal - 100) >= 0.0001
                            ? 'Complete 100% weighting'
                            : 'Create version ↗'}
                      </button>
                    </div>
                  </div>
                </section>
              </fieldset>
            </form>
          </>
        )
      )}
    </div>
  );
}

function RubricDetails({
  rubric,
  featured = false,
}: {
  rubric: RealRubric;
  featured?: boolean;
}) {
  const totalWeight =
    rubric.criteria.reduce(
      (sum, criterion) =>
        sum + criterion.weight,
      0,
    );

  return (
    <div
      className={[
        'rubric-blueprint',
        featured ? 'is-featured' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="rubric-blueprint-head">
        <div className="rubric-blueprint-title">
          <span className="rubric-blueprint-code">
            RB / V{rubric.version}
          </span>

          <div>
            <p className="metadata">
              JUDGING SPECIFICATION
            </p>

            <h3>{rubric.title}</h3>

            <p>
              {rubric.criteria.length} scoring
              criteria define the current evaluation
              model.
            </p>
          </div>
        </div>

        <div className="rubric-blueprint-meta">
          <div>
            <span>STATUS</span>
            <strong>
              {rubric.status.toUpperCase()}
            </strong>
          </div>

          <div>
            <span>CRITERIA</span>
            <strong>
              {rubric.criteria.length}
            </strong>
          </div>

          <div>
            <span>TOTAL</span>
            <strong>
              {totalWeight}%
            </strong>
          </div>
        </div>
      </div>

      <div className="rubric-weight-map">
        <div className="rubric-weight-map-header">
          <span>WEIGHT DISTRIBUTION</span>

          <strong>
            {Math.abs(totalWeight - 100) < 0.0001
              ? 'VALID / 100%'
              : `${totalWeight}% TOTAL`}
          </strong>
        </div>

        <div
          className="rubric-weight-spectrum"
          aria-label={`Rubric total weight ${totalWeight}%`}
        >
          {rubric.criteria.map(
            criterion => (
              <span
                key={criterion.id}
                style={{
                  width: `${Math.max(
                    criterion.weight,
                    1,
                  )}%`,
                }}
              />
            ),
          )}
        </div>

        <div className="rubric-weight-legend">
          {rubric.criteria.map(
            (criterion, index) => (
              <div key={criterion.id}>
                <span>
                  {String(index + 1).padStart(
                    2,
                    '0',
                  )}
                </span>

                <strong>
                  {criterion.name}
                </strong>

                <em>
                  {criterion.weight}%
                </em>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="rubric-spec-table">
        <div className="rubric-spec-header">
          <span>ID</span>
          <span>CRITERION</span>
          <span>MAX SCORE</span>
          <span>WEIGHT</span>
        </div>

        {rubric.criteria.map(
          (criterion, index) => (
            <article
              className="rubric-spec-row"
              key={criterion.id}
            >
              <div className="rubric-spec-index">
                {String(index + 1).padStart(
                  2,
                  '0',
                )}
              </div>

              <div className="rubric-spec-copy">
                <h4>
                  {criterion.name}
                </h4>

                {criterion.description && (
                  <p>
                    {criterion.description}
                  </p>
                )}

                <div className="rubric-spec-line">
                  <span
                    style={{
                      width: `${Math.min(
                        criterion.weight,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="rubric-spec-score">
                <span>MAX</span>

                <strong>
                  {criterion.max_score}
                </strong>
              </div>

              <div className="rubric-spec-weight">
                <strong>
                  {criterion.weight}
                </strong>

                <span>%</span>
              </div>
            </article>
          ),
        )}
      </div>

      <div className="rubric-blueprint-footer">
        <span>
          VERSION / V{rubric.version}
        </span>

        <span>
          STATUS / {rubric.status.toUpperCase()}
        </span>

        <span>
          TOTAL WEIGHT / {totalWeight}%
        </span>

        <span>
          MODEL / VALIDATED BY BACKEND
        </span>
      </div>
    </div>
  );
}
