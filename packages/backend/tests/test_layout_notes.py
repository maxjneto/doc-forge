"""Layout documents v2: side effects as notices, previews, measure/find, notes, revisions.

Uses the same fake layout service as test_layout.py (its `layout_service`
fixture is autouse there; it is imported here so it applies to this module too).
"""

import copy
from unittest.mock import patch

import pytest

from app.models.user import User

from .test_layout import REAL_CALL, _add, _create, layout_service  # noqa: F401  (fixture)


async def _notes(client, doc_id: str, **params) -> list[dict]:
    res = await client.get(f"/api/documents/{doc_id}/layout/notes", params=params)
    assert res.status_code == 200, res.text
    return res.json()["notes"]


async def _ops(client, doc_id: str, *ops: dict) -> dict:
    res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": list(ops)})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.mark.asyncio
async def test_side_effects_are_accepted_returned_and_stored_as_notices(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"), _add("b"))
        body = await _ops(client, doc_id, {"op": "push", "component": "b", "code": "moved-page"})
        notes = await _notes(client, doc_id)
        mapped = (await client.get(f"/api/documents/{doc_id}/layout/map")).json()

    assert body["ok"] is True and body["revision"] == 3
    assert body["changes"][0]["code"] == "moved-page"
    assert len(notes) == 1
    assert notes[0]["kind"] == "notice" and notes[0]["code"] == "moved-page" and notes[0]["severity"] == "warning"
    assert notes[0]["anchor"] == {"component": "b"} and notes[0]["revision"] == 3
    assert notes[0]["where"] == "at b"
    assert mapped["open_notices"] == 1


@pytest.mark.asyncio
async def test_a_newer_change_supersedes_a_notice_and_a_recovery_resolves_it(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"), _add("b"))
        await _ops(client, doc_id, {"op": "push", "component": "b"}, {"op": "push", "code": "page-count"})
        await _ops(client, doc_id, {"op": "push", "component": "b"})
        superseded = await _notes(client, doc_id, status="all")
        await _ops(client, doc_id, {"op": "unpush", "component": "b"}, {"op": "unpush", "code": "page-count"})
        after = await _notes(client, doc_id, status="all")
        still_open = await _notes(client, doc_id)

    about_b = [n for n in superseded if n["anchor"].get("component") == "b"]
    assert [n["status"] for n in about_b] == ["resolved", "open"]
    assert about_b[0]["resolution_note"] == "Superseded by revision 4."
    assert still_open == []
    # A recovery is not stored as a new notice; it explains why the old one closed.
    assert len(after) == 3
    assert all(n["status"] == "resolved" for n in after)
    assert any(n["resolution_note"] == "Revision 5: b moved back" for n in after)


@pytest.mark.asyncio
async def test_notices_about_removed_components_are_resolved(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"), _add("b"))
        await _ops(client, doc_id, {"op": "push", "component": "b"})
        await _ops(client, doc_id, {"op": "remove", "component": "b"})
        notes = await _notes(client, doc_id, status="all")

    assert notes[0]["status"] == "resolved"
    assert "no longer in the document" in notes[0]["resolution_note"]


@pytest.mark.asyncio
async def test_replace_reports_side_effects_on_the_components_it_did_not_change(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"), _add("b"))
        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()
        content = copy.deepcopy(state["content"])
        content["components"][0]["content"] = {"paragraphs": ["changed"]}
        res = await client.put(f"/api/documents/{doc_id}/layout", json={"content": content})

    assert res.json()["ok"] is True
    assert [c["component"] for c in res.json()["changes"]] == ["b"]


@pytest.mark.asyncio
async def test_preview_never_saves(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        stored = await client.post(f"/api/documents/{doc_id}/layout/preview", json={"ops": [_add("a")], "pages": [1]})
        stale = await client.post(f"/api/documents/{doc_id}/layout/preview", json={"ops": [_add("a")], "base_revision": 7})
        inline = await client.post("/api/layout/preview", json={"content": {"components": []}, "ops": [_add("z")]})
        whole = await client.post("/api/layout/preview", json={"content": {"components": [{"id": "q"}]}})
        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()

    assert stored.json()["ok"] is True and stored.json()["base_revision"] == 1
    assert stored.json()["map"] == "map of 1 pages=[1]"
    assert stale.status_code == 409
    assert inline.json()["content"]["components"][0]["id"] == "z"
    assert whole.json()["map"] == "map of 1"
    assert state["revision"] == 1 and state["content"]["components"] == []


@pytest.mark.asyncio
async def test_measure_uses_a_stored_document_when_asked(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        component = {"id": "x", "type": "text", "content": {"paragraphs": ["x"]}}
        alone = await client.post("/api/layout/measure", json={"component": component, "widths": [20, 40]})
        styled = await client.post("/api/layout/measure", json={"component": component, "document_id": doc_id})
        bad_id = await client.post("/api/layout/measure", json={"component": component, "document_id": "nope"})

    assert alone.json()["text"] == "measured with doc=False"
    assert [m["w"] for m in alone.json()["measurements"]] == [20, 40]
    assert styled.json()["text"] == "measured with doc=True"
    assert bad_id.status_code == 422


@pytest.mark.asyncio
async def test_find_builds_the_query_from_parameters(client_factory, layout_service):  # noqa: F811
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        url = f"/api/documents/{doc_id}/layout/find"
        ok = await client.get(url, params={"text": "receita", "type": "kpi,text", "page": 2, "rect": "1,0,0,10,20", "state": "moved"})
        any_page = await client.get(url, params={"rect": "0,5,5,2,2"})
        bad_rect = await client.get(url, params={"rect": "1,2,3"})
        bad_state = await client.get(url, params={"state": "weird"})

    sent = [call.args[1]["query"] for call in layout_service.call_args_list if call.args[0] == "/find"]
    assert ok.status_code == 200 and any_page.status_code == 200
    assert sent[0] == {
        "text": "receita",
        "type": ["kpi", "text"],
        "page": 2,
        "rect": {"x": 0, "y": 0, "w": 10, "h": 20, "page": 1},
        "state": "moved",
    }
    assert sent[1] == {"rect": {"x": 5, "y": 5, "w": 2, "h": 2}}
    assert bad_rect.status_code == 422 and bad_state.status_code == 422


@pytest.mark.asyncio
async def test_annotations_are_anchored_listed_with_positions_and_resolved(client_factory):
    owner = User(id="u_notes", email="n@test.com", name="N", credits=5)
    stranger = User(id="u_notes_x", email="nx@test.com", name="NX", credits=5)
    async with client_factory(owner) as client:
        doc_id = (await _create(client))["document_id"]
        created = await client.post(
            f"/api/documents/{doc_id}/layout/notes",
            json={"message": "Trocar a cor", "anchor": {"rect": {"page": 1, "x": 0, "y": 20, "w": 40, "h": 10}}},
        )
        no_target = await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "x", "anchor": {}})
        listed = await _notes(client, doc_id, kind="annotation")
        note_id = created.json()["id"]
        resolved = await client.patch(f"/api/layout-notes/{note_id}", json={"status": "resolved", "resolution_note": "feito"})
        open_after = await _notes(client, doc_id)
        mapped = (await client.get(f"/api/documents/{doc_id}/layout/map")).json()
    async with client_factory(stranger) as client:
        hidden = await client.patch(f"/api/layout-notes/{note_id}", json={"status": "open"})

    assert created.status_code == 201
    assert created.json()["kind"] == "annotation" and created.json()["author_user_id"] == "u_notes"
    assert created.json()["anchor"] == {"rect": {"page": 1, "x": 0, "y": 20, "w": 40, "h": 10}}
    assert no_target.status_code == 422
    assert listed[0]["where"].startswith("at {")
    assert resolved.json()["status"] == "resolved" and resolved.json()["resolved_at"] is not None
    assert open_after == []
    assert mapped["open_annotations"] == 0
    assert hidden.status_code == 404


@pytest.mark.asyncio
async def test_notes_stay_readable_when_the_layout_service_is_down(client_factory, layout_service):  # noqa: F811
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "x", "anchor": {"component": "a"}})
        layout_service.side_effect = REAL_CALL
        with patch("app.services.layout.settings.LAYOUT_SERVICE_URL", "http://127.0.0.1:9"):
            notes = await _notes(client, doc_id)

    assert notes[0]["message"] == "x" and notes[0]["where"] is None


@pytest.mark.asyncio
async def test_every_write_is_kept_as_a_revision(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _ops(client, doc_id, _add("a"))
        await _ops(client, doc_id, _add("b"), _add("c"))
        listed = (await client.get(f"/api/documents/{doc_id}/layout/revisions")).json()
        second = (await client.get(f"/api/documents/{doc_id}/layout/revisions/2")).json()
        missing = await client.get(f"/api/documents/{doc_id}/layout/revisions/9")

    assert [r["revision"] for r in listed["revisions"]] == [3, 2, 1]
    assert [r["ops_count"] for r in listed["revisions"]] == [2, 1, None]
    assert listed["revisions"][-1]["description"] == "Created"
    assert [c["id"] for c in second["content"]["components"]] == ["a"]
    assert second["ops"][0]["op"] == "add"
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_calibrate_passes_one_target_and_saves_nothing(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        url = f"/api/documents/{doc_id}/layout/calibrate"
        ok = await client.post(url, json={"label": "nota", "variants": [{"fontSize": 20}, {"fontSize": 24}]})
        two_targets = await client.post(url, json={"label": "a", "component": "b", "variants": [{}]})
        no_variants = await client.post(url, json={"component": "b", "variants": []})
        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()

    assert ok.status_code == 200
    assert ok.json()["text"] == "calibrating {'label': 'nota'}"
    assert len(ok.json()["variants"]) == 3
    assert two_targets.status_code == 422 and no_variants.status_code == 422
    assert state["revision"] == 1


@pytest.mark.asyncio
async def test_a_write_note_becomes_the_revision_description(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a")], "note": "juntei os dois parágrafos"})
        assert res.status_code == 200, res.text
        revisions = (await client.get(f"/api/documents/{doc_id}/layout/revisions")).json()["revisions"]
    assert revisions[0]["description"] == "juntei os dois parágrafos"


@pytest.mark.asyncio
async def test_review_requests_and_answers_are_annotations_with_data(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        request = await client.post(
            f"/api/documents/{doc_id}/layout/notes",
            json={
                "message": "Montei a página 1.",
                "code": "review-request",
                "review": {"focus": ["a"], "questions": [{"text": "Gráfico ao lado ou abaixo?", "options": ["Ao lado", "Abaixo"]}]},
            },
        )
        assert request.status_code == 201, request.text
        answer = await client.post(
            f"/api/documents/{doc_id}/layout/notes",
            json={"message": "Gráfico ao lado ou abaixo? → Abaixo", "code": "review-answer", "answers": {"0": "Abaixo"}, "request_id": request.json()["id"]},
        )
        assert answer.status_code == 201, answer.text
        plain = await client.post(f"/api/documents/{doc_id}/layout/notes", json={"message": "sem âncora"})
        notes = await _notes(client, doc_id, kind="annotation")

    assert plain.status_code == 422
    by_code = {n["code"]: n for n in notes}
    assert by_code["review-request"]["data"]["questions"][0]["options"] == ["Ao lado", "Abaixo"]
    assert by_code["review-request"]["anchor"] == {}
    assert by_code["review-answer"]["data"] == {"answers": {"0": "Abaixo"}, "request_id": request.json()["id"]}
