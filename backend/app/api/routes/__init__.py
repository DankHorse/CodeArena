from app.api.routes.auth import router as auth_router
from app.api.routes.problems import router as problems_router
from fastapi import APIRouter

router = APIRouter()

router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(problems_router, prefix="/problems", tags=["problems"])
