"""Layout documents v3: saved themes, saved versions, comment threads and slides.

Uses the fake layout service from test_layout.py (imported so its autouse
fixture applies here too).
"""

import pytest

from .test_layout import _add, _create, layout_service  # noqa: F401  (fixture)


async def _ops(client, doc_id: str, *ops: dict, note: str | None = None) -> dict:
    res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": list(ops), **({"note": note} if note else {})})
    assert res.status_code == 200, res.text
    return res.json()


# ─── Themes ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_built_in_themes_set_the_whole_palette_and_fonts(client_factory):
    async with client_factory() as client:
        body = (await client.get("/api/layout-themes")).json()
    themes = body["themes"]
    keys = [t["key"] for t in themes]
    assert keys[:4] == ["sober", "executive", "green", "forge"]
    assert {"editorial", "tech", "night"} <= set(keys)
    assert all(t["builtin"] for t in themes)
    for t in themes:
        assert len(t["tokens"]["color"]) == 16
        assert set(t["tokens"]["font"]) == {"sans", "heading", "mono"}
    night = next(t for t in themes if t["key"] == "night")
    assert night["tokens"]["color"]["surface"] == "#14161a"
    assert "Source Serif 4" in body["fonts"]


@pytest.mark.asyncio
async def test_a_saved_theme_is_listed_renamed_and_deleted(client_factory):
    async with client_factory() as client:
        created = await client.post(
            "/api/layout-themes",
            json={"name": "Marca", "tokens": {"color": {"primary": "#ff0055"}, "font": {"heading": "Source Serif 4"}}},
        )
        assert created.status_code == 201, created.text
        theme_id = created.json()["id"]
        listed = (await client.get("/api/layout-themes")).json()["themes"]
        renamed = await client.patch(f"/api/layout-themes/{theme_id}", json={"name": "Marca 2026"})
        deleted = await client.delete(f"/api/layout-themes/{theme_id}")
        after = (await client.get("/api/layout-themes")).json()["themes"]

    mine = [t for t in listed if not t["builtin"]]
    assert [t["name"] for t in mine] == ["Marca"]
    assert mine[0]["tokens"]["color"] == {"primary": "#ff0055"}
    assert renamed.json()["name"] == "Marca 2026"
    assert deleted.status_code == 204
    assert all(t["builtin"] for t in after)


@pytest.mark.asyncio
async def test_a_theme_with_an_unknown_font_or_group_is_refused(client_factory):
    async with client_factory() as client:
        font = await client.post("/api/layout-themes", json={"name": "X", "tokens": {"font": {"heading": "Comic Sans"}}})
        group = await client.post("/api/layout-themes", json={"name": "X", "tokens": {"shadow": {"m": 2}}})
    assert font.status_code == 422 and "Comic Sans" in font.text
    assert group.status_code == 422 and "shadow" in group.text


@pytest.mark.asyncio
async def test_an_unknown_theme_is_not_found(client_factory):
    async with client_factory() as client:
        res = await client.patch("/api/layout-themes/00000000-0000-0000-0000-000000000000", json={"name": "Y"})
    assert res.status_code == 404


# ─── Saved versions ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_saving_a_version_names_the_current_revision(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"), _add("b"), note="Dois blocos")
        saved = await client.post(f"/api/documents/{doc_id}/layout/versions", json={"name": "Primeira versão", "note": "Antes da revisão"})
        await _ops(client, doc_id, {"op": "remove", "component": "b"})
        timeline = (await client.get(f"/api/documents/{doc_id}/layout/revisions")).json()["revisions"]
        named = (await client.get(f"/api/documents/{doc_id}/layout/revisions", params={"named": "true"})).json()["revisions"]
        past = (await client.get(f"/api/documents/{doc_id}/layout/revisions/2")).json()

    assert saved.status_code == 201, saved.text
    assert saved.json()["revision"] == 2 and saved.json()["name"] == "Primeira versão"
    assert [r["revision"] for r in timeline] == [3, 2, 1]
    assert timeline[1]["name"] == "Primeira versão" and timeline[1]["note"] == "Antes da revisão"
    assert timeline[1]["summary"] == {"ops": {"add": 2}, "components": ["a", "b"]}
    assert timeline[0]["summary"] == {"ops": {"remove": 1}, "components": ["b"]}
    assert [r["revision"] for r in named] == [2]
    assert past["name"] == "Primeira versão" and len(past["content"]["components"]) == 2


