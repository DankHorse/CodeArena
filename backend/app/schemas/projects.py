from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=20_000)
    repository_url: HttpUrl | None = None
    demo_url: HttpUrl | None = None


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=20_000)
    repository_url: HttpUrl | None = None
    demo_url: HttpUrl | None = None

    @model_validator(mode="after")
    def require_nonnull_text_fields(self):
        if "title" in self.model_fields_set and self.title is None:
            raise ValueError("Project title cannot be cleared")
        if "description" in self.model_fields_set and self.description is None:
            raise ValueError("Project description cannot be cleared")
        return self


class ProjectPrivateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    team_id: UUID
    title: str
    description: str
    repository_url: str | None
    demo_url: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None


class GalleryProjectResponse(BaseModel):
    id: UUID
    event_slug: str
    event_title: str
    title: str
    description: str
    repository_url: str | None
    demo_url: str | None
    submitted_at: datetime


class GalleryPage(BaseModel):
    items: list[GalleryProjectResponse]
    offset: int
    limit: int
    total: int
