# HackFlow Backend

## Setup

Use Python 3.10 or newer. From this directory, create a virtual environment,
install dependencies, and create your private local environment file from the
example. Replace `POSTGRES_PASSWORD` with your own URL-safe local password;
`.env` is gitignored.

```sh
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

The `DATABASE_URL` entry expands from the same username, password, database,
and port used by Docker Compose, so keep those settings together in `.env`.
Authentication also uses these settings:

- `JWT_SECRET_KEY`: unique random secret of at least 32 characters. Generate it
  with `openssl rand -hex 32` and keep it only in `.env`.
- `JWT_ALGORITHM`: currently `HS256`.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: access token lifetime; local example is 15.
- `AUTH_COOKIE_NAME`: name of the authentication cookie.
- `AUTH_COOKIE_SECURE`: set `true` when serving over HTTPS; the local example
  is `false` for HTTP development.
- `AUTH_COOKIE_SAMESITE`: `lax` by default. `none` requires
  `AUTH_COOKIE_SECURE=true`.

Start the development server with `uvicorn app.main:app --reload`. The health
check is available at `/health`, and versioned API routes are mounted under
`/api/v1`.

## Database migrations

Start local PostgreSQL and apply migrations from this directory:

```sh
docker compose up -d postgres
alembic upgrade head
alembic current
```

PostgreSQL listens on host port `55433`, as configured by `POSTGRES_PORT`.
`alembic current` reports the database's migration revision. Authentication
adds only the `users` table. When later SQLAlchemy models are added, create
migrations with:

```sh
alembic revision --autogenerate -m "description"
```

## Tests

Run the full backend test suite from this directory:

```sh
pytest
```

Run migrations before the authentication tests. The auth tests use the
PostgreSQL database configured by `DATABASE_URL` and clean up their test users
after each test. Authentication tokens are returned only as HttpOnly cookies,
not in JSON responses. Local development uses `Secure=false` and `SameSite=lax`;
enable `Secure` behind HTTPS in deployed environments.

The authentication routes are `POST /api/v1/auth/register`,
`POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, and
`GET /api/v1/auth/me`. Registration creates an account; login sets the access
cookie. Access tokens are never included in response JSON.

Run only the authentication tests with:

```sh
pytest app/tests/test_auth.py
```

## Problems API

FastAPI's interactive contract is available at `/docs` and the machine-readable
OpenAPI document at `/openapi.json`.

| Method | Path | Authentication | Success |
| --- | --- | --- | --- |
| `GET` | `/api/v1/problems` | Public | `200`, array of problem summaries |
| `GET` | `/api/v1/problems/{slug}` | Public | `200`, problem detail with public examples |
| `POST` | `/api/v1/problems` | Authenticated admin | `201`, created problem detail |
| `PATCH` | `/api/v1/problems/{problem_id}` | Authenticated admin | `200`, updated problem detail |
| `DELETE` | `/api/v1/problems/{problem_id}` | Authenticated admin | `204`, problem deactivated |

List query parameters are optional `difficulty` (`easy`, `medium`, `hard`),
`category` (case-insensitive exact match), `search` (matches title or
description), `offset` (default `0`) and `limit` (default `50`, maximum `100`).
Inactive problems are omitted. A summary contains `id`, `title`, `slug`,
`difficulty`, `category`, `supported_languages`, `created_at`, and
`updated_at`. Detail adds `description`, nullable `constraints`,
`input_description`, `output_description`, `starter_code`, and `examples`.
An example has `input_data`, `expected_output`, and `position`. Hidden test
cases and execution constraints are never returned from public endpoints or
authoring responses.

Create request body:

```json
{
  "title": "Add Two Numbers",
  "slug": "add-two-numbers",
  "description": "Read two integers and print their sum.",
  "difficulty": "easy",
  "category": "Math",
  "constraints": "-1000 <= a, b <= 1000",
  "input_description": "Two space-separated integers.",
  "output_description": "Their sum.",
  "starter_code": {"python": "a, b = map(int, input().split())"},
  "supported_languages": ["python"],
  "test_cases": [
    {"input_data": "2 3\\n", "expected_output": "5\\n", "is_hidden": false},
    {"input_data": "20 22\\n", "expected_output": "42\\n", "is_hidden": true, "time_limit_ms": 1000, "memory_limit_mb": 128}
  ]
}
```

