"""Usage events: who acted (agent or person), on what, what the MCP server handed the
agent, and whose name an event goes under (the person's choice about analytics).
PostHog is replaced by a recorder."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import Request
from sqlalchemy import select

from app.auth import get_current_user
from app.main import app
from app.models.user import User
from app.services import observability

from .conftest import TestSession
from .test_layout import _add, _create, layout_service  # noqa: F401  (fixture)

AGENT = User(id="user_agent", email="agent@example.com", name="Agent", credits=5)


@pytest.fixture()
def recorder():
    rec = MagicMock()
    with patch("app.services.observability.posthog_client", rec):
        yield rec


@pytest.fixture()
def events(recorder):
    return lambda: [(c.args[0], c.kwargs["properties"]) for c in recorder.capture.call_args_list]


def _by_name(events):
    out: dict[str, list[dict]] = {}
    for name, props in events():
        out.setdefault(name, []).append(props)
    return out


def _as_agent(user: User = AGENT):
    """Authenticate like an MCP call does: an API key on the request."""

    async def override(request: Request):
        request.state.api_key_id = uuid.uuid4()
        request.state.user_id = user.id
        request.state.user = user
        return user

    app.dependency_overrides[get_current_user] = override


@pytest.mark.asyncio
async def test_writes_and_creation_say_who_acted(client_factory, events):
    async with client_factory(AGENT) as client:
        doc_id = (await _create(client, template="one-pager"))["document_id"]
        await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a")]})
        _as_agent()
        await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("b")], "note": "porque sim"})

    by_name = _by_name(events)
    created = by_name["document_created"][0]
    assert created["template"] == "one-pager" and created["document_mode"] == "layout" and created["document_kind"] == "page"
    writes = by_name["layout_changed"]
    assert [w["source"] for w in writes] == ["person", "agent"]
    assert writes[1]["has_note"] is True and writes[1]["op_types"] == "add"
    # Successful agent requests are counted per tool by the MCP server, not here.
    assert "agent_request_failed" not in by_name


@pytest.mark.asyncio
async def test_failed_agent_requests_are_reported(client_factory, events):
    async with client_factory(AGENT) as client:
        _as_agent()
        res = await client.post(f"/api/documents/{uuid.uuid4()}/layout/ops", json={"ops": [_add("a")]})
    assert res.status_code >= 400
    failed = _by_name(events)["agent_request_failed"][0]
    assert failed["route"] == "POST /documents/{document_id}/layout/ops" and failed["status"] == res.status_code


@pytest.mark.asyncio
async def test_the_mcp_server_reports_tool_calls(client_factory, events):
    async with client_factory(AGENT) as client:
        _as_agent()
        res = await client.post(
            "/api/telemetry/mcp-tool",
            json={"tool": "apply_layout_ops", "toolset": "cgd", "ok": True, "duration_ms": 120.5, "response_chars": 600, "document_id": "d1", "detail": {"map": "summary"}},
        )
    assert res.status_code == 204
    props = _by_name(events)["mcp_tool_called"][0]
    assert props["tool"] == "apply_layout_ops" and props["toolset"] == "cgd"
    assert props["approx_tokens"] == 150 and props["detail_map"] == "summary"


@pytest.mark.asyncio
async def test_reviewing_agent_changes_on_a_layout_is_recorded_server_side(client_factory, events):
    async with client_factory(AGENT) as client:
        doc_id = (await _create(client, template="one-pager"))["document_id"]
        res = await client.post(f"/api/documents/{doc_id}/layout/reviewed", json={"outcome": "kept", "changes": 4, "effects": 1})
    assert res.status_code == 204
    reviewed = _by_name(events)["agent_changes_reviewed"][0]
    assert reviewed == {**reviewed, "outcome": "kept", "changes": 4, "document_mode": "layout", "source": "person", "document_id": doc_id}


@pytest.mark.asyncio
async def test_the_cookie_choice_is_kept_on_the_account(client_factory):
    user = User(id="user_consent", email="c@example.com", name="C", credits=5)
    async with client_factory(user) as client:
        assert (await client.patch("/api/users/me", json={"analytics_consent": "accepted"})).status_code == 204
        assert (await client.patch("/api/users/me", json={"analytics_consent": "maybe"})).status_code == 422
    async with TestSession() as session:
        stored = (await session.execute(select(User).where(User.id == "user_consent"))).scalar_one()
        assert stored.analytics_consent == "accepted"


def _sent(recorder):
    call = recorder.capture.call_args
    return call.kwargs["distinct_id"], call.kwargs["properties"]


def test_people_who_accepted_are_identified(recorder):
    person = User(id="user_yes", email="y@example.com", analytics_consent="accepted")
    observability.capture_account_event(person, "subscription_started", {"plan": "pro"}, person={"plan": "pro"})
    distinct_id, props = _sent(recorder)
    assert distinct_id == "user_yes"
    assert props["$set"] == {"plan": "pro"} and "$process_person_profile" not in props


@pytest.mark.parametrize("consent", [None, "declined"])
def test_everyone_else_is_an_anonymous_pseudonym(recorder, consent):
    person = User(id="user_no", email="n@example.com", analytics_consent=consent)
    observability.capture_account_event(person, "subscription_started", {"plan": "pro"}, person={"plan": "pro"})
    distinct_id, props = _sent(recorder)
    assert distinct_id.startswith("anon_") and "user_no" not in distinct_id
    assert distinct_id == observability.pseudonym("user_no")  # stable: the funnel still counts one person
    assert props["$process_person_profile"] is False and "$set" not in props
    # A bare id (no account loaded) is never identified either.
    observability.capture_event("user_no", "d1", "public_document_read")
    assert _sent(recorder)[0] == distinct_id
