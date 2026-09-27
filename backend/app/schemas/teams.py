from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Team name must not be blank")
        return value


class TeamInvitationCreate(BaseModel):
    invitee_id: UUID


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    name: str
    captain_id: UUID
    created_at: datetime


class TeamInvitationResponse(BaseModel):
    invitation_id: UUID
    invitee_id: UUID
    expires_at: datetime
    token: str


class InvitationAccept(BaseModel):
    token: str = Field(min_length=32, max_length=128)


class TeamMembershipResponse(BaseModel):
    team: TeamResponse
    member_ids: list[UUID]
