# CodeArena

CodeArena is a FastAPI and PostgreSQL hackathon portal. The current DOGFOOD
submission claims and verifies **T1 and T2**. The repository also contains a
separate coding problem, code submission, and evaluation system; those records
are distinct from DOGFOOD project judging.

## Run locally

From the repository root, configure `backend/.env` from
`backend/.env.example`, including a local PostgreSQL password and a private
`JWT_SECRET_KEY` of at least 32 characters. Then start the seeded backend and
PostgreSQL:

```sh
docker compose --env-file backend/.env -f backend/docker-compose.yml up --build
```

To run the backend tests, install `backend/requirements.txt` in a Python 3.10+
environment, configure the test database in `backend/.env`, apply migrations
from `backend/`, and run:

```sh
cd backend
pytest
```

The seeded local DOGFOOD fixture produces `.dogfood.local.toml` at the
repository root. It contains short-lived local credentials and **must not be
committed**. Run the acceptance checker from the root with:

```sh
python3 run.py .dogfood.local.toml
```

The official acceptance result is **T1 and T2 verified** (all seven T1/T2
checks pass). The root `frontend/` directory contains the current Vite/React
frontend.

## Repository map

- `backend/app/` — API routes, services, models, schemas, auth, worker, and tests.
- `backend/migrations/` — Alembic database migrations.
- `frontend/` — Vite/React app and static assets.
- `fixtures.json` — organizer-provided DOGFOOD seed fixture.
- `run.py` — DOGFOOD acceptance checker.
- `ARCHITECTURE.md`, `DATA-MODEL.md`, `JUDGING.md` — implementation notes.

See [backend/README.md](backend/README.md) for API details and
[JUDGING.md](JUDGING.md) for T2 behavior and privacy boundaries.
