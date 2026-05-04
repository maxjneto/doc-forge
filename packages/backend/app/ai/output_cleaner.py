def strip_outer_markdown_fence(text: str | None) -> str:
    """Strip a single outer markdown fence wrapper, if present.

    Removes wrappers like:
    - ```markdown\n...\n```
    - ```md\n...\n```
    - ```\n...\n```

    Keeps content unchanged for other fenced languages (e.g., ```mermaid).
    """
    if not text:
        return ""

    stripped = text.strip()
    if not stripped.startswith("```"):
        return text

    lines = stripped.splitlines()
    if len(lines) < 2:
        return text

    first = lines[0].strip().lower()
    last = lines[-1].strip()
    if not first.startswith("```") or last != "```":
        return text

    language = first[3:].strip()
    if language and language not in {"markdown", "md"}:
        return text

    return "\n".join(lines[1:-1]).strip("\n")