`slug` is optional and generated from `title` when omitted. Each test case also
accepts `position` (default `0`); test case input/output are each limited to
100,000 characters and at most 500 cases can be supplied. `PATCH` accepts any
subset of problem fields. Supplying `test_cases` replaces the full test-case
set; omitting it leaves cases unchanged. `DELETE` is a soft delete (`is_active`
becomes false) so future submissions can retain their problem reference.

Errors use the shared shape `{"error":{"code":"...","message":"...","details":...}}`.
Relevant responses are `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404
PROBLEM_NOT_FOUND`, `409 PROBLEM_SLUG_CONFLICT`, and `422 VALIDATION_ERROR`.
Create/update/delete are restricted to accounts whose backend role is `admin`;
registration always creates a participant account. Admin account provisioning
is intentionally not exposed as a public API.

## Submissions API

All submission endpoints require the HttpOnly authentication cookie. Every read
is restricted in the backend to the current user; fetching another user's
submission returns the same `404 SUBMISSION_NOT_FOUND` response as an unknown
submission.

| Method | Path | Success | Response |
| --- | --- | --- | --- |
| `POST` | `/api/v1/submissions` | `201` | Created submission detail |
| `GET` | `/api/v1/submissions` | `200` | Current user's paginated submission summaries |
| `GET` | `/api/v1/submissions/{submission_id}` | `200` | Owned submission detail, including source code |
| `GET` | `/api/v1/problems/{slug}/submissions` | `200` | Current user's paginated summaries for that problem |

Create request body (the only accepted client-controlled fields):

```json
{
  "problem_id": "8cf6a4c5-8c6f-4bb0-8fd9-11365ed21a98",
  "language": "python",
  "source_code": "print(input())\\n"
}
```

`problem_id` must identify an active problem and `language` must match one of
that problem's `supported_languages` (case-insensitive). Source code must be
nonblank and at most 65,536 UTF-8 bytes. Unknown request fields are rejected,
so clients cannot set `user_id`, `status`, `score`, execution time, memory
usage, output, or error fields. New submissions initially have status `pending`;
the independent execution worker later evaluates the submission against test cases.

Create and detail responses contain `id`, `problem_id`, `language`,
`source_code`, `status`, nullable `execution_time_ms`, `memory_usage_kb`,
`score`, `error_message`, `stdout`, `stderr`, and `exit_code`, plus
`created_at` and `updated_at`. Detail responses also contain ordered
`test_results` with position, visibility, status, duration, and safe output
fields. Test result responses never include test input or expected output;
stdout/stderr are null for hidden cases. List responses omit `source_code`,
stdout, stderr, and per-test results. Status values include `pending`,
`running`, `accepted`, `wrong_answer`, `compilation_error`, `runtime_error`,
`time_limit_exceeded`, `output_limit_exceeded`, and `system_error`. Legacy
`completed`, `failed`, and `timeout` values remain accepted for existing rows.
The server owns status and result fields. A newly created submission returns
`201` with `status: "pending"` and null result fields.

`GET /api/v1/submissions` accepts optional `problem_id`, `status`, `offset`
(default `0`, minimum `0`), and `limit` (default `50`, range `1`-`100`). The problem
history endpoint accepts `offset` and `limit` with the same bounds. Both lists
are newest first and never include another user's rows. Responses use the
shared structured error envelope: `401 UNAUTHORIZED`, `404 PROBLEM_NOT_FOUND`
or `SUBMISSION_NOT_FOUND`, `409 PROBLEM_NOT_PUBLISHED`, and `422
UNSUPPORTED_LANGUAGE` or `VALIDATION_ERROR`.

