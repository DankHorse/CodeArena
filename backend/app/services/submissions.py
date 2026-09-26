from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.problem import Problem
from app.models.submission import Submission
from app.schemas.submissions import SubmissionCreate, SubmissionStatus


def create_submission(db: Session, user_id: UUID, request: SubmissionCreate) -> Submission:
    problem = db.get(Problem, request.problem_id)
    if problem is None:
        raise APIError(404, "PROBLEM_NOT_FOUND", "Problem was not found")
    if not problem.is_active:
        raise APIError(409, "PROBLEM_NOT_PUBLISHED", "Submissions are not accepted for this problem")
    supported_languages = {language.lower() for language in problem.supported_languages}
    if request.language not in supported_languages:
        raise APIError(422, "UNSUPPORTED_LANGUAGE", "This language is not supported for the problem")

    submission = Submission(
        user_id=user_id,
        problem_id=problem.id,
        language=request.language,
        source_code=request.source_code,
        status=SubmissionStatus.PENDING.value,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)
    return submission


def list_user_submissions(
    db: Session,
    user_id: UUID,
    *,
    problem_id: UUID | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> list[Submission]:
    query = select(Submission).where(Submission.user_id == user_id)
    if problem_id is not None:
        query = query.where(Submission.problem_id == problem_id)
    if status is not None:
        query = query.where(Submission.status == status)
    return list(
        db.scalars(
            query.order_by(Submission.created_at.desc(), Submission.id.desc())
            .offset(offset)
            .limit(limit)
        )
    )


def get_user_submission(db: Session, user_id: UUID, submission_id: UUID) -> Submission:
    submission = db.scalar(
        select(Submission).where(
            Submission.id == submission_id,
            Submission.user_id == user_id,
        )
    )
    if submission is None:
        raise APIError(404, "SUBMISSION_NOT_FOUND", "Submission was not found")
    return submission


def list_user_problem_submissions(
    db: Session, user_id: UUID, slug: str, *, offset: int = 0, limit: int = 50
) -> list[Submission]:
    problem = db.scalar(select(Problem).where(Problem.slug == slug))
    if problem is None:
        raise APIError(404, "PROBLEM_NOT_FOUND", "Problem was not found")
    return list_user_submissions(db, user_id, problem_id=problem.id, offset=offset, limit=limit)
