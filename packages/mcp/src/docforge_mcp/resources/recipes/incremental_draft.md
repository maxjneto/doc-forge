# Recipe: incremental-draft

Use when producing a long document from scratch or expanding a sparse outline into a full draft. The goal is to leave the user a navigable history of checkpoints instead of one giant "wrote a draft" entry.

## Steps

1. **`get_document(document_id)`** — read any existing skeleton/outline.
2. **`snapshot_section(document_id, version_name="Outline", change_summary="Starting point before drafting")`** — name the starting state.
3. For each major section of the draft:
   - Compose the new content (preserving everything written so far).
   - **`write_section(document_id, content=..., note="Drafted: <section name>")`** — write the cumulative content.
   - Optionally `snapshot_section` after a particularly substantial section, named `"<section name> drafted"`.
4. **`snapshot_section(document_id, version_name="First complete draft", change_summary="<one-line summary of what's covered>")`** — final checkpoint.
5. **`get_activity(document_id, limit=10)`** — confirm the timeline reads sensibly.

## Why incremental

If you write the entire 4000-word draft in one `write_section` call, the version history is `Outline` → `First complete draft` with no intermediate states. If something goes wrong (or the human prefers an earlier section style), they can't roll back partway. Section-by-section snapshots give them real undo points.

## Tuning

- A 500-word doc doesn't need section-by-section snapshots — outline + final is enough.
- A 5000-word doc with eight sections probably wants a snapshot every 2-3 sections.
- Always pass `change_summary` — it's what shows up in the version panel and helps the user pick which version to compare.
