from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectSubmission(Base):
    """DOGFOOD project entry; intentionally separate from CodeArena Submission."""

    __tablename__ = "project_submissions"
    __table_args__ = (
        ForeignKeyConstraint(
            ["team_id", "event_id"],
            ["teams.id", "teams.event_id"],
            ondelete="RESTRICT",
            name="fk_project_submissions_team_event",
        ),
        ForeignKeyConstraint(
            ["track_id", "event_id"],
            ["event_tracks.id", "event_tracks.event_id"],
            ondelete="RESTRICT",
            name="fk_project_submissions_track_event",
        ),
        UniqueConstraint("team_id", name="uq_project_submissions_team"),
        UniqueConstraint(
            "id", "event_id", name="uq_project_submissions_id_event"
        ),
        CheckConstraint(
            "status IN ('draft', 'submitted')", name="ck_project_submissions_status"
        ),
        CheckConstraint(
            "(status = 'draft' AND submitted_at IS NULL) OR "
            "(status = 'submitted' AND submitted_at IS NOT NULL)",
            name="ck_project_submissions_submitted_at",
        ),
        Index(
            "ix_project_submissions_event_status_submitted",
            "event_id",
            "status",
            "submitted_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(nullable=False)
    team_id: Mapped[UUID] = mapped_column(nullable=False)
    track_id: Mapped[UUID | None] = mapped_column(nullable=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(
        Text, nullable=False, default="", server_default=text("''")
    )
    repository_url: Mapped[str | None] = mapped_column(String(2_048))
    demo_url: Mapped[str | None] = mapped_column(String(2_048))
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="draft", server_default=text("'draft'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
