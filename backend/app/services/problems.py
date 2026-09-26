import re
import unicodedata
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.errors import APIError
from app.models.problem import Problem, ProblemTestCase
from app.schemas.problems import (
    ProblemCreate,
    ProblemDetail,
    ProblemExample,
    ProblemSummary,
    ProblemUpdate,
    TestCaseWrite,
)


def _slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return slug[:180].strip("-") or "problem"


def _test_case(row: TestCaseWrite, problem_id: UUID) -> ProblemTestCase:
    return ProblemTestCase(problem_id=problem_id, **row.model_dump())


def _detail(problem: Problem) -> ProblemDetail:
    data = ProblemSummary.model_validate(problem).model_dump()
    data.update(
        description=problem.description,
        constraints=problem.constraints,
        input_description=problem.input_description,
        output_description=problem.output_description,
        starter_code=problem.starter_code,
    )
    data["examples"] = [
        ProblemExample.model_validate(case).model_dump()
        for case in problem.test_cases
        if not case.is_hidden
    ]
    return ProblemDetail.model_validate(data)


def list_problems(
    db: Session,
    *,
    difficulty: str | None = None,
    category: str | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> list[Problem]:
    query = select(Problem).where(Problem.is_active.is_(True))
    if difficulty:
        query = query.where(Problem.difficulty == difficulty)
    if category:
        query = query.where(Problem.category.ilike(category))
    if search:
        term = f"%{search.strip()}%"
        query = query.where(Problem.title.ilike(term) | Problem.description.ilike(term))
    return list(db.scalars(query.order_by(Problem.title, Problem.id).offset(offset).limit(limit)))


def get_problem(db: Session, slug: str) -> ProblemDetail:
    problem = db.scalar(
        select(Problem)
        .options(selectinload(Problem.test_cases))
        .where(Problem.slug == slug, Problem.is_active.is_(True))
    )
    if problem is None:
        raise APIError(404, "PROBLEM_NOT_FOUND", "Problem was not found")
    return _detail(problem)


def create_problem(db: Session, request: ProblemCreate) -> ProblemDetail:
    slug = request.slug or _slugify(request.title)
    problem = Problem(
        title=request.title.strip(),
        slug=slug,
        description=request.description,
        difficulty=request.difficulty.value,
        category=request.category.strip() if request.category else None,
        constraints=request.constraints,
        input_description=request.input_description,
        output_description=request.output_description,
        starter_code=request.starter_code,
        supported_languages=request.supported_languages,
    )
    try:
        db.add(problem)
        db.flush()
        problem.test_cases = [_test_case(row, problem.id) for row in request.test_cases]
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "PROBLEM_SLUG_CONFLICT", "A problem with this slug already exists") from exc
    db.refresh(problem)
    return _detail(db.scalar(
        select(Problem).options(selectinload(Problem.test_cases)).where(Problem.id == problem.id)
    ))


def update_problem(db: Session, problem_id: UUID, request: ProblemUpdate) -> ProblemDetail:
    problem = db.scalar(
        select(Problem).options(selectinload(Problem.test_cases)).where(Problem.id == problem_id)
    )
    if problem is None:
        raise APIError(404, "PROBLEM_NOT_FOUND", "Problem was not found")

    changes = request.model_dump(exclude_unset=True)
    test_cases = changes.pop("test_cases", None)
    for key, value in changes.items():
        if key == "difficulty" and value is not None:
            value = value.value
        if key == "category" and value is not None:
            value = value.strip()
        if key == "title" and value is not None:
            value = value.strip()
        setattr(problem, key, value)

    if test_cases is not None:
        problem.test_cases.clear()
        problem.test_cases.extend(_test_case(row, problem.id) for row in test_cases)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "PROBLEM_SLUG_CONFLICT", "A problem with this slug already exists") from exc
    return get_problem(db, problem.slug) if problem.is_active else _detail(problem)


def deactivate_problem(db: Session, problem_id: UUID) -> None:
    problem = db.get(Problem, problem_id)
    if problem is None:
        raise APIError(404, "PROBLEM_NOT_FOUND", "Problem was not found")
    problem.is_active = False
    db.commit()
