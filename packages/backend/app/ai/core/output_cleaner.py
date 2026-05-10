def strip_redundant_section_heading(content: str, section_type: str) -> str:
    """Remove the first heading if its text exactly matches the section type name.

    Prevents duplicates like a 'Context' section whose content opens with '## Context'.
    Only checks the first non-empty line; stops immediately if it is not a heading.
    """
    lines = content.splitlines()
    for i, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            heading_text = stripped.lstrip("#").strip()
            if heading_text.lower() == section_type.lower():
                del lines[i]
                while i < len(lines) and not lines[i].strip():
                    del lines[i]
        break
    return "\n".join(lines)


def promote_h1_headings(content: str) -> str:
    """Promote H1 headings (# Title) to H2 (## Title) outside code fences.

    Section content should never contain H1 — the section itself is the top-level heading.
    Lines inside fenced code blocks (``` ... ```) are left untouched.
    """
    lines = content.splitlines()
    result = []
    in_fence = False
    for line in lines:
        if line.strip().startswith("```"):
            in_fence = not in_fence
        if not in_fence and line.startswith("# "):
            line = "#" + line
        result.append(line)
    return "\n".join(result)


def clean_section_output(content: str | None, section_type: str) -> str:
    """Full output cleaning pipeline for generated or refined section Markdown."""
    content = strip_outer_markdown_fence(content)
    content = strip_redundant_section_heading(content, section_type)
    content = promote_h1_headings(content)
    return content


def strip_outer_markdown_fence(text: str | None) -> str:
    """Strip a single outer markdown fence wrapper, if present.

    Removes wrappers like:
    - ```markdown\\n...\\n```
    - ```md\\n...\\n```
    - ```\\n...\\n```

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
