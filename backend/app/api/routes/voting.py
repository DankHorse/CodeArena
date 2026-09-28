from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.voting import (
    EventVotesSummaryResponse,
    ProjectVoteSummary,
    VoteCheckResponse,
    VoteCreate,
    VoteListResponse,
    VoteResponse,
    BallotProjectResponse,
)
from app.services.voting import (
    cast_vote,
    check_vote,
    get_event_votes_summary,
    get_project_vote_summary,
    list_user_votes,
    retract_vote,
    get_ballot_projects,
)

router = APIRouter()


@router.post(
    "/projects/{project_id}/vote",
    response_model=VoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cast a community vote for a project",
    description="Participant-only. Duplicate votes on the same project are rejected.",
)
def vote_for_project(
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cast_vote(db, project_id=project_id, actor=actor)


@router.post(
    "/projects/{project_id}/votes",
    response_model=VoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cast a community vote for a project (plural route alias)",
    include_in_schema=False,
)
def vote_for_project_plural(
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cast_vote(db, project_id=project_id, actor=actor)


@router.post(
    "/events/{event_id}/projects/{project_id}/vote",
    response_model=VoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cast a community vote for an event-scoped project",
)
def vote_for_event_project(
    event_id: UUID,
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cast_vote(db, project_id=project_id, actor=actor, event_id=event_id)


@router.post(
    "/events/{event_id}/votes",
    response_model=VoteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cast a community vote within an event specifying the project in the body",
)
def vote_in_event(
    event_id: UUID,
    request: VoteCreate,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return cast_vote(db, project_id=request.project_id, actor=actor, event_id=event_id)


@router.get(
    "/projects/{project_id}/vote",
    response_model=VoteCheckResponse,
    summary="Check if the current user has voted for a project",
)
def check_project_vote(
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return check_vote(db, project_id=project_id, actor=actor)


@router.get(
    "/events/{event_id}/projects/{project_id}/vote",
    response_model=VoteCheckResponse,
    summary="Check if the current user has voted for an event-scoped project",
)
def check_event_project_vote(
    event_id: UUID,
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return check_vote(db, project_id=project_id, actor=actor, event_id=event_id)


@router.get(
    "/projects/{project_id}/votes",
    response_model=ProjectVoteSummary,
    summary="Get vote summary for a project",
)
def project_votes_summary(
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_project_vote_summary(db, project_id=project_id, actor=actor)


@router.get(
    "/events/{event_id}/projects/{project_id}/votes",
    response_model=ProjectVoteSummary,
    summary="Get vote summary for an event project",
)
def event_project_votes_summary(
    event_id: UUID,
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_project_vote_summary(
        db, project_id=project_id, actor=actor, event_id=event_id
    )


@router.get(
    "/events/{event_id}/votes/me",
    response_model=VoteListResponse,
    summary="List all votes cast by the current user in an event",
)
def my_event_votes(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = list_user_votes(db, event_id=event_id, actor=actor)
    return {"items": items, "total": total}


@router.get(
    "/events/{event_id}/votes",
    response_model=EventVotesSummaryResponse,
    summary="Get event-level community vote tallies by project",
)
def event_votes(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_event_votes_summary(db, event_id=event_id)


@router.delete(
    "/projects/{project_id}/vote",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retract a previously cast vote",
)
def retract_project_vote(
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    retract_vote(db, project_id=project_id, actor=actor)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/events/{event_id}/projects/{project_id}/vote",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Retract a previously cast vote in an event",
)
def retract_event_project_vote(
    event_id: UUID,
    project_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    retract_vote(db, project_id=project_id, actor=actor, event_id=event_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/events/{event_id}/ballot",
    response_model=list[BallotProjectResponse],
    summary="Get a randomized community voting ballot",
)
def event_ballot(
    event_id: UUID,
    actor: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_ballot_projects(db, event_id=event_id, actor=actor)
