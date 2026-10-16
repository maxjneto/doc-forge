"""Layout documents outside DocForge: publishing, the public read for
@docforge-lib/layout, reading a pinned revision by id, and format conversion.

Uses the fake layout service from test_layout.py (imported so its autouse
fixture applies here too).
"""

import pytest

from app.models.user import User
from app.routers import layout as layout_router

from .test_layout import _add, _create, layout_service  # noqa: F401  (fixture)


@pytest.fixture(autouse=True)
def reset_public_limit():
    layout_router._public_reads.clear()
    yield
    layout_router._public_reads.clear()


async def _write(client, doc_id: str, component: str) -> None:
    res = await client.post(f"/api/documents/{doc_id}/layout/ops", json={"ops": [_add(component)]})
    assert res.status_code == 200 and res.json()["ok"], res.text


def _ids(content: dict) -> list[str]:
    return [c["id"] for c in content["components"]]


@pytest.mark.asyncio
async def test_public_link_serves_only_what_was_published(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client, title="Anúncio"))["document_id"]
        await _write(client, doc_id, "a")

        before = (await client.get(f"/api/documents/{doc_id}/layout/publish")).json()
        published = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()
        token = published["token"]
        await _write(client, doc_id, "b")  # an edit after publishing stays private

        public = await client.get(f"/api/public/{token}/layout")
        state = (await client.get(f"/api/documents/{doc_id}/layout/publish")).json()

    assert before["published"] is False and before["token"] is None
    assert published["published"] is True and published["revision"] == 2
    assert public.status_code == 200, public.text
    body = public.json()
    assert body["title"] == "Anúncio" and body["revision"] == 2
    assert _ids(body["content"]) == ["a"]
    assert body["notes"] == []
    assert public.headers["access-control-allow-origin"] == "*"
    assert public.headers["etag"]
    assert state["revision"] == 2 and state["current_revision"] == 3


