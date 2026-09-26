from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import RegisterRequest


def register_user(db: Session, request: RegisterRequest) -> User:
    email = str(request.email).strip().casefold()
    if db.scalar(select(User.id).where(User.email == email)) is not None:
        raise APIError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists")

    user = User(
        email=email,
        password_hash=hash_password(request.password.get_secret_value()),
        display_name=request.display_name.strip(),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists") from exc
    db.refresh(user)
    return user


def authenticate_user(db: Session, request_email: str, password: str) -> tuple[User, str]:
    email = request_email.strip().casefold()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(password, user.password_hash):
        raise APIError(401, "INVALID_CREDENTIALS", "Email or password is incorrect")
    if not user.is_active:
        raise APIError(403, "ACCOUNT_DISABLED", "This account is disabled")

    return user, create_access_token(user.id)
