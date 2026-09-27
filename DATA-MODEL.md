# Data model

PostgreSQL is accessed through SQLAlchemy models and Alembic migrations. UUIDs
identify application records; timestamp columns use timezone-aware values.
This overview describes the current model, not a separate proposed schema.

## Identity and events

- `users` stores unique email, password hash, display name, active flag, and
  global role (`participant`, `organizer`, or `admin`).
- `events` belongs to an organizer and stores its lifecycle status, schedule,
  slug, and per-event team size limits.
- `event_registrations` links a user to an event, unique by event/user.
- `event_tracks` stores event-local tracks used by fixture projects.
- `teams` belongs to one event and has a registered captain.
- `team_members` joins registered users to teams within the same event. The
  event/user key prevents multiple team membership in one event.
- `team_invitations` stores invitation state, expiry, and a SHA-256 token
  digest; the raw one-time token is not stored.

## DOGFOOD project records

`project_submissions` stores a team's DOGFOOD project, its event and optional
track, title, description, URLs, draft/submitted status, and submission time.
It is constrained to a team and track from the same event, with at most one
project per team. Submitted projects are the records shown in the public
gallery and judged in T2.

These rows are separate from the coding system's `problems`, coding
`submissions`, `submission_test_results`, and test case records. DOGFOOD
projects are not sent to the code execution worker.

## Judging tables

The judging migration adds event-scoped records (table names are prefixed
`dogfood_`):

- `dogfood_rubrics` stores immutable rubric versions and draft/active/archived
  state; an event has at most one active rubric.
- `dogfood_rubric_criteria` stores ordered criteria, positive weights, and
  maximum scores. Criteria belong to their rubric and event.
- `dogfood_judge_event_assignments` enrolls a user as an active or revoked
  judge for an event.
- `dogfood_judge_project_assignments` connects an enrolled judge, submitted
  project, event, and pinned rubric version. A judge/project pair is unique.
- `dogfood_judge_evaluations` stores one draft or submitted evaluation per
  assignment, including feedback and a server-computed weighted percentage.
- `dogfood_judge_criterion_scores` stores individual raw criterion scores for
  an evaluation.
- `dogfood_judging_result_snapshots` and
  `dogfood_judging_project_results` store versioned event result snapshots,
  including raw aggregates and normalized project results.

Composite foreign keys keep assignments, projects, judges, rubric versions,
evaluations, and criteria within their event and rubric scope. Uniqueness and
check constraints support one evaluation per assignment, one score per
criterion/evaluation, legal states, and score bounds. See the judging migration
and SQLAlchemy models for the full constraints and columns.

## Other coding domain tables

The coding challenge path uses `problems` and their test cases, coding
`submissions`, and per-case `submission_test_results`. The worker consumes
coding submissions and stores execution outcomes. These records and results
are independent of DOGFOOD `project_submissions` and human judging data.

## Schema evolution

`backend/migrations/versions/` contains the migration history for users,
problems, submissions, evaluation results, DOGFOOD event/team/project data,
judging, ownership constraints, and event tracks. Apply it with
`alembic upgrade head` from `backend/` or through the local Docker startup.
