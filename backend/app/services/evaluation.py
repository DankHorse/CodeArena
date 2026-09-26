import logging
import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import SessionLocal, get_engine
from app.models.problem import ProblemTestCase
from app.models.submission import Submission, SubmissionTestResult
from app.schemas.submissions import SubmissionStatus
from app.worker.execution import (
    ExecutionJob,
    ExecutionResult,
    ExecutionRunner,
    ExecutionStatus,
)

logger = logging.getLogger(__name__)

_PYTHON_COMPILE_ERROR = re.compile(r"(?m)^(?:SyntaxError|IndentationError|TabError):")


def normalize_output(output: str) -> str:
    """Normalize line endings and trailing whitespace only; preserve internal spacing."""
    return output.replace("\r\n", "\n").replace("\r", "\n").rstrip()


def _case_status(result: ExecutionResult) -> SubmissionStatus:
    if result.status == ExecutionStatus.TIMEOUT:
        return SubmissionStatus.TIME_LIMIT_EXCEEDED
    if result.status == ExecutionStatus.SYSTEM_ERROR:
        return SubmissionStatus.SYSTEM_ERROR
    if result.status == ExecutionStatus.FAILED:
        if result.error_message and result.error_message.startswith("Execution output exceeded "):
            return SubmissionStatus.OUTPUT_LIMIT_EXCEEDED
        if result.error_message == "Execution input exceeded its configured limit.":
            return SubmissionStatus.SYSTEM_ERROR
        if _PYTHON_COMPILE_ERROR.search(result.stderr):
            return SubmissionStatus.COMPILATION_ERROR
        return SubmissionStatus.RUNTIME_ERROR
    return SubmissionStatus.ACCEPTED


def _persist_case(
    session_factory: sessionmaker[Session],
    submission_id: UUID,
    test_case: ProblemTestCase,
    status: SubmissionStatus,
    result: ExecutionResult,
) -> None:
    with session_factory(bind=get_engine()) as db:
        if db.get(Submission, submission_id) is None:
            logger.error("Submission %s disappeared during evaluation", submission_id)
            return
        db.add(
            SubmissionTestResult(
                submission_id=submission_id,
                test_case_id=test_case.id,
                position=test_case.position,
                is_hidden=test_case.is_hidden,
                status=status.value,
                execution_time_ms=result.execution_time_ms,
                stdout=None if test_case.is_hidden else result.stdout,
                stderr=None if test_case.is_hidden else result.stderr,
                exit_code=result.exit_code,
                error_message=(
                    "Execution failed for this hidden test case."
                    if test_case.is_hidden and status != SubmissionStatus.ACCEPTED
                    else result.error_message
                ),
            )
        )
        db.commit()


def evaluate_submission(
    submission_id: UUID,
    runner: ExecutionRunner,
    *,
    session_factory: sessionmaker[Session] = SessionLocal,
) -> None:
    """Run test cases in order through the isolated runner, stopping at first failure."""
    with session_factory(bind=get_engine()) as db:
        submission = db.get(Submission, submission_id)
        if submission is None:
            logger.error("Submission %s disappeared before evaluation", submission_id)
            return
        test_cases = list(
            db.scalars(
                select(ProblemTestCase)
                .where(ProblemTestCase.problem_id == submission.problem_id)
                .order_by(ProblemTestCase.position, ProblemTestCase.id)
            )
        )
        job = ExecutionJob(
            submission_id=submission.id,
            language=submission.language,
            source_code=submission.source_code,
        )

    if not test_cases:
        _persist_final(
            session_factory,
            submission_id,
            SubmissionStatus.SYSTEM_ERROR,
            0,
            None,
            None,
            None,
            "Problem has no configured test cases.",
        )
        return

    passed = 0
    duration_ms = 0
    last_public_result: ExecutionResult | None = None
    last_exit_code: int | None = None
    final_status = SubmissionStatus.ACCEPTED
    final_error: str | None = None

    for test_case in test_cases:
        try:
            result = runner.execute(
                ExecutionJob(
                    submission_id=job.submission_id,
                    language=job.language,
                    source_code=job.source_code,
                    stdin_data=test_case.input_data,
                )
            )
        except Exception as exc:
            logger.warning(
                "Execution failed for submission %s (%s)", submission_id, type(exc).__name__
            )
            result = ExecutionResult(
                status=ExecutionStatus.SYSTEM_ERROR,
                stdout="",
                stderr="",
                exit_code=None,
                execution_time_ms=0,
                error_message="The isolated execution worker failed to run this test case.",
            )

        case_status = _case_status(result)
        if result.status == ExecutionStatus.COMPLETED:
            if normalize_output(result.stdout) == normalize_output(test_case.expected_output):
                case_status = SubmissionStatus.ACCEPTED
            else:
                case_status = SubmissionStatus.WRONG_ANSWER
        _persist_case(session_factory, submission_id, test_case, case_status, result)
        duration_ms += result.execution_time_ms
        last_exit_code = result.exit_code
        if not test_case.is_hidden:
            last_public_result = result

        if case_status == SubmissionStatus.ACCEPTED:
            passed += 1
            continue

        final_status = case_status
        final_error = (
            "Execution failed for a hidden test case."
            if test_case.is_hidden and case_status != SubmissionStatus.WRONG_ANSWER
            else result.error_message
        )
        break

    score = round((passed / len(test_cases)) * 100, 2)
    _persist_final(
        session_factory,
        submission_id,
        final_status,
        duration_ms,
        score,
        last_public_result.stdout if last_public_result else None,
        last_public_result.stderr if last_public_result else None,
        final_error,
        last_exit_code,
    )


def _persist_final(
    session_factory: sessionmaker[Session],
    submission_id: UUID,
    status: SubmissionStatus,
    duration_ms: int,
    score: float | None,
    stdout: str | None,
    stderr: str | None,
    error_message: str | None,
    exit_code: int | None = None,
) -> None:
    with session_factory(bind=get_engine()) as db:
        submission = db.get(Submission, submission_id)
        if submission is None:
            logger.error("Submission %s disappeared before final result persistence", submission_id)
            return
        submission.status = status.value
        submission.execution_time_ms = duration_ms
        submission.score = score
        submission.stdout = stdout
        submission.stderr = stderr
        submission.exit_code = exit_code
        submission.error_message = error_message
        db.commit()
