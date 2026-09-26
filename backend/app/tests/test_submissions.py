from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect, or_, select

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import SessionLocal, get_engine
from app.main import app
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.user import User


@pytest.fixture(autouse=True)
def clean_submission_test_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        test_users = select(User.id).where(User.email.like("submission-test-%@example.com"))
        test_problems = select(Problem.id).where(Problem.slug.like("submission-test-%"))
        db.execute(
            delete(Submission).where(
                or_(Submission.user_id.in_(test_users), Submission.problem_id.in_(test_problems))
            )
        )
        db.execute(delete(Problem).where(Problem.slug.like("submission-test-%")))
        db.execute(delete(User).where(User.email.like("submission-test-%@example.com")))
        db.commit()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def seed_user(client: TestClient, label: str) -> UUID:
    user_id = uuid4()
    with SessionLocal(bind=get_engine()) as db:
        db.add(
            User(
                id=user_id,
                email=f"submission-test-{label}-{user_id.hex}@example.com",
                password_hash="not-used-by-this-test",
                display_name=f"Submission {label}",
            )
        )
        db.commit()
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(user_id))
    return user_id


def seed_problem(*, active: bool = True, languages: list[str] | None = None) -> Problem:
    with SessionLocal(bind=get_engine()) as db:
        problem = Problem(
            title="Submission Test Problem",
            slug=f"submission-test-{uuid4().hex}",
            description="Problem fixture.",
            difficulty="easy",
            input_description="Input.",
            output_description="Output.",
            supported_languages=languages or ["python"],
            is_active=active,
        )
        db.add(problem)
        db.commit()
        db.refresh(problem)
        return problem


def submission_payload(problem_id: UUID, **overrides):
    payload = {
        "problem_id": str(problem_id),
        "language": "python",
        "source_code": "print(input())\n",
    }
    payload.update(overrides)
    return payload


def create_submission(client: TestClient, problem_id: UUID):
    return client.post("/api/v1/submissions", json=submission_payload(problem_id))


def test_authenticated_submission_is_persisted_as_pending(client: TestClient) -> None:
    user_id = seed_user(client, "owner")
    problem = seed_problem()

    response = create_submission(client, problem.id)

    assert response.status_code == 201
    data = response.json()
    assert data["problem_id"] == str(problem.id)
    assert data["language"] == "python"
    assert data["source_code"] == "print(input())\n"
    assert data["status"] == "pending"
    assert data["execution_time_ms"] is None
    assert data["memory_usage_kb"] is None
    assert data["score"] is None
    assert data["error_message"] is None
    assert "user_id" not in data
    with SessionLocal(bind=get_engine()) as db:
        stored = db.get(Submission, UUID(data["id"]))
    assert stored is not None
    assert stored.user_id == user_id


def test_unauthenticated_submission_is_rejected(client: TestClient) -> None:
    problem = seed_problem()

    response = create_submission(client, problem.id)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_nonexistent_problem_is_rejected(client: TestClient) -> None:
    seed_user(client, "owner")

    response = create_submission(client, uuid4())

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROBLEM_NOT_FOUND"


def test_unpublished_problem_is_rejected(client: TestClient) -> None:
    seed_user(client, "owner")
    problem = seed_problem(active=False)

    response = create_submission(client, problem.id)

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PROBLEM_NOT_PUBLISHED"


def test_unsupported_language_is_rejected(client: TestClient) -> None:
    seed_user(client, "owner")
    problem = seed_problem(languages=["python"])

    response = client.post(
        "/api/v1/submissions",
        json=submission_payload(problem.id, language="javascript"),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNSUPPORTED_LANGUAGE"


def test_source_code_size_is_limited(client: TestClient) -> None:
    seed_user(client, "owner")
    problem = seed_problem()

    response = client.post(
        "/api/v1/submissions",
        json=submission_payload(problem.id, source_code="x" * 65_537),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_client_cannot_assign_server_owned_result_fields(client: TestClient) -> None:
    seed_user(client, "owner")
    problem = seed_problem()

    response = client.post(
        "/api/v1/submissions",
        json=submission_payload(problem.id, status="accepted", score=100),
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_submission_detail_is_private_to_owner(client: TestClient) -> None:
    owner_id = seed_user(client, "owner")
    problem = seed_problem()
    created = create_submission(client, problem.id)
    submission_id = created.json()["id"]

    own_detail = client.get(f"/api/v1/submissions/{submission_id}")
    assert own_detail.status_code == 200
    assert own_detail.json()["source_code"] == "print(input())\n"
    assert own_detail.json()["status"] == "pending"
    assert owner_id

    other = TestClient(app)
    seed_user(other, "other")
    foreign_detail = other.get(f"/api/v1/submissions/{submission_id}")

    assert foreign_detail.status_code == 404
    assert foreign_detail.json()["error"]["code"] == "SUBMISSION_NOT_FOUND"
    other.close()


def test_submission_list_contains_only_current_users_and_filters_by_problem(client: TestClient) -> None:
    owner_id = seed_user(client, "owner")
    problem = seed_problem()
    other_problem = seed_problem()
    own_submission = create_submission(client, problem.id).json()
    own_other_problem_submission = create_submission(client, other_problem.id).json()

    other = TestClient(app)
    seed_user(other, "other")
    foreign_submission = create_submission(other, problem.id).json()

    owner_list = client.get("/api/v1/submissions", params={"limit": 10})
    problem_list = client.get(f"/api/v1/problems/{problem.slug}/submissions")
    assert owner_list.status_code == 200
    assert {item["id"] for item in owner_list.json()} == {
        own_submission["id"],
        own_other_problem_submission["id"],
    }
    assert all("source_code" not in item for item in owner_list.json())
    assert problem_list.status_code == 200
    assert [item["id"] for item in problem_list.json()] == [own_submission["id"]]
    assert foreign_submission["id"] not in {item["id"] for item in owner_list.json()}

    other.close()


def test_submission_migration_created_table() -> None:
    inspector = inspect(get_engine())
    assert inspector.has_table("submissions")
    assert {
        "user_id",
        "problem_id",
        "source_code",
        "status",
        "execution_time_ms",
        "memory_usage_kb",
        "score",
        "error_message",
    } <= {column["name"] for column in inspector.get_columns("submissions")}
