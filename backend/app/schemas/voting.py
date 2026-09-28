from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VoteCreate(BaseModel):
    project_id: UUID


class VoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    project_id: UUID
    voter_id: UUID
    created_at: datetime


class VoteCheckResponse(BaseModel):
    has_voted: bool
    vote: VoteResponse | None = None


class ProjectVoteSummary(BaseModel):
    project_id: UUID
    vote_count: int
    has_voted: bool = False


class VoteListResponse(BaseModel):
    items: list[VoteResponse]
    total: int


class ProjectVoteItem(BaseModel):
    project_id: UUID
    vote_count: int


class EventVotesSummaryResponse(BaseModel):
    event_id: UUID
    total_votes: int
    items: list[ProjectVoteItem]


class BallotProjectResponse(BaseModel):
    id: UUID
    event_slug: str
    event_title: str
    title: str
    description: str
    repository_url: str | None
    demo_url: str | None
    submitted_at: datetime
