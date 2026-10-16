"""Layout documents: storage, revisions and the all-or-nothing write rule.

The layout service (Node) is replaced by a fake that follows its contract, so
these tests pin what the backend owns: a write is saved only when the service
says ok, revisions detect concurrent writers, the service being down is a 503
rather than "invalid", and permissions match the rest of the API.
"""

import copy
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models import DocumentActivity, DocumentLayout
from app.models.user import User
from app.services import layout as layout_module

from .conftest import TestSession

REAL_CALL = layout_module._call


def _error(code: str, message: str) -> dict:
    return {"severity": "error", "code": code, "message": message}


def _change(component: str | None, code: str = "moved", recovery: bool = False) -> dict:
    return {
        "code": code,
        "severity": "warning" if code == "moved-page" else "info",
        **({"component": component} if component else {}),
        "message": f"{component or 'document'} {code}{' back' if recovery else ''}",
        "data": {},
        "recovery": recovery,
    }


async def fake_service(path: str, body: dict) -> dict:
    """Mimics packages/layout-service: `invalid: true` in a doc makes it invalid;
    an op named "bad" fails; "add" appends the component; "remove" drops it;
    "push"/"unpush" {component?, code?} report a side effect / its recovery."""
    if path == "/validate":
        doc = body["doc"]
        if doc.get("invalid"):
            return {"ok": False, "diagnostics": [_error("schema", "bad doc")], "map": "invalid", "pages": 0}
        return {"ok": True, "diagnostics": [], "map": f"map of {len(doc['components'])}", "pages": 1}
    if path == "/apply":
        doc = body["doc"]
        if any(op.get("op") == "bad" for op in body["ops"]):
            return {"ok": False, "doc": None, "diagnostics": [_error("invalid-op", "op 1 (bad): nope")], "changes": [], "map": "unchanged"}
        new = copy.deepcopy(doc)
        changes = []
        for op in body["ops"]:
            if op["op"] == "add":
                new["components"].append({**op["component"], "at": op["at"]})
            elif op["op"] == "remove":
                new["components"] = [c for c in new["components"] if c["id"] != op["component"]]
            elif op["op"] in ("push", "unpush"):
                changes.append(_change(op.get("component"), op.get("code", "moved"), recovery=op["op"] == "unpush"))
        extra = f" pages={body['pages']}" if "pages" in body else ""
        return {"ok": True, "doc": new, "diagnostics": [], "changes": changes, "map": f"map of {len(new['components'])}{extra}", "summary": f"summary of {len(new['components'])}"}
    if path == "/map":
        components = ",".join(body.get("components", []))
        return {"level": body["level"], "text": f"level {body['level']} {components} pages={body.get('pages')} draw={body.get('draw')}"}
    if path == "/diff":
        return {"changes": [_change(c["id"]) for c in body["after"]["components"] if c["id"] not in body["touched"]]}
    if path == "/measure":
        measurements = [{"w": w, "rows": 3} for w in body.get("widths", [])]
        return {"ok": True, "measurements": measurements, "diagnostics": [], "text": f"measured with doc={'doc' in body}"}
    if path == "/find":
        return {"matches": [], "text": f"query {body['query']}"}
    if path == "/calibrate":
        return {"ok": True, "variants": [{"index": i} for i in range(len(body["variants"]) + 1)], "text": f"calibrating {body['target']}"}
    if path == "/render-image":
        return {"page": body["page"], "pages": 1, "png": "iVBORw0KGgo=", "width": int(794 * body["scale"]), "height": int(1123 * body["scale"]), "highlight": body.get("highlight")}
    if path == "/review":
        return {"findings": [{"code": "empty-space", "components": [c["id"] for c in body["doc"]["components"]]}], "text": "review text"}
    if path == "/downgrade":
        doc = copy.deepcopy(body["doc"])
        doc["version"] = body["target"]
        return {"ok": True, "doc": doc, "from": 3, "to": body["target"], "notes": [f"converted to {body['target']}"]}
    if path == "/locate":
        return {"anchors": [{"under": [], "text": f"at {a.get('component') or a.get('rect')}"} for a in body["anchors"]]}
    raise AssertionError(path)


@pytest.fixture(autouse=True)
def layout_service():
    with patch("app.services.layout._call", side_effect=fake_service) as mock:
        yield mock


