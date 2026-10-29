# DocForge MCP — Agent Orientation

You are operating on a user's living document via the DocForge MCP server. The user may be reading, editing, or running another agent against the same document at the same time as you. Treat every action as collaborative, not exclusive.

## Mental model

A DocForge document has one body section. The body section has many versions; exactly one is the *active* version — that's what the user sees in their browser. Snapshots create a new named version (which then becomes active) so the previous state is preserved.

**Your writes are suggestions by default.** On most documents (`agent_write_policy: suggest`, the default), `write_section`, `append_section`, and `patch_section` create a *pending suggestion* the user reviews as a diff and accepts or rejects. A first write to an empty editor body may be applied directly because there is no prior content to diff against. On `direct`-policy documents writes apply immediately. The tool's response tells you which happened.

Every action you take is logged to the document's activity feed with your API key's name attached. The user sees that feed in real time. Be a good citizen: descriptive snapshot names, useful notes, no surprise wholesale rewrites.

## The review loop (important)

1. Before writing: `get_pending_feedback` — the user may have left comments or rejected earlier suggestions with explanations. Address them.
2. Write with a useful `note` — it's what the reviewer reads next to the diff.
3. Later: `check_suggestions` — see whether your suggestion was accepted or rejected. A rejection usually carries a `reviewer said:` comment; treat it as authoritative instructions, fix the content, and write again.
4. When you address a feedback item, call `resolve_feedback` with a short note.

Do not spam pending suggestions: if one is already pending on a section, prefer waiting for its review (or check feedback) before proposing another rewrite of the same content.

## Core loop

Before any meaningful edit:

1. `get_user_info` — confirms you're authenticated and shows remaining document creations for the week.
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
| `get_user_info` | Auth check, document-creation allowance, name. |
| `list_documents` | Find a document id. |
| `create_document` | New editor document. Uses one weekly document creation. |
| `get_document` | Read body + metadata. |
| `write_section` | Propose (default) or apply body content. |
| `append_section` | Append content without resending the full body. |
| `patch_section` | Replace an exact fragment within a heading-scoped section. |
| `check_suggestions` | Status of your suggestions (pending/accepted/rejected + review comments). |
| `get_pending_feedback` | Open human feedback to address before writing. |
| `resolve_feedback` | Mark a feedback item as addressed. |
| `snapshot_section` | Save a named version checkpoint. |
| `list_versions` | Version history metadata. |
| `get_version_content` | Read the content of a specific version (active or not). |
| `select_active_version` | Switch which version is displayed. |
| `rename_version` | Update a version's name/summary. |
| `get_activity` | Recent actions on the document. |
| `get_document_url` | Browser URL to share with the user. |
| `get_quality_gate` | Read the quality-gate state and sections to audit. |
| `submit_quality_findings` | Record findings from an agent-run cross-section audit. |
| `list_artifacts` / `create_artifact` | Manage diagrams, tables, and decision notes attached to the document. |
| `create_layout_document` | New layout document (components on a unit grid). Uses one weekly document creation. |
| `get_layout_map` | Read a layout document as text: settings, each page drawn in ASCII, a table of components. |
| `request_review` | Hand a layout document to the person: summary, what to look at, questions with options. |
| `render_page` | A page of a layout document as a PNG, for agents that can see images. |
| `review_layout` | What a reader would notice (empty boxes, ragged rows, edges off the guides), with fixing ops. |
| `find_layout` | Find components by text, type, class, page, grid area or state. |
| `measure_component` | How tall a component would be at given widths. Free. |
| `preview_layout` | What ops (or a whole draft) would produce. Free, saves nothing. |
| `calibrate_style` | Compare style variants for a component, class or type before choosing. Free. |
| `apply_layout_ops` | Change a layout document (`edit` and `replaceText` fix parts of the content); answers with a short summary of what changed and what moved. |
| `get_layout_notes` / `resolve_layout_note` | Notices (what the layout moved on its own) and annotations people pinned. |
| `get_layout_document` | Raw JSON of a layout document. |

## Layout documents

For one-pagers, reports and proposals where position matters (KPIs side by side, a chart next to its explanation, cards), use a layout document instead of markdown. It is a different document mode with its own tools: you place components on a grid of 8px units (12 guide columns help you align), measure and preview before writing, and read each page as an ASCII drawing, so you never need to see the page. Read `docforge://guide/layout` before the first one.

## Resources

- `docforge://documents` — JSON list of all your documents.
- `docforge://document/{id}` — current body content as markdown.
- `docforge://document/{id}/versions` — JSON version history.
- `docforge://recipes` — index of named workflow playbooks.
- `docforge://recipes/{workflow}` — specific procedural recipe (e.g. `safe-rewrite`, `suggestion-review-loop`).
- `docforge://writing` — index of curated writing guides by document type.
- `docforge://guide/layout` — the layout document format: grid, components, operations, styles.
- `docforge://writing/{type}` — writing guide (`adr`, `postmortem`, `runbook`, `rfc`) — read before drafting that kind of document.

Read the relevant recipe before starting a workflow you've not done before. They encode the safe ordering of tool calls.
