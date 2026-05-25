# DocForge MCP — Tool Reference

All tools accept and return plain text. Document IDs are UUIDs. The server resolves body section IDs internally — you never handle section UUIDs directly.

---

## `get_user_info`

Returns the authenticated user's name, email, credit balance, and weekly allowance.

**Call before `create_document`** to confirm the user has at least 1 credit.

```
Name: Max
Email: max@example.com
Credits: 12 (weekly allowance: 20)
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

Creates a new editor document. Costs 1 credit.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `title` | string | yes | Document title |
| `context` | string | no | Short description of the document's purpose |

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

## `write_section`

Replaces the full body section content. Changes appear in the user's browser in real-time via SSE.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `document_id` | string | yes | Document UUID |
| `content` | string | yes | Full Markdown content |
| `note` | string | no | Explanation shown in the Activity panel (e.g. `"Analyzed 47 source files"`) |

To **append**: call `get_document` first, compose `existing + new_content`, then write.

```
Written 2847 characters to 'FastAPI Service Tech Spec'. The user's browser has been updated in real-time.
```

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
1. get_user_info()                          → confirm ≥1 credit
2. create_document("My Spec")               → get id + show URL to user
3. [read local files via file tools]
4. write_section(id, content, note="...")   → user sees it appear in browser
5. snapshot_section(id, "Initial draft")    → preserve checkpoint
6. get_document(id)                         → read current content before refining
7. write_section(id, refined_content)       → user sees update
8. snapshot_section(id, "Final")
```