## Statistics and Leaderboard

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/statistics/me` | Required | Current user's submission totals and progress |
| `GET` | `/api/v1/problems/{slug}/statistics` | Public | Aggregate counts for an active problem |
| `GET` | `/api/v1/leaderboard` | Public | Paginated coding leaderboard |

`GET /api/v1/statistics/me` returns `total_submissions`,
`judged_submissions`, `accepted_submissions`, `solved_problems`, and
`acceptance_rate`. Personal statistics count every owned submission in the
total and accepted attempts across all existing problems in solved progress.
Judged attempts are accepted, wrong answer, compilation error, runtime error,
time limit exceeded, and output limit exceeded. Pending/running submissions,
infrastructure `system_error` results, and legacy process-only statuses are
excluded from the acceptance-rate denominator. The rate is accepted judged
submissions divided by judged submissions, as a percentage rounded to two
decimal places (zero when there are no judged submissions). This endpoint
returns only the authenticated user's aggregates and requires the same HttpOnly
authentication cookie as submission history.

`GET /api/v1/problems/{slug}/statistics` returns `total_submissions`,
`judged_submissions`, `accepted_submissions`, `unique_solvers`, and
`acceptance_rate`, along with the problem slug. It is available only for active
problems. Counts are aggregates only; no user identities, source, test inputs,
expected outputs, or hidden-case data are returned. `unique_solvers` counts
distinct users with an accepted submission.

`GET /api/v1/leaderboard` accepts `offset` (default `0`, minimum `0`) and
`limit` (default `50`, range `1`-`100`). Only active users and active problems
are considered. A user appears after accepting at least one active problem;
the metric is the number of distinct active problems accepted. Equal solve
counts share a dense rank. Rows within a rank are ordered by display name and
an internal user ID for stable pagination. The response exposes only rank,
display name, and solved-problem count; it never exposes email, user ID,
password data, source code, or test-case data. This is a global platform
leaderboard; no event-specific ranking exists yet.

Example leaderboard response:

```json
{
  "items": [
    {"rank": 1, "display_name": "Ada", "solved_problems": 12},
    {"rank": 1, "display_name": "Grace", "solved_problems": 12},
    {"rank": 2, "display_name": "Linus", "solved_problems": 10}
  ],
  "total": 3,
  "offset": 0,
  "limit": 50
}
```

## Isolated Execution Worker

Submission creation only persists a `pending` job; FastAPI never executes source
code. Run one or more independent worker processes from `backend/` after Docker
Engine is installed and running and the configured trusted image is available:

```sh
docker pull python:3.12-slim
python -m app.worker
```

The worker polls PostgreSQL and claims pending rows with row-level locking, so
multiple worker processes do not claim the same job. It runs each Python test
case in a disposable Docker container, passing that case's input on stdin.
Cases run in position order and stop at the first non-accepted result. A
submission is `accepted` only when all configured cases pass. Output comparison
normalizes CRLF/CR to LF and strips trailing whitespace at the end of the
complete output; internal spaces and line breaks remain significant. The
submission score is the percentage of cases passed, rounded to two decimal
places. Timeouts, output-limit failures, runtime failures, syntax/indentation
errors, and worker/runtime failures map to distinct statuses. Memory usage
remains null because the runner does not collect container metrics.

Execution limits are environment-configurable: `EXECUTION_DOCKER_BINARY`,
`EXECUTION_DOCKER_IMAGE`, `EXECUTION_TIMEOUT_SECONDS` (default 5, maximum 30),
`EXECUTION_MEMORY_LIMIT_MB` (default 128, maximum 512),
`EXECUTION_CPU_LIMIT` (default 0.5 cores, maximum 2), `EXECUTION_PIDS_LIMIT`
(default 32), `EXECUTION_MAX_OUTPUT_BYTES` (default 65,536),
`EXECUTION_MAX_INPUT_BYTES` (default 65,536), and
`WORKER_POLL_INTERVAL_SECONDS` (default 1). The container has no network,
read-only root and source mount, no capabilities, no-new-privileges, a
non-root UID, bounded `/tmp`, and a PID/memory/CPU cap. stdout/stderr are
drained with a combined byte limit; exceeding it terminates the container.
Only trusted operators should configure the Docker binary/image or grant the
worker access to the Docker daemon. Do not run untrusted submitted code directly
on the host.

Evaluation result fields are returned by the owned submission detail endpoint
`GET /api/v1/submissions/{submission_id}`: overall `status`, `score`, aggregate
`execution_time_ms`, safe output/error fields, and ordered `test_results`.
Hidden case inputs and expected outputs are never included in API responses;
hidden case stdout and stderr are also omitted. List APIs omit source code and
execution output. The per-case table stores only result metadata and safe
outputs, and cascades when its submission is removed.

## DOGFOOD Events and Projects (T1)

DOGFOOD project entries are separate from coding `Submission` rows. They are
team-owned project records and are not executed by the CodeArena coding
worker. User roles are `participant`, `organizer`, and `admin`. Registration
always creates a participant. An admin can grant only participant or organizer
with the role endpoint; public self-promotion is not available. Event
management is scoped to the event's `organizer_id`, even for an admin.

Event creation requires an organizer/admin and creates a private `draft`.
Organizers can edit only drafts, then transition through
`draft -> published -> active -> completed`; cancellation is allowed from
draft, published, or active. Activation is rejected before `starts_at`, and
completion is rejected before `ends_at`. Public event reads omit drafts and
cancelled events. The organizer is assigned from the authenticated identity,
never from request data.

Team size is configured per event (`team_min_size`, `team_max_size`) rather
than relying on an undocumented global limit. Only registered participants
can create teams. A participant can belong to at most one team per event; the
captain is the initial member and only the captain may invite teammates or
manage the team's project. Invitations target participants registered for
the same event, expire at its registration deadline, and persist only a
SHA-256 digest of the one-time bearer token. The raw token is returned only
when created and must be delivered to the invitee through the app's
authenticated channel.

Drafts can be created/edited while the event is published or active and the
submission deadline has not passed. Equality with the deadline is accepted;
strictly later times are rejected. Finalization additionally requires the
configured minimum team size and a nonblank description. Submitted projects
are immutable. Event closure/cancellation rejects edits and finalization.
Private project reads are limited to event team members and the event
organizer. The public gallery contains only submitted projects from published,
active, or completed events and uses a dedicated response schema without team
or user identities or internal fields.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `PATCH` | `/api/v1/admin/users/{user_id}/role` | Admin | Assign participant/organizer role |
| `GET` | `/api/v1/events?offset=0&limit=20` | Public | Paginated public event list |
| `GET` | `/api/v1/events/by-slug/{slug}` | Public | Public event details |
| `POST` | `/api/v1/events` | Organizer/admin | Create draft event |
| `GET` | `/api/v1/events/{event_id}` | Authenticated | Read event; private drafts only to owner |
| `PATCH` | `/api/v1/events/{event_id}` | Event organizer | Edit a draft event |
| `POST` | `/api/v1/events/{event_id}/transition` | Event organizer | Transition event lifecycle |
| `POST` | `/api/v1/events/{event_id}/registrations` | Participant | Register current user |
| `POST` | `/api/v1/events/{event_id}/teams` | Registered participant | Create team; caller is captain |
| `GET` | `/api/v1/events/{event_id}/teams/me` | Authenticated | Current user's team and member IDs |
| `POST` | `/api/v1/teams/{team_id}/invitations` | Team captain | Invite registered event participant |
| `POST` | `/api/v1/team-invitations/accept` | Invitee | Accept using `{ "token": "..." }` |
| `POST` | `/api/v1/events/{event_id}/projects` | Team captain | Create project draft |
| `GET` | `/api/v1/projects/{project_id}` | Team member/organizer | Read private project state |
| `PATCH` | `/api/v1/projects/{project_id}` | Team captain | Edit draft project |
| `POST` | `/api/v1/projects/{project_id}/submit` | Team captain | Finalize project |
| `GET` | `/api/v1/gallery/projects?offset=0&limit=20` | Public | Paginated submitted gallery |

Event creation requires `title`, `description`, timezone-aware
`registration_opens_at`, `registration_deadline`, `starts_at`,
`submission_deadline`, `ends_at`, and event-specific `team_min_size` and
`team_max_size`; `slug` is optional. Dates must be chronological. Transition
request bodies are `{"status":"published"}`, `{"status":"active"}`,
`{"status":"completed"}`, or `{"status":"cancelled"}`, subject to
lifecycle/time rules. Event and gallery lists accept `offset` (default 0) and
`limit` (default 20, maximum 100); gallery also supports `event_slug` and
`search`.

Project create bodies accept `title`, optional `description`,
`repository_url`, and `demo_url`. Updates accept a subset. Event/team/owner/
status fields are server-owned. The gallery response has `items`, `offset`,
`limit`, and `total`; each item contains project ID, event slug/title, project
title/description, public repository/demo URLs, and `submitted_at`. Drafts,
team identities, member IDs, organizer IDs, and internal fields are never
included.

Relevant structured errors include `401 UNAUTHORIZED`, `403 FORBIDDEN`,
`404 EVENT_NOT_FOUND`/`PROJECT_NOT_FOUND`, `409 INVALID_EVENT_TRANSITION`,
`ALREADY_REGISTERED`, `REGISTRATION_CLOSED`, `ALREADY_IN_TEAM`, `TEAM_FULL`,
`INVITATION_EXPIRED`, `SUBMISSION_LOCKED`, `EVENT_CLOSED`, and
`DEADLINE_PASSED`; invalid bodies use `422 VALIDATION_ERROR`.

## DOGFOOD Human Judging (T2)

These routes judge DOGFOOD `ProjectSubmission` records. They do not read or
write CodeArena coding `Submission`, `SubmissionTestResult`, or problem
evaluation records. Authentication uses the existing HttpOnly cookie. Every
management route is scoped to `events.organizer_id`; being a global admin does
not grant management access to another organizer's event.

Judges are event-scoped. An event organizer assigns an active participant
account as a judge; that account must not be registered for the same event.
Registration and judge assignment serialize on the event row, preventing one
account from acquiring both event roles. The account remains a normal global
`participant` for other events.

| Method | Path | Authorization | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/events/{event_id}/rubrics` | Event organizer | Create a new immutable draft rubric version |
| `GET` | `/api/v1/events/{event_id}/rubrics` | Event organizer | List rubric versions and criteria |
| `GET` | `/api/v1/events/{event_id}/rubric` | Event organizer or active event judge | Read the active rubric |
| `POST` | `/api/v1/events/{event_id}/rubrics/{rubric_id}/activate` | Event organizer | Activate a draft rubric; rejected after project assignments exist |
| `POST` | `/api/v1/events/{event_id}/judges` | Event organizer | Enroll a participant account as an event judge |
| `POST` | `/api/v1/events/{event_id}/judge-assignments` | Event organizer | Assign an enrolled judge to a submitted project |
| `GET` | `/api/v1/events/{event_id}/judge-assignments` | Event organizer | List assignment IDs and status only; contains no score/feedback |
| `GET` | `/api/v1/events/{event_id}/judge-assignments/me` | Active event judge | List only the caller's assignments |
| `GET` | `/api/v1/judge-assignments/{assignment_id}` | Assigned judge | Read assigned project details and its pinned rubric |
| `GET` | `/api/v1/judge-assignments/{assignment_id}/evaluation` | Assigned judge | Read only the caller's own evaluation, or `{"evaluation":null}` |
| `GET` | `/api/v1/judging/scores` | Active event judge | List the caller's own assignment scores; a `judge` query is rejected |
| `PUT` | `/api/v1/judge-assignments/{assignment_id}/evaluation` | Assigned judge | Replace/save the caller's draft scores and feedback |
| `POST` | `/api/v1/judge-assignments/{assignment_id}/evaluation/submit` | Assigned judge | Finalize; all criteria must be scored; immutable afterward |
| `GET` | `/api/v1/events/{event_id}/judging/progress` | Event organizer | Assignment counts and completion percentages by judge; no private scores |
| `POST` | `/api/v1/events/{event_id}/judging/results/recalculate` | Event organizer | Persist a new versioned normalization snapshot |
| `GET` | `/api/v1/events/{event_id}/judging/results` | Event organizer | Read latest aggregate result snapshot and freshness state |
| `GET` | `/api/v1/events/{event_id}/judging/results.csv` | Event organizer | Download event-scoped aggregate results CSV |

