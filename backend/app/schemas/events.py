from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    slug: str | None = Field(default=None, min_length=1, max_length=180)
    description: str = Field(min_length=1, max_length=20_000)
    registration_opens_at: datetime
    registration_deadline: datetime
    starts_at: datetime
    submission_deadline: datetime
    ends_at: datetime
    voting_opens_at: datetime | None = None
    voting_ends_at: datetime | None = None
    team_min_size: int = Field(ge=1)
    team_max_size: int = Field(ge=1)

    @field_validator("title", "description")
    @classmethod
    def nonblank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @field_validator("slug")
    @classmethod
    def valid_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not value or any(not (char.isalnum() or char == "-") for char in value):
            raise ValueError("Slug may contain only letters, numbers, and hyphens")
        return value


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1, max_length=20_000)
    registration_opens_at: datetime | None = None
    registration_deadline: datetime | None = None
    starts_at: datetime | None = None
    submission_deadline: datetime | None = None
    ends_at: datetime | None = None
    voting_opens_at: datetime | None = None
    voting_ends_at: datetime | None = None
    team_min_size: int | None = Field(default=None, ge=1)
    team_max_size: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def reject_explicit_nulls(self):
        if any(getattr(self, name) is None for name in self.model_fields_set):
            raise ValueError("Event fields cannot be cleared")
        return self


class EventTransition(BaseModel):
    status: str = Field(pattern="^(published|active|completed|cancelled)$")


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organizer_id: UUID
    title: str
    slug: str
    description: str
    status: str
    registration_opens_at: datetime
    registration_deadline: datetime
    starts_at: datetime
    submission_deadline: datetime
    ends_at: datetime
    voting_opens_at: datetime | None = None
    voting_ends_at: datetime | None = None
    team_min_size: int
    team_max_size: int
    created_at: datetime
    updated_at: datetime


class EventPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    slug: str
    description: str
    status: str
    registration_opens_at: datetime
    registration_deadline: datetime
    starts_at: datetime
    submission_deadline: datetime
    ends_at: datetime
    voting_opens_at: datetime | None = None
    voting_ends_at: datetime | None = None
    team_min_size: int
    team_max_size: int

    @classmethod
    def from_event(cls, event):
        return cls.model_validate(event)


class EventPage(BaseModel):
    items: list[EventPublic]
    offset: int
    limit: int
    total: int


class EventRegistrationResponse(BaseModel):
    id: UUID
    event_id: UUID
    created_at: datetime
