from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect, select

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.db.session import SessionLocal, get_engine
from app.main import app
from app.models.user import User

PASSWORD = "test-auth-password-123"


@pytest.fixture(autouse=True)
def clean_auth_test_users():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    db = SessionLocal(bind=get_engine())
    try:
        db.execute(delete(User).where(User.email.like("auth-test-%@example.com")))
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def new_email() -> str:
    return f"auth-test-{uuid4().hex}@example.com"


def register(client: TestClient, email: str | None = None) -> tuple[str, dict]:
    email = email or new_email()
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": "Test Participant"},
    )
    return email, response


def test_successful_registration(client: TestClient) -> None:
    email, response = register(client)

    assert response.status_code == 201
    assert response.json()["email"] == email
    assert response.json()["role"] == "participant"
    assert "password_hash" not in response.json()


def test_duplicate_email_rejected_case_insensitively(client: TestClient) -> None:
    email, first = register(client)
    duplicate = client.post(
        "/api/v1/auth/register",
        json={"email": email.upper(), "password": PASSWORD, "display_name": "Duplicate"},
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


def test_password_is_hashed_and_never_returned(client: TestClient) -> None:
    email, response = register(client)
    with SessionLocal(bind=get_engine()) as db:
        user = db.scalar(select(User).where(User.email == email))

    assert response.status_code == 201
    assert user is not None
    assert user.password_hash != PASSWORD
    assert verify_password(PASSWORD, user.password_hash)
    assert PASSWORD not in response.text
    assert "password_hash" not in response.json()


def test_successful_login_sets_http_only_cookie(client: TestClient) -> None:
    email, registration = register(client)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    cookie = response.headers["set-cookie"]

    assert registration.status_code == 201
    assert response.status_code == 200
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Max-Age=900" in cookie
    assert "Secure" not in cookie
    assert "access_token" not in response.json()
    assert PASSWORD not in response.text


def test_invalid_password_is_rejected(client: TestClient) -> None:
    email, registration = register(client)
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "wrong-password"})

    assert registration.status_code == 201
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_missing_authentication_is_rejected(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_current_user_endpoint_uses_authenticated_user(client: TestClient) -> None:
    email, registration = register(client)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    response = client.get("/api/v1/auth/me")

    assert registration.status_code == 201
    assert login.status_code == 200
    assert response.status_code == 200
    assert response.json()["email"] == email
    assert response.json()["display_name"] == "Test Participant"


def test_logout_clears_cookie_and_protected_access(client: TestClient) -> None:
    email, registration = register(client)
    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    logout = client.post("/api/v1/auth/logout")
    current_user = client.get("/api/v1/auth/me")

    assert registration.status_code == 201
    assert login.status_code == 200
    assert logout.status_code == 204
    assert "Max-Age=0" in logout.headers["set-cookie"]
    assert current_user.status_code == 401


@pytest.mark.parametrize("token_kind", ["invalid", "expired"])
def test_invalid_or_expired_token_rejected(client: TestClient, token_kind: str) -> None:
    email, registration = register(client)
    with SessionLocal(bind=get_engine()) as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        token = (
            "not-a-jwt"
            if token_kind == "invalid"
            else create_access_token(user.id, expires_delta=timedelta(seconds=-1))
        )

    client.cookies.set(get_settings().auth_cookie_name, token)
    response = client.get("/api/v1/auth/me")

    assert registration.status_code == 201
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_disabled_user_cannot_login_or_access_current_user(client: TestClient) -> None:
    email, registration = register(client)
    with SessionLocal(bind=get_engine()) as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        user_id = user.id
        user.is_active = False
        db.commit()

    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(user_id))
    current_user = client.get("/api/v1/auth/me")

    assert registration.status_code == 201
    assert login.status_code == 403
    assert login.json()["error"]["code"] == "ACCOUNT_DISABLED"
    assert current_user.status_code == 403
    assert current_user.json()["error"]["code"] == "ACCOUNT_DISABLED"


def test_migration_created_users_table() -> None:
    inspector = inspect(get_engine())
    assert inspector.has_table("users")
    columns = {column["name"] for column in inspector.get_columns("users")}
    assert {
        "id",
        "email",
        "password_hash",
        "display_name",
        "role",
        "is_active",
        "created_at",
        "updated_at",
    } <= columns
