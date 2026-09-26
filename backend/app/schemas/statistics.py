from pydantic import BaseModel, ConfigDict, Field


class UserStatisticsResponse(BaseModel):
    total_submissions: int
    judged_submissions: int
    accepted_submissions: int
    solved_problems: int
    acceptance_rate: float


class ProblemStatisticsResponse(BaseModel):
    problem_slug: str
    total_submissions: int
    judged_submissions: int
    accepted_submissions: int
    unique_solvers: int
    acceptance_rate: float


class LeaderboardEntry(BaseModel):
    rank: int
    display_name: str
    solved_problems: int


class LeaderboardPage(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[LeaderboardEntry]
    total: int
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
