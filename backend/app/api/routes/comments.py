from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.comments import ProjectCommentCreate, ProjectCommentResponse
from app.services.comments import create_comment, list_comments

router = APIRouter()


@router.get(
    "/events/{event_id}/projects/{project_id}/comments",
    response_model=list[ProjectCommentResponse],
)
def get_project_comments(
    event_id: UUID,
    project_id: UUID,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return list_comments(
        db,
        event_id=event_id,
        project_id=project_id,
    )


@router.post(
    "/events/{event_id}/projects/{project_id}/comments",
    response_model=ProjectCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_project_comment(
    event_id: UUID,
    project_id: UUID,
    payload: ProjectCommentCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    return create_comment(
        db,
        event_id=event_id,
        project_id=project_id,
        actor=actor,
        payload=payload,
    )
