from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.event import Event
from app.models.project import ProjectSubmission
from app.models.team import Team, TeamMember
from app.models.user import User
from app.models.voting_audit import VotingAuditLog
from app.models.event import EventTrack

router = APIRouter()


def _organizer_event(db: Session, event_id: UUID, actor: User) -> Event:
    event = db.scalar(select(Event).where(Event.id == event_id))
    if event is None:
        raise APIError(404, "EVENT_NOT_FOUND", "Event was not found")
    if actor.role not in {"organizer", "admin"} or event.organizer_id != actor.id:
        raise APIError(403, "FORBIDDEN", "Only this event's organizer can access this data")
    return event


@router.get("/events/{event_id}/teams")
def organizer_teams(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _organizer_event(db, event_id, actor)

    teams = db.scalars(
        select(Team)
        .where(Team.event_id == event_id)
        .order_by(Team.created_at, Team.id)
    ).all()

    items = []
    for team in teams:
        member_ids = list(
            db.scalars(
                select(TeamMember.user_id)
                .where(
                    TeamMember.event_id == event_id,
                    TeamMember.team_id == team.id,
                )
                .order_by(TeamMember.joined_at, TeamMember.user_id)
            )
        )

        items.append(
            {
                "id": team.id,
                "event_id": team.event_id,
                "name": team.name,
                "captain_id": team.captain_id,
                "member_ids": member_ids,
                "member_count": len(member_ids),
            }
        )

    return {"items": items}


@router.get("/events/{event_id}/projects")
def organizer_projects(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _organizer_event(db, event_id, actor)

    projects = db.scalars(
        select(ProjectSubmission)
        .where(ProjectSubmission.event_id == event_id)
        .order_by(ProjectSubmission.created_at, ProjectSubmission.id)
    ).all()

    team_ids = {project.team_id for project in projects}
    track_ids = {project.track_id for project in projects if project.track_id}

    teams = {
        team.id: team
        for team in db.scalars(
            select(Team).where(
                Team.event_id == event_id,
                Team.id.in_(team_ids) if team_ids else True,
            )
        )
    }

    tracks = {
        track.id: track
        for track in db.scalars(
            select(EventTrack).where(
                EventTrack.event_id == event_id,
                EventTrack.id.in_(track_ids) if track_ids else True,
            )
        )
    }

    return {
        "items": [
            {
                "id": project.id,
                "event_id": project.event_id,
                "title": project.title,
                "summary": project.description,
                "team_id": project.team_id,
                "team_name": teams.get(project.team_id).name
                if teams.get(project.team_id)
                else None,
                "track_id": project.track_id,
                "track_name": tracks.get(project.track_id).name
                if project.track_id and tracks.get(project.track_id)
                else None,
                "state": project.status,
                "status": project.status,
                "repo_url": project.repository_url,
                "demo_url": project.demo_url,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
                "submitted_at": project.submitted_at,
            }
            for project in projects
        ]
    }


@router.get("/events/{event_id}/activity")
def organizer_activity(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _organizer_event(db, event_id, actor)

    entries = db.scalars(
        select(VotingAuditLog)
        .where(VotingAuditLog.event_id == event_id)
        .order_by(VotingAuditLog.created_at.desc(), VotingAuditLog.id.desc())
    ).all()

    return {
        "items": [
            {
                "id": entry.id,
                "action": entry.action,
                "actor_id": entry.voter_id,
                "target": str(entry.project_id) if entry.project_id else str(entry.event_id),
                "outcome": entry.outcome,
                "created_at": entry.created_at,
            }
            for entry in entries
        ]
    }
