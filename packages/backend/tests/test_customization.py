"""Tests for M4 customization: pipeline definitions, custom types, custom prompts."""

import pytest

from app.models.user import User

CONTEXT = "Design a caching layer for the product API to cut p99 latency in half."


def _pro_user(uid: str) -> User:
    return User(id=uid, email=f"{uid}@test.com", name="Pro", credits=20, plan="pro")


@pytest.mark.asyncio
async def test_clone_edit_and_run_custom_pipeline(client_factory):
    """M4 exit criterion: clone the baseline, edit a prompt, run it end-to-end."""
    async with client_factory(_pro_user("u_cust1")) as client:
        # Clone the RFC baseline — prompts come back materialized as text
        res = await client.post(
            "/api/pipeline-definitions/clone",
            json={"document_type_slug": "rfc", "name": "My RFC flow"},
        )
        assert res.status_code == 201, res.text
        definition = res.json()
        steps = definition["steps"]
        assert steps[0]["phase"] == "discovery"
        assert steps[0]["prompt"]  # materialized, editable text

        # Edit: customize the first discovery prompt
        steps[0]["prompt"] = "CUSTOM HOUSE PROMPT: always start from the incident postmortems."
        res = await client.patch(
            f"/api/pipeline-definitions/{definition['id']}",
            json={"steps": steps},
        )
        assert res.status_code == 200
        assert "CUSTOM HOUSE PROMPT" in res.json()["steps"][0]["prompt"]

        # Run a pipeline from the custom definition
        res = await client.post("/api/pipeline/documents", json={
            "document_context": CONTEXT,
            "pipeline_definition_id": definition["id"],
        })
        assert res.status_code == 201, res.text
        doc_id = res.json()["document_id"]
        first_step = res.json()["next_step"]
        assert "CUSTOM HOUSE PROMPT" in first_step["instructions"]

        # The run is resumable and still serves the custom prompt
        res = await client.get(f"/api/documents/{doc_id}/pipeline/next-step")
        assert "CUSTOM HOUSE PROMPT" in res.json()["instructions"]


@pytest.mark.asyncio
async def test_definition_steps_validation(client_factory):
    async with client_factory(_pro_user("u_cust2")) as client:
        res = await client.post("/api/pipeline-definitions/clone", json={"document_type_slug": "rfc"})
        definition = res.json()

        res = await client.patch(
            f"/api/pipeline-definitions/{definition['id']}",
            json={"steps": [{"phase": "brew-coffee"}]},
        )
        assert res.status_code == 422
        assert "phase" in res.json()["detail"]

        res = await client.patch(
            f"/api/pipeline-definitions/{definition['id']}",
            json={"steps": [{"phase": "generation", "section_key": "nonexistent"}]},
        )
        assert res.status_code == 422


@pytest.mark.asyncio
async def test_customization_is_pro_gated(client_factory):
    free_user = User(id="u_cust3", email="free@test.com", name="F", credits=5)
    async with client_factory(free_user) as client:
        res = await client.post("/api/pipeline-definitions/clone", json={"document_type_slug": "rfc"})
        assert res.status_code == 403

        res = await client.post("/api/document-types", json={
            "slug": "my-type", "name": "My Type", "description": "x",
            "sections": [{"section_key": "body", "display_name": "Body", "order": 1, "role_description": "r"}],
        })
        assert res.status_code == 403


@pytest.mark.asyncio
async def test_custom_document_type_with_prompts_and_pipeline(client_factory):
    """P3 completa: custom type + custom prompt, visible only to its owner,
    and runnable as a pipeline."""
    async with client_factory(_pro_user("u_cust4")) as client:
        res = await client.post("/api/document-types", json={
            "slug": "design-doc",
            "name": "Design Doc",
            "description": "Two-section internal design doc.",
            "sections": [
                {"section_key": "problem", "display_name": "Problem", "order": 1,
                 "role_description": "What we are solving and why."},
                {"section_key": "design", "display_name": "Design", "order": 2,
                 "role_description": "The chosen approach."},
            ],
        })
        assert res.status_code == 201, res.text
        assert res.json()["is_custom"] is True

        # Custom prompt for the type (single source: pipeline + resources)
        res = await client.put("/api/document-types/design-doc/prompts", json={
            "phase": "discovery",
            "prompt_text": "DESIGN-DOC DISCOVERY PROMPT: enumerate affected teams first.",
        })
        assert res.status_code == 200

        # Listed for the owner
        res = await client.get("/api/document-types")
        slugs = [t["slug"] for t in res.json()]
        assert "design-doc" in slugs and "rfc" in slugs

        # Pipeline over the custom type serves the custom prompt
        res = await client.post("/api/pipeline/documents", json={
            "document_type_slug": "design-doc",
            "document_context": CONTEXT,
        })
        assert res.status_code == 201, res.text
        step = res.json()["next_step"]
        assert step["section_key"] == "problem"
        assert "DESIGN-DOC DISCOVERY PROMPT" in step["instructions"]

    # Another user does not see the custom type
    async with client_factory(_pro_user("u_cust5")) as other:
        res = await other.get("/api/document-types")
        slugs = [t["slug"] for t in res.json()]
        assert "design-doc" not in slugs
        res = await other.post("/api/pipeline/documents", json={
            "document_type_slug": "design-doc",
            "document_context": CONTEXT,
        })
        assert res.status_code == 400


@pytest.mark.asyncio
async def test_slug_collision_rejected(client_factory):
    async with client_factory(_pro_user("u_cust6")) as client:
        res = await client.post("/api/document-types", json={
            "slug": "rfc", "name": "Clash", "description": "x",
            "sections": [{"section_key": "body", "display_name": "Body", "order": 1, "role_description": "r"}],
        })
        assert res.status_code == 409
