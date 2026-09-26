from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.authorization import get_admin_user
from app.models.problem import Problem
from app.schemas.problems import ProblemCreate, ProblemDetail, ProblemSummary, ProblemUpdate
from app.services.problems import (
    create_problem,
    deactivate_problem,
    get_problem,
    list_problems,
    update_problem,
)

router = APIRouter()


@router.get(
    "",
    response_model=list[ProblemSummary],
    summary="List published coding problems",
    description=(
        "Returns active problems. Optional exact difficulty/category filters and a title/description "
        "search are supported. This public response contains no test-case data."
    ),
)
def problems_index(
    difficulty: str | None = Query(default=None, pattern="^(easy|medium|hard)$"),
    category: str | None = Query(default=None, max_length=80),
    search: str | None = Query(default=None, min_length=1, max_length=100),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[Problem]:
    return list_problems(
        db, difficulty=difficulty, category=category, search=search, offset=offset, limit=limit
    )


@router.get(
    "/{slug}",
    response_model=ProblemDetail,
    summary="Get a coding problem",
    description=(
        "Returns the active problem and its public examples. Hidden test cases and execution limits "
        "are never included."
    ),
    responses={404: {"description": "Problem not found"}},
)
def problem_detail(slug: str, db: Session = Depends(get_db)) -> ProblemDetail:
    return get_problem(db, slug)


@router.post(
    "",
    response_model=ProblemDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a problem",
    description=(
        "Administrator only. If slug is omitted, it is generated from title. Test cases can include "
        "hidden cases, but the response returns public examples only."
    ),
    responses={401: {"description": "Authentication required"}, 403: {"description": "Administrator role required"}, 409: {"description": "Slug conflict"}},
)
def problem_create(
    request: ProblemCreate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
) -> ProblemDetail:
    return create_problem(db, request)


@router.patch(
    "/{problem_id}",
    response_model=ProblemDetail,
    summary="Update a problem",
    description=(
        "Administrator only. When test_cases is supplied it replaces the complete case set. "
        "The response returns public examples only."
    ),
    responses={401: {"description": "Authentication required"}, 403: {"description": "Administrator role required"}, 404: {"description": "Problem not found"}, 409: {"description": "Slug conflict"}},
)
def problem_update(
    problem_id: UUID,
    request: ProblemUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
) -> ProblemDetail:
    return update_problem(db, problem_id, request)


@router.delete(
    "/{problem_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a problem",
    description="Administrator only. Deactivates instead of deleting so submissions can retain their references.",
    responses={401: {"description": "Authentication required"}, 403: {"description": "Administrator role required"}, 404: {"description": "Problem not found"}},
)
def problem_delete(
    problem_id: UUID,
    db: Session = Depends(get_db),
    _admin=Depends(get_admin_user),
) -> Response:
    deactivate_problem(db, problem_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
