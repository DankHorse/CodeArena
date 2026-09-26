from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect, or_, select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import SessionLocal, get_engine
from app.main import app
from app.models.problem import Problem, ProblemTestCase
from app.models.submission import Submission
from app.models.user import User
from app.worker.execution import ExecutionJob, ExecutionResult, ExecutionStatus
from app.worker.service import process_next_submission


@pytest.fixture(autouse=True)
def clean_evaluation_test_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        test_users = select(User.id).where(User.email.like("evaluation-test-%@example.com"))
        test_problems = select(Problem.id).where(Problem.slug.like("evaluation-test-%"))
        db.execute(
            delete(Submission).where(
                or_(Submission.user_id.in_(test_users), Submission.problem_id.in_(test_problems))
            )
        )
        db.execute(delete(Problem).where(Problem.slug.like("evaluation-test-%")))
        db.execute(delete(User).where(User.email.like("evaluation-test-%@example.com")))
        db.commit()


class FakeRunner:
    def __init__(self, results: list[ExecutionResult]):
        self.results = iter(results)
        self.jobs: list[ExecutionJob] = []

    def execute(self, job: ExecutionJob) -> ExecutionResult:
        self.jobs.append(job)
        return next(self.results)


def result(
    stdout: str = "",
    *,
    status: ExecutionStatus = ExecutionStatus.COMPLETED,
    stderr: str = "",
    exit_code: int | None = 0,
    error_message: str | None = None,
    duration: int = 7,
) -> ExecutionResult:
    return ExecutionResult(status, stdout, stderr, exit_code, duration, error_message)


