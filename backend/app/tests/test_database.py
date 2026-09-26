import pytest
from sqlalchemy import text

from app.core.config import get_settings
from app.db import session


def test_engine_uses_configured_postgresql_url(monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = "postgresql+psycopg://test:test@localhost:5432/test_db"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    session.get_engine.cache_clear()

    try:
        assert session.get_engine().url.render_as_string(hide_password=False) == database_url
    finally:
        session.get_engine().dispose()
        session.get_engine.cache_clear()
        get_settings.cache_clear()


def test_database_dependency_rolls_back_and_closes(monkeypatch: pytest.MonkeyPatch) -> None:
    class SessionStub:
        rolled_back = False
        closed = False

        def rollback(self) -> None:
            self.rolled_back = True

        def close(self) -> None:
            self.closed = True

    db = SessionStub()
    monkeypatch.setattr(session, "get_engine", lambda: object())
    monkeypatch.setattr(session, "SessionLocal", lambda **kwargs: db)

    dependency = session.get_db()
    next(dependency)
    dependency.close()

    assert db.rolled_back
    assert db.closed


@pytest.mark.skipif(
    not get_settings().database_url,
    reason="DATABASE_URL is not configured",
)
def test_postgresql_connection() -> None:
    engine = session.get_engine()
    with engine.connect() as connection:
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
