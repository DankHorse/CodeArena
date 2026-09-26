import logging
import time
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.session import SessionLocal, get_engine
from app.models.submission import Submission
from app.schemas.submissions import SubmissionStatus
from app.worker.execution import (
    DockerExecutionRunner,
    ExecutionJob,
    ExecutionResult,
    ExecutionRunner,
    ExecutionStatus,
)

logger = logging.getLogger(__name__)


def _claim_next_submission(session_factory: sessionmaker[Session]) -> ExecutionJob | None:
    with session_factory(bind=get_engine()) as db:
        submission = db.scalar(
            select(Submission)
            .where(Submission.status == SubmissionStatus.PENDING.value)
            .order_by(Submission.created_at, Submission.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if submission is None:
            db.rollback()
            return None

        submission.status = SubmissionStatus.RUNNING.value
        job = ExecutionJob(
            submission_id=submission.id,
            language=submission.language,
            source_code=submission.source_code,
        )
        db.commit()
        return job


def _persist_result(
    session_factory: sessionmaker[Session], submission_id: UUID, result: ExecutionResult
) -> None:
    with session_factory(bind=get_engine()) as db:
        submission = db.get(Submission, submission_id)
        if submission is None:
            logger.error("Submission %s disappeared while execution was running", submission_id)
            return
        submission.status = result.status.value
        submission.stdout = result.stdout
        submission.stderr = result.stderr
        submission.exit_code = result.exit_code
        submission.execution_time_ms = result.execution_time_ms
        submission.error_message = result.error_message
        db.commit()


def process_next_submission(
    runner: ExecutionRunner | None = None,
    *,
    session_factory: sessionmaker[Session] = SessionLocal,
) -> bool:
    job = _claim_next_submission(session_factory)
    if job is None:
        return False

    try:
        result = (runner or DockerExecutionRunner()).execute(job)
    except Exception as exc:
        logger.warning(
            "Execution failed for submission %s (%s)", job.submission_id, type(exc).__name__
        )
        result = ExecutionResult(
            status=ExecutionStatus.SYSTEM_ERROR,
            stdout="",
            stderr="",
            exit_code=None,
            execution_time_ms=0,
            error_message="The isolated execution worker failed to run this submission.",
        )

    _persist_result(session_factory, job.submission_id, result)
    return True


def run_worker(runner: ExecutionRunner | None = None) -> None:
    runner = runner or DockerExecutionRunner()
    poll_interval = get_settings().worker_poll_interval_seconds
    logger.info("Isolated execution worker started")
    while True:
        try:
            found_work = process_next_submission(runner)
        except Exception:
            logger.exception("Worker failed while processing a submission")
            found_work = False
        if not found_work:
            time.sleep(poll_interval)
