"""SQLAlchemy models imported here for Alembic metadata discovery."""

from app.models.user import User
from app.models.problem import Problem, ProblemTestCase
from app.models.submission import Submission, SubmissionTestResult
from app.models.event import Event, EventRegistration, EventTrack
from app.models.team import Team, TeamInvitation, TeamMember
from app.models.project import ProjectSubmission
from app.models.judging import (
    JudgeCriterionScore,
    JudgeEvaluation,
    JudgeEventAssignment,
    JudgeProjectAssignment,
    JudgingProjectResult,
    JudgingResultSnapshot,
    JudgingRubric,
    JudgingRubricCriterion,
)

__all__ = [
    "Event",
    "EventRegistration",
    "EventTrack",
    "JudgeCriterionScore",
    "JudgeEvaluation",
    "JudgeEventAssignment",
    "JudgeProjectAssignment",
    "JudgingProjectResult",
    "JudgingResultSnapshot",
    "JudgingRubric",
    "JudgingRubricCriterion",
    "Problem",
    "ProblemTestCase",
    "ProjectSubmission",
    "Submission",
    "SubmissionTestResult",
    "Team",
    "TeamInvitation",
    "TeamMember",
    "User",
]
