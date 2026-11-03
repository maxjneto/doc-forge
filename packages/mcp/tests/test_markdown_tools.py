"""The Markdown tools as an agent calls them, with the backend client faked.

Run: pip install -e ".[dev]" && pytest
"""
import asyncio

import pytest

import docforge_mcp.server as srv

BODY = "# Doc\n\n## Um\n\nporta 8002, Caddy na frente\n\n## Dois\n\nCaddy de novo\n"


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def backend(monkeypatch):
    """A document under review; `state` holds what the agent wrote and what is pending."""
    state = {"active": BODY, "mine": None, "writes": [], "bases": [], "feedback": []}

    async def get_document(document_id):
        return {
            "id": document_id, "title": "Doc", "document_mode": "editor", "agent_write_policy": "suggest",
            "sections": [{"id": "sec", "section_type": "body", "active_version_content": state["active"]}],
        }

    async def list_suggestions(document_id, status=None, include_content=False):
        return [state["mine"]] if state["mine"] else []

    async def update_section_content(section_id, content, note=None, mode="replace", base=None):
        state["writes"].append((content, note, mode))
        state["bases"].append(base)
        state["mine"] = {"id": "s1", "is_mine": True, "proposed_content": content, "has_conflict": False}
        return {"mode": "suggestion", "suggestion_id": "s1"}

    async def list_feedback(document_id, status=None):
        return state["feedback"]

    monkeypatch.setattr(srv.api, "get_document", get_document)
    monkeypatch.setattr(srv.api, "list_suggestions", list_suggestions)
    monkeypatch.setattr(srv.api, "update_section_content", update_section_content)
    monkeypatch.setattr(srv.api, "list_feedback", list_feedback)
    monkeypatch.setattr(srv, "_use_api_key", lambda ctx: None)
    return state


def test_edits_build_on_the_agents_pending_suggestion(backend):
    run(srv.patch_section("d", old_text="porta 8002", new_text="porta 8003", ctx=None))
    out = run(srv.patch_section("d", anchor="Dois", old_text="Caddy de novo", new_text="proxy de novo", ctx=None))
    # The second edit started from the first one, not from the untouched document.
    assert backend["writes"][-1][0] == BODY.replace("porta 8002", "porta 8003").replace("Caddy de novo", "proxy de novo")
    assert "suggestion s1" in out and "further writes update it" in out

    doc = run(srv.get_document("d", full=True, ctx=None))
    assert "Your pending suggestion s1 is applied" in doc and "porta 8003" in doc


def test_several_edits_land_as_one_write(backend):
    run(srv.patch_section("d", edits=[
        {"old_text": "Caddy", "new_text": "proxy de borda", "all": True},
        {"anchor": "Um", "old_text": "porta 8002", "new_text": "porta 8003"},
    ], note="renomeia", ctx=None))
    assert len(backend["writes"]) == 1
    content, note, _ = backend["writes"][0]
    assert "Caddy" not in content and content.count("proxy de borda") == 2 and "porta 8003" in content
    assert note == "renomeia"


def test_edits_arrive_as_a_json_string_too(backend):
    run(srv.patch_section("d", edits='[{"old_text": "porta 8002", "new_text": "porta 9"}]', ctx=None))
    assert "porta 9" in backend["writes"][0][0]


def test_one_bad_edit_writes_nothing(backend):
    with pytest.raises(srv.DocForgeError, match="Edit 2: old_text appears 2 times"):
        run(srv.patch_section("d", edits=[
            {"old_text": "porta 8002", "new_text": "porta 8003"},
            {"old_text": "Caddy", "new_text": "proxy"},
        ], ctx=None))
    assert backend["writes"] == []


def test_an_unknown_heading_lists_the_real_ones(backend):
    with pytest.raises(srv.DocForgeError, match="Headings: Doc, Um, Dois"):
        run(srv.patch_section("d", anchor="Três", old_text="x", new_text="y", ctx=None))


def test_comments_for_the_agent_are_set_apart_from_people_talking(backend):
    backend["feedback"] = [
        {"id": "f1", "content": "Troque o status", "for_agent": True, "anchor": {"quote": "porta 8002"}},
        {"id": "f2", "content": "@time: confere o limite?", "for_agent": False},
        {"id": "f3", "parent_id": "f2", "content": "confiro amanhã", "author_name": "Ana"},
    ]
    out = run(srv.get_pending_feedback("d", ctx=None))
    mine, others = out.split("BETWEEN PEOPLE")
    assert "FOR YOU (1)" in mine and "Troque o status" in mine and "porta 8002" in mine
    assert "Do not reply to or resolve these" in others and "confere o limite" in others and "confiro amanhã" in others


def test_a_clashing_suggestion_is_redone_from_what_people_wrote(backend):
    backend["active"] = BODY.replace("porta 8002", "porta 9000")  # a person changed it
    backend["mine"] = {"id": "s1", "is_mine": True, "has_conflict": True,
                       "proposed_content": BODY.replace("porta 8002", "porta 8003"),
                       "people_changes": [{"before": "porta 8002", "after": "porta 9000"}]}
    doc = run(srv.get_document("d", full=True, ctx=None))
    assert "WARNING" in doc and "WITHOUT your pending changes" in doc and "porta 9000" in doc
    # It names what the person changed, so everything else is the agent's to re-apply.
    assert '"porta 8002" → "porta 9000"' in doc

    run(srv.patch_section("d", old_text="Caddy de novo", new_text="proxy", ctx=None))
    # Rebuilt on the people's text, and that text is the new base: no clash left.
    assert backend["writes"][-1][0] == backend["active"].replace("Caddy de novo", "proxy")
    assert backend["bases"][-1] == backend["active"]
