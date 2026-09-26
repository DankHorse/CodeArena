from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

MAX_SOURCE_CODE_BYTES = 65_536


class SubmissionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    COMPILATION_ERROR = "compilation_error"
    RUNTIME_ERROR = "runtime_error"
    TIMEOUT = "timeout"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    OUTPUT_LIMIT_EXCEEDED = "output_limit_exceeded"
    SYSTEM_ERROR = "system_error"


class SubmissionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problem_id: UUID
    language: str = Field(min_length=1, max_length=32)
    source_code: str = Field(min_length=1, max_length=MAX_SOURCE_CODE_BYTES)

    @field_validator("language")
    @classmethod
    def normalize_language(cls, value: str) -> str:
        value = value.strip().lower()
        if not value:
            raise ValueError("Language must not be blank")
        return value

    @field_validator("source_code")
    @classmethod
    def validate_source_code(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Source code must not be blank")
        if len(value.encode("utf-8")) > MAX_SOURCE_CODE_BYTES:
            raise ValueError(f"Source code must not exceed {MAX_SOURCE_CODE_BYTES} UTF-8 bytes")
        return value


class SubmissionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    problem_id: UUID
    language: str
    status: SubmissionStatus
    execution_time_ms: int | None
    memory_usage_kb: int | None
    score: float | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime


class SubmissionTestResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    position: int
    is_hidden: bool
    status: SubmissionStatus
    execution_time_ms: int | None
    stdout: str | None
    stderr: str | None
    exit_code: int | None
    error_message: str | None


class SubmissionResponse(SubmissionListItem):
    source_code: str
    stdout: str | None
    stderr: str | None
    exit_code: int | None
    test_results: list[SubmissionTestResultResponse] = Field(default_factory=list)
