from pathlib import Path
import shutil
import subprocess
from uuid import uuid4

import pytest
from sqlalchemy import delete, or_, select

from app.core.config import Settings, get_settings
from app.db.session import SessionLocal, get_engine
from app.models.problem import Problem, ProblemTestCase
from app.models.submission import Submission
from app.models.user import User
from app.worker.execution import (
    DockerExecutionRunner,
    ExecutionJob,
    ExecutionResult,
    ExecutionStatus,
)
from app.worker.service import process_next_submission


@pytest.fixture(autouse=True)
def clean_worker_test_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        test_users = select(User.id).where(User.email.like("worker-test-%@example.com"))
        test_problems = select(Problem.id).where(Problem.slug.like("worker-test-%"))
        db.execute(
            delete(Submission).where(
                or_(Submission.user_id.in_(test_users), Submission.problem_id.in_(test_problems))
            )
        )
        db.execute(delete(Problem).where(Problem.slug.like("worker-test-%")))
        db.execute(delete(User).where(User.email.like("worker-test-%@example.com")))
        db.commit()


def enqueue_submission() -> Submission:
    user_id = uuid4()
    with SessionLocal(bind=get_engine()) as db:
        user = User(
            id=user_id,
            email=f"worker-test-{user_id.hex}@example.com",
            password_hash="not-used-by-this-test",
            display_name="Worker Test",
        )
        problem = Problem(
            title="Worker Test Problem",
            slug=f"worker-test-{user_id.hex}",
            description="Worker fixture.",
            difficulty="easy",
            input_description="Input.",
            output_description="Output.",
            supported_languages=["python"],
        )
        db.add_all([user, problem])
        db.flush()
        db.add(
            ProblemTestCase(
                problem_id=problem.id,
                input_data="",
                expected_output="isolated\n",
                position=0,
            )
        )
        submission = Submission(
            user_id=user.id,
            problem_id=problem.id,
            language="python",
            source_code="print('isolated')",
            status="pending",
        )
        db.add(submission)
        db.commit()
        db.refresh(submission)
        return submission


class FakeRunner:
    def __init__(self, result: ExecutionResult | None = None, error: Exception | None = None):
        self.result = result
        self.error = error
        self.job: ExecutionJob | None = None
        self.observed_status: str | None = None

    def execute(self, job: ExecutionJob) -> ExecutionResult:
        self.job = job
        with SessionLocal(bind=get_engine()) as db:
            self.observed_status = db.get(Submission, job.submission_id).status
        if self.error:
            raise self.error
        assert self.result is not None
        return self.result


def test_worker_claims_submission_and_persists_evaluation_result() -> None:
    submission = enqueue_submission()
    runner = FakeRunner(
        ExecutionResult(
            status=ExecutionStatus.COMPLETED,
            stdout="isolated\n",
            stderr="",
            exit_code=0,
            execution_time_ms=18,
        )
    )

    assert process_next_submission(runner)

    assert runner.job is not None
    assert runner.job.submission_id == submission.id
    assert runner.job.source_code == "print('isolated')"
    assert runner.observed_status == "running"
    with SessionLocal(bind=get_engine()) as db:
        result = db.get(Submission, submission.id)
    assert result.status == "accepted"
    assert result.stdout == "isolated\n"
    assert result.stderr == ""
    assert result.exit_code == 0
    assert result.execution_time_ms == 18


def test_worker_maps_process_failure_to_runtime_error() -> None:
    submission = enqueue_submission()
    runner = FakeRunner(
        ExecutionResult(
            status=ExecutionStatus.FAILED,
            stdout="partial",
            stderr="Traceback: example failure",
            exit_code=1,
            execution_time_ms=21,
            error_message="Execution process exited with code 1.",
        )
    )

    assert process_next_submission(runner)
    with SessionLocal(bind=get_engine()) as db:
        result = db.get(Submission, submission.id)
    assert result.status == "runtime_error"
    assert result.exit_code == 1
    assert result.stderr == "Traceback: example failure"
    assert result.error_message == "Execution process exited with code 1."
    assert result.score == 0


def test_worker_persists_timeout_result() -> None:
    submission = enqueue_submission()
    runner = FakeRunner(
        ExecutionResult(
            status=ExecutionStatus.TIMEOUT,
            stdout="",
            stderr="",
            exit_code=-9,
            execution_time_ms=5_000,
            error_message="Execution exceeded 5 seconds.",
        )
    )

    assert process_next_submission(runner)
    with SessionLocal(bind=get_engine()) as db:
        result = db.get(Submission, submission.id)
    assert result.status == "time_limit_exceeded"
    assert result.execution_time_ms == 5_000
    assert result.error_message == "Execution exceeded 5 seconds."


