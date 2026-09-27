# DOGFOOD T2 judging

The T2 system scores submitted DOGFOOD `ProjectSubmission` records. It is
separate from CodeArena coding submissions and automated evaluation. The
current claimed and officially verified DOGFOOD tiers are **T1 and T2**.

## Rubrics and assignments

An event organizer creates a draft rubric with ordered criteria. Positions
must be unique and contiguous from zero; weights must be positive and total
exactly 100; each criterion has a positive maximum score. A rubric is
activated separately. Activated versions and their criteria are immutable,
and activation is blocked after project assignments exist. Assignments pin the
active rubric version so later rubric changes cannot alter existing work.

The event organizer enrolls an active participant account that is not
registered for that event as a judge, then assigns the judge to a submitted
project. Judge identity is event-scoped; it does not change the user's global
participant role. A project/judge pair can be assigned only once.

## Scoring and progress

Judges can save draft scores and feedback for their assigned projects. Scores
are raw values from zero through each criterion's `max_score`. Drafts may be
partial; the weighted result is absent until all criteria have scores.
Submitting requires every criterion and makes that evaluation immutable. The
server calculates the raw weighted percentage as:

`sum(score / max_score * criterion_weight)`

The derived value is between 0 and 100; clients cannot supply it. Raw
criterion scores and written feedback remain attached to the judge's
evaluation.

The organizer's progress endpoint returns total, completed, pending, and
in-progress assignment counts and completion percentages by judge. It does
not return scores or feedback.

## Normalization and snapshots

The implemented normalization method is **`judge_mean_center`, version
`1.0`**. For submitted evaluations in an event:

1. Compute each judge's mean weighted percentage.
2. Compute the grand mean across all submitted evaluations.
3. For each project/judge evaluation, calculate
   `adjusted = raw_weighted_percentage - judge_mean + grand_mean`.
4. Clamp each adjusted score to `[0, 100]`, then average adjusted scores per
   project.

Result calculations use decimal arithmetic and round half-up to four decimal
places. A snapshot also retains each project's unmodified raw-score average.
The method requires at least two judges and at least two submitted
evaluations per judge. When that condition is not met, recalculation persists
an `insufficient_data` snapshot with a reason and no invented normalized
values. Raw evaluations are never changed by normalization.

Snapshots are event-scoped and versioned. The results endpoint reports
`is_stale` when evaluations were submitted after the latest snapshot. When a
snapshot is stale, insufficient, or not yet calculated, CSV export includes
available raw weighted averages and evaluation counts, while rank and
normalized-score cells are blank. Stale data is labeled
`stale_snapshot_ignored`. Missing evaluations are never imputed.

Rows with normalized scores sort by normalized score descending, raw average
descending, project title, then project UUID. Equal normalized scores share a
rank; remaining keys provide deterministic display ordering.

## Backend role isolation and privacy

All authorization is enforced by the backend using the authenticated
HttpOnly-cookie identity and event-scoped records:

- Judges can read their own assignment details, rubric, and evaluation, and
  can save or submit only their own evaluations.
- `GET /api/v1/judging/scores` returns only the caller's own assignment
  scores. A `judge` query parameter is rejected; peer score access is denied
  or hidden as not found/forbidden.
- Participants without an active judge assignment cannot use judge routes.
- Event organizers can manage judging for their own event, see progress, and
  read aggregate results. They cannot read individual score sheets or
  feedback through organizer endpoints. A global admin does not gain
  management access to another organizer's event.
- Results and CSV are organizer-only. There is no public result publication
  endpoint in T2.

The CSV columns are stable and ordered:

`event_slug,event_title,rubric_version,normalization_method,rank,project_id,project_title,team_id,raw_average,normalized_score,completed_evaluations,submitted_at,repository_url,demo_url`

Formula-leading values beginning with `=`, `+`, `-`, or `@` (including after
leading spaces, tabs, or newlines) are prefixed with an apostrophe before CSV
quoting.

## Relevant routes

| Operation | Route | Access |
| --- | --- | --- |
| Create/list rubric versions | `POST/GET /api/v1/events/{event_id}/rubrics` | Event organizer |
| Activate a rubric version | `POST /api/v1/events/{event_id}/rubrics/{rubric_id}/activate` | Event organizer |
| Read active rubric | `GET /api/v1/events/{event_id}/rubric` | Organizer or active event judge |
| Enroll judge / assign project | `POST /api/v1/events/{event_id}/judges`, `/judge-assignments` | Event organizer |
| List own assignments | `GET /api/v1/events/{event_id}/judge-assignments/me` | Active event judge |
| Read/save/submit assigned evaluation | `GET/PUT /api/v1/judge-assignments/{assignment_id}/evaluation`, `POST .../submit` | Assigned judge |
| Read own scores | `GET /api/v1/judging/scores` | Active event judge |
| Progress | `GET /api/v1/events/{event_id}/judging/progress` | Event organizer |
| Recalculate/read results | `POST .../judging/results/recalculate`, `GET .../judging/results` | Event organizer |
| Export CSV | `GET /api/v1/events/{event_id}/judging/results.csv` | Event organizer |

The backend acceptance checker verifies own-score access, peer isolation,
participant denial, and organizer CSV export as part of the T2 checks.
