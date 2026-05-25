# Recipe: safe-rewrite

Use when you're about to replace a section's content with something substantially different (more than a paragraph changed).

## Steps

1. **`get_document(document_id)`** — read the current body. Note its length and the last few headings.
2. **`get_activity(document_id, limit=5)`** — confirm no one else has edited recently. If the most recent entry is from another actor, decide whether to merge their change or wait.
3. **`snapshot_section(document_id, version_name="...", change_summary="...")`** — name the snapshot after the *current* (pre-rewrite) state, e.g. `"Pre-restructure draft"`. The summary should say what you're about to change and why.
4. **`write_section(document_id, content=..., note="...")`** — write the new content. The `note` is recorded in the activity log; describe the rewrite in one short sentence.
5. **`get_activity(document_id, limit=3)`** — verify your write landed and shows the actor as you.

## Why this order

Snapshotting before writing means the prior version is preserved as a named, restorable checkpoint. If you write first and snapshot after, the snapshot captures the new content — the old version is gone.

## Failure modes to avoid

- Skipping step 1: writing without reading means you might delete sections you didn't intend to.
- Skipping step 2: silently clobbering a human edit.
- Snapshotting with no name: the default timestamp name is useless for navigation later.
