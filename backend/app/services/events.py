import re
import unicodedata
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.event import Event, EventRegistration
from app.models.judging import JudgeEventAssignment
from app.models.user import User
from app.schemas.events import EventCreate, EventUpdate

_SCHEDULE_FIELDS = (
    "registration_opens_at",
    "registration_deadline",
    "starts_at",
    "submission_deadline",
    "ends_at",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _slugify(value: str) -> str:
    value = (
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    )
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")[:180].strip("-") or "event"


def _validate_schedule(values: dict) -> None:
    schedule = [values[name] for name in _SCHEDULE_FIELDS]
    if any(value.tzinfo is None or value.utcoffset() is None for value in schedule):
        raise APIError(
            422, "INVALID_EVENT_SCHEDULE", "Event times must include a timezone"
        )
    if schedule != sorted(schedule):
        raise APIError(
            422, "INVALID_EVENT_SCHEDULE", "Event dates must be in chronological order"
        )
    if values["team_max_size"] < values["team_min_size"]:
        raise APIError(
            422, "INVALID_TEAM_SIZE", "Maximum team size must be at least the minimum"
        )


def create_event(db: Session, request: EventCreate, organizer: User) -> Event:
    if organizer.role not in {"organizer", "admin"}:
        raise APIError(
            403, "FORBIDDEN", "Organizer access is required to create events"
        )
    values = request.model_dump()
    _validate_schedule(values)
    slug = values.pop("slug")
    event = Event(
        **values,
        slug=slug or _slugify(values["title"]),
        organizer_id=organizer.id,
        status="draft",
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "EVENT_SLUG_CONFLICT", "An event with this slug already exists"
        ) from exc
    db.refresh(event)
    return event


def get_event(db: Session, event_id: UUID, *, actor: User | None = None) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    if event.status in {"draft", "cancelled"} and not (
        actor and actor.id == event.organizer_id
    ):
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    return event


def lock_event(db: Session, event_id: UUID) -> Event:
    event = db.scalar(select(Event).where(Event.id == event_id).with_for_update())
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    return event


def get_event_by_slug(db: Session, slug: str) -> Event:
    event = db.scalar(
        select(Event).where(
            Event.slug == slug, Event.status.in_(["published", "active", "completed"])
        )
    )
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    return event


def list_public_events(db: Session, offset: int, limit: int) -> tuple[list[Event], int]:
    visible = Event.status.in_(["published", "active", "completed"])
    total = db.scalar(select(func.count()).select_from(Event).where(visible)) or 0
    rows = db.scalars(
        select(Event)
        .where(visible)
        .order_by(Event.starts_at, Event.id)
        .offset(offset)
        .limit(limit)
    )
    return list(rows), total


def update_event(
    db: Session, event_id: UUID, request: EventUpdate, actor: User
) -> Event:
    event = lock_event(db, event_id)
    if event.organizer_id != actor.id:
        raise APIError(
            403, "FORBIDDEN", "Only the event organizer can manage this event"
        )
    if event.status != "draft":
        raise APIError(
            409, "INVALID_EVENT_TRANSITION", "Only draft events can be edited"
        )
    values = {
        **{field: getattr(event, field) for field in _SCHEDULE_FIELDS},
        "team_min_size": event.team_min_size,
        "team_max_size": event.team_max_size,
    }
    values.update(request.model_dump(exclude_unset=True))
    _validate_schedule(values)
    for name, value in request.model_dump(exclude_unset=True).items():
        if name == "title" or name == "description":
            value = value.strip()
        setattr(event, name, value)
    db.commit()
    db.refresh(event)
    return event


def transition_event(db: Session, event_id: UUID, target: str, actor: User) -> Event:
    event = lock_event(db, event_id)
    if event.organizer_id != actor.id:
        raise APIError(
            403, "FORBIDDEN", "Only the event organizer can manage this event"
        )
    allowed = {
        "draft": {"published", "cancelled"},
        "published": {"active", "cancelled"},
        "active": {"completed", "cancelled"},
        "completed": set(),
        "cancelled": set(),
    }
    if target not in allowed[event.status]:
        raise APIError(
            409, "INVALID_EVENT_TRANSITION", "Event status transition is not allowed"
        )
    now = utc_now()
    if target == "active" and now < event.starts_at:
        raise APIError(
            409, "EVENT_NOT_STARTED", "An event cannot become active before it starts"
        )
    if target == "completed" and now < event.ends_at:
        raise APIError(
            409, "EVENT_NOT_ENDED", "An event cannot be completed before it ends"
        )
    event.status = target
    db.commit()
    db.refresh(event)
    return event


def register_for_event(
    db: Session, event_id: UUID, user: User, now: datetime | None = None
) -> EventRegistration:
    event = lock_event(db, event_id)
    now = now or utc_now()
    if user.role != "participant":
        raise APIError(403, "FORBIDDEN", "Participant access is required to register")
    if event.status != "published":
        raise APIError(409, "EVENT_NOT_OPEN", "Event registration is not open")
    judge_assignment = db.scalar(
        select(JudgeEventAssignment.id).where(
            JudgeEventAssignment.event_id == event_id,
            JudgeEventAssignment.judge_id == user.id,
            JudgeEventAssignment.status == "active",
        )
    )
    if judge_assignment is not None:
        raise APIError(409, "JUDGE_CONFLICT", "An event judge cannot register as a participant")
    if now < event.registration_opens_at or now > event.registration_deadline:
        raise APIError(
            409,
            "REGISTRATION_CLOSED",
            "Event registration is outside its allowed window",
        )
    row = EventRegistration(event_id=event.id, user_id=user.id)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "ALREADY_REGISTERED", "User is already registered for this event"
        ) from exc
    db.refresh(row)
    return row


def organizer_role_update(db: Session, user_id: UUID, role: str) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise APIError(404, "USER_NOT_FOUND", "User was not found")
    user.role = role
    db.commit()
    db.refresh(user)
    return user
