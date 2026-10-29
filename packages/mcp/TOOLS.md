# DocForge MCP — Tool Reference

All tools accept and return plain text. Document IDs are UUIDs. The server resolves body section IDs internally — you never handle section UUIDs directly.

---

## `get_user_info`

Returns the authenticated user's name, email, remaining document creations, and weekly allowance.

Each new document uses one weekly document creation. Editing and working in existing documents does not.

```
Name: Max
Email: max@example.com
Document creations remaining: 12 (weekly allowance: 15)
```

---

## `list_documents`

Lists all your DocForge editor documents.

```
- [FastAPI Tech Spec] id=abc123 updated=2025-05-20
- [onboarding guide] id=def456 updated=2025-05-18
```

---

## `create_document`

Creates a new Markdown document using one weekly document creation.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | yes | Document title |

Returns the document ID, title, and browser URL. **Share the URL with the user immediately** so they can open it and follow along.

```
Document created.
Title: FastAPI Service Tech Spec
ID: abc123...
URL: http://localhost:5173/document/abc123...

Share this URL with the user so they can follow along in real-time.
```

---

## `get_document`

Reads document metadata and the current body section content.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |

**Always call this before `write_section`** if you want to append rather than replace.

```
Title: FastAPI Service Tech Spec
ID: abc123...
Phase: refinement
Body section ID: xyz789...
Content (1842 chars):

# Overview
...
```

---

## `append_section`

Appends content to the end of the body without requiring the agent to resend the whole document. It follows the same suggestion/direct-write policy as `write_section`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `content` | string | yes | Markdown to append |
| `note` | string | no | Review note |

## `patch_section`

Replaces an exact text fragment scoped to a Markdown heading. Use it for a focused change instead of rewriting the whole body.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `anchor` | string | yes | Exact heading that scopes the edit |
| `old_text` | string | yes | Exact text to replace once |
| `new_text` | string | yes | Replacement text |
| `note` | string | no | Review note |

## `write_section`

Writes the full body section content. **By default the write becomes a pending suggestion** (`agent_write_policy: suggest`): the user reviews it as a diff in the browser and accepts or rejects it — the document is unchanged until acceptance. On `direct`-policy documents the write applies immediately. The response tells you which happened.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `content` | string | yes | Full Markdown content |
| `note` | string | no | Your "PR description" — shown to the reviewer next to the diff |

To **append**: call `get_document` first, compose `existing + new_content`, then write.

```
Suggestion submitted for 'FastAPI Service Tech Spec' (2847 characters).
Suggestion ID: 7c2e...

The write is PENDING human review — the document content is unchanged until
the user accepts it in their browser. Use check_suggestions to see if it was
accepted or rejected, and get_pending_feedback to read any review comments
before rewriting.
```

---

## `check_suggestions`

Lists your suggestions on a document with review status (`pending` / `accepted` / `rejected`), the note you attached, and the reviewer's comment on rejection.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `status` | string | no | Filter: `pending`, `accepted`, or `rejected` |

```
- [REJECTED] id=7c2e... created=2026-07-18 14:02
  note: Rewrote the deployment section
  reviewer said: Wrong: the timeout is 30s, see config.py
```

---

## `get_pending_feedback`

Reads open human feedback on a document: standalone comments plus rejection comments from suggestions. **Call before writing** and address the items.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |

```
Open feedback items:
- id=91af... 2026-07-18 14:02 [from a rejected suggestion]
  Wrong: the timeout is 30s, see config.py
```

---

## `resolve_feedback`

Marks a feedback item as resolved after you addressed it.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `feedback_id` | string | yes | Feedback UUID (from `get_pending_feedback`) |
| `resolution_note` | string | no | How you addressed it |

---

## `snapshot_section`

Saves a named version checkpoint. Use before and after large rewrites.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `version_name` | string | no | Short label (e.g. `"Initial draft"`) |
| `change_summary` | string | no | Longer description of what changed |

```
Snapshot saved for 'FastAPI Service Tech Spec'.
Version: Initial draft
ID: ver001...
```

---

## `list_versions`

Lists version history for the body section. Check this before a major write to see who last edited.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |

```
Versions for 'FastAPI Service Tech Spec':
- Initial draft id=ver001... [ACTIVE] created=2025-05-20T14:32
- Auto-save id=ver000...           created=2025-05-20T14:28
```

---

## `select_active_version`

Makes a specific version the active (displayed) one. The user sees the change in their browser immediately.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `version_id` | string | yes | Version UUID (from `list_versions`) |

```
Version ver001... is now active for 'FastAPI Service Tech Spec'. The user's browser has been updated.
```

---

## `get_version_content`

Reads the full content of a specific (possibly inactive) version. Use this to diff or preview before calling `select_active_version`.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `version_id` | string | yes | Version UUID (from `list_versions`) |

```
Version: Initial draft
ID: ver001...
Created: 2025-05-20T14:32
Summary: First pass, sections still rough
Content (1842 chars):

# Overview
...
```

---

## `rename_version`

Updates the name and/or change summary of an existing version. At least one of `version_name` or `change_summary` must be provided.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `version_id` | string | yes | Version UUID |
| `version_name` | string | no | New label (omit to keep current) |
| `change_summary` | string | no | New description (omit to keep current; empty string clears it) |

```
Updated version for 'FastAPI Service Tech Spec'.
Name: Initial draft (reviewed)
Summary: First pass, sections still rough
```

---

## `get_activity`

Lists recent activity (writes, snapshots, version switches) for a document. Use this to see what other actors — humans or other agents — have done.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `limit` | integer | no | Maximum entries to return (default 20, max 50) |

