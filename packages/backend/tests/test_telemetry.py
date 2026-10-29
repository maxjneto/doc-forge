"""Usage events for the user tests: who acted (agent or person), on what, and what the
MCP server handed the agent. PostHog is replaced by a recorder."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import Request

from app.auth import get_current_user
from app.main import app
from app.models.user import User

from .test_layout import _add, _create, layout_service  # noqa: F401  (fixture)

AGENT = User(id="user_agent", email="agent@example.com", name="Agent", credits=5)


@pytest.fixture()
def events():
    recorder = MagicMock()
    with patch("app.services.observability.posthog_client", recorder):
        yield lambda: [(c.kwargs["event"], c.kwargs["properties"]) for c in recorder.capture.call_args_list]


def _as_agent():
    """Authenticate like an MCP call does: an API key on the request."""

    async def override(request: Request):
        request.state.api_key_id = uuid.uuid4()
        request.state.user_id = AGENT.id
        return AGENT

    app.dependency_overrides[get_current_user] = override


@pytest.mark.asyncio
async def test_writes_and_creation_say_who_acted(client_factory, events):
    async with client_factory(AGENT) as client:
        doc_id = (await _create(client, template="one-pager"))["document_id"]
        await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a")]})
        _as_agent()
        await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("b")], "note": "porque sim"})

    by_name = {}
    for name, props in events():
        by_name.setdefault(name, []).append(props)
    assert by_name["layout_document_created"][0]["template"] == "one-pager"
    writes = by_name["layout_write"]
    assert [w["source"] for w in writes] == ["person", "agent"]
    assert writes[1]["has_note"] is True and writes[1]["op_types"] == "add"
    # The agent's write is also an API request, by route template.
    assert any(p["route"] == "POST /documents/{document_id}/layout/ops" and p["ok"] for p in by_name["mcp_api_request"])


@pytest.mark.asyncio
async def test_the_mcp_server_reports_tool_calls(client_factory, events):
    async with client_factory(AGENT) as client:
        _as_agent()
        res = await client.post(
            "/api/telemetry/mcp-tool",
            json={"tool": "apply_layout_ops", "ok": True, "duration_ms": 120.5, "response_chars": 600, "document_id": "d1", "detail": {"map": "summary"}},
        )
    assert res.status_code == 204
    name, props = next((n, p) for n, p in events() if n == "mcp_tool_called")
    assert props["tool"] == "apply_layout_ops" and props["approx_tokens"] == 150 and props["detail_map"] == "summary"
    # The telemetry post itself is not counted as an agent request.
    assert not any(n == "mcp_api_request" for n, _ in events())