def test_worker_exception_is_persisted_as_system_error() -> None:
    submission = enqueue_submission()

    assert process_next_submission(FakeRunner(error=RuntimeError("runtime secret must not leak")))
    with SessionLocal(bind=get_engine()) as db:
        result = db.get(Submission, submission.id)
    assert result.status == "system_error"
    assert result.error_message == "The isolated execution worker failed to run this test case."
    assert "runtime secret" not in result.error_message


def test_worker_returns_false_when_there_are_no_pending_submissions() -> None:
    assert process_next_submission(FakeRunner(error=AssertionError("must not execute"))) is False


def test_docker_command_enforces_isolation_and_resource_limits() -> None:
    runner = DockerExecutionRunner(
        Settings(
            execution_docker_binary="docker",
            execution_docker_image="python:3.12-slim",
            execution_timeout_seconds=5,
            execution_memory_limit_mb=128,
            execution_cpu_limit=0.5,
            execution_pids_limit=32,
        )
    )
    command = runner._build_command(
        ExecutionJob(uuid4(), "python", "print('ok')"), Path("/tmp/main.py"), "codearena-test"
    )

    for required in (
        "--network=none",
        "--read-only",
        "--memory=128m",
        "--memory-swap=128m",
        "--cpus=0.5",
        "--pids-limit=32",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges:true",
        "--user=65534:65534",
        "--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16m",
    ):
        assert required in command
    mount = next(argument for argument in command if argument.startswith("--mount="))
    assert mount.endswith("dst=/workspace/main.py,readonly")
    assert "--privileged" not in command
    assert command[-4:] == ["python", "-I", "-B", "/workspace/main.py"]


def docker_image_available() -> bool:
    settings = get_settings()
    if not shutil.which(settings.execution_docker_binary):
        return False
    daemon = subprocess.run(
        [settings.execution_docker_binary, "info"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    image = subprocess.run(
        [settings.execution_docker_binary, "image", "inspect", settings.execution_docker_image],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return daemon.returncode == 0 and image.returncode == 0


def test_docker_runner_executes_code_in_container() -> None:
    if not docker_image_available():
        pytest.skip("Docker Engine and configured execution image are required")
    runner = DockerExecutionRunner()

    result = runner.execute(ExecutionJob(uuid4(), "python", "print('sandbox-ok')"))

    assert result.status == ExecutionStatus.COMPLETED
    assert result.stdout == "sandbox-ok\n"
    assert result.exit_code == 0
    assert result.execution_time_ms > 0


def test_docker_runner_terminates_timed_out_container() -> None:
    if not docker_image_available():
        pytest.skip("Docker Engine and configured execution image are required")
    runner = DockerExecutionRunner(Settings(execution_timeout_seconds=1))

    result = runner.execute(ExecutionJob(uuid4(), "python", "while True: pass"))

    assert result.status == ExecutionStatus.TIMEOUT
    assert result.error_message == "Execution exceeded the 1-second time limit."


def test_docker_runner_captures_nonzero_process_result() -> None:
    if not docker_image_available():
        pytest.skip("Docker Engine and configured execution image are required")
    source = "import sys\nprint('stdout-value')\nprint('stderr-value', file=sys.stderr)\nraise SystemExit(7)"

    result = DockerExecutionRunner().execute(ExecutionJob(uuid4(), "python", source))

    assert result.status == ExecutionStatus.FAILED
    assert result.stdout == "stdout-value\n"
    assert result.stderr == "stderr-value\n"
    assert result.exit_code == 7
    assert result.error_message == "Execution process exited with code 7."


def test_docker_runner_stops_when_output_limit_is_exceeded() -> None:
    if not docker_image_available():
        pytest.skip("Docker Engine and configured execution image are required")
    settings = Settings(execution_max_output_bytes=1_024)

    result = DockerExecutionRunner(settings).execute(
        ExecutionJob(uuid4(), "python", "print('x' * 200_000)")
    )

    assert result.status == ExecutionStatus.FAILED
    assert len(result.stdout.encode("utf-8")) + len(result.stderr.encode("utf-8")) <= 1_024
    assert result.error_message == "Execution output exceeded 1024 bytes."
