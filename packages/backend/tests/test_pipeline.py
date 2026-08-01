"""End-to-end tests for the BYOA pipeline state machine (M2).

Simulates the roadmap's exit criterion: an agent drives an RFC through
discovery → alignment (human checkpoint) → generation (via suggestions) →
audit, with the run resumable at any point.
"""

import pytest

from app.models.user import User

CONTEXT = "Build a rate limiter for our public API to stop abusive clients from degrading service."

LONG_TEXT = (
    "The service currently has no protection against abusive clients. "
    "We interviewed the on-call team and reviewed three recent incidents caused by "
    "a single client saturating the API. A token-bucket rate limiter at the gateway "
    "was chosen because it is well understood and cheap to operate."
)

SECTION_MD = (
    "## Overview\n\n"
    "This section describes the token-bucket rate limiter design in enough detail "
    "to be reviewed: buckets are keyed by API key, refill at a configurable rate, "
    "and are stored in Redis with a Lua script guaranteeing atomicity. Requests "
    "that find an empty bucket receive HTTP 429 with a Retry-After header. "
    "Operational dashboards track rejection rates per client so support can react."
)


async def _start(client) -> str:
    res = await client.post("/api/pipeline/documents", json={
        "document_type_slug": "rfc",
        "title": "Rate limiter RFC",
        "document_context": CONTEXT,
    })
    assert res.status_code == 201, res.text
    return res.json()["document_id"]


@pytest.mark.asyncio
async def test_pipeline_full_flow(client_factory):
    user = User(id="u_pipe1", email="p1@test.com", name="P", credits=5)
    async with client_factory(user) as client:
        doc_id = await _start(client)

        # ── Discovery: one step per RFC section, in order ──
        for expected_key in ["context", "proposal", "implementation", "risks"]:
            res = await client.get(f"/api/documents/{doc_id}/pipeline/next-step")
            step = res.json()
            assert step["status"] == "running"
            assert step["phase"] == "discovery"
            assert step["section_key"] == expected_key
            assert "instructions" in step and len(step["instructions"]) > 100

            res = await client.post(
                f"/api/documents/{doc_id}/pipeline/submit",
                json={"payload": {"content": LONG_TEXT}},
            )
            assert res.status_code == 200, res.text

        # ── Alignment: summaries must cover every section ──
        res = await client.get(f"/api/documents/{doc_id}/pipeline/next-step")
        assert res.json()["phase"] == "alignment"

        # Incomplete submission is rejected with a corrective message
        res = await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"summaries": {"context": "x" * 40}}},
        )
        assert res.status_code == 422
        assert "Missing summaries" in res.json()["detail"]

        summaries = {k: f"This section will cover {k} in detail, grounded in discovery."
                     for k in ["context", "proposal", "implementation", "risks"]}
        res = await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"summaries": summaries}},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "waiting_human"

        # Agent cannot bypass the human checkpoint
        res = await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"content": SECTION_MD}},
        )
        assert res.status_code == 422

        # ── Human approves in the browser ──
        res = await client.post(f"/api/documents/{doc_id}/pipeline/approve")
        assert res.status_code == 200
        assert res.json()["phase"] == "generation"

        # ── Generation: per section; first write direct, content flows in ──
        for expected_key in ["context", "proposal", "implementation", "risks"]:
            res = await client.get(f"/api/documents/{doc_id}/pipeline/next-step")
            step = res.json()
            assert step["phase"] == "generation"
            assert step["section_key"] == expected_key
            assert step["context"]["approved_summary"]

            res = await client.post(
                f"/api/documents/{doc_id}/pipeline/submit",
                json={"payload": {"content": SECTION_MD + f"\n\nSection: {expected_key}"}},
            )
            assert res.status_code == 200, res.text

        # ── Audit: agent reports findings ──
        res = await client.get(f"/api/documents/{doc_id}/pipeline/next-step")
        assert res.json()["phase"] == "audit"
        res = await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"findings": [
                {"section_type": "risks", "description": "Risks section does not mention Redis outage.", "severity": "high"},
            ]}},
        )
        assert res.status_code == 200
        assert res.json()["status"] == "completed"

        # Document hands off to the free editor (A-lite, not the old dedicated
        # completed screen — docs/product/pipeline-collaboration-implementation.md
        # Fase 2/ponto 6). The pipeline RUN is still "completed" above; only the
        # document-facing phase differs.
        detail = await client.get(f"/api/documents/{doc_id}")
        data = detail.json()
        assert data["document"]["current_phase"] == "editing"
        contents = {s["section_type"]: s["active_version_content"] for s in data["sections"]}
        assert all(contents[k] for k in ["context", "proposal", "implementation", "risks"])

        # A-lite: the N sections are concatenated into a synthetic `body`
        # section (one heading per section, in document-type order) so the
        # single-section EditorLayout has something to render.
        body = contents["body"]
        assert "## Context" in body
        assert "## Proposal" in body
        assert "## Implementation" in body
        assert "## Risks" in body
        assert body.index("## Context") < body.index("## Proposal") < body.index("## Implementation") < body.index("## Risks")

        # Audit findings persisted
        findings = await client.get(f"/api/documents/{doc_id}/audit-findings")
        assert len(findings.json()) == 1


