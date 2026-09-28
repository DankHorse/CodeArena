from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import SessionLocal, get_engine
from app.main import app
from app.models.event import Event, EventRegistration, EventTrack
from app.models.project import ProjectSubmission
from app.models.team import Team, TeamInvitation, TeamMember
from app.models.user import User
from app.models.voting import Vote


@pytest.fixture(autouse=True)
def clean_dogfood_t3_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        events = select(Event.id).where(Event.slug.like("dogfood-t3-%"))
        db.execute(delete(Vote).where(Vote.event_id.in_(events)))
        db.execute(delete(ProjectSubmission).where(ProjectSubmission.event_id.in_(events)))
        db.execute(delete(TeamInvitation).where(TeamInvitation.event_id.in_(events)))
        db.execute(delete(TeamMember).where(TeamMember.event_id.in_(events)))
        db.execute(delete(Team).where(Team.event_id.in_(events)))
        db.execute(delete(EventRegistration).where(EventRegistration.event_id.in_(events)))
        db.execute(delete(EventTrack).where(EventTrack.event_id.in_(events)))
        db.execute(delete(Event).where(Event.slug.like("dogfood-t3-%")))
        db.execute(delete(User).where(User.email.like("dogfood-t3-%@example.com")))
        db.commit()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_user(role: str = "participant", is_active: bool = True) -> User:
    user_id = uuid4()
    user = User(
        id=user_id,
        email=f"dogfood-t3-{user_id.hex}@example.com",
        password_hash="test-only-not-a-password-hash",
        display_name=f"DOGFOOD T3 {role.capitalize()}",
        role=role,
        is_active=is_active,
    )
    with SessionLocal(bind=get_engine()) as db:
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def auth(client: TestClient, user: User) -> None:
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(user.id))


def payload_event(**overrides):
    now = datetime.now(timezone.utc)
    data = {
        "title": "DOGFOOD T3 Event",
        "slug": f"dogfood-t3-{uuid4().hex}",
        "description": "Event fixture for community voting.",
        "registration_opens_at": (now - timedelta(hours=1)).isoformat(),
        "registration_deadline": (now + timedelta(days=2)).isoformat(),
        "starts_at": (now + timedelta(days=3)).isoformat(),
        "submission_deadline": (now + timedelta(days=10)).isoformat(),
        "ends_at": (now + timedelta(days=11)).isoformat(),
        "voting_opens_at": (now - timedelta(minutes=5)).isoformat(),
        "voting_ends_at": (now + timedelta(days=11)).isoformat(),
        "team_min_size": 1,
        "team_max_size": 4,
    }
    data.update(overrides)
    return data


def create_event(client: TestClient, organizer: User, publish: bool = True, **overrides) -> dict:
    auth(client, organizer)
    response = client.post("/api/v1/events", json=payload_event(**overrides))
    assert response.status_code == 201, response.text
    event = response.json()
    if publish:
        published = client.post(
            f"/api/v1/events/{event['id']}/transition", json={"status": "published"}
        )
        assert published.status_code == 200, published.text
        return published.json()
    return event


def create_project(client: TestClient, event_id: str, participant: User, title: str = "Test Project", submit: bool = True) -> dict:
    auth(client, participant)
    assert client.post(f"/api/v1/events/{event_id}/registrations").status_code == 201
    team = client.post(f"/api/v1/events/{event_id}/teams", json={"name": f"Team {uuid4().hex[:6]}"})
    assert team.status_code == 201, team.text
    project = client.post(
        f"/api/v1/events/{event_id}/projects",
        json={"title": title, "description": "A test project description."},
    )
    assert project.status_code == 201, project.text
    if submit:
        submitted = client.post(f"/api/v1/projects/{project.json()['id']}/submit")
        assert submitted.status_code == 200, submitted.text
        return submitted.json()
    return project.json()


def test_cast_vote_success_and_persistence(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder, title="Alpha Project")

    # Voter casts a vote
    auth(client, voter)
    response = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert response.status_code == 201, response.text
    vote_data = response.json()

    assert vote_data["project_id"] == project["id"]
    assert vote_data["event_id"] == event["id"]
    assert vote_data["voter_id"] == str(voter.id)
    assert "created_at" in vote_data
    assert "id" in vote_data

    # Verify persistence in database
    with SessionLocal(bind=get_engine()) as db:
        saved_vote = db.get(Vote, vote_data["id"])
        assert saved_vote is not None
        assert str(saved_vote.project_id) == project["id"]
        assert str(saved_vote.event_id) == event["id"]
        assert saved_vote.voter_id == voter.id


