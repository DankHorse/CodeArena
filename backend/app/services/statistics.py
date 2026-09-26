from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.problem import Problem
from app.models.submission import Submission
from app.models.user import User
from app.schemas.statistics import (
    LeaderboardEntry,
    LeaderboardPage,
    ProblemStatisticsResponse,
    UserStatisticsResponse,
)

JUDGED_STATUSES = (
    "accepted",
    "wrong_answer",
    "compilation_error",
    "runtime_error",
    "time_limit_exceeded",
    "output_limit_exceeded",
)


def _acceptance_rate(accepted: int, judged: int) -> float:
    return round(accepted / judged * 100, 2) if judged else 0.0


def get_user_statistics(db: Session, user_id: UUID) -> UserStatisticsResponse:
    total = db.scalar(
        select(func.count()).select_from(Submission).where(Submission.user_id == user_id)
    ) or 0
    counts = dict(
        db.execute(
            select(Submission.status, func.count())
            .where(Submission.user_id == user_id)
            .group_by(Submission.status)
        ).all()
    )
    judged = sum(counts.get(status, 0) for status in JUDGED_STATUSES)
    accepted = counts.get("accepted", 0)
    solved = db.scalar(
        select(func.count(func.distinct(Submission.problem_id))).where(
            Submission.user_id == user_id,
            Submission.status == "accepted",
        )
    ) or 0
    return UserStatisticsResponse(
        total_submissions=total,
        judged_submissions=judged,
        accepted_submissions=accepted,
        solved_problems=solved,
        acceptance_rate=_acceptance_rate(accepted, judged),
    )


def get_problem_statistics(db: Session, slug: str) -> ProblemStatisticsResponse:
    problem = db.scalar(
        select(Problem).where(Problem.slug == slug, Problem.is_active.is_(True))
    )
    if problem is None:
        raise APIError(404, "PROBLEM_NOT_FOUND", "Problem was not found")

    total = db.scalar(
        select(func.count()).select_from(Submission).where(Submission.problem_id == problem.id)
    ) or 0
    counts = dict(
        db.execute(
            select(Submission.status, func.count())
            .where(Submission.problem_id == problem.id)
            .group_by(Submission.status)
        ).all()
    )
    judged = sum(counts.get(status, 0) for status in JUDGED_STATUSES)
    accepted = counts.get("accepted", 0)
    solvers = db.scalar(
        select(func.count(func.distinct(Submission.user_id)))
        .where(
            Submission.problem_id == problem.id,
            Submission.status == "accepted",
        )
    ) or 0
    return ProblemStatisticsResponse(
        problem_slug=problem.slug,
        total_submissions=total,
        judged_submissions=judged,
        accepted_submissions=accepted,
        unique_solvers=solvers,
        acceptance_rate=_acceptance_rate(accepted, judged),
    )


def get_leaderboard(db: Session, *, offset: int = 0, limit: int = 50) -> LeaderboardPage:
    solved = func.count(func.distinct(Submission.problem_id)).label("solved_problems")
    rankings = (
        select(
            User.id.label("user_id"),
            User.display_name.label("display_name"),
            solved,
        )
        .join(Submission, Submission.user_id == User.id)
        .join(Problem, Problem.id == Submission.problem_id)
        .where(
            User.is_active.is_(True),
            Problem.is_active.is_(True),
            Submission.status == "accepted",
        )
        .group_by(User.id, User.display_name)
        .subquery()
    )
    total = db.scalar(select(func.count()).select_from(rankings)) or 0
    rows = db.execute(
        select(
            func.dense_rank()
            .over(order_by=rankings.c.solved_problems.desc())
            .label("rank"),
            rankings.c.display_name,
            rankings.c.solved_problems,
        )
        .order_by(
            rankings.c.solved_problems.desc(),
            rankings.c.display_name.asc(),
            rankings.c.user_id.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).all()
    return LeaderboardPage(
        items=[
            LeaderboardEntry(
                rank=row.rank,
                display_name=row.display_name,
                solved_problems=row.solved_problems,
            )
            for row in rows
        ],
        total=total,
        offset=offset,
        limit=limit,
    )
