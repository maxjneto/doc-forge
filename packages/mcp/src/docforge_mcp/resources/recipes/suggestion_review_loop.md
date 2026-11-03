# Recipe: Suggestion Review Loop

Use this whenever you write to a document whose `agent_write_policy` is `suggest` (the default). Your writes are proposals; people are the merge authority.

## Flow

1. **`get_pending_feedback(document_id)`** — the FOR YOU group is what people asked of you, including why they rejected an earlier suggestion. Address every item.
2. **`get_document(document_id)`** — the outline (or `full=True`). If you already have a pending suggestion, it is applied in what you read.
3. Edit with **`patch_section`** (several `edits` at once when they belong together), `append_section`, or `write_section` for a full rewrite. Pass a `note`: what changed and why, in one sentence. All your writes go into **one** suggestion — keep editing, it keeps updating.
4. **`resolve_feedback`** each FOR YOU item you handled, with a note saying the change awaits review; **`reply_feedback`** the ones that were questions.
5. Tell the person a suggestion is waiting, with **`get_document_url`**.
6. Later, **`check_suggestions(document_id)`**:
   - `ACCEPTED` → live. Your changes were replayed on whatever people wrote meanwhile.
   - `REJECTED` → the reason is in `get_pending_feedback` (FOR YOU). Fix and write again.
   - `CONFLICT` → someone rewrote the same passage after you proposed it. Re-read it and write it again; your next write updates the same suggestion.

## Rules

- A rejected suggestion is not a failure — it's the review loop working. Read the comment, fix, resubmit.
- Never ask the person to switch the document to `direct` policy to avoid review. The review is the product.
