from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect, or_, select

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import SessionLocal, get_engine
from app.main import app
from app.models.problem import Problem, ProblemTestCase
from app.models.submission import Submission
from app.models.user import User


@pytest.fixture(autouse=True)
def clean_statistics_test_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        test_users = select(User.id).where(User.email.like("statistics-test-%@example.com"))
        test_problems = select(Problem.id).where(Problem.slug.like("statistics-test-%"))
        db.execute(
            delete(Submission).where(
                or_(Submission.user_id.in_(test_users), Submission.problem_id.in_(test_problems))
            )
        )
        db.execute(delete(Problem).where(Problem.slug.like("statistics-test-%")))
        db.execute(delete(User).where(User.email.like("statistics-test-%@example.com")))
        db.commit()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def seed_user(name: str, *, active: bool = True) -> User:
    user_id = uuid4()
    with SessionLocal(bind=get_engine()) as db:
        user = User(
            id=user_id,
            email=f"statistics-test-{user_id.hex}@example.com",
            password_hash="not-used-by-this-test",
            display_name=name,
            is_active=active,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user


def seed_problem(*, active: bool = True) -> Problem:
    with SessionLocal(bind=get_engine()) as db:
        problem = Problem(
            title="Statistics Test Problem",
            slug=f"statistics-test-{uuid4().hex}",
            description="Statistics fixture.",
            difficulty="easy",
            input_description="Input.",
            output_description="Output.",
            supported_languages=["python"],
            is_active=active,
        )
        db.add(problem)
        db.commit()
        db.refresh(problem)
        return problem


def add_submission(
    user: User,
    problem: Problem,
    status: str,
    *,
    created_at: datetime | None = None,
) -> UUID:
    with SessionLocal(bind=get_engine()) as db:
        submission = Submission(
            user_id=user.id,
            problem_id=problem.id,
            language="python",
            source_code="print('private')",
            status=status,
            score=100 if status == "accepted" else None,
            created_at=created_at,
        )
        db.add(submission)
        db.commit()
        return submission.id


def login_cookie(client: TestClient, user_id: UUID) -> None:
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(user_id))


def test_user_statistics_are_authenticated_and_aggregate_only_current_user(client: TestClient) -> None:
    own_user = seed_user("Private Participant")
    other_user = seed_user("Other Participant")
    problem = seed_problem()
    for status in ("pending", "running", "accepted", "accepted", "wrong_answer", "system_error", "completed"):
        add_submission(own_user, problem, status)
    add_submission(other_user, problem, "accepted")

    anonymous = client.get("/api/v1/statistics/me")
    assert anonymous.status_code == 401
    login_cookie(client, own_user.id)
    response = client.get("/api/v1/statistics/me")

    assert response.status_code == 200
    assert response.json() == {
        "total_submissions": 7,
        "judged_submissions": 3,
        "accepted_submissions": 2,
        "solved_problems": 1,
        "acceptance_rate": 66.67,
    }
    assert own_user.email not in response.text
    assert other_user.email not in response.text


def test_problem_statistics_are_public_aggregates_only(client: TestClient) -> None:
    first_user = seed_user("First Solver")
    second_user = seed_user("Second Solver")
    problem = seed_problem()
    for status in ("accepted", "accepted", "wrong_answer", "pending", "system_error"):
        add_submission(first_user, problem, status)
    add_submission(second_user, problem, "accepted")
    with SessionLocal(bind=get_engine()) as db:
        db.add(
            ProblemTestCase(
                problem_id=problem.id,
                input_data="private-hidden-input-marker",
                expected_output="private-hidden-answer-marker",
                position=0,
                is_hidden=True,
            )
        )
        db.commit()

    response = client.get(f"/api/v1/problems/{problem.slug}/statistics")

    assert response.status_code == 200
    assert response.json() == {
        "problem_slug": problem.slug,
        "total_submissions": 6,
        "judged_submissions": 4,
        "accepted_submissions": 3,
        "unique_solvers": 2,
        "acceptance_rate": 75.0,
    }
    assert "private-hidden-input-marker" not in response.text
    assert "private-hidden-answer-marker" not in response.text
    assert first_user.email not in response.text
    assert second_user.email not in response.text


def test_problem_statistics_hide_inactive_problems(client: TestClient) -> None:
    problem = seed_problem(active=False)

    response = client.get(f"/api/v1/problems/{problem.slug}/statistics")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROBLEM_NOT_FOUND"


def test_public_leaderboard_ties_and_pagination_are_deterministic(client: TestClient) -> None:
    alpha = seed_user("Alpha")
    beta = seed_user("Beta")
    solo = seed_user("Solo")
    disabled = seed_user("Disabled", active=False)
    shared = seed_problem()
    alpha_problem = seed_problem()
    beta_problem = seed_problem()
    inactive_problem = seed_problem(active=False)

    add_submission(alpha, shared, "accepted")
    add_submission(alpha, alpha_problem, "accepted")
    add_submission(alpha, alpha_problem, "accepted")
    add_submission(beta, shared, "accepted")
    add_submission(beta, beta_problem, "accepted")
    add_submission(solo, shared, "accepted")
    for problem in (shared, alpha_problem, beta_problem, inactive_problem):
        add_submission(disabled, problem, "accepted")
    add_submission(alpha, inactive_problem, "accepted")

    first_page = client.get("/api/v1/leaderboard", params={"offset": 0, "limit": 2})
    second_page = client.get("/api/v1/leaderboard", params={"offset": 2, "limit": 2})

    assert first_page.status_code == 200
    assert first_page.json() == {
        "items": [
            {"rank": 1, "display_name": "Alpha", "solved_problems": 2},
            {"rank": 1, "display_name": "Beta", "solved_problems": 2},
        ],
        "total": 3,
        "offset": 0,
        "limit": 2,
    }
    assert second_page.json()["items"] == [
        {"rank": 2, "display_name": "Solo", "solved_problems": 1}
    ]
    assert "email" not in first_page.text
    assert "user_id" not in first_page.text
    assert alpha.email not in first_page.text
    assert disabled.display_name not in first_page.text
    assert client.get("/api/v1/leaderboard", params={"offset": -1}).status_code == 422


def test_submission_history_filters_and_paginates_only_current_user(client: TestClient) -> None:
    owner = seed_user("History Owner")
    other = seed_user("History Other")
    problem = seed_problem()
    now = datetime.now(timezone.utc)
    older = add_submission(owner, problem, "accepted", created_at=now - timedelta(minutes=2))
    newer = add_submission(owner, problem, "accepted", created_at=now - timedelta(minutes=1))
    add_submission(owner, problem, "wrong_answer", created_at=now)
    foreign = add_submission(other, problem, "accepted", created_at=now + timedelta(minutes=1))
    login_cookie(client, owner.id)

    response = client.get(
        "/api/v1/submissions",
        params={"status": "accepted", "problem_id": str(problem.id), "offset": 0, "limit": 1},
    )
    next_page = client.get(
        "/api/v1/submissions",
        params={"status": "accepted", "problem_id": str(problem.id), "offset": 1, "limit": 1},
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [str(newer)]
    assert [item["id"] for item in next_page.json()] == [str(older)]
    assert foreign not in {UUID(item["id"]) for item in response.json() + next_page.json()}
    assert all("source_code" not in item for item in response.json())


def test_submission_statistics_index_migration() -> None:
    indexes = inspect(get_engine()).get_indexes("submissions")

    assert any(
        index["name"] == "ix_submissions_status_problem_user"
        and index["column_names"] == ["status", "problem_id", "user_id"]
        for index in indexes
    )