@pytest.mark.asyncio
async def test_a_saved_version_is_renamed_and_unsaved(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await client.post(f"/api/documents/{doc_id}/layout/versions", json={"name": "v1"})
        renamed = await client.patch(f"/api/documents/{doc_id}/layout/revisions/1", json={"name": "Inicial"})
        unsaved = await client.patch(f"/api/documents/{doc_id}/layout/revisions/1", json={"name": None})
        missing = await client.post(f"/api/documents/{doc_id}/layout/versions", json={"name": "x", "revision": 9})
    assert renamed.json()["name"] == "Inicial"
    assert unsaved.json()["name"] is None
    assert missing.status_code == 404


# ─── Comment threads ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_replies_follow_their_thread_and_reopen_it(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"))
        root = (await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "Troque por um gráfico", "anchor": {"component": "a"}, "for_agent": True})).json()
        reply = (await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "Feito, veja agora", "parent_id": root["id"]})).json()
        reply_to_reply = (await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "Valeu", "parent_id": reply["id"]})).json()
        open_notes = (await client.get(f"/api/documents/{doc_id}/layout/notes")).json()["notes"]
        await client.patch(f"/api/layout-notes/{root['id']}", json={"status": "resolved"})
        after_resolve = (await client.get(f"/api/documents/{doc_id}/layout/notes")).json()["notes"]
        resolved = (await client.get(f"/api/documents/{doc_id}/layout/notes", params={"status": "resolved"})).json()["notes"]
        await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "Na verdade, prefiro tabela", "parent_id": root["id"]})
        reopened = (await client.get(f"/api/documents/{doc_id}/layout/notes")).json()["notes"]

    assert root["for_agent"] is True and root["parent_id"] is None
    assert reply["parent_id"] == root["id"] and reply["anchor"] == {"component": "a"} and reply["for_agent"] is False
    assert reply_to_reply["parent_id"] == root["id"]
    assert [n["message"] for n in open_notes] == ["Troque por um gráfico", "Feito, veja agora", "Valeu"]
    assert after_resolve == []
    assert len(resolved) == 3
    assert len(reopened) == 4 and reopened[0]["status"] == "open"


@pytest.mark.asyncio
async def test_a_note_can_be_handed_to_the_agent_later(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"))
        note = (await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "Mais curto", "anchor": {"component": "a"}})).json()
        flagged = await client.patch(f"/api/layout-notes/{note['id']}", json={"for_agent": True})
        empty = await client.patch(f"/api/layout-notes/{note['id']}", json={})
    assert flagged.json()["for_agent"] is True and flagged.json()["status"] == "open"
    assert empty.status_code == 422


@pytest.mark.asyncio
async def test_a_reply_to_a_note_of_another_document_is_refused(client_factory):
    async with client_factory() as client:
        a = (await _create(client))["document_id"]
        b = (await _create(client))["document_id"]
        await _ops(client, a, _add("x"))
        note = (await client.post(f"/api/documents/{a}/layout/notes", json={"message": "m", "anchor": {"component": "x"}})).json()
        res = await client.post(f"/api/documents/{b}/layout/notes", json={"message": "r", "parent_id": note["id"]})
    assert res.status_code == 404


# ─── Slides ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_empty_slide_deck_has_the_slide_surface_and_type_scale(client_factory):
    async with client_factory() as client:
        created = await _create(client, title="Deck", format="slide")
        state = (await client.get(f"/api/documents/{created['document_id']}/layout")).json()
        mixed = await client.post("/api/layout-documents", json={"template": "relatorio", "format": "slide"})
    surface = state["content"]["surfaces"][0]
    assert surface["size"] == "Slide" and len(state["content"]["surfaces"]) == 1
    assert state["content"]["tokens"]["size"]["m"] == 20
    assert mixed.status_code == 422


@pytest.mark.asyncio
async def test_the_presentation_template_is_a_deck(client_factory):
    async with client_factory() as client:
        created = await _create(client, template="apresentacao")
        state = (await client.get(f"/api/documents/{created['document_id']}/layout")).json()
    content = state["content"]
    assert content["surfaces"][0]["size"] == "Slide"
    assert max(c["at"]["page"] for c in content["components"]) == 5


@pytest.mark.asyncio
async def test_applying_a_theme_is_one_write_with_every_token(client_factory, layout_service):  # noqa: F811
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        saved = (await client.post("/api/layout-themes", json={"name": "Marca", "tokens": {"color": {"primary": "#ff0055"}}})).json()
        by_key = await client.post(f"/api/documents/{doc_id}/layout/theme", json={"theme": "night"})
        by_name = await client.post(f"/api/documents/{doc_id}/layout/theme", json={"theme": "marca"})
        by_id = await client.post(f"/api/documents/{doc_id}/layout/theme", json={"theme": saved["id"]})
        missing = await client.post(f"/api/documents/{doc_id}/layout/theme", json={"theme": "nada"})
        timeline = (await client.get(f"/api/documents/{doc_id}/layout/revisions")).json()["revisions"]
    assert by_key.status_code == 200 and by_key.json()["ok"] is True
    assert by_name.json()["revision"] == 3 and by_id.json()["revision"] == 4
    assert missing.status_code == 404
    assert timeline[0]["description"] == "Tema: Marca"
    assert timeline[0]["summary"]["ops"] == {"setTokens": 1, "setMeta": 1}
    sent = [c.args for c in layout_service.call_args_list if c.args[0] == "/apply"][-1][1]["ops"]
    assert sent[0]["tokens"]["color"]["primary"] == "#ff0055"
    assert len(sent[0]["tokens"]["color"]) == 16
    assert sent[1] == {"op": "setMeta", "meta": {"theme": "Marca"}}
