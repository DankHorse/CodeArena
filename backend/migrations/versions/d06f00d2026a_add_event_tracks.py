"""add event tracks for DOGFOOD fixture imports

Revision ID: d06f00d2026a
Revises: 3866dd34436e
"""
from alembic import op
import sqlalchemy as sa


revision = "d06f00d2026a"
down_revision = "3866dd34436e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "event_tracks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_id", sa.Uuid(), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "source_id", name="uq_event_tracks_event_source"),
        sa.UniqueConstraint("id", "event_id", name="uq_event_tracks_id_event"),
    )
    op.create_index("ix_event_tracks_event_id", "event_tracks", ["event_id"])
    op.add_column("project_submissions", sa.Column("track_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_project_submissions_track_event",
        "project_submissions",
        "event_tracks",
        ["track_id", "event_id"],
        ["id", "event_id"],
        ondelete="RESTRICT",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_project_submissions_track_event", "project_submissions", type_="foreignkey"
    )
    op.drop_column("project_submissions", "track_id")
    op.drop_index("ix_event_tracks_event_id", table_name="event_tracks")
    op.drop_table("event_tracks")
