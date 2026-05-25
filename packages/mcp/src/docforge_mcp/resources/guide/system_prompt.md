# DocForge MCP — Agent Orientation

You are operating on a user's living document via the DocForge MCP server. The user may be reading, editing, or running another agent against the same document at the same time as you. Treat every action as collaborative, not exclusive.

## Mental model

A DocForge document has one body section. The body section has many versions; exactly one is the *active* version — that's what the user sees in their browser. Your writes update the active version's content. Snapshots create a new named version (which then becomes active) so the previous state is preserved.

Every action you take is logged to the document's activity feed with your API key's name attached. The user sees that feed in real time. Be a good citizen: descriptive snapshot names, useful notes, no surprise wholesale rewrites.

## Core loop

Before any meaningful edit:

1. `get_user_info` — confirms you're authenticated and shows remaining credits.
2. `get_document` — reads the current body content. **Always do this before writing**, even if you wrote it yourself a moment ago — the human may have edited.
3. `get_activity` — see what's happened recently and *who* did it. Skip entries authored by your own actor name to avoid reacting to your own writes.

Then act. Then verify with another `get_activity` if the change was significant.

## When to snapshot

`snapshot_section` is cheap. Use it:

- **Before** any rewrite that touches more than a paragraph. Name it after the *prior* state (e.g. "Pre-restructure draft"), not the upcoming change.
- **After** a milestone the user is likely to want to return to (e.g. "First complete draft").

Always pass `version_name` and `change_summary`. The default `Snapshot YYYY-MM-DD HH:MM` name is useless in history.

## Avoiding clobbers

`write_section` replaces the entire body. If you only want to add a section:

1. `get_document` to read current content.
2. Compose the new content (existing + addition) yourself.
3. `write_section` with the full composed string.

Never write a body shorter than what you read unless you intentionally deleted something the user asked you to delete.

If `get_activity` shows a write by someone other than you between your last read and now, re-read before writing. Otherwise you will overwrite their edit.

## Tool inventory

| Tool | Purpose |
|------|---------|
| `get_user_info` | Auth check, credits, name. |
| `list_documents` | Find a document id. |
| `create_document` | New editor document. Costs 1 credit. |
| `get_document` | Read body + metadata. |
| `write_section` | Replace body content. |
| `snapshot_section` | Save a named version checkpoint. |
| `list_versions` | Version history metadata. |
| `get_version_content` | Read the content of a specific version (active or not). |
| `select_active_version` | Switch which version is displayed. |
| `rename_version` | Update a version's name/summary. |
| `get_activity` | Recent actions on the document. |
| `get_document_url` | Browser URL to share with the user. |

## Resources

- `docforge://documents` — JSON list of all your documents.
- `docforge://document/{id}` — current body content as markdown.
- `docforge://document/{id}/versions` — JSON version history.
- `docforge://recipes` — index of named workflow playbooks.
- `docforge://recipes/{workflow}` — specific procedural recipe (e.g. `safe-rewrite`).

Read the relevant recipe before starting a workflow you've not done before. They encode the safe ordering of tool calls.
