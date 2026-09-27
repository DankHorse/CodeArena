import hashlib
import secrets
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.models.event import EventRegistration
from app.models.team import Team, TeamInvitation, TeamMember
from app.models.user import User
from app.services.events import lock_event, utc_now


def _registration(db: Session, event_id: UUID, user_id: UUID) -> bool:
    return (
        db.scalar(
            select(EventRegistration.id).where(
                EventRegistration.event_id == event_id,
                EventRegistration.user_id == user_id,
            )
        )
        is not None
    )


def _membership_count(db: Session, team_id: UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(TeamMember)
            .where(TeamMember.team_id == team_id)
        )
        or 0
    )


def create_team(db: Session, event_id: UUID, name: str, user: User) -> Team:
    event = lock_event(db, event_id)
    now = utc_now()
    if user.role != "participant" or not _registration(db, event_id, user.id):
        raise APIError(
            403, "FORBIDDEN", "Only registered participants may create a team"
        )
    if event.status != "published" or now > event.registration_deadline:
        raise APIError(
            409, "REGISTRATION_CLOSED", "Teams cannot be created outside registration"
        )
    if db.scalar(
        select(TeamMember).where(
            TeamMember.event_id == event_id, TeamMember.user_id == user.id
        )
    ):
        raise APIError(
            409,
            "ALREADY_IN_TEAM",
            "Participant already belongs to a team in this event",
        )
    team = Team(event_id=event_id, name=name.strip(), captain_id=user.id)
    db.add(team)
    try:
        db.flush()
        db.add(TeamMember(event_id=event_id, user_id=user.id, team_id=team.id))
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(409, "TEAM_CONFLICT", "Could not create this team") from exc
    db.refresh(team)
    return team


def get_my_team(db: Session, event_id: UUID, user: User) -> tuple[Team, list[UUID]]:
    member = db.scalar(
        select(TeamMember).where(
            TeamMember.event_id == event_id, TeamMember.user_id == user.id
        )
    )
    if member is None:
        raise APIError(
            404, "TEAM_NOT_FOUND", "User does not belong to a team in this event"
        )
    team = db.get(Team, member.team_id)
    member_ids = list(
        db.scalars(
            select(TeamMember.user_id)
            .where(TeamMember.team_id == team.id)
            .order_by(TeamMember.joined_at, TeamMember.user_id)
        )
    )
    return team, member_ids


def create_invitation(
    db: Session, team_id: UUID, invitee_id: UUID, actor: User
) -> tuple[TeamInvitation, str]:
    team = db.get(Team, team_id)
    if team is None:
        raise APIError(404, "TEAM_NOT_FOUND", "Team was not found")
    event = lock_event(db, team.event_id)
    team = db.scalar(select(Team).where(Team.id == team_id).with_for_update())
    if team.captain_id != actor.id:
        raise APIError(403, "FORBIDDEN", "Only the team captain may invite members")
    now = utc_now()
    if event.status != "published" or now > event.registration_deadline:
        raise APIError(409, "REGISTRATION_CLOSED", "Invitations are not allowed now")
    invitee = db.get(User, invitee_id)
    if invitee is None or not _registration(db, team.event_id, invitee_id):
        raise APIError(
            404, "INVITEE_NOT_REGISTERED", "Invitee is not registered for this event"
        )
    if invitee_id == actor.id or db.scalar(
        select(TeamMember).where(
            TeamMember.event_id == team.event_id, TeamMember.user_id == invitee_id
        )
    ):
        raise APIError(
            409, "ALREADY_IN_TEAM", "Invitee already belongs to an event team"
        )
    if _membership_count(db, team_id) >= event.team_max_size:
        raise APIError(409, "TEAM_FULL", "Team has reached its configured maximum size")
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    existing = db.scalar(
        select(TeamInvitation).where(
            TeamInvitation.team_id == team_id, TeamInvitation.invitee_id == invitee_id
        )
    )
    try:
        if existing:
            if existing.status == "pending" and existing.expires_at >= now:
                raise APIError(
                    409, "INVITATION_PENDING", "An invitation is already pending"
                )
            existing.token_hash = token_hash
            existing.status = "pending"
            existing.expires_at = event.registration_deadline
            existing.created_at = now
            existing.accepted_at = None
            invitation = existing
        else:
            invitation = TeamInvitation(
                team_id=team_id,
                event_id=team.event_id,
                inviter_id=actor.id,
                invitee_id=invitee_id,
                token_hash=token_hash,
                status="pending",
                expires_at=event.registration_deadline,
            )
            db.add(invitation)
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "INVITATION_CONFLICT", "Could not create invitation"
        ) from exc
    db.refresh(invitation)
    return invitation, token


def accept_invitation(
    db: Session, token: str, user: User, now: datetime | None = None
) -> Team:
    now = now or utc_now()
    digest = hashlib.sha256(token.encode()).hexdigest()
    invitation = db.scalar(
        select(TeamInvitation).where(TeamInvitation.token_hash == digest)
    )
    if (
        invitation is None
        or invitation.invitee_id != user.id
        or invitation.status != "pending"
    ):
        raise APIError(404, "INVITATION_NOT_FOUND", "Valid invitation was not found")
    event = lock_event(db, invitation.event_id)
    team = db.scalar(
        select(Team).where(Team.id == invitation.team_id).with_for_update()
    )
    invitation = db.scalar(
        select(TeamInvitation)
        .where(TeamInvitation.token_hash == digest)
        .with_for_update()
    )
    if (
        invitation is None
        or invitation.invitee_id != user.id
        or invitation.status != "pending"
    ):
        raise APIError(404, "INVITATION_NOT_FOUND", "Valid invitation was not found")
    if (
        now > invitation.expires_at
        or event.status != "published"
        or now > event.registration_deadline
    ):
        invitation.status = "expired"
        db.commit()
        raise APIError(409, "INVITATION_EXPIRED", "Invitation has expired")
    if db.scalar(
        select(TeamMember).where(
            TeamMember.event_id == event.id, TeamMember.user_id == user.id
        )
    ):
        raise APIError(
            409,
            "ALREADY_IN_TEAM",
            "Participant already belongs to a team in this event",
        )
    if _membership_count(db, team.id) >= event.team_max_size:
        raise APIError(409, "TEAM_FULL", "Team has reached its configured maximum size")
    db.add(TeamMember(event_id=event.id, user_id=user.id, team_id=team.id))
    invitation.status = "accepted"
    invitation.accepted_at = now
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise APIError(
            409, "TEAM_MEMBERSHIP_CONFLICT", "Could not accept invitation"
        ) from exc
    return team
