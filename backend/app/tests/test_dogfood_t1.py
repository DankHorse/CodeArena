from datetime import timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy import inspect

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import SessionLocal, get_engine
from app.main import app
from app.models.event import Event, EventRegistration
from app.models.project import ProjectSubmission
from app.models.team import Team, TeamInvitation, TeamMember
from app.models.user import User
from app.services.projects import finalize_project
from app.core.errors import APIError


@pytest.fixture(autouse=True)
def clean_dogfood_data():
    if not get_settings().database_url:
        pytest.skip("DATABASE_URL is not configured")
    yield
    with SessionLocal(bind=get_engine()) as db:
        events = select(Event.id).where(Event.slug.like("dogfood-test-%"))
        db.execute(
            delete(ProjectSubmission).where(ProjectSubmission.event_id.in_(events))
        )
        db.execute(delete(TeamInvitation).where(TeamInvitation.event_id.in_(events)))
        db.execute(delete(TeamMember).where(TeamMember.event_id.in_(events)))
        db.execute(delete(Team).where(Team.event_id.in_(events)))
        db.execute(
            delete(EventRegistration).where(EventRegistration.event_id.in_(events))
        )
        db.execute(delete(Event).where(Event.id.in_(events)))
        db.execute(delete(User).where(User.email.like("dogfood-test-%@example.com")))
        db.commit()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_user(role: str = "participant") -> User:
    user_id = uuid4()
    user = User(
        id=user_id,
        email=f"dogfood-test-{user_id.hex}@example.com",
        password_hash="test-only-not-a-password-hash",
        display_name="DOGFOOD Tester",
        role=role,
    )
    with SessionLocal(bind=get_engine()) as db:
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def auth(client: TestClient, user: User) -> None:
    client.cookies.set(get_settings().auth_cookie_name, create_access_token(user.id))


def event_payload(**overrides):
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    data = {
        "title": "DOGFOOD T1 Event",
        "slug": f"dogfood-test-{uuid4().hex}",
        "description": "Test event description",
        "registration_opens_at": (now - timedelta(hours=1)).isoformat(),
        "registration_deadline": (now + timedelta(days=2)).isoformat(),
        "starts_at": (now + timedelta(days=3)).isoformat(),
        "submission_deadline": (now + timedelta(days=4)).isoformat(),
        "ends_at": (now + timedelta(days=5)).isoformat(),
        "team_min_size": 1,
        "team_max_size": 3,
    }
    data.update(overrides)
    return data


def create_event(
    client: TestClient, organizer: User, *, publish=True, **overrides
) -> dict:
    auth(client, organizer)
    created = client.post("/api/v1/events", json=event_payload(**overrides))
    assert created.status_code == 201, created.text
    if publish:
        published = client.post(
            f"/api/v1/events/{created.json()['id']}/transition",
            json={"status": "published"},
        )
        assert published.status_code == 200, published.text
        return published.json()
    return created.json()


def register(client: TestClient, event_id: str, user: User):
    auth(client, user)
    return client.post(f"/api/v1/events/{event_id}/registrations")


def test_event_creation_role_and_event_scoped_ownership(client: TestClient) -> None:
    participant, organizer, other = (
        make_user(),
        make_user("organizer"),
        make_user("organizer"),
    )
    auth(client, participant)
    forbidden = client.post("/api/v1/events", json=event_payload())
    assert forbidden.status_code == 403
    event = create_event(client, organizer, publish=False)
    assert event["organizer_id"] == str(organizer.id)
    auth(client, other)
    attempt = client.post(
        f"/api/v1/events/{event['id']}/transition", json={"status": "published"}
    )
    assert attempt.status_code == 403


def test_event_lifecycle_and_duplicate_registration(client: TestClient) -> None:
    organizer, participant = make_user("organizer"), make_user()
    draft = create_event(client, organizer, publish=False)
    auth(client, organizer)
    early = client.post(
        f"/api/v1/events/{draft['id']}/transition", json={"status": "active"}
    )
    assert early.status_code == 409
    published = client.post(
        f"/api/v1/events/{draft['id']}/transition", json={"status": "published"}
    )
    assert published.status_code == 200
    assert register(client, draft["id"], participant).status_code == 201
    duplicate = register(client, draft["id"], participant)
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "ALREADY_REGISTERED"


