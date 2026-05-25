# Recipe: collaborative-edit

Use when you're working on a document the user is actively editing in their browser, or when other agents may also be writing.

## Principles

- **Read before every write.** Even seconds-old reads can be stale.
- **Prefer additive over replacement.** Append sections, fill in gaps, expand stubs — don't restructure the whole body in one shot.
- **Echo-suppress.** When you check `get_activity`, filter out entries whose `actor_name` matches your own API key's name. Otherwise you'll react to your own writes and loop.

## Loop

Between meaningful changes:

1. **`get_activity(document_id, limit=10)`** — scan recent entries.
2. If the most recent non-self entry is newer than your last read of the body:
   - **`get_document(document_id)`** — refresh your understanding.
   - Reconcile: if their edit touches the same area you were about to edit, reconsider your plan.
3. Make your change with `write_section`. Pass a `note` that describes what you did.
4. Wait or yield. Don't spam writes — give the human time to see and respond.

## When to stop

- The human writes a sentence asking you to stop or pause (visible in activity descriptions if they snapshot with a note, or surfaced out-of-band).
- You've made N edits with no acknowledgement — back off and confirm direction before continuing.

## What never to do

- **Wholesale `write_section` without a fresh read.** This is how you lose the human's in-flight work.
- **Snapshot without naming.** A document with twenty `Snapshot YYYY-MM-DD HH:MM` rows is unnavigable.
- **Edit without a `note`.** The activity feed becomes opaque to the human if your entries have no description.
