"""Folders and sharing.

The property worth pinning is that the permission resolver is the *only*
thing deciding access. Before this, every endpoint asked `doc.user_id ==
current_user.id` inline — which is exactly the check that has to change once a
document can be shared.
"""

import uuid

import pytest

from app.models.user import User


async def _new_document(client, title: str = "Doc") -> str:
    res = await client.post("/api/documents", json={"title": title, "mode": "editor"})
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.mark.asyncio
async def test_folders_nest_and_count_their_documents(client_factory):
    user = User(id="u_org1", email="o1@test.com", name="O", credits=5)
    async with client_factory(user) as client:
        root = await client.post("/api/folders", json={"name": "Projetos"})
        assert root.status_code == 201
        root_id = root.json()["id"]

        child = await client.post("/api/folders", json={"name": "CopaSim", "parent_id": root_id})
        assert child.json()["parent_id"] == root_id

        doc_id = await _new_document(client)
        moved = await client.patch(
            f"/api/documents/{doc_id}/folder", json={"folder_id": child.json()["id"]}
        )
        assert moved.status_code == 204

        documents = await client.get("/api/documents")
        assert documents.status_code == 200, documents.text
        listed_doc = next(d for d in documents.json()["documents"] if d["id"] == doc_id)
        assert listed_doc["folder_id"] == child.json()["id"]

        listed = {f["name"]: f for f in (await client.get("/api/folders")).json()["folders"]}
        assert listed["CopaSim"]["document_count"] == 1
        assert listed["CopaSim"]["direct_document_count"] == 1
        assert listed["Projetos"]["document_count"] == 1
        assert listed["Projetos"]["direct_document_count"] == 0

        moved_to_root = await client.patch(f"/api/folders/{child.json()['id']}", json={"parent_id": None})
        assert moved_to_root.status_code == 200, moved_to_root.text
        assert moved_to_root.json()["parent_id"] is None


@pytest.mark.asyncio
async def test_a_folder_cannot_contain_itself(client_factory):
    user = User(id="u_org2", email="o2@test.com", name="O", credits=5)
    async with client_factory(user) as client:
        a = (await client.post("/api/folders", json={"name": "A"})).json()["id"]
        b = (await client.post("/api/folders", json={"name": "B", "parent_id": a})).json()["id"]
        res = await client.patch(f"/api/folders/{a}", json={"parent_id": b})
        assert res.status_code == 409


@pytest.mark.asyncio
async def test_deleting_a_folder_keeps_its_documents(client_factory):
    """Deleting a shelf must never delete the books."""
    user = User(id="u_org3", email="o3@test.com", name="O", credits=5)
    async with client_factory(user) as client:
        folder_id = (await client.post("/api/folders", json={"name": "Temp"})).json()["id"]
        doc_id = await _new_document(client)
        await client.patch(f"/api/documents/{doc_id}/folder", json={"folder_id": folder_id})

        assert (await client.delete(f"/api/folders/{folder_id}")).status_code == 204
        assert (await client.get(f"/api/documents/{doc_id}")).status_code == 200


@pytest.mark.asyncio
async def test_public_link_serves_only_the_published_version(client_factory):
    user = User(id="u_public", email="public@test.com", name="Public", credits=5)
    async with client_factory(user) as client:
        doc_id = await _new_document(client, "Release notes")
        detail = await client.get(f"/api/documents/{doc_id}")
        section_id = next(s["id"] for s in detail.json()["sections"] if s["section_type"] == "body")
        await client.patch(f"/api/sections/{section_id}/content", json={"content": "published text\n"})

        enabled = await client.post(f"/api/documents/{doc_id}/public-link?enabled=true")
        token = enabled.json()["token"]
        assert (await client.get(f"/api/public/{token}")).status_code == 404

        assert (await client.post(f"/api/documents/{doc_id}/publish")).status_code == 200
        public = await client.get(f"/api/public/{token}")
        assert public.status_code == 200, public.text
        assert public.json()["content"] == "published text\n"

        await client.patch(f"/api/sections/{section_id}/content", json={"content": "draft text\n"})
        public = await client.get(f"/api/public/{token}")
        assert public.json()["content"] == "published text\n"

        current_link = await client.get(f"/api/documents/{doc_id}/public-link")
        assert current_link.json() == {"token": token, "enabled": True}


