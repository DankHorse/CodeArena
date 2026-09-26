from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.submission import Submission
from app.models.user import User
from app.schemas.submissions import (
    SubmissionCreate,
    SubmissionListItem,
    SubmissionResponse,
    SubmissionStatus,
)
from app.services.submissions import (
    create_submission,
    get_user_submission,
    list_user_problem_submissions,
    list_user_submissions,
)

router = APIRouter()
problem_submissions_router = APIRouter()


@router.post(
    "",
    response_model=SubmissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a code submission",
    description=(
        "Authenticated users submit only problem_id, language, and source_code. The server assigns "
        "pending status and persists the submission. The isolated worker evaluates cases asynchronously."
    ),
    responses={
        401: {"description": "Authentication required"},
        404: {"description": "Problem not found"},
        409: {"description": "Problem is unpublished"},
        422: {"description": "Invalid request, unsupported language, or oversized source"},
    },
)
def submission_create(
    request: SubmissionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Submission:
    return create_submission(db, user.id, request)


@router.get(
    "",
    response_model=list[SubmissionListItem],
    summary="List the current user's submissions",
    description=(
        "Returns only the authenticated user's submissions, newest first. Source code is omitted "
        "from list items. Use problem_id and/or status to filter and offset/limit for pagination."
    ),
    responses={401: {"description": "Authentication required"}},
)
def submissions_index(
    problem_id: UUID | None = Query(default=None),
    status: SubmissionStatus | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Submission]:
    return list_user_submissions(
        db,
        user.id,
        problem_id=problem_id,
        status=status.value if status else None,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/{submission_id}",
    response_model=SubmissionResponse,
    summary="Get one of the current user's submissions",
    description=(
        "Returns source code and result fields only to the submission owner. Per-test results "
        "never include test inputs or expected outputs; hidden-case stdout and stderr are omitted."
    ),
    responses={401: {"description": "Authentication required"}, 404: {"description": "Submission not found"}},
)
def submission_detail(
    submission_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Submission:
    return get_user_submission(db, user.id, submission_id)


@problem_submissions_router.get(
    "/{slug}/submissions",
    response_model=list[SubmissionListItem],
    summary="List the current user's submissions for a problem",
    description="Returns only the authenticated user's submissions for the problem, newest first.",
    responses={401: {"description": "Authentication required"}, 404: {"description": "Problem not found"}},
)
def problem_submissions(
    slug: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Submission]:
    return list_user_problem_submissions(db, user.id, slug, offset=offset, limit=limit)