def _add(component_id: str) -> dict:
    return {
        "op": "add",
        "component": {"id": component_id, "type": "text", "content": {"paragraphs": ["x"]}},
        "at": {"page": 1, "x": 0, "y": 0, "w": 40},
    }


async def _create(client, **body) -> dict:
    res = await client.post("/api/layout-documents", json=body)
    assert res.status_code == 201, res.text
    return res.json()


@pytest.mark.asyncio
async def test_create_starts_from_an_empty_starter_document(client_factory):
    async with client_factory() as client:
        created = await _create(client, title="Quarterly")
        doc_id = created["document_id"]
        assert created["ok"] is True and created["revision"] == 1

        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()
        listed = (await client.get(f"/api/documents/{doc_id}")).json()

    assert state["revision"] == 1
    assert state["content"]["format"] == "docforge/layout"
    assert state["content"]["version"] == 3
    assert "sections" not in state["content"]
    assert state["content"]["meta"]["title"] == "Quarterly"
    assert state["content"]["components"] == []
    document = listed.get("document", listed)
    assert document["document_mode"] == "layout"
    assert document["title"] == "Quarterly"


@pytest.mark.asyncio
async def test_create_with_invalid_content_creates_nothing_and_spends_nothing(client_factory):
    user = User(id="u_invalid", email="i@test.com", name="I", credits=5)
    async with client_factory(user) as client:
        res = await client.post("/api/layout-documents", json={"content": {"invalid": True, "components": []}})
    assert res.status_code == 422
    assert res.json()["detail"]["code"] == "INVALID_LAYOUT"
    async with TestSession() as session:
        assert (await session.execute(select(DocumentLayout))).first() is None
        refreshed = await session.get(User, "u_invalid")
    assert refreshed.credits == 5


@pytest.mark.asyncio
async def test_create_spends_one_document_creation(client_factory):
    user = User(id="u_spend", email="s@test.com", name="S", credits=5)
    async with client_factory(user) as client:
        await _create(client)
    async with TestSession() as session:
        refreshed = await session.get(User, "u_spend")
    assert refreshed.credits == 4


@pytest.mark.asyncio
async def test_ops_are_saved_when_ok_and_bump_the_revision(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a"), _add("b")], "base_revision": 1})
        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()

    body = res.json()
    assert res.status_code == 200
    assert body["ok"] is True and body["revision"] == 2
    assert body["map"] == "map of 2"
    assert body["summary"] == "summary of 2"
    assert [c["id"] for c in state["content"]["components"]] == ["a", "b"]
    async with TestSession() as session:
        actions = (await session.execute(
            select(DocumentActivity.action_type, DocumentActivity.description)
            .where(DocumentActivity.document_id == uuid.UUID(doc_id))
        )).all()
    assert ("layout_updated", "2 layout operations") in actions


@pytest.mark.asyncio
async def test_failed_ops_change_nothing(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a"), {"op": "bad"}]})
        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()

    body = res.json()
    assert res.status_code == 200
    assert body["ok"] is False and body["revision"] == 1
    assert body["diagnostics"][0]["code"] == "invalid-op"
    assert state["revision"] == 1 and state["content"]["components"] == []


@pytest.mark.asyncio
async def test_stale_base_revision_is_refused(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a")]})
        res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("b")], "base_revision": 1})

    assert res.status_code == 409
    assert res.json()["detail"]["code"] == "STALE_REVISION"
    assert res.json()["detail"]["revision"] == 2


