from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect, select

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import SessionLocal, get_engine
from app.main import app
from app.models.problem import Problem, ProblemTestCase
from app.models.user import User


@pytest.fixture(autouse=True)
def clean_problem_test_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        db.execute(delete(Problem).where(Problem.slug.like("problem-test-%")))
        db.execute(delete(User).where(User.email.like("problem-test-%@example.com")))
        db.commit()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def create_admin_and_login(client: TestClient) -> None:
    email = f"problem-test-admin-{uuid4().hex}@example.com"
    with SessionLocal(bind=get_engine()) as db:
        db.add(
            User(
                email=email,
                password_hash=hash_password("problem-test-password-123"),
                display_name="Problem Admin",
                role="admin",
            )
        )
        db.commit()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "problem-test-password-123"},
    )
    assert response.status_code == 200


def problem_payload(**overrides):
    payload = {
        "title": "Problem Test Add Numbers",
        "slug": f"problem-test-add-{uuid4().hex}",
        "description": "Read two integers and print their sum.",
        "difficulty": "easy",
        "category": "Math",
        "constraints": "-1000 <= a, b <= 1000",
        "input_description": "Two space-separated integers.",
        "output_description": "One integer, their sum.",
        "starter_code": {"python": "a, b = map(int, input().split())\n"},
        "supported_languages": ["python"],
        "test_cases": [
            {"input_data": "2 3\n", "expected_output": "5\n", "position": 0},
            {
                "input_data": "hidden-secret-input-marker",
                "expected_output": "hidden-secret-output-marker",
                "position": 1,
                "is_hidden": True,
                "time_limit_ms": 1000,
                "memory_limit_mb": 128,
            },
        ],
    }
    payload.update(overrides)
    return payload


def test_problem_create_retrieve_and_hidden_case_protection(client: TestClient) -> None:
    create_admin_and_login(client)
    payload = problem_payload()
    created = client.post("/api/v1/problems", json=payload)

    assert created.status_code == 201
    assert created.json()["slug"] == payload["slug"]
    assert created.json()["examples"] == [
        {"input_data": "2 3\n", "expected_output": "5\n", "position": 0}
    ]
    assert "hidden-secret" not in created.text

    retrieved = client.get(f"/api/v1/problems/{payload['slug']}")
    assert retrieved.status_code == 200
    assert retrieved.json()["examples"] == created.json()["examples"]
    assert "test_cases" not in retrieved.json()
    assert "memory_limit_mb" not in retrieved.text

    with SessionLocal(bind=get_engine()) as db:
        problem = db.scalar(select(Problem).where(Problem.slug == payload["slug"]))
        cases = list(
            db.scalars(select(ProblemTestCase).where(ProblemTestCase.problem_id == problem.id))
        )
    assert problem is not None
    assert len(cases) == 2
    assert sum(case.is_hidden for case in cases) == 1


def test_problem_list_filters_active_problems(client: TestClient) -> None:
    create_admin_and_login(client)
    payload = problem_payload(category="Arrays")
    assert client.post("/api/v1/problems", json=payload).status_code == 201

    response = client.get("/api/v1/problems", params={"difficulty": "easy", "category": "arrays"})

    assert response.status_code == 200
    assert [item["slug"] for item in response.json()] == [payload["slug"]]
    assert "expected_output" not in response.text


def test_problem_writes_require_admin(client: TestClient) -> None:
    payload = problem_payload()
    anonymous = client.post("/api/v1/problems", json=payload)
    assert anonymous.status_code == 401
    assert anonymous.json()["error"]["code"] == "UNAUTHORIZED"

    email, password = f"problem-test-user-{uuid4().hex}@example.com", "problem-test-password-123"
    registered = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "display_name": "Participant"},
    )
    assert registered.status_code == 201
    assert client.post("/api/v1/auth/login", json={"email": email, "password": password}).status_code == 200

    forbidden = client.post("/api/v1/problems", json=payload)
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "FORBIDDEN"


def test_problem_slug_conflict_update_and_deactivate(client: TestClient) -> None:
    create_admin_and_login(client)
    payload = problem_payload()
    created = client.post("/api/v1/problems", json=payload)
    assert created.status_code == 201
    duplicate = client.post("/api/v1/problems", json=payload)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "PROBLEM_SLUG_CONFLICT"

    problem_id = created.json()["id"]
    update = client.patch(
        f"/api/v1/problems/{problem_id}",
        json={"title": "Problem Test Updated", "test_cases": []},
    )
    assert update.status_code == 200
    assert update.json()["title"] == "Problem Test Updated"
    assert update.json()["examples"] == []

    deleted = client.delete(f"/api/v1/problems/{problem_id}")
    assert deleted.status_code == 204
    assert client.get(f"/api/v1/problems/{payload['slug']}").status_code == 404
    assert all(item["id"] != problem_id for item in client.get("/api/v1/problems").json())


def test_problem_migration_created_tables() -> None:
    inspector = inspect(get_engine())
    assert inspector.has_table("problems")
    assert inspector.has_table("problem_test_cases")
    assert {"slug", "difficulty", "supported_languages", "is_active"} <= {
        column["name"] for column in inspector.get_columns("problems")
    }
    assert {"problem_id", "input_data", "expected_output", "is_hidden"} <= {
        column["name"] for column in inspector.get_columns("problem_test_cases")
    }
