from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, Index, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectComment(Base):
    __tablename__ = "project_comments"
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "event_id"],
            ["project_submissions.id", "project_submissions.event_id"],
            ondelete="CASCADE",
            name="fk_project_comments_project_event",
        ),
        ForeignKeyConstraint(
            ["author_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name="fk_project_comments_author",
        ),
        Index(
            "ix_project_comments_project_event_created",
            "project_id",
            "event_id",
            "created_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(nullable=False)
    project_id: Mapped[UUID] = mapped_column(nullable=False)
    author_id: Mapped[UUID] = mapped_column(nullable=False)

    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
