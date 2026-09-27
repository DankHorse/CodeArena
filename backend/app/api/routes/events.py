from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.authorization import get_organizer_user
from app.models.user import User
from app.schemas.events import (
    EventCreate,
    EventPage,
    EventPublic,
    EventRegistrationResponse,
    EventResponse,
    EventTransition,
    EventUpdate,
)
from app.services.events import (
    create_event,
    get_event,
    get_event_by_slug,
    list_public_events,
    register_for_event,
    transition_event,
    update_event,
)

router = APIRouter()


@router.get("", response_model=EventPage)
def events(
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict:
    rows, total = list_public_events(db, offset, limit)
    return {
        "items": [EventPublic.from_event(row) for row in rows],
        "offset": offset,
        "limit": limit,
        "total": total,
    }


@router.get("/by-slug/{slug}", response_model=EventPublic)
def event_by_slug(slug: str, db: Session = Depends(get_db)):
    return get_event_by_slug(db, slug)


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create(
    request: EventCreate,
    actor: User = Depends(get_organizer_user),
    db: Session = Depends(get_db),
):
    return create_event(db, request, actor)


@router.get("/{event_id}", response_model=EventResponse)
def event_detail(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_event(db, event_id, actor=actor)


@router.patch("/{event_id}", response_model=EventResponse)
def event_update(
    event_id: UUID,
    request: EventUpdate,
    actor: User = Depends(get_organizer_user),
    db: Session = Depends(get_db),
):
    return update_event(db, event_id, request, actor)


@router.post("/{event_id}/transition", response_model=EventResponse)
def event_transition(
    event_id: UUID,
    request: EventTransition,
    actor: User = Depends(get_organizer_user),
    db: Session = Depends(get_db),
):
    return transition_event(db, event_id, request.status, actor)


@router.post(
    "/{event_id}/registrations",
    response_model=EventRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    registration = register_for_event(db, event_id, actor)
    return {
        "id": registration.id,
        "event_id": registration.event_id,
        "created_at": registration.created_at,
    }