def test_event_lifecycle_can_advance_when_schedule_allows(client: TestClient) -> None:
    from datetime import datetime, timezone

    organizer = make_user("organizer")
    now = datetime.now(timezone.utc)
    event = create_event(
        client,
        organizer,
        publish=False,
        registration_opens_at=(now - timedelta(days=5)).isoformat(),
        registration_deadline=(now - timedelta(days=4)).isoformat(),
        starts_at=(now - timedelta(days=3)).isoformat(),
        submission_deadline=(now - timedelta(days=2)).isoformat(),
        ends_at=(now - timedelta(days=1)).isoformat(),
    )
    auth(client, organizer)
    assert (
        client.post(
            f"/api/v1/events/{event['id']}/transition", json={"status": "published"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/events/{event['id']}/transition", json={"status": "active"}
        ).status_code
        == 200
    )
    completed = client.post(
        f"/api/v1/events/{event['id']}/transition", json={"status": "completed"}
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"


def test_team_membership_invitation_and_authorization(client: TestClient) -> None:
    organizer, captain, invited, outsider = (
        make_user("organizer"),
        make_user(),
        make_user(),
        make_user(),
    )
    event = create_event(client, organizer)
    for user in (captain, invited):
        assert register(client, event["id"], user).status_code == 201
    auth(client, captain)
    team_response = client.post(
        f"/api/v1/events/{event['id']}/teams", json={"name": "DOGFOOD team"}
    )
    assert team_response.status_code == 201, team_response.text
    team_id = team_response.json()["id"]
    auth(client, outsider)
    denied = client.post(
        f"/api/v1/teams/{team_id}/invitations", json={"invitee_id": str(invited.id)}
    )
    assert denied.status_code == 403
    auth(client, captain)
    invite = client.post(
        f"/api/v1/teams/{team_id}/invitations", json={"invitee_id": str(invited.id)}
    )
    assert invite.status_code == 201, invite.text
    token = invite.json()["token"]
    assert token not in invite.json().get("token_hash", "")
    auth(client, outsider)
    wrong_recipient = client.post(
        "/api/v1/team-invitations/accept", json={"token": token}
    )
    assert wrong_recipient.status_code == 404
    invalid_token = client.post(
        "/api/v1/team-invitations/accept", json={"token": "x" * 48}
    )
    assert invalid_token.status_code == 404
    auth(client, invited)
    accepted = client.post("/api/v1/team-invitations/accept", json={"token": token})
    assert accepted.status_code == 200, accepted.text
    member = client.get(f"/api/v1/events/{event['id']}/teams/me")
    assert member.status_code == 200
    assert {str(captain.id), str(invited.id)} == set(member.json()["member_ids"])
    assert register(client, event["id"], outsider).status_code == 201
    auth(client, invited)
    duplicate_membership = client.post(
        f"/api/v1/events/{event['id']}/teams", json={"name": "second team"}
    )
    assert duplicate_membership.status_code == 409


def test_expired_invitation_is_rejected(client: TestClient) -> None:
    organizer, captain, invitee = make_user("organizer"), make_user(), make_user()
    event = create_event(client, organizer)
    for user in (captain, invitee):
        assert register(client, event["id"], user).status_code == 201
    auth(client, captain)
    team = client.post(
        f"/api/v1/events/{event['id']}/teams", json={"name": "Expiration team"}
    )
    invitation = client.post(
        f"/api/v1/teams/{team.json()['id']}/invitations",
        json={"invitee_id": str(invitee.id)},
    )
    from datetime import datetime, timezone

    with SessionLocal(bind=get_engine()) as db:
        row = db.scalar(
            select(TeamInvitation).where(
                TeamInvitation.id == invitation.json()["invitation_id"]
            )
        )
        row.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    auth(client, invitee)
    rejected = client.post(
        "/api/v1/team-invitations/accept", json={"token": invitation.json()["token"]}
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "INVITATION_EXPIRED"


def test_project_draft_edit_submit_lock_and_public_gallery(client: TestClient) -> None:
    organizer, participant, outsider = make_user("organizer"), make_user(), make_user()
    event = create_event(client, organizer)
    assert register(client, event["id"], participant).status_code == 201
    auth(client, participant)
    team = client.post(
        f"/api/v1/events/{event['id']}/teams", json={"name": "Gallery team"}
    )
    assert team.status_code == 201
    draft = client.post(
        f"/api/v1/events/{event['id']}/projects",
        json={"title": "Private draft title", "description": "Initial description"},
    )
    assert draft.status_code == 201, draft.text
    project_id = draft.json()["id"]
    auth(client, outsider)
    hidden = client.get(f"/api/v1/projects/{project_id}")
    assert hidden.status_code == 404
    hidden_update = client.patch(
        f"/api/v1/projects/{project_id}", json={"title": "Intrusion"}
    )
    assert hidden_update.status_code == 404
    auth(client, participant)
    edited = client.patch(
        f"/api/v1/projects/{project_id}", json={"title": "DOGFOOD Public Project"}
    )
    assert edited.status_code == 200
    submitted = client.post(f"/api/v1/projects/{project_id}/submit")
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"
    locked = client.patch(f"/api/v1/projects/{project_id}", json={"title": "Mutated"})
    assert locked.status_code == 409
    public = client.get("/api/v1/gallery/projects", params={"limit": 1})
    assert public.status_code == 200
    page = public.json()
    assert page["total"] >= 1
    assert page["items"][0]["title"] == "DOGFOOD Public Project"
    assert "team_id" not in public.text
    assert "organizer_id" not in public.text
    assert "captain_id" not in public.text
    assert "status" not in page["items"][0]


def test_submission_deadline_exact_boundary_and_after_deadline(
    client: TestClient,
) -> None:
    organizer, participant = make_user("organizer"), make_user()
    event = create_event(client, organizer)
    register(client, event["id"], participant)
    auth(client, participant)
    team = client.post(
        f"/api/v1/events/{event['id']}/teams", json={"name": "Deadline team"}
    )
    project = client.post(
        f"/api/v1/events/{event['id']}/projects",
        json={"title": "Deadline project", "description": "Ready"},
    )
    assert team.status_code == project.status_code == 201
    with SessionLocal(bind=get_engine()) as db:
        row = db.get(ProjectSubmission, project.json()["id"])
        deadline = db.get(Event, event["id"]).submission_deadline
        assert (
            finalize_project(db, row.id, participant, now=deadline).status
            == "submitted"
        )


def test_submission_after_deadline_and_closed_event_rejected(
    client: TestClient,
) -> None:
    organizer, participant = make_user("organizer"), make_user()
    event = create_event(client, organizer)
    register(client, event["id"], participant)
    auth(client, participant)
    client.post(f"/api/v1/events/{event['id']}/teams", json={"name": "Late team"})
    project = client.post(
        f"/api/v1/events/{event['id']}/projects",
        json={"title": "Late project", "description": "Ready"},
    )
    with SessionLocal(bind=get_engine()) as db:
        row = db.get(ProjectSubmission, project.json()["id"])
        deadline = db.get(Event, event["id"]).submission_deadline
        with pytest.raises(APIError) as error:
            finalize_project(
                db, row.id, participant, now=deadline + timedelta(microseconds=1)
            )
        assert error.value.code == "DEADLINE_PASSED"
        db.rollback()
        db.get(Event, event["id"]).status = "completed"
        db.commit()
    closed_edit = client.patch(
        f"/api/v1/projects/{project.json()['id']}", json={"title": "No"}
    )
    assert closed_edit.status_code == 409
    closed_submit = client.post(f"/api/v1/projects/{project.json()['id']}/submit")
    assert closed_submit.status_code == 409
    assert closed_submit.json()["error"]["code"] == "EVENT_CLOSED"


def test_gallery_pagination_and_only_publicly_submitted_projects(
    client: TestClient,
) -> None:
    organizer = make_user("organizer")
    event = create_event(client, organizer)
    for index in range(3):
        participant = make_user()
        register(client, event["id"], participant)
        auth(client, participant)
        team = client.post(
            f"/api/v1/events/{event['id']}/teams", json={"name": f"Team {index}"}
        )
        project = client.post(
            f"/api/v1/events/{event['id']}/projects",
            json={"title": f"DOGFOOD Gallery {index}", "description": "Gallery text"},
        )
        assert team.status_code == project.status_code == 201
        if index < 2:
            assert (
                client.post(
                    f"/api/v1/projects/{project.json()['id']}/submit"
                ).status_code
                == 200
            )
    first = client.get("/api/v1/gallery/projects", params={"offset": 0, "limit": 1})
    second = client.get("/api/v1/gallery/projects", params={"offset": 1, "limit": 1})
    assert first.status_code == second.status_code == 200
    assert first.json()["total"] == 2
    assert len(second.json()["items"]) == 1
    assert first.json()["items"][0]["id"] != second.json()["items"][0]["id"]


def test_team_minimum_is_enforced_only_when_finalizing(client: TestClient) -> None:
    organizer, captain, invitee = make_user("organizer"), make_user(), make_user()
    event = create_event(client, organizer, team_min_size=2)
    for user in (captain, invitee):
        assert register(client, event["id"], user).status_code == 201
    auth(client, captain)
    team = client.post(
        f"/api/v1/events/{event['id']}/teams", json={"name": "Minimum team"}
    )
    project = client.post(
        f"/api/v1/events/{event['id']}/projects",
        json={"title": "Wait for member", "description": "Ready"},
    )
    rejected = client.post(f"/api/v1/projects/{project.json()['id']}/submit")
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "TEAM_BELOW_MINIMUM"
    invite = client.post(
        f"/api/v1/teams/{team.json()['id']}/invitations",
        json={"invitee_id": str(invitee.id)},
    )
    auth(client, invitee)
    assert (
        client.post(
            "/api/v1/team-invitations/accept", json={"token": invite.json()["token"]}
        ).status_code
        == 200
    )
    auth(client, captain)
    assert (
        client.post(f"/api/v1/projects/{project.json()['id']}/submit").status_code
        == 200
    )


def test_event_specific_team_maximum_is_enforced(client: TestClient) -> None:
    organizer, captain, invitee = make_user("organizer"), make_user(), make_user()
    event = create_event(client, organizer, team_max_size=1)
    for user in (captain, invitee):
        assert register(client, event["id"], user).status_code == 201
    auth(client, captain)
    team = client.post(
        f"/api/v1/events/{event['id']}/teams", json={"name": "Full team"}
    )
    invite = client.post(
        f"/api/v1/teams/{team.json()['id']}/invitations",
        json={"invitee_id": str(invitee.id)},
    )
    assert invite.status_code == 409
    assert invite.json()["error"]["code"] == "TEAM_FULL"


def test_admin_can_assign_organizer_role_only(client: TestClient) -> None:
    admin, participant = make_user("admin"), make_user()
    auth(client, participant)
    denied = client.patch(
        f"/api/v1/admin/users/{participant.id}/role", json={"role": "organizer"}
    )
    assert denied.status_code == 403
    auth(client, admin)
    promoted = client.patch(
        f"/api/v1/admin/users/{participant.id}/role", json={"role": "organizer"}
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "organizer"
    forbidden_escalation = client.patch(
        f"/api/v1/admin/users/{participant.id}/role", json={"role": "admin"}
    )
    assert forbidden_escalation.status_code == 422


def test_dogfood_migration_tables_and_constraints_exist() -> None:
    inspector = inspect(get_engine())
    for table in (
        "events",
        "event_registrations",
        "teams",
        "team_members",
        "team_invitations",
        "project_submissions",
    ):
        assert inspector.has_table(table)
    event_constraints = {
        item["name"] for item in inspector.get_check_constraints("events")
    }
    assert "ck_events_schedule_order" in event_constraints
    project_indexes = {
        item["name"] for item in inspector.get_indexes("project_submissions")
    }
    assert "ix_project_submissions_event_status_submitted" in project_indexes
