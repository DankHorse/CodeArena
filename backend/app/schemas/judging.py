from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class RubricCriterionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=4_000)
    weight: Decimal = Field(gt=0, max_digits=7, decimal_places=4)
    max_score: Decimal = Field(gt=0, max_digits=8, decimal_places=3)
    position: int = Field(ge=0)

    @model_validator(mode="after")
    def strip_text(self):
        self.name = self.name.strip()
        if not self.name:
            raise ValueError("Criterion name must not be blank")
        self.description = self.description.strip()
        return self


class RubricCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    criteria: list[RubricCriterionCreate] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_rubric(self):
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("Rubric title must not be blank")
        positions = sorted(criterion.position for criterion in self.criteria)
        if positions != list(range(len(self.criteria))):
            raise ValueError("Criterion positions must be unique and start at zero")
        if sum((criterion.weight for criterion in self.criteria), Decimal("0")) != Decimal("100"):
            raise ValueError("Criterion weights must total exactly 100")
        if len({criterion.name.casefold() for criterion in self.criteria}) != len(self.criteria):
            raise ValueError("Criterion names must be unique within a rubric")
        return self


class RubricCriterionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str
    weight: Decimal
    max_score: Decimal
    position: int


class RubricResponse(BaseModel):
    id: UUID
    event_id: UUID
    version: int
    title: str
    status: str
    created_at: datetime
    activated_at: datetime | None
    criteria: list[RubricCriterionResponse]


class RubricListResponse(BaseModel):
    items: list[RubricResponse]


class JudgeEventCreate(BaseModel):
    judge_id: UUID


class JudgeEventResponse(BaseModel):
    event_id: UUID
    judge_id: UUID
    status: str
    created_at: datetime


class JudgeProjectAssignmentCreate(BaseModel):
    project_id: UUID
    judge_id: UUID


class JudgeAssignmentResponse(BaseModel):
    id: UUID
    event_id: UUID
    project_id: UUID
    judge_id: UUID
    rubric_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime


class JudgeAssignmentListResponse(BaseModel):
    items: list[JudgeAssignmentResponse]


class AssignedProjectResponse(BaseModel):
    id: UUID
    event_id: UUID
    title: str
    description: str
    repository_url: str | None
    demo_url: str | None
    submitted_at: datetime


class JudgeAssignmentDetailResponse(BaseModel):
    assignment: JudgeAssignmentResponse
    project: AssignedProjectResponse
    rubric: RubricResponse


class CriterionScoreInput(BaseModel):
    criterion_id: UUID
    score: Decimal = Field(ge=0, max_digits=8, decimal_places=3)


class EvaluationDraftRequest(BaseModel):
    scores: list[CriterionScoreInput] = Field(max_length=50)
    feedback: str = Field(default="", max_length=20_000)

    @model_validator(mode="after")
    def unique_criteria(self):
        ids = [score.criterion_id for score in self.scores]
        if len(ids) != len(set(ids)):
            raise ValueError("A criterion may only be scored once")
        self.feedback = self.feedback.strip()
        return self


class CriterionScoreResponse(BaseModel):
    criterion_id: UUID
    name: str
    weight: Decimal
    max_score: Decimal
    raw_score: Decimal
    weighted_contribution: Decimal


class EvaluationResponse(BaseModel):
    id: UUID
    assignment_id: UUID
    rubric_id: UUID
    status: str
    feedback: str
    weighted_score: Decimal | None
    scores: list[CriterionScoreResponse]
    created_at: datetime
    updated_at: datetime
    submitted_at: datetime | None


class EvaluationEnvelope(BaseModel):
    evaluation: EvaluationResponse | None


class OwnJudgeScoreItem(BaseModel):
    event_id: UUID
    assignment_id: UUID
    project_id: UUID
    evaluation: EvaluationResponse | None


class OwnJudgeScoresResponse(BaseModel):
    items: list[OwnJudgeScoreItem]


class JudgeProgressItem(BaseModel):
    judge_id: UUID
    assignments: int
    completed: int
    in_progress: int
    pending: int
    completion_percentage: Decimal


class JudgingProgressResponse(BaseModel):
    event_id: UUID
    total_assignments: int
    completed_evaluations: int
    pending_evaluations: int
    in_progress_evaluations: int
    completion_percentage: Decimal
    judges: list[JudgeProgressItem]


class JudgingResultItem(BaseModel):
    rank: int | None
    project_id: UUID
    project_title: str
    team_id: UUID
    raw_average: Decimal
    normalized_score: Decimal | None
    completed_evaluations: int


class JudgingResultsResponse(BaseModel):
    event_id: UUID
    snapshot_id: UUID
    status: str
    method: str
    method_version: str
    calculated_at: datetime
    source_evaluation_count: int
    is_stale: bool
    insufficient_reason: str | None
    items: list[JudgingResultItem]


class JudgingRecalculationResponse(BaseModel):
    snapshot_id: UUID
    status: str
    method: str
    method_version: str
    source_evaluation_count: int
    insufficient_reason: str | None