Create a rubric with a title and ordered criteria. `position` values must be
unique and contiguous from zero. Each weight must be positive and all weights
must total exactly 100. Each criterion has a positive `max_score`.

```json
{
  "title": "DOGFOOD 2026 rubric",
  "criteria": [
    {"name": "Impact", "description": "Problem impact", "weight": 60, "max_score": 5, "position": 0},
    {"name": "Execution", "description": "Quality", "weight": 40, "max_score": 5, "position": 1}
  ]
}
```

Rubric versions are created as drafts and activated separately. Activated
criteria cannot be edited through the API. Create a new version to make
changes. Activation is blocked after any project assignment exists, so an
assignment and every evaluation pin one stable rubric version. Composite
database foreign keys keep an assignment, event, rubric and score criterion
within the same event/version.

Enroll a judge with `{"judge_id":"<user UUID>"}`. Assign them to a submitted
project with `{"project_id":"<project UUID>","judge_id":"<user UUID>"}`.
Project assignment rows are unique per project/judge and already support
multiple rows in one transaction for a future batch-assignment operation.
Unregistered, inactive, event-registered, or non-participant accounts cannot
be enrolled as event judges.

Draft evaluation requests use a full replacement set of scores and feedback:

```json
{
  "scores": [
    {"criterion_id": "<impact criterion UUID>", "score": 4},
    {"criterion_id": "<execution criterion UUID>", "score": 3.5}
  ],
  "feedback": "Clear user value; polish the onboarding flow."
}
```