@pytest.mark.asyncio
async def test_publishing_again_keeps_the_link_and_updates_what_it_serves(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        first = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()
        await _write(client, doc_id, "a")
        second = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()
        public = (await client.get(f"/api/public/{first['token']}/layout")).json()

    assert second["token"] == first["token"]
    assert second["revision"] == 2
    assert _ids(public["content"]) == ["a"]


@pytest.mark.asyncio
async def test_a_past_revision_can_be_published(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        await _write(client, doc_id, "a")
        await _write(client, doc_id, "b")
        published = (await client.post(f"/api/documents/{doc_id}/layout/publish", json={"revision": 2})).json()
        public = (await client.get(f"/api/public/{published['token']}/layout")).json()
        missing = await client.post(f"/api/documents/{doc_id}/layout/publish", json={"revision": 99})

    assert published["revision"] == 2
    assert _ids(public["content"]) == ["a"]
    assert missing.status_code == 404


@pytest.mark.asyncio
async def test_unpublishing_revokes_the_link(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        token = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()["token"]
        state = (await client.delete(f"/api/documents/{doc_id}/layout/publish")).json()
        gone = await client.get(f"/api/public/{token}/layout")
        again = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()

    assert state["published"] is False and state["token"] is None
    assert gone.status_code == 404
    assert gone.headers["access-control-allow-origin"] == "*"
    assert again["token"] != token


@pytest.mark.asyncio
async def test_unknown_tokens_and_unpublished_documents_are_404(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        # The Markdown "public link" switch alone does not publish a layout document.
        token = (await client.post(f"/api/documents/{doc_id}/public-link?enabled=true")).json()["token"]
        assert (await client.get(f"/api/public/{token}/layout")).status_code == 404
        assert (await client.get(f"/api/public/{token}")).status_code == 404
        assert (await client.get("/api/public/nope/layout")).status_code == 404


@pytest.mark.asyncio
async def test_the_reader_page_gets_the_published_layout(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client, title="Deck"))["document_id"]
        token = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()["token"]
        page = (await client.get(f"/api/public/{token}")).json()

    assert page["mode"] == "layout"
    assert page["title"] == "Deck"
    assert page["content"]["format"] == "docforge/layout"
    assert page["revision"] == 1


@pytest.mark.asyncio
async def test_an_older_library_gets_its_format_and_what_was_lost(client_factory, layout_service):  # noqa: F811
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        token = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()["token"]
        current = (await client.get(f"/api/public/{token}/layout?format=3")).json()
        newer = (await client.get(f"/api/public/{token}/layout?format=7")).json()
        older = (await client.get(f"/api/public/{token}/layout?format=2")).json()
        too_old = await client.get(f"/api/public/{token}/layout?format=1")

    assert current["content"]["version"] == 3 and current["notes"] == []
    assert newer["content"]["version"] == 3
    assert older["content"]["version"] == 2
    assert older["notes"] == ["converted to 2"]
    assert too_old.status_code == 422
    downgrades = [c for c in layout_service.call_args_list if c.args[0] == "/downgrade"]
    assert len(downgrades) == 1


@pytest.mark.asyncio
async def test_etag_answers_304_until_the_next_publish(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        token = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()["token"]
        first = await client.get(f"/api/public/{token}/layout")
        etag = first.headers["etag"]
        same = await client.get(f"/api/public/{token}/layout", headers={"If-None-Match": etag})
        other_format = await client.get(f"/api/public/{token}/layout?format=2", headers={"If-None-Match": etag})
        await _write(client, doc_id, "a")
        await client.post(f"/api/documents/{doc_id}/layout/publish")
        after = await client.get(f"/api/public/{token}/layout", headers={"If-None-Match": etag})

    assert same.status_code == 304
    assert other_format.status_code == 200
    assert after.status_code == 200


@pytest.mark.asyncio
async def test_public_reads_are_limited_per_address(client_factory, monkeypatch):
    monkeypatch.setattr(layout_router, "PUBLIC_READS_PER_MINUTE", 3)
    async with client_factory() as client:
        doc_id = (await _create(client))["document_id"]
        token = (await client.post(f"/api/documents/{doc_id}/layout/publish")).json()["token"]
        codes = [(await client.get(f"/api/public/{token}/layout")).status_code for _ in range(4)]
        other = await client.get(f"/api/public/{token}/layout", headers={"X-Forwarded-For": "203.0.113.9"})

    assert codes == [200, 200, 200, 429]
    assert other.status_code == 200


@pytest.mark.asyncio
async def test_only_managers_publish(client_factory):
    owner = User(id="u_pub_owner", email="o@test.com", name="O", credits=5)
    stranger = User(id="u_pub_stranger", email="s@test.com", name="S", credits=5)
    async with client_factory(owner) as client:
        doc_id = (await _create(client))["document_id"]
    async with client_factory(stranger) as client:
        assert (await client.post(f"/api/documents/{doc_id}/layout/publish")).status_code in (403, 404)
        assert (await client.get(f"/api/documents/{doc_id}/layout/publish")).status_code in (403, 404)


@pytest.mark.asyncio
async def test_by_id_a_pinned_revision_or_the_current_one(client_factory):
    async with client_factory() as client:
        doc_id = (await _create(client, title="Por id"))["document_id"]
        await _write(client, doc_id, "a")
        await _write(client, doc_id, "b")
        pinned = (await client.get(f"/api/documents/{doc_id}/layout?revision=2&format=3")).json()
        current = (await client.get(f"/api/documents/{doc_id}/layout")).json()
        older = (await client.get(f"/api/documents/{doc_id}/layout?revision=2&format=2")).json()
        missing = await client.get(f"/api/documents/{doc_id}/layout?revision=42")

    assert pinned["revision"] == 2 and _ids(pinned["content"]) == ["a"]
    assert pinned["title"] == "Por id"
    assert current["revision"] == 3 and _ids(current["content"]) == ["a", "b"]
    assert older["content"]["version"] == 2 and older["notes"] == ["converted to 2"]
    assert missing.status_code == 404
