"""Token-aware context truncation strategy.

Uses a character-based approximation (1 token ≈ 4 chars for English prose,
3 chars for code/Markdown with dense symbols). This avoids a tiktoken
dependency and is accurate enough for budget decisions.

Strategy:
- Document contract: always included at full fidelity, never truncated.
- Section content: truncated to a per-phase char budget if over limit.
- Chat history: rolling window of last N messages; older messages are
  summarized in a single lightweight AI call when over the rolling limit.
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


def estimate_tokens(text: str) -> int:
    return max(1, round(len(text) / _CHARS_PER_TOKEN))


def truncate_section(content: str, phase: str, label: str = "section") -> str:
    """Truncate section content to the phase budget if needed."""
    limit = SECTION_MAX_CHARS.get(phase)
    if limit is None or len(content) <= limit:
        return content

    truncated = content[:limit]
    tokens_est = estimate_tokens(content)
    tokens_kept = estimate_tokens(truncated)
    logger.warning(
        "[truncation] {} truncated | phase={} original_chars={} kept_chars={} est_tokens={} kept_tokens={}",
        label,
        phase,
        len(content),
        len(truncated),
        tokens_est,
        tokens_kept,
    )
    return truncated + "\n\n… [content truncated for context budget]"


def truncate_chat_history(
    messages: list[dict],
    window: int = CHAT_HISTORY_WINDOW,
) -> list[dict]:
    """Return the last `window` messages. Older history is dropped."""
    if len(messages) <= window:
        return messages
    dropped = len(messages) - window
    logger.info("[truncation] chat history: dropped {} older messages, keeping last {}", dropped, window)
    return messages[-window:]


def build_context_report(phase: str, components: dict[str, str]) -> None:
    """Log token estimates for each context component at build time."""
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