@pytest.mark.asyncio
async def test_pipeline_is_resumable(client_factory):
    """A new session (fresh client) picks up exactly where the old one died."""
    user = User(id="u_pipe2", email="p2@test.com", name="P", credits=5)
    async with client_factory(user) as client:
        doc_id = await _start(client)
        await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"content": LONG_TEXT}},
        )
        # Session dies here (client closed)

    async with client_factory(user) as new_session:
        res = await new_session.get(f"/api/documents/{doc_id}/pipeline/next-step")
        step = res.json()
        assert step["phase"] == "discovery"
        assert step["section_key"] == "proposal"  # second section — state survived
        assert step["step_index"] == 1


@pytest.mark.asyncio
async def test_pipeline_alignment_rejection_returns_to_agent(client_factory):
    """Human rejects the checkpoint → run unblocks, comment becomes feedback."""
    user = User(id="u_pipe5", email="p5@test.com", name="P", credits=5)
    async with client_factory(user) as client:
        doc_id = await _start(client)
        for _ in range(4):
            await client.post(
                f"/api/documents/{doc_id}/pipeline/submit",
                json={"payload": {"content": LONG_TEXT}},
            )
        summaries = {k: f"This section will cover {k} in detail, grounded in discovery."
                     for k in ["context", "proposal", "implementation", "risks"]}
        await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"summaries": summaries}},
        )

        res = await client.post(
            f"/api/documents/{doc_id}/pipeline/reject",
            json={"comment": "Proposal summary ignores the Redis dependency."},
        )
        assert res.status_code == 200
        step = res.json()
        assert step["status"] == "running"
        assert step["phase"] == "alignment"  # same step, back with the agent

        feedback = await client.get(f"/api/documents/{doc_id}/feedback", params={"status": "open"})
        items = feedback.json()["feedback"]
        assert len(items) == 1
        assert "Redis dependency" in items[0]["content"]

        # Agent resubmits and this time the human approves
        await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"summaries": summaries}},
        )
        res = await client.post(f"/api/documents/{doc_id}/pipeline/approve")
        assert res.status_code == 200
        assert res.json()["phase"] == "generation"


@pytest.mark.asyncio
async def test_pipeline_rejects_thin_submissions(client_factory):
    user = User(id="u_pipe3", email="p3@test.com", name="P", credits=5)
    async with client_factory(user) as client:
        doc_id = await _start(client)
        res = await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"content": "too short"}},
        )
        assert res.status_code == 422
        assert "too short" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_pipeline_generation_creates_suggestions_after_first_write(client_factory, monkeypatch):
    """Regenerating a section that already has content must go through review."""
    user = User(id="u_pipe4", email="p4@test.com", name="P", credits=5)
    async with client_factory(user) as client:
        doc_id = await _start(client)
        for _ in range(4):
            await client.post(
                f"/api/documents/{doc_id}/pipeline/submit",
                json={"payload": {"content": LONG_TEXT}},
            )
        summaries = {k: f"This section will cover {k} in detail, grounded in discovery."
                     for k in ["context", "proposal", "implementation", "risks"]}
        await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"summaries": summaries}},
        )
        await client.post(f"/api/documents/{doc_id}/pipeline/approve")

        # First generation for 'context' writes directly (nothing to diff)
        await client.post(
            f"/api/documents/{doc_id}/pipeline/submit",
            json={"payload": {"content": SECTION_MD}},
        )
        listed = await client.get(f"/api/documents/{doc_id}/suggestions")
        assert listed.json()["suggestions"] == []

        # A later explicit suggestion on the same section goes through review
        detail = await client.get(f"/api/documents/{doc_id}")
        context_section = next(
            s for s in detail.json()["sections"] if s["section_type"] == "context"
        )
        res = await client.post(
            f"/api/sections/{context_section['id']}/suggestions",
            json={"content": SECTION_MD + "\n\nRevised."},
        )
        assert res.status_code == 201
