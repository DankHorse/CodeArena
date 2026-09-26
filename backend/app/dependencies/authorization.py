from fastapi import Depends

from app.core.errors import APIError
from app.dependencies.auth import get_current_user
from app.models.user import User


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise APIError(403, "FORBIDDEN", "Administrator access is required")
    return user
