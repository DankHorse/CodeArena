from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.projects import (
    GalleryPage,
    GalleryProjectResponse,
    ProjectCreate,
    ProjectPrivateResponse,
    ProjectUpdate,
)
from app.services.projects import (
    create_draft,
    finalize_project,
    get_project,
    list_gallery,
    update_draft,
)

router = APIRouter()
gallery_router = APIRouter()


@router.post(
    "/events/{event_id}/projects",
    response_model=ProjectPrivateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    event_id: UUID,
    request: ProjectCreate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_draft(db, event_id, request, actor)


@router.get("/projects/{project_id}", response_model=ProjectPrivateResponse)
def project_detail(
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_project(db, project_id, actor)


@router.patch("/projects/{project_id}", response_model=ProjectPrivateResponse)
def edit_project(
    project_id: UUID,
    request: ProjectUpdate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_draft(db, project_id, request, actor)


@router.post("/projects/{project_id}/submit", response_model=ProjectPrivateResponse)
def submit_project(
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return finalize_project(db, project_id, actor)


@gallery_router.get("/gallery/projects", response_model=GalleryPage)
def gallery(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    event_slug: str | None = None,
    search: str | None = Query(None, max_length=100),
    db: Session = Depends(get_db),
):
    items, total = list_gallery(
        db, offset=offset, limit=limit, event_slug=event_slug, search=search
    )
    return {
        "items": [GalleryProjectResponse.model_validate(item) for item in items],
        "offset": offset,
        "limit": limit,
        "total": total,
    }
