# Recipe: collaborative-edit

Use when people are editing the document in their browser while you work, or when other agents may also be writing.

## Principles

- **Edit, don't rewrite.** `patch_section` changes only the text you name, so it can't undo a sentence someone just wrote elsewhere. A full `write_section` replaces everything — use it only for a deliberate restructure, right after `get_document(full=True)`.
- **Under review, nothing is lost.** On a document whose writes become suggestions, people's edits made after your proposal survive acceptance: your changes are replayed on top. Only a clash on the very same words is refused (`check_suggestions` shows CONFLICT).
- **Direct documents have no such net.** If the document applies writes immediately, re-read the passage (`get_section`) right before a large change.
- **Say what you did.** Every write takes a `note`; it is what people see in the activity feed and next to the diff.

## Who did what

`get_activity(document_id, limit=10)` lists recent actions with their author. Skip entries made by your own key name, or you will react to your own writes.

## When to stop

- A person asks you to stop or wait (in a comment for you, or in the conversation).
- You've made many edits with no acknowledgement — check in before continuing.
