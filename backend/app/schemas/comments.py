from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectCommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class ProjectCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    project_id: UUID
    author_id: UUID
    body: str
    created_at: datetime
    updated_at: datetime
