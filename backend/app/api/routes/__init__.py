from app.api.routes.auth import router as auth_router
from app.api.routes.admin import router as admin_router
from app.api.routes.events import router as events_router
from app.api.routes.problems import router as problems_router
from app.api.routes.projects import gallery_router, router as projects_router
from app.api.routes.statistics import leaderboard_router, router as statistics_router
from app.api.routes.submissions import problem_submissions_router, router as submissions_router
from app.api.routes.teams import invitation_router, router as teams_router
from app.api.routes.judging import router as judging_router
from fastapi import APIRouter

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(admin_router, prefix="/admin", tags=["admin"])
router.include_router(events_router, prefix="/events", tags=["events"])
router.include_router(teams_router, tags=["teams"])
router.include_router(invitation_router, tags=["teams"])
router.include_router(projects_router, tags=["projects"])
router.include_router(gallery_router, tags=["public gallery"])
router.include_router(problems_router, prefix="/problems", tags=["problems"])
router.include_router(problem_submissions_router, prefix="/problems", tags=["submissions"])
router.include_router(submissions_router, prefix="/submissions", tags=["submissions"])
router.include_router(statistics_router, prefix="/statistics", tags=["statistics"])
router.include_router(leaderboard_router, tags=["leaderboard"])
router.include_router(judging_router, tags=["DOGFOOD judging"])
