from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.statistics import LeaderboardPage, UserStatisticsResponse
from app.services.statistics import get_leaderboard, get_user_statistics

router = APIRouter()
leaderboard_router = APIRouter()


@router.get(
    "/me",
    response_model=UserStatisticsResponse,
    summary="Get the current user's submission statistics",
    description=(
        "Counts all owned submissions in total_submissions. Acceptance rate includes only judged "
        "results and excludes pending/running, infrastructure errors, and legacy process-only results."
    ),
    responses={401: {"description": "Authentication required"}, 403: {"description": "Account disabled"}},
)
def my_statistics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserStatisticsResponse:
    return get_user_statistics(db, user.id)


@leaderboard_router.get(
    "/leaderboard",
    response_model=LeaderboardPage,
    summary="Get the public coding leaderboard",
    description=(
        "Ranks active users by the number of distinct active problems with an accepted submission. "
        "Equal solve counts share a dense rank; display name and an internal ID provide stable page order. "
        "Only display name, rank, and solved count are returned."
    ),
)
def leaderboard(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> LeaderboardPage:
    return get_leaderboard(db, offset=offset, limit=limit)
