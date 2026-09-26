from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Problem(Base):
    __tablename__ = "problems"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_problems_slug"),
        CheckConstraint(
            "difficulty IN ('easy', 'medium', 'hard')", name="ck_problems_difficulty"
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    slug: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(16), nullable=False)
    category: Mapped[str | None] = mapped_column(String(80))
    constraints: Mapped[str | None] = mapped_column(Text)
    input_description: Mapped[str] = mapped_column(Text, nullable=False)
    output_description: Mapped[str] = mapped_column(Text, nullable=False)
    starter_code: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, default=dict)
    supported_languages: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=lambda: ["python"]
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    test_cases: Mapped[list["ProblemTestCase"]] = relationship(
        back_populates="problem", cascade="all, delete-orphan", order_by="ProblemTestCase.position"
    )


class ProblemTestCase(Base):
    __tablename__ = "problem_test_cases"
    __table_args__ = (
        CheckConstraint("position >= 0", name="ck_problem_test_cases_position_nonnegative"),
        CheckConstraint(
            "time_limit_ms IS NULL OR time_limit_ms > 0",
            name="ck_problem_test_cases_time_limit_positive",
        ),
        CheckConstraint(
            "memory_limit_mb IS NULL OR memory_limit_mb > 0",
            name="ck_problem_test_cases_memory_limit_positive",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    problem_id: Mapped[UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    input_data: Mapped[str] = mapped_column(Text, nullable=False)
    expected_output: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    time_limit_ms: Mapped[int | None] = mapped_column(Integer)
    memory_limit_mb: Mapped[int | None] = mapped_column(Integer)

    problem: Mapped[Problem] = relationship(back_populates="test_cases")
