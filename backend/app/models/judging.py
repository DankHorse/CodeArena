from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class JudgingRubric(Base):
    __tablename__ = "dogfood_rubrics"
    __table_args__ = (
        UniqueConstraint("id", "event_id", name="uq_dogfood_rubrics_id_event"),
        UniqueConstraint("event_id", "version", name="uq_dogfood_rubrics_event_version"),
        CheckConstraint("version >= 1", name="ck_dogfood_rubrics_version_positive"),
        CheckConstraint(
            "status IN ('draft', 'active', 'archived')",
            name="ck_dogfood_rubrics_status",
        ),
        Index(
            "uq_dogfood_rubrics_one_active_per_event",
            "event_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default=text("'draft'")
    )
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JudgingRubricCriterion(Base):
    __tablename__ = "dogfood_rubric_criteria"
    __table_args__ = (
        ForeignKeyConstraint(
            ["rubric_id", "event_id"],
            ["dogfood_rubrics.id", "dogfood_rubrics.event_id"],
            ondelete="CASCADE",
            name="fk_dogfood_criteria_rubric_event",
        ),
        UniqueConstraint("rubric_id", "position", name="uq_dogfood_criteria_position"),
        UniqueConstraint("id", "rubric_id", name="uq_dogfood_criteria_id_rubric"),
        CheckConstraint("position >= 0", name="ck_dogfood_criteria_position_nonnegative"),
        CheckConstraint("weight > 0", name="ck_dogfood_criteria_weight_positive"),
        CheckConstraint("max_score > 0", name="ck_dogfood_criteria_max_score_positive"),
        Index("ix_dogfood_criteria_rubric", "rubric_id", "position"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    rubric_id: Mapped[UUID] = mapped_column(nullable=False)
    event_id: Mapped[UUID] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    weight: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    max_score: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)


class JudgeEventAssignment(Base):
    __tablename__ = "dogfood_judge_event_assignments"
    __table_args__ = (
        UniqueConstraint("event_id", "judge_id", name="uq_dogfood_event_judge"),
        CheckConstraint(
            "status IN ('active', 'revoked')", name="ck_dogfood_event_judge_status"
        ),
        Index("ix_dogfood_event_judges_event_status", "event_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    judge_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    assigned_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="active", server_default=text("'active'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class JudgeProjectAssignment(Base):
    __tablename__ = "dogfood_judge_project_assignments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "event_id"],
            ["project_submissions.id", "project_submissions.event_id"],
            ondelete="CASCADE",
            name="fk_dogfood_project_assignment_project_event",
        ),
        ForeignKeyConstraint(
            ["event_id", "judge_id"],
            ["dogfood_judge_event_assignments.event_id", "dogfood_judge_event_assignments.judge_id"],
            ondelete="RESTRICT",
            name="fk_dogfood_project_assignment_event_judge",
        ),
        ForeignKeyConstraint(
            ["rubric_id", "event_id"],
            ["dogfood_rubrics.id", "dogfood_rubrics.event_id"],
            ondelete="RESTRICT",
            name="fk_dogfood_project_assignment_rubric_event",
        ),
        UniqueConstraint("project_id", "judge_id", name="uq_dogfood_project_judge"),
        UniqueConstraint(
            "id", "event_id", "judge_id", "rubric_id",
            name="uq_dogfood_assignment_scope",
        ),
        CheckConstraint(
            "status IN ('pending', 'in_progress', 'submitted', 'revoked')",
            name="ck_dogfood_project_assignment_status",
        ),
        Index("ix_dogfood_project_assignments_judge_status", "judge_id", "status"),
        Index("ix_dogfood_project_assignments_event", "event_id", "project_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(nullable=False)
    project_id: Mapped[UUID] = mapped_column(nullable=False)
    judge_id: Mapped[UUID] = mapped_column(nullable=False)
    rubric_id: Mapped[UUID] = mapped_column(nullable=False)
    assigned_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default=text("'pending'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class JudgeEvaluation(Base):
    __tablename__ = "dogfood_judge_evaluations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["assignment_id", "event_id", "judge_id", "rubric_id"],
            [
                "dogfood_judge_project_assignments.id",
                "dogfood_judge_project_assignments.event_id",
                "dogfood_judge_project_assignments.judge_id",
                "dogfood_judge_project_assignments.rubric_id",
            ],
            ondelete="CASCADE",
            name="fk_dogfood_evaluation_assignment_scope",
        ),
        UniqueConstraint("assignment_id", name="uq_dogfood_evaluation_assignment"),
        UniqueConstraint("id", "rubric_id", name="uq_dogfood_evaluation_id_rubric"),
        CheckConstraint(
            "status IN ('draft', 'submitted')", name="ck_dogfood_evaluation_status"
        ),
        CheckConstraint(
            "(status = 'draft' AND submitted_at IS NULL) OR "
            "(status = 'submitted' AND submitted_at IS NOT NULL)",
            name="ck_dogfood_evaluation_submitted_at",
        ),
        CheckConstraint(
            "weighted_score IS NULL OR (weighted_score >= 0 AND weighted_score <= 100)",
            name="ck_dogfood_evaluation_weighted_score",
        ),
        Index("ix_dogfood_evaluations_event_status", "event_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    assignment_id: Mapped[UUID] = mapped_column(nullable=False)
    event_id: Mapped[UUID] = mapped_column(nullable=False)
    judge_id: Mapped[UUID] = mapped_column(nullable=False)
    rubric_id: Mapped[UUID] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default=text("'draft'")
    )
    feedback: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default=text("''"))
    weighted_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class JudgeCriterionScore(Base):
    __tablename__ = "dogfood_judge_criterion_scores"
    __table_args__ = (
        ForeignKeyConstraint(
            ["evaluation_id", "rubric_id"],
            ["dogfood_judge_evaluations.id", "dogfood_judge_evaluations.rubric_id"],
            ondelete="CASCADE",
            name="fk_dogfood_score_evaluation_rubric",
        ),
        ForeignKeyConstraint(
            ["criterion_id", "rubric_id"],
            ["dogfood_rubric_criteria.id", "dogfood_rubric_criteria.rubric_id"],
            ondelete="RESTRICT",
            name="fk_dogfood_score_criterion_rubric",
        ),
        UniqueConstraint("evaluation_id", "criterion_id", name="uq_dogfood_score_criterion"),
        CheckConstraint("raw_score >= 0", name="ck_dogfood_raw_score_nonnegative"),
        Index("ix_dogfood_scores_evaluation", "evaluation_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    evaluation_id: Mapped[UUID] = mapped_column(nullable=False)
    criterion_id: Mapped[UUID] = mapped_column(nullable=False)
    rubric_id: Mapped[UUID] = mapped_column(nullable=False)
    raw_score: Mapped[Decimal] = mapped_column(Numeric(8, 3), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class JudgingResultSnapshot(Base):
    __tablename__ = "dogfood_judging_result_snapshots"
    __table_args__ = (
        UniqueConstraint("id", "event_id", name="uq_dogfood_snapshot_id_event"),
        ForeignKeyConstraint(
            ["rubric_id", "event_id"],
            ["dogfood_rubrics.id", "dogfood_rubrics.event_id"],
            ondelete="RESTRICT",
            name="fk_dogfood_snapshot_rubric_event",
        ),
        CheckConstraint(
            "status IN ('ready', 'insufficient_data')", name="ck_dogfood_snapshot_status"
        ),
        CheckConstraint("source_evaluation_count >= 0", name="ck_dogfood_snapshot_source_count"),
        Index("ix_dogfood_snapshots_event_created", "event_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    rubric_id: Mapped[UUID] = mapped_column(nullable=False)
    method: Mapped[str] = mapped_column(String(64), nullable=False)
    method_version: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False)
    insufficient_reason: Mapped[str | None] = mapped_column(Text)
    source_evaluation_count: Mapped[int] = mapped_column(Integer, nullable=False)
    parameters: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class JudgingProjectResult(Base):
    __tablename__ = "dogfood_judging_project_results"
    __table_args__ = (
        ForeignKeyConstraint(
            ["snapshot_id", "event_id"],
            ["dogfood_judging_result_snapshots.id", "dogfood_judging_result_snapshots.event_id"],
            ondelete="CASCADE",
            name="fk_dogfood_project_result_snapshot_event",
        ),
        ForeignKeyConstraint(
            ["project_id", "event_id"],
            ["project_submissions.id", "project_submissions.event_id"],
            ondelete="CASCADE",
            name="fk_dogfood_project_result_project_event",
        ),
        UniqueConstraint("snapshot_id", "project_id", name="uq_dogfood_snapshot_project"),
        CheckConstraint("evaluation_count > 0", name="ck_dogfood_result_evaluation_count"),
        CheckConstraint("raw_average >= 0 AND raw_average <= 100", name="ck_dogfood_result_raw_range"),
        CheckConstraint(
            "normalized_score IS NULL OR (normalized_score >= 0 AND normalized_score <= 100)",
            name="ck_dogfood_result_normalized_range",
        ),
        Index("ix_dogfood_project_results_snapshot_rank", "snapshot_id", "normalized_score"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    snapshot_id: Mapped[UUID] = mapped_column(nullable=False)
    event_id: Mapped[UUID] = mapped_column(nullable=False)
    project_id: Mapped[UUID] = mapped_column(nullable=False)
    raw_average: Mapped[Decimal] = mapped_column(Numeric(8, 4), nullable=False)
    normalized_score: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    evaluation_count: Mapped[int] = mapped_column(Integer, nullable=False)