```
- 2025-05-20T14:32 Max: edited (+412 chars)
- 2025-05-20T14:30 Claude Code — work [agent]: snapshot "Initial draft"
- 2025-05-20T14:28 Claude Code — work [agent]: edited (+1842 chars)
```

---

## `get_document_url`

Returns the browser URL for a document.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |

```
http://localhost:5173/document/abc123...
```

---

## Quality gates and artifacts

| Tool | Purpose |
|---|---|
| `get_quality_gate` | Read gate settings, current findings, and the sections to audit. |
| `submit_quality_findings` | Record the agent's cross-section audit; high findings can block suggestion acceptance when enabled. |
| `list_artifacts` | List diagrams, tables, and decision notes attached to a document. |
| `create_artifact` | Create supporting material and return its `::artefato[key]` anchor directive. |

## Layout documents

Pages and slides made of components on a grid. The agent never sees the page: it reads a text map and gets a summary after every write. Read `docforge://guide/layout` before the first one; it has the shape of every component and operation.

### Building and changing

| Tool | Parameters | Purpose |
|---|---|---|
| `create_layout_document` | `title`, `content?`, `template?`, `format?` | New layout document (one weekly creation). Empty A4 page by default; `template` starts from a finished composition (`relatorio`, `proposta`, `one-pager`, `apresentacao`); `format: "slide"` for an empty 16:9 deck. |
| `get_layout_map` | `document_id`, `level?`, `components?`, `pages?`, `draw?` | The document as text: level 0 outline, level 1 settings and each page drawn in ASCII, level 2 everything. |
| `get_layout_document` | `document_id` | Raw JSON and revision, for when exact content is needed. |
| `apply_layout_ops` | `document_id`, `ops`, `base_revision?`, `pages?`, `map?`, `note?` | Apply operations atomically. Refused only for a malformed op, an unknown id or an invalid result; layout side effects come back in the summary. |
| `preview_layout` | `document_id`, `ops?`, `content?`, `pages?`, `map?` | What ops (or a whole draft) would produce. Saves nothing. |
| `measure_component` | `component`, `widths?`, `cols?`, `document_id?` | How tall a component would be at given widths, before placing it. |
| `calibrate_style` | `document_id`, `variants`, `component?` \| `label?` \| `selector?` | Compare up to 12 style variants on the document before choosing one. |
| `render_page` | `document_id`, `page?`, `scale?`, `highlight?` | A page as PNG, for agents that can see images. |
| `review_layout` | `document_id` | What a reader would notice (boxes taller than their content, uneven rows, edges off the guides, a near-empty last page), each with the ops that fix it. |
| `find_layout` | `document_id`, `text?`, `type?`, `label?`, `page?`, `rect?`, `state?` | Find components by content, type, class, page, area or state (moved, split, warning…). |

### Working with the person

| Tool | Parameters | Purpose |
|---|---|---|
| `get_layout_notes` | `document_id`, `status?`, `kind?`, `component?` | Notices (what the layout did on its own) and annotations people pinned, including requests addressed to the agent. |
| `request_review` | `document_id`, `summary`, `focus?`, `questions?` | Hand the document to the person: what was done, what to look at, up to 5 questions with options. |
| `reply_layout_note` | `document_id`, `note_id`, `message` | Answer in a note's thread. |
| `resolve_layout_note` | `note_id`, `status?`, `note?` | Close, acknowledge or reopen a note. |
| `save_layout_version` | `document_id`, `name`, `note?` | Name the current revision ("Sent to the client"). |
| `list_layout_versions` | `document_id`, `all_edits?`, `limit?` | Saved versions, or every write with its author. |
| `restore_layout_version` | `document_id`, `revision` | Bring back a revision as a new write on top. |

### Themes

| Tool | Parameters | Purpose |
|---|---|---|
| `list_layout_themes` | — | Built-in themes and the ones the person saved. |
| `apply_layout_theme` | `document_id`, `theme` | Colors, fonts and radii in one write. |
| `save_layout_theme` | `name`, `tokens?` \| `from_document?`, `description?` | Save a reusable theme. |

## Resources

Resources are read-only URIs the agent can read without a tool call.

### Data

| URI | Content |
|---|---|
| `docforge://documents` | JSON list of all your documents |
| `docforge://document/{id}` | Current body content as Markdown (front-matter header + body) |
| `docforge://document/{id}/versions` | JSON version history for the body section |

### Guide

| URI | Content |
|---|---|
| `docforge://guide/system-prompt` | Agent orientation brief — mental model, core loop, when to snapshot, full tool inventory. Agents are expected to read this first. |

### Recipes

Composable mini-playbooks for common workflows.

| URI | Content |
|---|---|
| `docforge://recipes` | JSON index of available recipe slugs |
| `docforge://recipes/safe-rewrite` | Snapshot → write → verify pattern for replacing a section |
| `docforge://recipes/collaborative-edit` | How to work alongside a human editing the same document |
| `docforge://recipes/incremental-draft` | Snapshotting strategy for long drafts written section by section |

---

## Recommended workflow

```
1. `get_user_info()`                         → confirm remaining weekly document creations
2. `create_document("My Spec")`              → get id + show URL to user
3. `get_pending_feedback(id)` and `get_document(id)` → read before editing
4. Read local files with the agent's own tools
5. Use `patch_section` / `append_section` for focused changes; use `write_section` for a deliberate full replacement
6. `check_suggestions(id)`                    → verify review status
7. `snapshot_section(id, "Initial draft")`   → preserve a named checkpoint
```
