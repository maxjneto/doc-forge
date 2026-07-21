"""Token-aware context truncation strategy.

Uses a character-based approximation (1 token ≈ 3.5 chars for mixed
prose+Markdown). This avoids a tiktoken dependency and is accurate enough
for budget decisions.

Strategy:
- Document contract: always included at full fidelity, never truncated.
- Section content: middle-truncated (head + tail preserved, cut at paragraph
  boundaries) to a per-phase char budget if over limit — the end of a document
  is where audit/coherence find contradictions, so it is never blindly dropped.
- Chat history: rolling window of last N messages; older messages are
  summarized in a single lightweight AI call (`compress_chat_history`) so
  earlier refinement decisions survive. Falls back to plain window-dropping
  if the summarization call fails.
- Budget: `enforce_context_budget` actively trims components (by priority or
  proportionally) when the phase total exceeds budget — detection is no longer
  log-only.
"""

from __future__ import annotations

from loguru import logger

# Rough char-to-token ratio for mixed prose+Markdown content
_CHARS_PER_TOKEN = 3.5

# Per-phase approximate token budgets for the user-supplied context
# (system prompt + response budget excluded — model context is typically 128k)
BUDGET = {
    "discovery":       24_000,  # tokens — per-section call with section_role context
    "alignment":       12_000,
    "generation":      24_000,
    "refinement":      20_000,
    "audit":           32_000,
    "coherence":       28_000,
    "contract":         8_000,
}

# Chat history: keep last N messages unconditionally
CHAT_HISTORY_WINDOW = 20

# Section content: max chars before truncating with ellipsis
SECTION_MAX_CHARS = {
    "discovery":    None,       # not used
    "alignment":    None,
    "generation":   40_000,     # cross-section refs in generation
    "refinement":   30_000,     # current section content
    "coherence":    60_000,     # includes all sibling sections
    "audit":        80_000,     # all 4 sections combined
}

# Never trim a component below this many tokens during budget enforcement —
# a component present in the context is presumed to carry signal.
_MIN_COMPONENT_TOKENS = 500

# Fraction of the char budget given to the head when middle-truncating
_HEAD_FRACTION = 0.6

_SUMMARY_ROLE = "system"
_SUMMARY_PREFIX = "Summary of earlier conversation (older messages compressed):"


def estimate_tokens(text: str) -> int:
    return max(1, round(len(text) / _CHARS_PER_TOKEN))


def _cut_keeping_head(text: str, budget: int) -> str:
    """Take the first `budget` chars, backing up to the last paragraph break."""
    if len(text) <= budget:
        return text
    slice_ = text[:budget]
    boundary = slice_.rfind("\n\n")
    # Only respect the boundary if it doesn't sacrifice too much of the slice
    if boundary > budget * 0.5:
        return slice_[:boundary]
    return slice_


def _cut_keeping_tail(text: str, budget: int) -> str:
    """Take the last `budget` chars, advancing to the next paragraph break."""
    if len(text) <= budget:
        return text
    slice_ = text[-budget:]
    boundary = slice_.find("\n\n")
    if 0 <= boundary < budget * 0.5:
        return slice_[boundary + 2:]
    return slice_


def truncate_middle(text: str, max_chars: int, label: str = "content") -> str:
    """Truncate preserving head and tail, cutting at paragraph boundaries.

    The middle is replaced by an explicit omission marker so the model knows
    content is missing (instead of silently ending mid-sentence).
    """
    if len(text) <= max_chars:
        return text

    marker = "\n\n… [middle of this content omitted to fit the context budget] …\n\n"
    usable = max(max_chars - len(marker), 200)
    head_budget = int(usable * _HEAD_FRACTION)
    tail_budget = usable - head_budget

    head = _cut_keeping_head(text, head_budget)
    tail = _cut_keeping_tail(text, tail_budget)

    logger.warning(
        "[truncation] {} middle-truncated | original_chars={} kept_chars={} est_tokens={} kept_tokens={}",
        label,
        len(text),
        len(head) + len(tail),
        estimate_tokens(text),
        estimate_tokens(head + tail),
    )
    return head + marker + tail


def truncate_section(content: str, phase: str, label: str = "section") -> str:
    """Truncate section content to the phase budget if needed.

    Head AND tail are preserved — audit/coherence rely on the end of the
    document, where contradictions typically hide.
    """
    limit = SECTION_MAX_CHARS.get(phase)
    if limit is None or len(content) <= limit:
        return content
    return truncate_middle(content, limit, label=f"{phase}:{label}")


def truncate_chat_history(
    messages: list[dict],
    window: int = CHAT_HISTORY_WINDOW,
) -> list[dict]:
    """Return the last `window` messages (sync, no AI call).

    A leading summary message produced by `compress_chat_history` is always
    preserved. Prefer `compress_chat_history` when an event loop is available.
    """
    if len(messages) <= window:
        return messages
    head_summary = []
    body = messages
    if messages and str(messages[0].get("content", "")).startswith(_SUMMARY_PREFIX):
        head_summary = [messages[0]]
        body = messages[1:]
    kept = body[-(window - len(head_summary)):]
    dropped = len(body) - len(kept)
    if dropped > 0:
        logger.info(
            "[truncation] chat history: dropped {} older messages, keeping last {}",
            dropped,
            len(kept),
        )
    return head_summary + kept


