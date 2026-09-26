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