Scores are raw values from zero through the criterion's `max_score`. Partial
drafts are allowed; the weighted result is absent until every criterion has a
score. Finalization requires every criterion and freezes the judge's response.
The server stores each raw criterion score separately and computes the raw
weighted percentage as `sum(score / max_score * weight)`. The `weighted_score`
is a derived 0-100 percentage; clients cannot provide it. Judges can only
read/write their own assigned evaluation. Other judges' assignments, scores,
and feedback return not-found/forbidden responses. Participants have no access
to judging routes. Organizers see progress counts and aggregate results, not
individual score sheets or feedback.

Progress responses contain `total_assignments`, `completed_evaluations`,
`pending_evaluations`, `in_progress_evaluations`, `completion_percentage`, and
per-judge counts keyed by judge UUID. They intentionally omit raw or weighted
scores and written feedback.

Normalization is `judge_mean_center`, version `1.0`. For each judge, calculate
their mean weighted percentage across submitted event evaluations. Calculate
the grand mean across all those evaluations. For each project/judge evaluation:
`adjusted = raw_weighted_percentage - judge_mean + grand_mean`; clamp each
adjusted score to `[0, 100]`; then average the adjusted scores per project.
The result snapshot also retains the project's unmodified raw-score average.
Values use decimal arithmetic and round half-up to four decimal places. This
method requires at least two judges and at least two submitted evaluations per
judge. Otherwise recalculation persists an `insufficient_data` snapshot with a
reason and no invented normalized values. Recalculation never updates raw
evaluations. Result snapshots are event-scoped and identify the method and
version. `GET results` reports `is_stale` if more evaluations were finalized
since the last snapshot. For stale, insufficient, or not-yet-calculated
snapshots, CSV exports available raw weighted averages and evaluation counts;
rank and normalized-score cells are blank. A stale snapshot is labeled
`stale_snapshot_ignored`. Missing scores are never filled in or treated as
normalized results.

