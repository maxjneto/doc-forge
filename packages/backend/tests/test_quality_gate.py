"""Tests for quality gates (M5): agent-run findings, server-run audit, and the
blocking gate on suggestion acceptance."""


import pytest

from app.models.user import User

from .test_suggestions import agent_client_factory  # noqa: F401  (fixture reuse)


async def _editor_doc(client) -> tuple[str, str]:
    res = await client.post("/api/documents", json={"title": "Doc"})
    doc_id = res.json()["id"]
    detail = await client.get(f"/api/documents/{doc_id}")
    body = next(s for s in detail.json()["sections"] if s["section_type"] == "body")
    return doc_id, body["id"]


@pytest.mark.asyncio
async def test_agent_submits_findings_and_gate_blocks_accept(client_factory, agent_client_factory):  # noqa: F811
    """Roadmap exit criterion: a planted contradiction blocks acceptance until
    resolution/dismissal."""
    user = User(id="u_gate1", email="g1@test.com", name="G", credits=10)
    async with client_factory(user) as human:
        doc_id, section_id = await _editor_doc(human)
        await human.patch(f"/api/sections/{section_id}/content", json={"content": "Timeout is 30s."})
        # Enable the blocking gate on this document
        res = await human.patch(f"/api/documents/{doc_id}", json={"require_gate_on_accept": True})
        assert res.json()["require_gate_on_accept"] is True

    async with agent_client_factory(user) as agent:
        # Agent proposes content, then audits and reports a planted contradiction
        res = await agent.patch(
            f"/api/sections/{section_id}/content",
            json={"content": "Timeout is 30s. Later we retry after the 60s timeout."},
        )
        suggestion_id = res.json()["suggestion_id"]

        res = await agent.post(f"/api/documents/{doc_id}/quality-gate/findings", json={
            "findings": [{
                "section_type": "body",
                "description": "Contradiction: timeout stated as both 30s and 60s.",
                "severity": "high",
            }],
        })
        assert res.status_code == 200
        assert len(res.json()) == 1

    async with client_factory(user) as human:
        # Gate status reflects the blocking condition
        res = await human.get(f"/api/documents/{doc_id}/quality-gate")
        gate = res.json()
        assert gate["blocking"] is True
        assert gate["open_high_findings"] == 1

        # Accepting the suggestion is blocked
        res = await human.post(f"/api/suggestions/{suggestion_id}/accept")
        assert res.status_code == 409
        assert "Quality gate" in res.json()["detail"]

        # Human dismisses the finding → acceptance unblocks
        finding_id = gate["findings"][0]["id"]
        res = await human.post(f"/api/documents/{doc_id}/audit-findings/{finding_id}/dismiss")
        assert res.status_code == 200
        res = await human.post(f"/api/suggestions/{suggestion_id}/accept")
        assert res.status_code == 200


@pytest.mark.asyncio
async def test_rerun_replaces_open_but_keeps_dismissed(client_factory):
    user = User(id="u_gate2", email="g2@test.com", name="G", credits=10)
    async with client_factory(user) as client:
        doc_id, section_id = await _editor_doc(client)
        await client.patch(f"/api/sections/{section_id}/content", json={"content": "content"})

        res = await client.post(f"/api/documents/{doc_id}/quality-gate/findings", json={
            "findings": [
                {"section_type": "body", "description": "Old finding A", "severity": "high"},
                {"section_type": "body", "description": "Old finding B", "severity": "low"},
            ],
        })
        first = res.json()
        # Dismiss A — the human's call survives future runs
        await client.post(f"/api/documents/{doc_id}/audit-findings/{first[0]['id']}/dismiss")

        res = await client.post(f"/api/documents/{doc_id}/quality-gate/findings", json={
            "findings": [{"section_type": "body", "description": "New finding", "severity": "low"}],
        })
        assert res.status_code == 200

        listed = await client.get(f"/api/documents/{doc_id}/audit-findings")
        descriptions = [f["description"] for f in listed.json()]
        assert descriptions == ["New finding"]  # open ones replaced, dismissed hidden


@pytest.mark.asyncio
async def test_findings_validation(client_factory):
    user = User(id="u_gate3", email="g3@test.com", name="G", credits=10)
    async with client_factory(user) as client:
        doc_id, _ = await _editor_doc(client)
        res = await client.post(f"/api/documents/{doc_id}/quality-gate/findings", json={
            "findings": [{"section_type": "nope", "description": "x", "severity": "high"}],
        })
        assert res.status_code == 422
        res = await client.post(f"/api/documents/{doc_id}/quality-gate/findings", json={
            "findings": [{"section_type": "body", "description": "x", "severity": "catastrophic"}],
        })
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_there_is_no_server_run_gate(client_factory):
    """DocForge never calls a model: the gate is run by the person's agent."""
    user = User(id="u_gate5", email="g5@test.com", name="G", credits=1)
    async with client_factory(user) as client:
        doc_id, _ = await _editor_doc(client)
        res = await client.post(f"/api/documents/{doc_id}/quality-gate/run")
        assert res.status_code in (404, 405)
