# Recipe: Suggestion Review Loop

Use this whenever you write to a document whose `agent_write_policy` is `suggest` (the default). Your writes are proposals; the human is the merge authority.

## Flow

1. **`get_pending_feedback(document_id)`** — read open feedback first. Each item is either a standalone comment or the reason a previous suggestion was rejected. Address every item relevant to what you're about to write.
2. **`get_document(document_id)`** — read the current content. Never compose against a stale read.
3. Compose the full new body (existing content + your changes).
4. **`write_section(document_id, content, note=...)`** — the `note` is your PR description: say *what changed and why* in one or two sentences. The response tells you the suggestion ID.
5. Tell the user (in your conversation with them) that a suggestion is awaiting their review in the browser, with the document URL (`get_document_url`).
6. On your next turn — or when the user says they reviewed it — **`check_suggestions(document_id)`**:
   - `ACCEPTED` → your content is live. Continue with the next task.
   - `REJECTED` with `reviewer said:` → that comment is authoritative. Fix the content accordingly and go back to step 2. Also `resolve_feedback` the item once addressed.
   - `PENDING` → do not pile a second suggestion for the same content on top; wait or ask the user to review.
7. After addressing any feedback item, **`resolve_feedback(feedback_id, resolution_note=...)`**.

## Rules

- One pending suggestion per section at a time. Check before writing.
- A rejected suggestion is not a failure — it's the review loop working. Read the comment, fix, resubmit.
- `is_stale` on a suggestion means the human edited the document after you proposed — re-read the document before resubmitting.
- Never ask the user to switch the document to `direct` policy to avoid review. The review is the product.
