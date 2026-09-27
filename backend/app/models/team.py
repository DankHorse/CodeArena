from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("id", "event_id", name="uq_teams_id_event"),
        ForeignKeyConstraint(
            ["event_id", "captain_id"],
            ["event_registrations.event_id", "event_registrations.user_id"],
            ondelete="RESTRICT",
            name="fk_teams_captain_registration",
        ),
        Index("ix_teams_event_id", "event_id"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    captain_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (
        ForeignKeyConstraint(
            ["team_id", "event_id"],
            ["teams.id", "teams.event_id"],
            ondelete="CASCADE",
            name="fk_team_members_team_event",
        ),
        ForeignKeyConstraint(
            ["event_id", "user_id"],
            ["event_registrations.event_id", "event_registrations.user_id"],
            ondelete="CASCADE",
            name="fk_team_members_registration",
        ),
        Index("ix_team_members_team_id", "team_id"),
    )

    event_id: Mapped[UUID] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), primary_key=True
    )
    team_id: Mapped[UUID] = mapped_column(nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class TeamInvitation(Base):
    __tablename__ = "team_invitations"
    __table_args__ = (
        ForeignKeyConstraint(
            ["team_id", "event_id"],
            ["teams.id", "teams.event_id"],
            ondelete="CASCADE",
            name="fk_team_invitations_team_event",
        ),
        ForeignKeyConstraint(
            ["event_id", "invitee_id"],
            ["event_registrations.event_id", "event_registrations.user_id"],
            ondelete="CASCADE",
            name="fk_team_invitations_registration",
        ),
        UniqueConstraint(
            "team_id", "invitee_id", name="uq_team_invitations_team_invitee"
        ),
        UniqueConstraint("token_hash", name="uq_team_invitations_token_hash"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'revoked', 'expired')",
            name="ck_team_invitations_status",
        ),
        Index("ix_team_invitations_invitee_status", "invitee_id", "status"),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    team_id: Mapped[UUID] = mapped_column(nullable=False)
    event_id: Mapped[UUID] = mapped_column(nullable=False)
    inviter_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    invitee_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default="pending", server_default=text("'pending'")
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
