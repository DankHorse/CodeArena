from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.comment import ProjectComment
from app.models.event import Event
from app.models.project import ProjectSubmission
from app.models.user import User
from app.schemas.comments import ProjectCommentCreate


def _get_project(db: Session, event_id: UUID, project_id: UUID) -> ProjectSubmission:
    project = db.scalar(
        select(ProjectSubmission).where(
            ProjectSubmission.id == project_id,
            ProjectSubmission.event_id == event_id,
        )
    )

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return project


def list_comments(
    db: Session,
    *,
    event_id: UUID,
    project_id: UUID,
) -> list[ProjectComment]:
    project = _get_project(db, event_id, project_id)

    if project.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    return db.scalars(
        select(ProjectComment)
        .where(
            ProjectComment.event_id == event_id,
            ProjectComment.project_id == project_id,
        )
        .order_by(ProjectComment.created_at.asc(), ProjectComment.id.asc())
    ).all()


def create_comment(
    db: Session,
    *,
    event_id: UUID,
    project_id: UUID,
    actor: User,
    payload: ProjectCommentCreate,
) -> ProjectComment:
    if actor.role != "participant":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only participants can comment",
        )

    if not actor.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive users cannot comment",
        )

    project = _get_project(db, event_id, project_id)

    if project.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Comments are only allowed on submitted projects",
        )

    event = db.scalar(
        select(Event).where(Event.id == event_id)
    )
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    body = payload.body.strip()
    if not body:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Comment body cannot be blank",
        )

    comment = ProjectComment(
        event_id=event_id,
        project_id=project_id,
        author_id=actor.id,
        body=body,
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    return comment
