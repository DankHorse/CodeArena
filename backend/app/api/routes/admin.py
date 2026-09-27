from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.authorization import get_admin_user
from app.models.user import User
from app.schemas.admin import RoleUpdate, RoleUpdateResponse
from app.services.events import organizer_role_update

router = APIRouter()


@router.patch("/users/{user_id}/role", response_model=RoleUpdateResponse)
def set_user_role(
    user_id: UUID,
    request: RoleUpdate,
    _actor: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    return organizer_role_update(db, user_id, request.role)
