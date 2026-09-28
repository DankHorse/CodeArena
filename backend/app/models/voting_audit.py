from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VotingAuditLog(Base):
    __tablename__ = "dogfood_voting_audit_logs"
    __table_args__ = (
        Index(
            "ix_dogfood_voting_audit_event_created",
            "event_id",
            "created_at",
        ),
        Index(
            "ix_dogfood_voting_audit_voter_created",
            "voter_id",
            "created_at",
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)

    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
    )

    project_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("project_submissions.id", ondelete="SET NULL"),
        nullable=True,
    )

    voter_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    action: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )

    outcome: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
