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
