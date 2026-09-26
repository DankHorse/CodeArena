from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        Index("ix_submissions_status_problem_user", "status", "problem_id", "user_id"),
        CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'failed', 'accepted', "
            "'wrong_answer', 'compilation_error', 'runtime_error', 'timeout', "
            "'time_limit_exceeded', 'output_limit_exceeded', 'system_error')",
            name="ck_submissions_status",
        ),
        CheckConstraint("execution_time_ms IS NULL OR execution_time_ms >= 0", name="ck_submissions_execution_time_nonnegative"),
        CheckConstraint("memory_usage_kb IS NULL OR memory_usage_kb >= 0", name="ck_submissions_memory_usage_nonnegative"),
        CheckConstraint("score IS NULL OR (score >= 0 AND score <= 100)", name="ck_submissions_score_range"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    problem_id: Mapped[UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    language: Mapped[str] = mapped_column(String(32), nullable=False)
    source_code: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="pending", server_default=text("'pending'")
    )
    execution_time_ms: Mapped[int | None] = mapped_column(Integer)
    memory_usage_kb: Mapped[int | None] = mapped_column(Integer)
    stdout: Mapped[str | None] = mapped_column(Text)
    stderr: Mapped[str | None] = mapped_column(Text)
    exit_code: Mapped[int | None] = mapped_column(Integer)
    score: Mapped[float | None] = mapped_column(Float)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    test_results: Mapped[list["SubmissionTestResult"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
        order_by="SubmissionTestResult.position",
    )


class SubmissionTestResult(Base):
    __tablename__ = "submission_test_results"
    __table_args__ = (
        CheckConstraint(
            "status IN ('accepted', 'wrong_answer', 'compilation_error', 'runtime_error', "
            "'time_limit_exceeded', 'output_limit_exceeded', 'system_error')",
            name="ck_submission_test_results_status",
        ),
        CheckConstraint("position >= 0", name="ck_submission_test_results_position_nonnegative"),
        CheckConstraint(
            "execution_time_ms IS NULL OR execution_time_ms >= 0",
            name="ck_submission_test_results_execution_time_nonnegative",
        ),
        UniqueConstraint("submission_id", "test_case_id", name="uq_submission_test_result_case"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    submission_id: Mapped[UUID] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    test_case_id: Mapped[UUID] = mapped_column(
        ForeignKey("problem_test_cases.id", ondelete="RESTRICT"), nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    is_hidden: Mapped[bool] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    execution_time_ms: Mapped[int | None] = mapped_column(Integer)
    stdout: Mapped[str | None] = mapped_column(Text)
    stderr: Mapped[str | None] = mapped_column(Text)
    exit_code: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)

    submission: Mapped[Submission] = relationship(back_populates="test_results")
