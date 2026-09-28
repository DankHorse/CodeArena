from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Vote(Base):
    __tablename__ = "dogfood_votes"
    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "event_id"],
            ["project_submissions.id", "project_submissions.event_id"],
            ondelete="CASCADE",
            name="fk_dogfood_votes_project_event",
        ),
        UniqueConstraint(
            "project_id", "voter_id", name="uq_dogfood_votes_project_voter"
        ),
        Index("ix_dogfood_votes_event_voter", "event_id", "voter_id"),
        Index("ix_dogfood_votes_project", "project_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[UUID] = mapped_column(nullable=False)
    voter_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
