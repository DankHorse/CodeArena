from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.event import Event
from app.models.project import ProjectSubmission
from app.models.team import Team, TeamMember
from app.models.user import User
from app.schemas.projects import ProjectCreate, ProjectUpdate
from app.services.events import lock_event, utc_now


def _team_for_member(db: Session, event_id: UUID, user_id: UUID) -> Team:
    membership = db.scalar(
        select(TeamMember).where(
            TeamMember.event_id == event_id, TeamMember.user_id == user_id
        )
    )
    if membership is None:
        raise APIError(403, "FORBIDDEN", "User must be a member of an event team")
    return db.get(Team, membership.team_id)


def _open_for_submission(event: Event, now: datetime) -> None:
    if event.status not in {"published", "active"}:
        raise APIError(
            409, "EVENT_CLOSED", "Event is not accepting project submissions"
        )
    if now > event.submission_deadline:
        raise APIError(409, "DEADLINE_PASSED", "Project submission deadline has passed")


def create_draft(
    db: Session, event_id: UUID, request: ProjectCreate, actor: User
) -> ProjectSubmission:
    event = lock_event(db, event_id)
    if actor.role != "participant":
        raise APIError(403, "FORBIDDEN", "Participant access is required")
    team = _team_for_member(db, event_id, actor.id)
    if team.captain_id != actor.id:
        raise APIError(403, "FORBIDDEN", "Only the team captain may manage the project")
    _open_for_submission(event, utc_now())
    if db.scalar(
        select(ProjectSubmission.id).where(ProjectSubmission.team_id == team.id)
    ):
        raise APIError(409, "PROJECT_EXISTS", "This team already has a project")
    project = ProjectSubmission(
        event_id=event.id,
        team_id=team.id,
        **request.model_dump(mode="json"),
        status="draft",
    )
    db.add(project)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "PROJECT_EXISTS", "This team already has a project"
        ) from exc
    db.refresh(project)
    return project


def _owned_project(
    db: Session, project_id: UUID, actor: User
) -> tuple[ProjectSubmission, Event, Team]:
    project = db.get(ProjectSubmission, project_id)
    if project is None:
        raise APIError(404, "PROJECT_NOT_FOUND", "Project was not found")
    event = db.get(Event, project.event_id)
    team = db.get(Team, project.team_id)
    member = db.scalar(
        select(TeamMember.event_id).where(
            TeamMember.event_id == event.id,
            TeamMember.team_id == team.id,
            TeamMember.user_id == actor.id,
        )
    )
    if member is None and actor.id != event.organizer_id:
        raise APIError(404, "PROJECT_NOT_FOUND", "Project was not found")
    return project, event, team


def get_project(db: Session, project_id: UUID, actor: User) -> ProjectSubmission:
    return _owned_project(db, project_id, actor)[0]


def update_draft(
    db: Session, project_id: UUID, request: ProjectUpdate, actor: User
) -> ProjectSubmission:
    project, event, team = _owned_project(db, project_id, actor)
    event = lock_event(db, event.id)
    if team.captain_id != actor.id or actor.role != "participant":
        raise APIError(403, "FORBIDDEN", "Only the team captain may edit the project")
    if project.status != "draft":
        raise APIError(409, "SUBMISSION_LOCKED", "Submitted projects cannot be edited")
    _open_for_submission(event, utc_now())
    for field, value in request.model_dump(exclude_unset=True, mode="json").items():
        if isinstance(value, str) and field in {"title", "description"}:
            value = value.strip()
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def finalize_project(
    db: Session, project_id: UUID, actor: User, now: datetime | None = None
) -> ProjectSubmission:
    project, event, team = _owned_project(db, project_id, actor)
    event = lock_event(db, event.id)
    if team.captain_id != actor.id or actor.role != "participant":
        raise APIError(403, "FORBIDDEN", "Only the team captain may submit the project")
    if project.status != "draft":
        raise APIError(409, "SUBMISSION_LOCKED", "Project has already been submitted")
    now = now or utc_now()
    _open_for_submission(event, now)
    member_count = (
        db.scalar(
            select(func.count())
            .select_from(TeamMember)
            .where(TeamMember.team_id == team.id)
        )
        or 0
    )
    if member_count < event.team_min_size:
        raise APIError(
            409, "TEAM_BELOW_MINIMUM", "Team does not meet the event minimum team size"
        )
    if not project.description.strip():
        raise APIError(
            422,
            "PROJECT_INCOMPLETE",
            "Project description is required before submission",
        )
    project.status = "submitted"
    project.submitted_at = now
    db.commit()
    db.refresh(project)
    return project


def list_gallery(
    db: Session,
    *,
    offset: int,
    limit: int,
    event_slug: str | None = None,
    search: str | None = None,
) -> tuple[list[dict], int]:
    query = (
        select(ProjectSubmission, Event)
        .join(Event, Event.id == ProjectSubmission.event_id)
        .where(
            ProjectSubmission.status == "submitted",
            Event.status.in_(["published", "active", "completed"]),
        )
    )
    count_query = (
        select(func.count())
        .select_from(ProjectSubmission)
        .join(Event, Event.id == ProjectSubmission.event_id)
        .where(
            ProjectSubmission.status == "submitted",
            Event.status.in_(["published", "active", "completed"]),
        )
    )
    if event_slug:
        query = query.where(Event.slug == event_slug)
        count_query = count_query.where(Event.slug == event_slug)
    if search:
        term = f"%{search.strip()}%"
        criterion = ProjectSubmission.title.ilike(
            term
        ) | ProjectSubmission.description.ilike(term)
        query = query.where(criterion)
        count_query = count_query.where(criterion)
    total = db.scalar(count_query) or 0
    rows = db.execute(
        query.order_by(ProjectSubmission.submitted_at.desc(), ProjectSubmission.id)
        .offset(offset)
        .limit(limit)
    )
    items = [
        {
            "id": project.id,
            "event_slug": event.slug,
            "event_title": event.title,
            "title": project.title,
            "description": project.description,
            "repository_url": project.repository_url,
            "demo_url": project.demo_url,
            "submitted_at": project.submitted_at,
        }
        for project, event in rows
    ]
    return items, total
