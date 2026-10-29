"""Themes, saved versions, note threads and slide decks, as an agent calls them (backend faked)."""

import pytest

import docforge_mcp.server as srv

calls: list[tuple] = []

THEMES = {
    "fonts": ["Inter", "Source Serif 4", "Space Grotesk", "JetBrains Mono"],
    "themes": [
        {"id": "builtin:night", "key": "night", "name": "Noite", "description": "Página escura", "builtin": True, "tokens": {"color": {"surface": "#14161a", "text": "#eef0f3", "primary": "#7aa2ff"}, "font": {"heading": "Space Grotesk"}}},
        {"id": "t-1", "name": "Marca", "builtin": False, "tokens": {"color": {"primary": "#ff0055"}}},
    ],
}


@pytest.fixture(autouse=True)
def fake_backend(monkeypatch):
    calls.clear()
    monkeypatch.setattr(srv, "_use_api_key", lambda ctx: None)

    async def themes():
        return THEMES

    async def apply_theme(document_id, theme):
        calls.append(("theme", theme))
        return {"ok": True, "revision": 4, "diagnostics": [], "changes": [], "map": "", "summary": "tokens changed"}

    async def save_theme(name, tokens, description=None):
        calls.append(("save-theme", name, tokens))
        return {"id": "t-2", "name": name}

    async def get_layout(document_id):
        return {"revision": 9, "content": {"tokens": {"color": {"primary": "#123456"}}}}

    async def save_version(document_id, name, note=None, revision=None):
        calls.append(("version", name, note))
        return {"revision": 9, "name": name}

    async def revisions(document_id, named=False, limit=30):
        calls.append(("revisions", named))
        return {
            "revision": 9,
            "revisions": [
                {"revision": 9, "name": "Enviada", "note": "Para o cliente", "description": "Tema: Noite", "by_agent": True, "summary": {"ops": {"setTokens": 1, "setMeta": 1}, "components": []}, "created_at": "2026-10-15T10:00:00Z"},
            ],
        }

    async def revision(document_id, rev):
        return {"revision": rev, "content": {"components": ["old"]}}

    async def replace(document_id, content, base_revision=None):
        calls.append(("replace", content, base_revision))
        return {"ok": True, "revision": 10, "diagnostics": [], "changes": [], "map": "", "summary": ""}

    async def reply(document_id, note_id, message):
        calls.append(("reply", note_id, message))
        return {"id": "r-1", "parent_id": note_id}

    async def notes(document_id, status, kind, component):
        return {
            "revision": 9,
            "notes": [
                {"id": "a", "kind": "annotation", "by_agent": False, "message": "Ok assim", "anchor": {}, "revision": 9, "status": "open"},
                {"id": "b", "kind": "annotation", "by_agent": False, "for_agent": True, "message": "Troque o gráfico por uma tabela", "anchor": {"component": "g"}, "where": "p1 g", "revision": 9, "status": "open"},
                {"id": "c", "kind": "annotation", "by_agent": True, "parent_id": "b", "message": "Vou trocar", "anchor": {"component": "g"}, "revision": 9, "status": "open"},
            ],
        }

    async def create(title, content=None, template=None, fmt=None):
        calls.append(("create", template, fmt))
        return {"document_id": "11111111-1111-1111-1111-111111111111", "ok": True, "revision": 1, "diagnostics": [], "changes": [], "map": "", "summary": ""}

    for name, fn in {
        "list_layout_themes": themes,
        "apply_layout_theme": apply_theme,
        "save_layout_theme": save_theme,
        "get_layout": get_layout,
        "save_layout_version": save_version,
        "list_layout_revisions": revisions,
        "get_layout_revision": revision,
        "replace_layout": replace,
        "reply_layout_note": reply,
        "list_layout_notes": notes,
        "create_layout_document": create,
    }.items():
        monkeypatch.setattr(srv.api, name, fn)


def _text(out) -> str:
    blocks = out[0] if isinstance(out, tuple) else out
    return "\n".join(getattr(b, "text", "") for b in blocks)


@pytest.mark.asyncio
async def test_themes_are_listed_applied_and_saved():
    listed = _text(await srv.mcp.call_tool("list_layout_themes", {}))
    assert "Noite (night)" in listed and "surface #14161a" in listed and "titles Space Grotesk" in listed
    assert "Marca (t-1)" in listed and "Source Serif 4" in listed

    applied = _text(await srv.mcp.call_tool("apply_layout_theme", {"document_id": "d", "theme": "night"}))
    assert "Theme applied." in applied and ("theme", "night") in calls

    await srv.mcp.call_tool("save_layout_theme", {"name": "Da página", "from_document": "d"})
    assert ("save-theme", "Da página", {"color": {"primary": "#123456"}}) in calls


@pytest.mark.asyncio
async def test_saving_a_theme_needs_tokens_or_a_document():
    with pytest.raises(Exception, match="tokens or from_document"):
        await srv.mcp.call_tool("save_layout_theme", {"name": "X"})


@pytest.mark.asyncio
async def test_versions_are_saved_listed_and_restored():
    saved = _text(await srv.mcp.call_tool("save_layout_version", {"document_id": "d", "name": "Enviada", "note": "Para o cliente"}))
    assert '"Enviada" = revision 9' in saved

    listed = _text(await srv.mcp.call_tool("list_layout_versions", {"document_id": "d"}))
    assert "★ Enviada" in listed and "setTokens×1" in listed and "Para o cliente" in listed
    assert ("revisions", True) in calls

    restored = _text(await srv.mcp.call_tool("restore_layout_version", {"document_id": "d", "revision": 3}))
    assert "Revision 3 restored." in restored
    assert ("replace", {"components": ["old"]}, 9) in calls


@pytest.mark.asyncio
async def test_notes_put_requests_for_the_agent_first_with_their_replies():
    text = _text(await srv.mcp.call_tool("get_layout_notes", {"document_id": "d"}))
    lines = text.splitlines()
    assert "1 request(s) for you" in lines[0]
    assert "[for you · annotation by a person] Troque o gráfico" in lines[1]
    assert any("↳ agent: Vou trocar" in line for line in lines)
    assert text.index("Troque o gráfico") < text.index("Ok assim")

    replied = _text(await srv.mcp.call_tool("reply_layout_note", {"document_id": "d", "note_id": "b", "message": "Trocado"}))
    assert "thread b" in replied and ("reply", "b", "Trocado") in calls


@pytest.mark.asyncio
async def test_a_slide_deck_starts_from_the_format_or_the_template():
    await srv.mcp.call_tool("create_layout_document", {"title": "Deck", "format": "slide"})
    await srv.mcp.call_tool("create_layout_document", {"title": "Deck", "template": "apresentacao"})
    assert ("create", None, "slide") in calls and ("create", "apresentacao", None) in calls
    with pytest.raises(Exception, match="only for an empty document"):
        await srv.mcp.call_tool("create_layout_document", {"title": "Deck", "template": "relatorio", "format": "slide"})