@pytest.mark.asyncio
async def test_sharing_grants_access_and_role_limits_what_it_allows(client_factory):
    owner = User(id="u_own", email="owner@test.com", name="Owner", credits=5)
    guest = User(id="u_guest", email="guest@test.com", name="Guest", credits=5)

    async with client_factory(owner) as client:
        doc_id = await _new_document(client, "Compartilhado")

    # Before the invitation the document may as well not exist.
    async with client_factory(guest) as client:
        assert (await client.get(f"/api/documents/{doc_id}")).status_code == 404

    async with client_factory(owner) as client:
        shared = await client.post(
            f"/api/documents/{doc_id}/members",
            json={"email": "guest@test.com", "role": "viewer"},
        )
        assert shared.status_code == 201, shared.text
        assert shared.json()["accepted"] is True  # the account already exists

    async with client_factory(guest) as client:
        assert (await client.get(f"/api/documents/{doc_id}")).status_code == 200
        mine = await client.get("/api/shared-documents")
        assert [d["title"] for d in mine.json()["documents"]] == ["Compartilhado"]
        # A viewer cannot hand the document to anyone else.
        forbidden = await client.post(
            f"/api/documents/{doc_id}/members", json={"email": "x@test.com", "role": "editor"}
        )
        assert forbidden.status_code == 403


@pytest.mark.asyncio
async def test_invitation_waits_for_an_account_that_does_not_exist_yet(client_factory):
    owner = User(id="u_own2", email="owner2@test.com", name="Owner", credits=5)
    async with client_factory(owner) as client:
        doc_id = await _new_document(client)
        res = await client.post(
            f"/api/documents/{doc_id}/members",
            json={"email": "later@test.com", "role": "commenter"},
        )
        assert res.status_code == 201
        assert res.json()["accepted"] is False

    # The invitee signs in for the first time and picks the invitation up.
    late = User(id="u_late", email="later@test.com", name="Late", credits=5)
    async with client_factory(late) as client:
        mine = await client.get("/api/shared-documents")
        assert len(mine.json()["documents"]) == 1
        assert mine.json()["documents"][0]["role"] == "commenter"

    async with client_factory(owner) as client:
        members = (await client.get(f"/api/documents/{doc_id}/members")).json()
        assert members["members"][0]["accepted"] is True


@pytest.mark.asyncio
async def test_reshare_updates_the_role_instead_of_duplicating(client_factory):
    owner = User(id="u_own3", email="owner3@test.com", name="Owner", credits=5)
    async with client_factory(owner) as client:
        doc_id = await _new_document(client)
        await client.post(
            f"/api/documents/{doc_id}/members", json={"email": "p@test.com", "role": "viewer"}
        )
        again = await client.post(
            f"/api/documents/{doc_id}/members", json={"email": "p@test.com", "role": "editor"}
        )
        assert again.status_code == 201
        members = (await client.get(f"/api/documents/{doc_id}/members")).json()["members"]
        assert len(members) == 1
        assert members[0]["role"] == "editor"

        assert (
            await client.delete(f"/api/documents/{doc_id}/members/{members[0]['id']}")
        ).status_code == 204
        assert (await client.get(f"/api/documents/{doc_id}/members")).json()["members"] == []


@pytest.mark.asyncio
async def test_folders_are_private_to_their_owner(client_factory):
    a = User(id="u_fa", email="fa@test.com", name="A", credits=5)
    b = User(id="u_fb", email="fb@test.com", name="B", credits=5)
    async with client_factory(a) as client:
        folder_id = (await client.post("/api/folders", json={"name": "Meus"})).json()["id"]
    async with client_factory(b) as client:
        assert (await client.get("/api/folders")).json()["folders"] == []
        assert (await client.patch(f"/api/folders/{folder_id}", json={"name": "x"})).status_code == 404


@pytest.mark.asyncio
async def test_unknown_document_reads_as_not_found(client_factory):
    user = User(id="u_org9", email="o9@test.com", name="O", credits=5)
    async with client_factory(user) as client:
        res = await client.get(f"/api/documents/{uuid.uuid4()}/members")
        assert res.status_code == 404


@pytest.mark.asyncio
async def test_public_link_grants_read_without_an_account_and_revokes(client_factory):
    """The token is the capability, so turning the link off has to actually
    break links already shared."""
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    owner = User(id="u_pub", email="pub@test.com", name="P", credits=5)
    async with client_factory(owner) as client:
        doc_id = await _new_document(client, "Público")
        detail = await client.get(f"/api/documents/{doc_id}")
        section_id = next(
            s["id"] for s in detail.json()["sections"] if s["section_type"] == "body"
        )
        await client.patch(f"/api/sections/{section_id}/content", json={"content": "# Olá\n"})

        enabled = await client.post(f"/api/documents/{doc_id}/public-link?enabled=true")
        assert enabled.status_code == 200
        token = enabled.json()["token"]
        assert token
        assert (await client.post(f"/api/documents/{doc_id}/publish")).status_code == 200

    # No auth override at all — an anonymous reader.
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        res = await anon.get(f"/api/public/{token}")
        assert res.status_code == 200
        assert res.json()["title"] == "Público"
        assert "Olá" in res.json()["content"]

    async with client_factory(owner) as client:
        off = await client.post(f"/api/documents/{doc_id}/public-link?enabled=false")
        assert off.json()["enabled"] is False

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as anon:
        assert (await anon.get(f"/api/public/{token}")).status_code == 404