@pytest.mark.asyncio
async def test_replace_validates_before_saving(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()

        bad = await client.put(f"/api/documents/{doc_id}/layout", json={"content": {**state["content"], "invalid": True}})
        new_content = {**state["content"], "components": [{"id": "z", "type": "divider"}]}
        good = await client.put(f"/api/documents/{doc_id}/layout", json={"content": new_content, "base_revision": 1})
        after = (await client.get(f"/api/documents/{doc_id}/layout")).json()

    assert bad.json()["ok"] is False and bad.json()["revision"] == 1
    assert good.json()["ok"] is True and good.json()["revision"] == 2
    assert after["content"]["components"][0]["id"] == "z"


@pytest.mark.asyncio
async def test_map_passes_level_and_components(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        res = await client.get(f"/api/documents/{doc_id}/layout/map", params={"level": 2, "components": "a, b"})
        bad_level = await client.get(f"/api/documents/{doc_id}/layout/map", params={"level": 3})

    assert res.json() == {
        "document_id": doc_id,
        "revision": 1,
        "level": 2,
        "text": "level 2 a,b pages=None draw=None",
        "open_notices": 0,
        "open_annotations": 0,
    }
    assert bad_level.status_code == 422


@pytest.mark.asyncio
async def test_service_down_is_a_503_not_an_invalid_document(client_factory, layout_service):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        # The real client, pointed at a port nothing listens on.
        layout_service.side_effect = REAL_CALL
        with patch("app.services.layout.settings.LAYOUT_SERVICE_URL", "http://127.0.0.1:9"):
            res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a")]})
        state = (await client.get(f"/api/documents/{doc_id}/layout")).json()

    assert res.status_code == 503
    assert state["revision"] == 1


@pytest.mark.asyncio
async def test_layout_routes_refuse_other_documents_and_other_users(client_factory):
    owner = User(id="u_owner", email="o@test.com", name="O", credits=5)
    stranger = User(id="u_stranger", email="x@test.com", name="X", credits=5)
    async with client_factory(owner) as client:
        doc_id = (await _create(client))["document_id"]
        editor_doc = (await client.post("/api/documents", json={"title": "Prose"})).json()["id"]
        not_layout = await client.get(f"/api/documents/{editor_doc}/layout")
    async with client_factory(stranger) as client:
        hidden = await client.get(f"/api/documents/{doc_id}/layout")
        write = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a")]})

    assert not_layout.status_code == 400
    assert hidden.status_code == 404
    assert write.status_code == 404


@pytest.mark.asyncio
async def test_a_failed_create_refunds_the_creation_and_reports_the_real_error(client_factory):
    user = User(id="u_refund", email="r@test.com", name="R", credits=5)
    with patch("app.routers.layout.db_service.log_activity", side_effect=RuntimeError("boom")):
        async with client_factory(user) as client:
            with pytest.raises(RuntimeError, match="boom"):
                await client.post("/api/layout-documents", json={"title": "x"})
    async with TestSession() as session:
        refreshed = await session.get(User, "u_refund")
        assert (await session.execute(select(DocumentLayout))).first() is None
    assert refreshed.credits == 5


@pytest.mark.asyncio
async def test_review_reads_the_stored_document(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add("a")]})
        res = await client.get(f"/api/documents/{doc_id}/layout/review")
    body = res.json()
    assert res.status_code == 200
    assert body["revision"] == 2
    assert body["findings"][0]["components"] == ["a"]
    assert body["text"] == "review text"


@pytest.mark.asyncio
async def test_create_from_a_template_copies_it_with_the_title(client_factory):
    async with client_factory() as client:
        listed = (await client.get("/api/layout-templates")).json()["templates"]
        created = await _create(client, title="Q4", template="one-pager")
        state = (await client.get(f"/api/documents/{created['document_id']}/layout")).json()
        both = await client.post("/api/layout-documents", json={"template": "relatorio", "content": {"components": []}})
    assert [t["slug"] for t in listed] == ["relatorio", "proposta", "one-pager", "apresentacao"]
    assert listed[3]["format"] == "slide" and listed[0]["format"] == "page"
    assert state["content"]["meta"]["title"] == "Q4"
    assert len(state["content"]["components"]) == listed[2]["components"] > 0
    assert both.status_code == 422



@pytest.mark.asyncio
async def test_page_image_comes_from_the_service(client_factory, layout_service):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        res = await client.get(f"/api/documents/{doc_id}/layout/image", params={"page": 1, "scale": 0.5, "highlight": "a,b"})
        too_big = await client.get(f"/api/documents/{doc_id}/layout/image", params={"scale": 5})
    body = res.json()
    assert res.status_code == 200, res.text
    assert body["png"] == "iVBORw0KGgo=" and body["width"] == 397 and body["pages"] == 1
    sent = [c.args[1] for c in layout_service.call_args_list if c.args[0] == "/render-image"][-1]
    assert sent["highlight"] == ["a", "b"] and sent["scale"] == 0.5
    assert too_big.status_code == 422
