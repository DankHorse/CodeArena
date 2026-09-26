from app.api.routes.auth import router as auth_router
from app.api.routes.problems import router as problems_router
from app.api.routes.statistics import leaderboard_router, router as statistics_router
from app.api.routes.submissions import problem_submissions_router, router as submissions_router
from fastapi import APIRouter

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(problems_router, prefix="/problems", tags=["problems"])
router.include_router(problem_submissions_router, prefix="/problems", tags=["submissions"])
router.include_router(submissions_router, prefix="/submissions", tags=["submissions"])
router.include_router(statistics_router, prefix="/statistics", tags=["statistics"])
router.include_router(leaderboard_router, tags=["leaderboard"])
