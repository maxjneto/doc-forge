"""Toolsets: /mcp/markdown and /mcp/cgd show each agent only the tools of its document type.

Run: pip install -e ".[dev]" && pytest
"""
import asyncio

import pytest

import docforge_mcp.server as srv


def run(coro):
    return asyncio.run(coro)


def registered() -> set[str]:
    return {t.name for t in run(srv.mcp.list_tools())}


def test_every_tool_belongs_to_exactly_one_group():
    groups = [srv.GENERAL_TOOLS, srv.MARKDOWN_TOOLS, srv.CGD_TOOLS]
    assert set().union(*groups) == registered()
    assert sum(len(g) for g in groups) == len(registered())


@pytest.mark.parametrize("toolset", ["markdown", "cgd"])
def test_a_toolset_lists_only_its_tools(monkeypatch, toolset):
    monkeypatch.setattr(srv, "_toolset", lambda: toolset)
    names = {t.name for t in run(srv._list_tools())}
    assert names == srv.TOOLSETS[toolset]
    assert "list_documents" in names


def test_without_a_toolset_every_tool_is_listed(monkeypatch):
    monkeypatch.setattr(srv, "_toolset", lambda: None)
    assert {t.name for t in run(srv._list_tools())} == registered()


def test_calling_a_tool_from_the_other_toolset_says_where_it_lives(monkeypatch):
    monkeypatch.setattr(srv, "_toolset", lambda: "markdown")
    with pytest.raises(srv.DocForgeError, match="/mcp/cgd"):
        run(srv._call_tool("apply_layout_ops", {"document_id": "d", "ops": []}))


def test_resources_and_prompts_follow_the_toolset(monkeypatch):
    monkeypatch.setattr(srv, "_toolset", lambda: "cgd")
    uris = {str(r.uri) for r in run(srv._list_resources())}
    templates = {t.uriTemplate for t in run(srv._list_resource_templates())}
    assert "docforge://guide/layout" in uris and "docforge://documents" in templates
    assert "docforge://guide/system-prompt" not in uris
    assert not any(t.startswith("docforge://recipes") for t in templates)
    assert run(srv._list_prompts()) == []

    monkeypatch.setattr(srv, "_toolset", lambda: "markdown")
    uris = {str(r.uri) for r in run(srv._list_resources())}
    assert "docforge://guide/system-prompt" in uris and "docforge://guide/layout" not in uris


def test_the_path_becomes_the_toolset_header():
    seen = {}

    async def app(scope, receive, send):
        seen.update(scope)

    route = srv._toolset_paths(app)
    run(route({"type": "http", "path": "/mcp/markdown", "raw_path": b"/mcp/markdown", "headers": [(b"x-docforge-toolset", b"cgd")]}, None, None))
    assert seen["path"] == "/mcp"
    assert dict(seen["headers"])[b"x-docforge-toolset"] == b"markdown"

    seen.clear()
    run(route({"type": "http", "path": "/mcp", "raw_path": b"/mcp", "headers": []}, None, None))
    assert seen["path"] == "/mcp" and seen["headers"] == []

    seen.clear()
    run(route({"type": "http", "path": "/mcp/other", "raw_path": b"/mcp/other", "headers": []}, None, None))
    assert seen["path"] == "/mcp/other"


def test_list_documents_says_each_type(monkeypatch):
    async def fake_list():
        return [
            {"id": "a", "title": "Spec", "document_mode": "editor", "updated_at": "2026-11-02T10:00"},
            {"id": "b", "title": "Relatório", "document_mode": "layout", "updated_at": "2026-11-02T10:00"},
        ]

    monkeypatch.setattr(srv.api, "list_documents", fake_list)
    monkeypatch.setattr(srv, "_use_api_key", lambda ctx: None)
    monkeypatch.setattr(srv, "_toolset", lambda: "markdown")
    out = run(srv.list_documents(ctx=None))
    assert "id=a type=markdown" in out and "(its tools" not in out.splitlines()[0]
    assert "id=b type=cgd" in out and "/mcp/cgd" in out.splitlines()[1]


def test_markdown_tools_refuse_a_layout_document(monkeypatch):
    async def fake_get(document_id):
        return {"id": document_id, "title": "Relatório", "document_mode": "layout", "sections": []}

    monkeypatch.setattr(srv.api, "get_document", fake_get)
    monkeypatch.setattr(srv, "_use_api_key", lambda ctx: None)
    with pytest.raises(srv.DocForgeError, match="get_layout_map"):
        run(srv.get_document("b", ctx=None))