Results and CSV have no participant or judge route in T2; they remain private
to the event organizer (there is no publication endpoint yet). Result rows
sort by normalized score descending, raw average descending, then project
title and UUID. Equal normalized scores share a rank; the remaining keys only
provide deterministic display order.

CSV columns are stable and ordered as:
`event_slug,event_title,rubric_version,normalization_method,rank,project_id,project_title,team_id,raw_average,normalized_score,completed_evaluations,submitted_at,repository_url,demo_url`.
Formula-leading text beginning with `=`, `+`, `-`, or `@` (including after
leading spaces/tabs/newlines) is prefixed with an apostrophe before CSV
quoting.

Judging errors include `ACTIVE_RUBRIC_REQUIRED`, `RUBRIC_LOCKED`,
`RUBRIC_IMMUTABLE`, `JUDGE_CONFLICT`, `JUDGE_NOT_ASSIGNED`,
`ASSIGNMENT_EXISTS`, `ASSIGNMENT_NOT_FOUND`, `INVALID_CRITERION`,
`SCORE_OUT_OF_RANGE`, `EVALUATION_INCOMPLETE`, `EVALUATION_LOCKED`,
`INSUFFICIENT_NORMALIZATION_DATA`, and `RESULTS_STALE`. Request validation
errors use the existing structured `422 VALIDATION_ERROR` response.
