from uuid import UUID

import jwt
from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import APIError
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(get_settings().auth_cookie_name)
    if not token:
        raise APIError(401, "UNAUTHORIZED", "Authentication is required")

    try:
        claims = decode_access_token(token)
        user_id = UUID(claims["sub"])
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError) as exc:
        raise APIError(401, "UNAUTHORIZED", "Authentication token is invalid or expired") from exc

    user = db.get(User, user_id)
    if user is None:
        raise APIError(401, "UNAUTHORIZED", "Authenticated user no longer exists")
    if not user.is_active:
        raise APIError(403, "ACCOUNT_DISABLED", "This account is disabled")
    return user
