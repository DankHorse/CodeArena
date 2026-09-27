from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.teams import (
    InvitationAccept,
    TeamCreate,
    TeamInvitationCreate,
    TeamInvitationResponse,
    TeamMembershipResponse,
    TeamResponse,
)
from app.services.teams import (
    accept_invitation,
    create_invitation,
    create_team,
    get_my_team,
)

router = APIRouter()
invitation_router = APIRouter()


@router.post(
    "/events/{event_id}/teams",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event_team(
    event_id: UUID,
    request: TeamCreate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_team(db, event_id, request.name, actor)


@router.get("/events/{event_id}/teams/me", response_model=TeamMembershipResponse)
def my_event_team(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team, members = get_my_team(db, event_id, actor)
    return {"team": team, "member_ids": members}


@router.post(
    "/teams/{team_id}/invitations",
    response_model=TeamInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite(
    team_id: UUID,
    request: TeamInvitationCreate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invitation, token = create_invitation(db, team_id, request.invitee_id, actor)
    return {
        "invitation_id": invitation.id,
        "invitee_id": invitation.invitee_id,
        "expires_at": invitation.expires_at,
        "token": token,
    }


@invitation_router.post("/team-invitations/accept", response_model=TeamResponse)
def accept(
    request: InvitationAccept,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return accept_invitation(db, request.token, actor)