def test_prevent_duplicate_votes(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    auth(client, voter)
    # First vote succeeds
    first = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert first.status_code == 201

    # Second vote on the same project fails with 409 ALREADY_VOTED
    second = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ALREADY_VOTED"

    # Database still has only 1 vote
    with SessionLocal(bind=get_engine()) as db:
        vote_count = db.scalar(
            select(Vote).where(Vote.project_id == project["id"], Vote.voter_id == voter.id)
        )
        assert vote_count is not None


def test_enforce_voting_window_too_early(client: TestClient):
    now = datetime.now(timezone.utc)
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    # Event where voting_opens_at is in the future
    event = create_event(
        client,
        organizer,
        voting_opens_at=(now + timedelta(days=1)).isoformat(),
        voting_ends_at=(now + timedelta(days=2)).isoformat(),
    )
    # Builder submits project
    project = create_project(client, event["id"], builder)

    # Voter attempts to vote before voting window opens
    auth(client, voter)
    response = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "VOTING_NOT_OPEN"


def test_enforce_voting_window_closed(client: TestClient):
    now = datetime.now(timezone.utc)
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    # Event where voting_ends_at is in the past
    event = create_event(
        client,
        organizer,
        voting_opens_at=(now - timedelta(hours=2)).isoformat(),
        voting_ends_at=(now - timedelta(minutes=5)).isoformat(),
    )
    project = create_project(client, event["id"], builder)

    auth(client, voter)
    response = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "VOTING_CLOSED"


def test_enforce_custom_voting_window(client: TestClient):
    now = datetime.now(timezone.utc)
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    # Custom voting window set explicitly
    event = create_event(
        client,
        organizer,
        voting_opens_at=(now - timedelta(hours=2)).isoformat(),
        voting_ends_at=(now + timedelta(hours=2)).isoformat(),
    )
    project = create_project(client, event["id"], builder)

    # Within custom voting window: vote succeeds
    auth(client, voter)
    response = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert response.status_code == 201


def test_enforce_event_lifecycle_restriction(client: TestClient):
    organizer = make_user("organizer")
    voter = make_user("participant")

    event = create_event(client, organizer, publish=False)
    # Draft event is not open
    auth(client, voter)
    response = client.post(f"/api/v1/events/{event['id']}/projects/{uuid4()}/vote")
    assert response.status_code in (404, 409)


def test_enforce_voter_authorization_unauthenticated(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    # Unauthenticated request
    client.cookies.clear()
    response = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_enforce_voter_authorization_role_isolation(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    admin = make_user("admin")
    disabled_user = make_user("participant", is_active=False)

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    # Organizer cannot vote
    auth(client, organizer)
    org_resp = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert org_resp.status_code == 403
    assert org_resp.json()["error"]["code"] == "FORBIDDEN"

    # Admin cannot vote
    auth(client, admin)
    admin_resp = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert admin_resp.status_code == 403
    assert admin_resp.json()["error"]["code"] == "FORBIDDEN"

    # Disabled account cannot vote
    auth(client, disabled_user)
    disabled_resp = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert disabled_resp.status_code == 403
    assert disabled_resp.json()["error"]["code"] == "ACCOUNT_DISABLED"


def test_enforce_voter_authorization_prevent_self_voting(client: TestClient):
    organizer = make_user("organizer")
    captain = make_user("participant")
    teammate = make_user("participant")
    outside_voter = make_user("participant")

    event = create_event(client, organizer)

    # Captain registers and creates team
    auth(client, captain)
    client.post(f"/api/v1/events/{event['id']}/registrations")
    team_resp = client.post(f"/api/v1/events/{event['id']}/teams", json={"name": "Alpha Team"})
    team_id = team_resp.json()["id"]

    # Add teammate to team
    with SessionLocal(bind=get_engine()) as db:
        reg = EventRegistration(event_id=event["id"], user_id=teammate.id)
        db.add(reg)
        db.commit()
        member = TeamMember(event_id=event["id"], team_id=team_id, user_id=teammate.id)
        db.add(member)
        db.commit()

    # Captain creates and submits project
    auth(client, captain)
    proj_resp = client.post(
        f"/api/v1/events/{event['id']}/projects",
        json={"title": "Self Team Project", "description": "Description."},
    )
    project_id = proj_resp.json()["id"]
    client.post(f"/api/v1/projects/{project_id}/submit")

    # Captain tries to vote for their own project -> 403
    auth(client, captain)
    captain_vote = client.post(f"/api/v1/projects/{project_id}/vote")
    assert captain_vote.status_code == 403
    assert captain_vote.json()["error"]["code"] == "FORBIDDEN"

    # Teammate tries to vote for their team's project -> 403
    auth(client, teammate)
    teammate_vote = client.post(f"/api/v1/projects/{project_id}/vote")
    assert teammate_vote.status_code == 403
    assert teammate_vote.json()["error"]["code"] == "FORBIDDEN"

    # Outside voter can vote -> 201
    auth(client, outside_voter)
    outside_vote = client.post(f"/api/v1/projects/{project_id}/vote")
    assert outside_vote.status_code == 201


def test_cannot_vote_on_draft_project(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    event = create_event(client, organizer)
    draft_project = create_project(client, event["id"], builder, submit=False)

    auth(client, voter)
    response = client.post(f"/api/v1/projects/{draft_project['id']}/vote")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "PROJECT_NOT_SUBMITTED"


def test_cannot_vote_on_nonexistent_or_mismatched_project(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    event_a = create_event(client, organizer)
    event_b = create_event(client, organizer)
    project_a = create_project(client, event_a["id"], builder)

    auth(client, voter)
    # Nonexistent project
    not_found = client.post(f"/api/v1/projects/{uuid4()}/vote")
    assert not_found.status_code == 404
    assert not_found.json()["error"]["code"] == "PROJECT_NOT_FOUND"

    # Project belonging to event_a accessed via event_b
    mismatched = client.post(f"/api/v1/events/{event_b['id']}/projects/{project_a['id']}/vote")
    assert mismatched.status_code == 404
    assert mismatched.json()["error"]["code"] == "PROJECT_NOT_FOUND"


def test_check_votes_endpoints(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter_1 = make_user("participant")
    voter_2 = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    # Before voting: check returns has_voted = False
    auth(client, voter_1)
    before_check = client.get(f"/api/v1/projects/{project['id']}/vote")
    assert before_check.status_code == 200
    assert before_check.json()["has_voted"] is False
    assert before_check.json()["vote"] is None

    # Before voting: project summary count is 0
    summary_before = client.get(f"/api/v1/projects/{project['id']}/votes")
    assert summary_before.status_code == 200
    assert summary_before.json()["vote_count"] == 0
    assert summary_before.json()["has_voted"] is False

    # voter_1 casts vote
    vote_res = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert vote_res.status_code == 201

    # After voting: check returns has_voted = True
    after_check = client.get(f"/api/v1/projects/{project['id']}/vote")
    assert after_check.status_code == 200
    assert after_check.json()["has_voted"] is True
    assert after_check.json()["vote"]["id"] == vote_res.json()["id"]

    # Check via event-scoped route
    event_check = client.get(f"/api/v1/events/{event['id']}/projects/{project['id']}/vote")
    assert event_check.status_code == 200
    assert event_check.json()["has_voted"] is True

    # Check user's votes in event
    my_votes = client.get(f"/api/v1/events/{event['id']}/votes/me")
    assert my_votes.status_code == 200
    assert my_votes.json()["total"] == 1
    assert my_votes.json()["items"][0]["project_id"] == project["id"]

    # Check project summary for voter_1: count is 1, has_voted is True
    summary_v1 = client.get(f"/api/v1/projects/{project['id']}/votes")
    assert summary_v1.status_code == 200
    assert summary_v1.json()["vote_count"] == 1
    assert summary_v1.json()["has_voted"] is True

    # voter_2 checks summary: count is 1, has_voted is False
    auth(client, voter_2)
    summary_v2 = client.get(f"/api/v1/projects/{project['id']}/votes")
    assert summary_v2.status_code == 200
    assert summary_v2.json()["vote_count"] == 1
    assert summary_v2.json()["has_voted"] is False

    # voter_2 casts vote
    client.post(f"/api/v1/projects/{project['id']}/vote")
    summary_v2_after = client.get(f"/api/v1/projects/{project['id']}/votes")
    assert summary_v2_after.json()["vote_count"] == 2
    assert summary_v2_after.json()["has_voted"] is True

    # Event-level summary
    event_summary = client.get(f"/api/v1/events/{event['id']}/votes")
    assert event_summary.status_code == 200
    assert event_summary.json()["total_votes"] == 2


def test_multiple_projects_voting(client: TestClient):
    organizer = make_user("organizer")
    builder_1 = make_user("participant")
    builder_2 = make_user("participant")
    voter = make_user("participant")

    event = create_event(client, organizer)
    project_1 = create_project(client, event["id"], builder_1, title="Project 1")
    project_2 = create_project(client, event["id"], builder_2, title="Project 2")

    auth(client, voter)
    # Voter can vote for Project 1
    v1 = client.post(f"/api/v1/projects/{project_1['id']}/vote")
    assert v1.status_code == 201

    # Voter can vote for Project 2 in the same event
    v2 = client.post(f"/api/v1/projects/{project_2['id']}/vote")
    assert v2.status_code == 201

    # Voter cannot vote again for Project 1
    v1_dup = client.post(f"/api/v1/projects/{project_1['id']}/vote")
    assert v1_dup.status_code == 409
    assert v1_dup.json()["error"]["code"] == "ALREADY_VOTED"

    # User votes endpoint shows both votes
    my_votes = client.get(f"/api/v1/events/{event['id']}/votes/me")
    assert my_votes.status_code == 200
    assert my_votes.json()["total"] == 2


def test_vote_retraction(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    auth(client, voter)
    # Vote
    res = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert res.status_code == 201
    assert client.get(f"/api/v1/projects/{project['id']}/votes").json()["vote_count"] == 1

    # Retract vote
    retract = client.delete(f"/api/v1/projects/{project['id']}/vote")
    assert retract.status_code == 204

    # Check vote shows false and count is 0
    assert client.get(f"/api/v1/projects/{project['id']}/vote").json()["has_voted"] is False
    assert client.get(f"/api/v1/projects/{project['id']}/votes").json()["vote_count"] == 0

    # Retracting non-existent vote fails with 404
    retract_again = client.delete(f"/api/v1/projects/{project['id']}/vote")
    assert retract_again.status_code == 404
    assert retract_again.json()["error"]["code"] == "VOTE_NOT_FOUND"

    # Can vote again after retraction
    revote = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert revote.status_code == 201


def test_all_route_variations(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    voter_a = make_user("participant")
    voter_b = make_user("participant")
    voter_c = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    # Route 1: POST /projects/{project_id}/vote
    auth(client, voter_a)
    r1 = client.post(f"/api/v1/projects/{project['id']}/vote")
    assert r1.status_code == 201

    # Route 2: POST /events/{event_id}/projects/{project_id}/vote
    auth(client, voter_b)
    r2 = client.post(f"/api/v1/events/{event['id']}/projects/{project['id']}/vote")
    assert r2.status_code == 201

    # Route 3: POST /events/{event_id}/votes with body
    auth(client, voter_c)
    r3 = client.post(f"/api/v1/events/{event['id']}/votes", json={"project_id": project["id"]})
    assert r3.status_code == 201

    # Total votes = 3
    assert client.get(f"/api/v1/projects/{project['id']}/votes").json()["vote_count"] == 3


def test_project_comments_create_and_list(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    commenter = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder, title="Commentable Project")

    auth(client, commenter)

    created = client.post(
        f"/api/v1/events/{event['id']}/projects/{project['id']}/comments",
        json={"body": "This project looks interesting."},
    )
    assert created.status_code == 201, created.text

    comment = created.json()
    assert comment["event_id"] == event["id"]
    assert comment["project_id"] == project["id"]
    assert comment["author_id"] == str(commenter.id)
    assert comment["body"] == "This project looks interesting."
    assert "id" in comment
    assert "created_at" in comment

    listed = client.get(
        f"/api/v1/events/{event['id']}/projects/{project['id']}/comments"
    )
    assert listed.status_code == 200, listed.text
    comments = listed.json()

    assert len(comments) == 1
    assert comments[0]["id"] == comment["id"]


def test_project_comments_reject_non_participants(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    admin = make_user("admin")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    for user in (organizer, admin):
        auth(client, user)
        response = client.post(
            f"/api/v1/events/{event['id']}/projects/{project['id']}/comments",
            json={"body": "Not allowed."},
        )
        assert response.status_code == 403, response.text


def test_project_comments_reject_inactive_participant(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    inactive = make_user("participant", is_active=False)

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    auth(client, inactive)
    response = client.post(
        f"/api/v1/events/{event['id']}/projects/{project['id']}/comments",
        json={"body": "Inactive user."},
    )
    assert response.status_code == 403


def test_project_comments_reject_draft_project(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    commenter = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(
        client,
        event["id"],
        builder,
        submit=False,
    )

    auth(client, commenter)
    response = client.post(
        f"/api/v1/events/{event['id']}/projects/{project['id']}/comments",
        json={"body": "Draft comment."},
    )
    assert response.status_code == 400


def test_project_comments_require_authentication(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    client.cookies.clear()

    response = client.get(
        f"/api/v1/events/{event['id']}/projects/{project['id']}/comments"
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


def test_project_comments_reject_mismatched_event_project(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")

    event_a = create_event(client, organizer)
    event_b = create_event(client, organizer)
    project_a = create_project(client, event_a["id"], builder)

    auth(client, builder)

    response = client.get(
        f"/api/v1/events/{event_b['id']}/projects/{project_a['id']}/comments"
    )
    assert response.status_code == 404


def test_project_comments_reject_blank_body(client: TestClient):
    organizer = make_user("organizer")
    builder = make_user("participant")
    commenter = make_user("participant")

    event = create_event(client, organizer)
    project = create_project(client, event["id"], builder)

    auth(client, commenter)

    for body in ("", "   ", "\n\t"):
        response = client.post(
            f"/api/v1/events/{event['id']}/projects/{project['id']}/comments",
            json={"body": body},
        )
        assert response.status_code in (400, 422), response.text


def test_judging_results_hidden_during_community_voting(client: TestClient):
    organizer = make_user("organizer")
    event = create_event(
        client,
        organizer,
        voting_opens_at=(datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
        voting_ends_at=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
    )

    auth(client, organizer)

    results = client.get(
        f"/api/v1/events/{event['id']}/judging/results"
    )
    assert results.status_code == 409
    assert results.json()["error"]["code"] == "RESULTS_HIDDEN_DURING_VOTING"

    csv_results = client.get(
        f"/api/v1/events/{event['id']}/judging/results.csv"
    )
    assert csv_results.status_code == 409
    assert csv_results.json()["error"]["code"] == "RESULTS_HIDDEN_DURING_VOTING"


def test_judging_results_visible_after_community_voting(client: TestClient):
    organizer = make_user("organizer")
    event = create_event(
        client,
        organizer,
        voting_opens_at=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
        voting_ends_at=(datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
    )

    auth(client, organizer)

    results = client.get(
        f"/api/v1/events/{event['id']}/judging/results"
    )
    assert results.status_code == 404
    assert results.json()["error"]["code"] == "RESULTS_NOT_CALCULATED"

    csv_results = client.get(
        f"/api/v1/events/{event['id']}/judging/results.csv"
    )
    assert csv_results.status_code == 200
    assert csv_results.headers["content-type"].startswith("text/csv")


def test_judging_results_visible_before_community_voting(client: TestClient):
    organizer = make_user("organizer")
    event = create_event(
        client,
        organizer,
        voting_opens_at=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        voting_ends_at=(datetime.now(timezone.utc) + timedelta(hours=4)).isoformat(),
    )

    auth(client, organizer)

    results = client.get(
        f"/api/v1/events/{event['id']}/judging/results"
    )
    assert results.status_code == 404
    assert results.json()["error"]["code"] == "RESULTS_NOT_CALCULATED"
