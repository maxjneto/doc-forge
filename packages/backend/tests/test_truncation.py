"""Tests for context truncation, chat summarization, and budget enforcement."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.ai.core.truncation import (
    _CHARS_PER_TOKEN,
    BUDGET,
    build_context_report,
    compress_chat_history,
    enforce_context_budget,
    estimate_tokens,
    truncate_chat_history,
    truncate_middle,
    truncate_section,
)

# ─── truncate_middle / truncate_section ──────────────────────


def _make_document(paragraphs: int = 400) -> str:
    return "\n\n".join(
        f"Paragraph {i}: some meaningful prose content about the system design."
        for i in range(paragraphs)
    )


def test_truncate_middle_preserves_head_and_tail():
    doc = _make_document()
    out = truncate_middle(doc, 5_000)
    assert len(out) <= 5_100  # marker allowance
    assert out.startswith("Paragraph 0:")
    assert "Paragraph 399" in out  # tail survived
    assert "omitted to fit the context budget" in out


def test_truncate_middle_noop_under_limit():
    doc = "short content"
    assert truncate_middle(doc, 5_000) == doc


def test_truncate_section_keeps_document_tail():
    doc = _make_document(3_000)  # ~190k chars, over the 80k audit limit
    out = truncate_section(doc, "audit", "risks")
    assert len(out) < len(doc)
    assert "Paragraph 2999" in out


def test_truncate_section_phase_without_limit_is_noop():
    doc = _make_document(3_000)
    assert truncate_section(doc, "alignment") == doc


# ─── chat history ────────────────────────────────────────────


def _make_history(n: int) -> list[dict]:
    return [
        {"role": "user" if i % 2 == 0 else "agent", "content": f"message {i}"}
        for i in range(n)
    ]


def test_truncate_chat_history_window():
    out = truncate_chat_history(_make_history(30), window=20)
    assert len(out) == 20
    assert out[-1]["content"] == "message 29"


def test_truncate_chat_history_preserves_summary_message():
    history = [
        {"role": "system", "content": "Summary of earlier conversation (older messages compressed):\n- x"},
        *_make_history(30),
    ]
    out = truncate_chat_history(history, window=20)
    assert len(out) == 20
    assert out[0]["content"].startswith("Summary of earlier conversation")
    assert out[-1]["content"] == "message 29"


@pytest.mark.asyncio
async def test_compress_chat_history_summarizes_overflow():
    history = _make_history(30)

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "- decided to use Redis\n- user wants 30s timeout"

    with patch("app.ai.core.client.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
        out = await compress_chat_history(history, window=20)

    assert len(out) == 20  # 1 summary + last 19
    assert out[0]["role"] == "system"
    assert "decided to use Redis" in out[0]["content"]
    assert out[-1]["content"] == "message 29"
    # The summarized transcript included the dropped messages
    call_messages = mock_client.chat.completions.create.call_args.kwargs["messages"]
    assert "message 0" in call_messages[1]["content"]


@pytest.mark.asyncio
async def test_compress_chat_history_noop_within_window():
    history = _make_history(10)
    out = await compress_chat_history(history, window=20)
    assert out == history


@pytest.mark.asyncio
async def test_compress_chat_history_falls_back_on_failure():
    history = _make_history(30)
    with patch("app.ai.core.client.client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(side_effect=RuntimeError("api down"))
        out = await compress_chat_history(history, window=20)
    # Plain window fallback: last 20 messages, no summary
    assert len(out) == 20
    assert out[0]["content"] == "message 10"


# ─── budget enforcement ──────────────────────────────────────


def test_enforce_budget_noop_when_under():
    components = {"a": "short", "b": "also short"}
    assert enforce_context_budget("refinement", components, priority=["a", "b"]) == components


def test_enforce_budget_trims_priority_order():
    components = {
        "cross_section": _make_document(1_500),                     # ~30k tokens, expendable
        "current_content": "the section being refined right now",   # protected
    }
    out = enforce_context_budget(
        "refinement", components, priority=["cross_section", "current_content"]
    )
    assert len(out["cross_section"]) < len(components["cross_section"])
    assert out["current_content"] == components["current_content"]
    total = sum(estimate_tokens(v) for v in out.values())
    assert total <= BUDGET["refinement"] * 1.05  # small tolerance for markers


def test_enforce_budget_proportional_trims_all_large_components():
    big = _make_document(1_200)  # each ~78k chars ≈ 22k tokens
    components = {"context": big, "proposal": big, "implementation": big, "risks": big}
    out = enforce_context_budget("audit", components, proportional=True)
    for key in components:
        assert len(out[key]) < len(big)
        assert "Paragraph 1199" in out[key]  # tail preserved in every section
    total = sum(estimate_tokens(v) for v in out.values())
    assert total <= BUDGET["audit"] * 1.1


def test_build_context_report_returns_status():
    assert build_context_report("refinement", {"a": "tiny"}) == "OK"
    over = "x" * int(BUDGET["refinement"] * _CHARS_PER_TOKEN * 2)
    assert build_context_report("refinement", {"a": over}) == "OVER_BUDGET"
