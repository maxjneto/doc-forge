# Recipe: safe-rewrite

Use when you're about to replace most of the document with something substantially different — not for edits, which `patch_section` handles without any of this.

## Steps

1. **`get_document(document_id, full=True)`** — read the whole body (with your pending suggestion applied, if you have one). Note its length and headings.
2. **`snapshot_section(document_id, version_name="...", change_summary="...")`** — name the snapshot after the *current* state, e.g. `"Antes da reestruturação"`, and say in the summary what you're about to change and why.
3. **`write_section(document_id, content=..., note="...")`** — the new body; the `note` describes the rewrite in one sentence.

## Why this order

Snapshotting first keeps the prior version as a named, restorable checkpoint. On a document under review your rewrite is a suggestion anyway, and people's later edits are replayed on top when they accept it — but the snapshot is what lets them compare and go back.

## Failure modes to avoid

- Writing without reading the full body: you'll drop sections you never saw.
- A body much shorter than what you read, when nobody asked you to cut.
- Snapshotting with no name: the default timestamp name is useless in history.
