"""The layout tools as an agent calls them, through FastMCP, with the backend client faked.

Run: pip install -e ".[dev]" && pytest
"""
import asyncio
import base64

import pytest

import docforge_mcp.server as srv

PNG = base64.b64encode(bytes([137, 80, 78, 71, 13, 10, 26, 10]) + b"fake").decode()
calls = []


async def fake_render(document_id, page, scale, highlight):
    calls.append(("render", page, scale, highlight))
    return {"page": page, "pages": 2, "revision": 7, "png": PNG, "width": 595, "height": 842}


async def fake_apply(document_id, ops, base_revision, pages, note=None):
    calls.append(("apply", note))
    return {"ok": True, "revision": 8, "diagnostics": [], "changes": [], "map": "MAP-TEXT", "summary": "you changed\n  a  added at p1 x0 y0 w20 h10"}


async def fake_request(document_id, summary, focus, questions):
    calls.append(("review", summary, focus, questions))
    return {"id": "note-1"}


async def fake_notes(document_id, status, kind, component):
    return {
        "revision": 8,
        "notes": [
            {"id": "n1", "kind": "annotation", "code": "review-request", "by_agent": True, "message": "Montei a página 1.", "data": {"questions": [{"text": "Ao lado ou abaixo?"}]}, "anchor": {}, "revision": 8, "status": "open"},
            {"id": "n2", "kind": "annotation", "code": "review-answer", "by_agent": False, "message": "Ao lado ou abaixo? → Abaixo", "anchor": {"component": "g"}, "where": "p1 g", "revision": 8, "status": "open"},
        ],
    }



@pytest.fixture(autouse=True)
def fake_backend(monkeypatch):
    monkeypatch.setattr(srv, "_use_api_key", lambda ctx: None)
    monkeypatch.setattr(srv.api, "render_layout_page", fake_render)
    monkeypatch.setattr(srv.api, "apply_layout_ops", fake_apply)
    monkeypatch.setattr(srv.api, "request_layout_review", fake_request)
    monkeypatch.setattr(srv.api, "list_layout_notes", fake_notes)


async def _scenario():
    out = await srv.mcp.call_tool("render_page", {"document_id": "d", "page": 2, "scale": 0.5, "highlight": ["k"]})
    blocks = out[0] if isinstance(out, tuple) else out
    kinds = [b.type for b in blocks]
    assert kinds == ["text", "image"], kinds
    assert blocks[1].mimeType == "image/png", blocks[1].mimeType
    assert "Page 2 of 2" in blocks[0].text and "outlined: k" in blocks[0].text, blocks[0].text
    print("render_page:", kinds, blocks[0].text)

    out = await srv.mcp.call_tool("apply_layout_ops", {"document_id": "d", "ops": [{"op": "remove", "component": "a"}], "note": "porque sim"})
    text = (out[0] if isinstance(out, tuple) else out)[0].text
    assert "you changed" in text and "MAP-TEXT" not in text, text
    assert calls[-1] == ("apply", "porque sim")
    out = await srv.mcp.call_tool("apply_layout_ops", {"document_id": "d", "ops": [{"op": "remove", "component": "a"}], "map": "full"})
    assert "MAP-TEXT" in (out[0] if isinstance(out, tuple) else out)[0].text
    print("apply_layout_ops: summary by default, map on request, note passed")

    out = await srv.mcp.call_tool("request_review", {"document_id": "d", "summary": "Pronto", "focus": ["g"], "questions": [{"text": "Ao lado?", "options": ["Sim", "Não"]}]})
    assert calls[-1][0] == "review" and calls[-1][2] == ["g"], calls[-1]
    print("request_review:", (out[0] if isinstance(out, tuple) else out)[0].text)

    out = await srv.mcp.call_tool("get_layout_notes", {"document_id": "d"})
    text = (out[0] if isinstance(out, tuple) else out)[0].text
    assert "[review request by an agent] questions: Ao lado ou abaixo?" in text and "[review answer by a person]" in text, text
    print("get_layout_notes formats requests and answers")

    try:
        await srv.mcp.call_tool("create_layout_document", {"title": "x", "template": "nope"})
        raise AssertionError("bad template accepted")
    except Exception as e:  # noqa: BLE001 — FastMCP wraps tool errors in its own type
        assert "template" in str(e), e
    print("create_layout_document rejects unknown templates")

    names = {t.name for t in await srv.mcp.list_tools()}
    for n in ["render_page", "review_layout", "request_review", "apply_layout_ops", "preview_layout", "create_layout_document"]:
        assert n in names, n
    print("tools listed:", len(names))



def test_layout_tools_end_to_end():
    asyncio.run(_scenario())


def test_every_tool_reports_its_usage(monkeypatch):
    reports = []

    async def fake_report(payload):
        reports.append(payload)

    monkeypatch.setattr(srv.api, "report_tool_call", fake_report)

    async def scenario():
        token = srv._api_key_var.set("df_test_key")
        try:
            await srv.mcp.call_tool("apply_layout_ops", {"document_id": "d", "ops": [{"op": "remove", "component": "a"}], "map": "full"})
            await srv.mcp.call_tool("render_page", {"document_id": "d", "page": 1})
            await asyncio.gather(*list(srv._pending))
        finally:
            srv._api_key_var.reset(token)

    asyncio.run(scenario())
    by_tool = {r["tool"]: r for r in reports}
    write = by_tool["apply_layout_ops"]
    assert write["ok"] is True and write["document_id"] == "d"
    assert write["detail"] == {"map": "full", "ops": 1}
    assert write["response_chars"] > len("MAP-TEXT")
    assert by_tool["render_page"]["image_bytes"] > 0