async def compress_chat_history(
    messages: list[dict],
    window: int = CHAT_HISTORY_WINDOW,
    posthog_distinct_id: str | None = None,
) -> list[dict]:
    """Compress chat history: summarize messages beyond the rolling window.

    Returns at most `window` messages: one synthetic summary message followed
    by the last `window - 1` original messages. Decisions made early in a long
    refinement session survive instead of being silently dropped.

    On any failure the plain window fallback (`truncate_chat_history`) is used.
    """
    if len(messages) <= window:
        return messages

    overflow = messages[: len(messages) - (window - 1)]
    recent = messages[len(messages) - (window - 1):]

    transcript_lines = []
    for msg in overflow:
        role = str(msg.get("role", "user"))
        content = str(msg.get("content", ""))
        transcript_lines.append(f"[{role}] {content}")
    transcript = "\n".join(transcript_lines)
    # A runaway transcript would defeat the point of compressing it
    transcript = truncate_middle(transcript, 24_000, label="chat_overflow")

    try:
        # Imported here to keep this module importable without client config
        from app.ai.core.client import GUARDRAIL_MODEL, client

        response = await client.chat.completions.create(
            model=GUARDRAIL_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You summarize the earlier part of a conversation between a user "
                        "and an AI assistant refining a technical document section. "
                        "Produce a compact summary (max 300 words) that preserves: "
                        "decisions made and their rationale, explicit user preferences "
                        "and constraints, rejected approaches, and unresolved questions. "
                        "Write in terse bullet points."
                    ),
                },
                {"role": "user", "content": transcript},
            ],
            temperature=0.1,
            posthog_distinct_id=posthog_distinct_id,
        )
        summary = (response.choices[0].message.content or "").strip()
        if not summary:
            raise ValueError("empty summary")
        logger.info(
            "[truncation] chat history compressed | overflow_msgs={} summary_chars={} kept_msgs={}",
            len(overflow),
            len(summary),
            len(recent),
        )
        return [
            {"role": _SUMMARY_ROLE, "content": f"{_SUMMARY_PREFIX}\n{summary}"},
            *recent,
        ]
    except Exception as e:
        logger.warning(
            "[truncation] chat summarization failed ({}), falling back to window drop", e
        )
        return truncate_chat_history(messages, window)


def enforce_context_budget(
    phase: str,
    components: dict[str, str],
    priority: list[str] | None = None,
    proportional: bool = False,
) -> dict[str, str]:
    """Trim components until the phase total fits the budget.

    - `priority`: component names from most-expendable to least; trimmed in
      order. Components not listed are never trimmed.
    - `proportional=True`: every listed component above its fair share is
      middle-truncated proportionally (used by audit, where all sections
      matter equally).

    Each trim preserves head+tail via `truncate_middle` and no component is
    reduced below `_MIN_COMPONENT_TOKENS`.
    """
    budget_tokens = BUDGET.get(phase, 20_000)
    result = dict(components)
    total = sum(estimate_tokens(v or "") for v in result.values())
    if total <= budget_tokens:
        return result

    targets = [n for n in (priority or list(result.keys())) if result.get(n)]
    if not targets:
        return result

    if proportional:
        trimmable = {n: estimate_tokens(result[n]) for n in targets}
        fixed = total - sum(trimmable.values())
        available = max(budget_tokens - fixed, _MIN_COMPONENT_TOKENS * len(targets))
        scale = available / max(sum(trimmable.values()), 1)
        if scale < 1.0:
            for name in targets:
                target_tokens = max(int(trimmable[name] * scale), _MIN_COMPONENT_TOKENS)
                target_chars = int(target_tokens * _CHARS_PER_TOKEN)
                result[name] = truncate_middle(result[name], target_chars, label=f"{phase}:{name}")
    else:
        over = total - budget_tokens
        for name in targets:
            if over <= 0:
                break
            tokens = estimate_tokens(result[name])
            if tokens <= _MIN_COMPONENT_TOKENS:
                continue
            target_tokens = max(tokens - over, _MIN_COMPONENT_TOKENS)
            target_chars = int(target_tokens * _CHARS_PER_TOKEN)
            result[name] = truncate_middle(result[name], target_chars, label=f"{phase}:{name}")
            over -= tokens - estimate_tokens(result[name])

    new_total = sum(estimate_tokens(v or "") for v in result.values())
    logger.warning(
        "[token_budget:enforce] phase={} trimmed total_est {}→{} budget={}",
        phase,
        total,
        new_total,
        budget_tokens,
    )
    return result


def build_context_report(phase: str, components: dict[str, str]) -> str:
    """Log token estimates for each context component; returns the status."""
    total = 0
    parts = []
    for name, text in components.items():
        est = estimate_tokens(text or "")
        total += est
        parts.append(f"{name}={est}")
    budget = BUDGET.get(phase, 20_000)
    status = "OK" if total <= budget else "OVER_BUDGET"
    logger.info(
        "[token_budget:context] phase={} total_est={} budget={} status={} breakdown={}",
        phase,
        total,
        budget,
        status,
        " ".join(parts),
    )
    return status
