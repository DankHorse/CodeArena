from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProblemDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TestCaseWrite(BaseModel):
    input_data: str = Field(max_length=100_000)
    expected_output: str = Field(max_length=100_000)
    position: int = Field(default=0, ge=0)
    is_hidden: bool = False
    time_limit_ms: int | None = Field(default=None, gt=0, le=30_000)
    memory_limit_mb: int | None = Field(default=None, gt=0, le=1_024)


class ProblemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    slug: str | None = Field(default=None, min_length=1, max_length=180)
    description: str = Field(min_length=1, max_length=20_000)
    difficulty: ProblemDifficulty
    category: str | None = Field(default=None, max_length=80)
    constraints: str | None = Field(default=None, max_length=10_000)
    input_description: str = Field(min_length=1, max_length=10_000)
    output_description: str = Field(min_length=1, max_length=10_000)
    starter_code: dict[str, str] = Field(default_factory=dict)
    supported_languages: list[str] = Field(default_factory=lambda: ["python"], min_length=1)
    test_cases: list[TestCaseWrite] = Field(default_factory=list, max_length=500)

    @field_validator("title", "description", "input_description", "output_description")
    @classmethod
    def require_nonblank_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Value must not be blank")
        return value

    @field_validator("supported_languages")
    @classmethod
    def normalize_languages(cls, value: list[str]) -> list[str]:
        languages = list(dict.fromkeys(language.strip().lower() for language in value))
        if not languages or any(not language or len(language) > 32 for language in languages):
            raise ValueError("At least one valid language is required")
        return languages

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not value or any(not (char.isalnum() or char == "-") for char in value):
            raise ValueError("Slug may contain only letters, numbers, and hyphens")
        return value


class ProblemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    slug: str | None = Field(default=None, min_length=1, max_length=180)
    description: str | None = Field(default=None, min_length=1, max_length=20_000)
    difficulty: ProblemDifficulty | None = None
    category: str | None = Field(default=None, max_length=80)
    constraints: str | None = Field(default=None, max_length=10_000)
    input_description: str | None = Field(default=None, min_length=1, max_length=10_000)
    output_description: str | None = Field(default=None, min_length=1, max_length=10_000)
    starter_code: dict[str, str] | None = None
    supported_languages: list[str] | None = Field(default=None, min_length=1)
    is_active: bool | None = None
    test_cases: list[TestCaseWrite] | None = Field(default=None, max_length=500)

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not value or any(not (char.isalnum() or char == "-") for char in value):
            raise ValueError("Slug may contain only letters, numbers, and hyphens")
        return value


class ProblemSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    slug: str
    difficulty: ProblemDifficulty
    category: str | None
    supported_languages: list[str]
    created_at: datetime
    updated_at: datetime


class ProblemExample(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    input_data: str
    expected_output: str
    position: int


class ProblemDetail(ProblemSummary):
    description: str
    constraints: str | None
    input_description: str
    output_description: str
    starter_code: dict[str, str]
    examples: list[ProblemExample]