def seed_submission(
    cases: list[tuple[str, str, bool]], *, source_code: str = "print(input())"
) -> tuple[Submission, list[ProblemTestCase]]:
    user_id = uuid4()
    with SessionLocal(bind=get_engine()) as db:
        user = User(
            id=user_id,
            email=f"evaluation-test-{user_id.hex}@example.com",
            password_hash="not-used-by-this-test",
            display_name="Evaluation Test",
        )
        problem = Problem(
            title="Evaluation Test Problem",
            slug=f"evaluation-test-{user_id.hex}",
            description="Fixture.",
            difficulty="easy",
            input_description="Input.",
            output_description="Output.",
            supported_languages=["python"],
        )
        db.add_all([user, problem])
        db.flush()
        test_cases = [
            ProblemTestCase(
                problem_id=problem.id,
                input_data=input_data,
                expected_output=expected_output,
                position=index,
                is_hidden=hidden,
            )
            for index, (input_data, expected_output, hidden) in enumerate(cases)
        ]
        db.add_all(test_cases)
        db.flush()
        submission = Submission(
            user_id=user.id,
            problem_id=problem.id,
            language="python",
            source_code=source_code,
            status="pending",
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission, test_cases


def load_submission(submission_id: UUID) -> Submission:
    with SessionLocal(bind=get_engine()) as db:
        return db.scalar(
            select(Submission)
            .options(selectinload(Submission.test_results))
            .where(Submission.id == submission_id)
        )


def test_accepted_submission_runs_every_case_and_persists_results() -> None:
    submission, _ = seed_submission([("first\n", "first\n", False), ("second\n", "second\n", True)])
    runner = FakeRunner([result("first\r\n \n"), result("second\n")])

    assert process_next_submission(runner)

    stored = load_submission(submission.id)
    assert stored.status == "accepted"
    assert stored.score == 100
    assert stored.execution_time_ms == 14
    assert [job.stdin_data for job in runner.jobs] == ["first\n", "second\n"]
    assert [item.status for item in stored.test_results] == ["accepted", "accepted"]
    assert stored.test_results[1].stdout is None
    assert stored.test_results[1].stderr is None


def test_output_comparison_preserves_internal_whitespace_and_stops_on_wrong_answer() -> None:
    submission, _ = seed_submission([("1\n", "a b\n", False), ("2\n", "unused", False)])
    runner = FakeRunner([result("a  b\n"), result("unused")])

    process_next_submission(runner)

    stored = load_submission(submission.id)
    assert stored.status == "wrong_answer"
    assert stored.score == 0
    assert [item.status for item in stored.test_results] == ["wrong_answer"]
    assert len(runner.jobs) == 1


@pytest.mark.parametrize(
    ("execution_status", "stderr", "error_message", "expected"),
    [
        (ExecutionStatus.FAILED, "RuntimeError: bad input", "Execution process exited with code 1.", "runtime_error"),
        (ExecutionStatus.TIMEOUT, "", "Execution exceeded time limit.", "time_limit_exceeded"),
        (ExecutionStatus.FAILED, "", "Execution output exceeded 65536 bytes.", "output_limit_exceeded"),
        (ExecutionStatus.FAILED, "SyntaxError: invalid syntax", "Execution process exited with code 1.", "compilation_error"),
        (ExecutionStatus.SYSTEM_ERROR, "", "Runtime unavailable.", "system_error"),
    ],
)
def test_execution_failures_map_to_judging_statuses(
    execution_status: ExecutionStatus, stderr: str, error_message: str, expected: str
) -> None:
    submission, _ = seed_submission([("x\n", "x\n", False)])
    runner = FakeRunner(
        [result(status=execution_status, stderr=stderr, exit_code=1, error_message=error_message)]
    )

    process_next_submission(runner)

    stored = load_submission(submission.id)
    assert stored.status == expected
    assert stored.test_results[0].status == expected


def test_hidden_case_details_are_not_exposed_by_submission_api() -> None:
    submission, _ = seed_submission([("SECRET_INPUT", "SECRET_EXPECTED", True)])
    process_next_submission(FakeRunner([result("SECRET_ACTUAL\n")]))
    client = TestClient(app)
    with SessionLocal(bind=get_engine()) as db:
        stored = db.get(Submission, submission.id)
        user_id = stored.user_id
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(user_id))

    response = client.get(f"/api/v1/submissions/{submission.id}")
    client.close()

    assert response.status_code == 200
    payload = response.json()
    serialized = response.text
    assert "SECRET_INPUT" not in serialized
    assert "SECRET_EXPECTED" not in serialized
    assert "SECRET_ACTUAL" not in serialized
    assert payload["test_results"][0]["is_hidden"] is True
    assert payload["test_results"][0]["stdout"] is None
    assert payload["test_results"][0]["stderr"] is None


def test_problem_with_no_test_cases_is_system_error() -> None:
    submission, _ = seed_submission([])

    process_next_submission(FakeRunner([]))

    stored = load_submission(submission.id)
    assert stored.status == "system_error"
    assert stored.error_message == "Problem has no configured test cases."
    assert stored.test_results == []


def test_submission_results_are_private_to_owner() -> None:
    submission, _ = seed_submission([("x\n", "x\n", False)])
    process_next_submission(FakeRunner([result("x\n")]))
    client = TestClient(app)
    other_id = uuid4()
    with SessionLocal(bind=get_engine()) as db:
        other = User(
            id=other_id,
            email=f"evaluation-test-{other_id.hex}@example.com",
            password_hash="not-used-by-this-test",
            display_name="Other User",
        )
        db.add(other)
        db.commit()
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(other_id))

    response = client.get(f"/api/v1/submissions/{submission.id}")
    client.close()

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "SUBMISSION_NOT_FOUND"


def test_evaluation_migration_created_per_case_result_table() -> None:
    inspector = inspect(get_engine())
    assert inspector.has_table("submission_test_results")
    assert {
        "submission_id",
        "test_case_id",
        "position",
        "is_hidden",
        "status",
        "execution_time_ms",
        "stdout",
        "stderr",
        "exit_code",
        "error_message",
    } <= {column["name"] for column in inspector.get_columns("submission_test_results")}
