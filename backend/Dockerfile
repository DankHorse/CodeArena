FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY alembic.ini ./alembic.ini
COPY migrations ./migrations
COPY app ./app

ENV PYTHONPATH=/app
EXPOSE 8001
CMD ["sh", "-c", "alembic upgrade head && python -m app.scripts.seed_dogfood /fixtures/fixtures.json --config /demo/.dogfood.local.toml && uvicorn app.main:app --host 0.0.0.0 --port 8001"]
