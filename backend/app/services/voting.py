from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.event import Event
from app.models.project import ProjectSubmission
from app.models.team import TeamMember
from app.models.user import User
from app.models.voting import Vote
from app.services.events import utc_now


def _get_project_and_event(
    db: Session, project_id: UUID, event_id: UUID | None = None
) -> tuple[ProjectSubmission, Event]:
    project = db.get(ProjectSubmission, project_id)
    if project is None:
        raise APIError(404, "PROJECT_NOT_FOUND", "Project was not found")
    if event_id is not None and project.event_id != event_id:
        raise APIError(404, "PROJECT_NOT_FOUND", "Project was not found for this event")
    event = db.get(Event, project.event_id)
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    return project, event


def _voting_window(event: Event) -> tuple[datetime, datetime]:
    opens_at = event.voting_opens_at or event.submission_deadline
    ends_at = event.voting_ends_at or event.ends_at
    return opens_at, ends_at


def _check_voting_window(event: Event, current_time: datetime) -> None:
    if event.status in {"draft", "cancelled"}:
        raise APIError(409, "EVENT_NOT_OPEN", "Event is not open for voting")
    opens_at, ends_at = _voting_window(event)
    if current_time < opens_at:
        raise APIError(409, "VOTING_NOT_OPEN", "Voting has not opened yet")
    if current_time > ends_at:
        raise APIError(409, "VOTING_CLOSED", "Voting has closed for this event")


def cast_vote(
    db: Session,
    *,
    project_id: UUID,
    actor: User,
    event_id: UUID | None = None,
    now: datetime | None = None,
) -> Vote:
    if actor.role != "participant":
        raise APIError(403, "FORBIDDEN", "Participant access is required to vote")
    if not actor.is_active:
        raise APIError(403, "ACCOUNT_DISABLED", "This account is disabled")

    project, event = _get_project_and_event(db, project_id, event_id)

    if project.status != "submitted":
        raise APIError(
            409, "PROJECT_NOT_SUBMITTED", "Only submitted projects can receive votes"
        )

    current_time = now or utc_now()
    _check_voting_window(event, current_time)

    # Prevent team members from voting on their own project
    is_team_member = db.scalar(
        select(TeamMember.user_id).where(
            TeamMember.team_id == project.team_id,
            TeamMember.user_id == actor.id,
        )
    )
    if is_team_member is not None:
        raise APIError(403, "FORBIDDEN", "Team members cannot vote for their own project")

    # Prevent duplicate votes by the same voter on the same project
    existing = db.scalar(
        select(Vote.id).where(
            Vote.project_id == project.id,
            Vote.voter_id == actor.id,
        )
    )
    if existing is not None:
        raise APIError(409, "ALREADY_VOTED", "You have already voted for this project")

    vote = Vote(
        event_id=event.id,
        project_id=project.id,
        voter_id=actor.id,
    )
    db.add(vote)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "ALREADY_VOTED", "You have already voted for this project"
        ) from exc
    db.refresh(vote)
    return vote


def check_vote(
    db: Session,
    *,
    project_id: UUID,
    actor: User,
    event_id: UUID | None = None,
) -> dict:
    project, _ = _get_project_and_event(db, project_id, event_id)
    vote = db.scalar(
        select(Vote).where(
            Vote.project_id == project.id,
            Vote.voter_id == actor.id,
        )
    )
    if vote is None:
        return {"has_voted": False, "vote": None}
    return {"has_voted": True, "vote": vote}


def list_user_votes(
    db: Session,
    *,
    event_id: UUID,
    actor: User,
) -> tuple[list[Vote], int]:
    event = db.get(Event, event_id)
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")

    query = (
        select(Vote)
        .where(Vote.event_id == event_id, Vote.voter_id == actor.id)
        .order_by(Vote.created_at.desc())
    )
    votes = list(db.scalars(query))
    return votes, len(votes)


def get_project_vote_summary(
    db: Session,
    *,
    project_id: UUID,
    actor: User | None = None,
    event_id: UUID | None = None,
) -> dict:
    project, _ = _get_project_and_event(db, project_id, event_id)
    count = (
        db.scalar(
            select(func.count()).select_from(Vote).where(Vote.project_id == project.id)
        )
        or 0
    )
    has_voted = False
    if actor is not None and actor.role == "participant":
        has_voted = (
            db.scalar(
                select(Vote.id).where(
                    Vote.project_id == project.id,
                    Vote.voter_id == actor.id,
                )
            )
            is not None
        )
    return {"project_id": project.id, "vote_count": count, "has_voted": has_voted}


def get_event_votes_summary(
    db: Session,
    *,
    event_id: UUID,
) -> dict:
    event = db.get(Event, event_id)
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")

    rows = db.execute(
        select(Vote.project_id, func.count(Vote.id))
        .where(Vote.event_id == event_id)
        .group_by(Vote.project_id)
    ).all()
    items = [{"project_id": r[0], "vote_count": r[1]} for r in rows]
    total = sum(r[1] for r in rows)
    return {"event_id": event_id, "total_votes": total, "items": items}


def retract_vote(
    db: Session,
    *,
    project_id: UUID,
    actor: User,
    event_id: UUID | None = None,
    now: datetime | None = None,
) -> None:
    project, event = _get_project_and_event(db, project_id, event_id)

    current_time = now or utc_now()
    _check_voting_window(event, current_time)

    vote = db.scalar(
        select(Vote).where(
            Vote.project_id == project.id,
            Vote.voter_id == actor.id,
        )
    )
    if vote is None:
        raise APIError(404, "VOTE_NOT_FOUND", "Vote was not found")
    db.delete(vote)
    db.commit()
