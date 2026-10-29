# MCP server

`packages/mcp` — Python, the official MCP SDK (`FastMCP`), Streamable HTTP. The full tool reference is in [packages/mcp/TOOLS.md](../../packages/mcp/TOOLS.md); setup for each client is in [packages/mcp/README.md](../../packages/mcp/README.md).

The MCP server is how agents use DocForge. It holds no state and has no database access: each tool call becomes one or a few REST calls to the backend, made with the agent's own API key, and the answer comes back as text written for an agent to read.

## Connecting

A person creates a named API key on the **DocForge MCP** page (the key is shown once; only its hash is stored) and adds the server to their client:

```bash
claude mcp add --transport http docforge https://mcp.doc-forge.dev/mcp \
  --header "Authorization: Bearer <key>"
```

Codex, Cursor and other clients take the same URL and header in their own configuration; the MCP page shows the snippet for each.

## Authentication, per call

Every tool and resource call reads the `Authorization: Bearer` header **of that call** (`ctx.request_context.request`) and forwards the key to the backend as `X-API-Key`. It is deliberately not an ASGI middleware: a Streamable HTTP session processes all its messages in one long-lived task created at `initialize`, so a context variable set by middleware on a later request would never reach it, and only the key sent when the session started would count.

The backend then treats the request as the key's owner, attributes everything to the key (activity shows "Claude Code — laptop", not the person), and applies the document's write policy.

## Tools

42 tools, in groups:

| Group | Tools | Notes |
|---|---|---|
| Account and documents | `get_user_info`, `list_documents`, `create_document`, `get_document`, `get_section`, `get_document_url` | `get_document` returns an outline first; `get_section` reads one heading's text |
| Writing Markdown | `write_section`, `append_section`, `patch_section` | with the default policy, these become suggestions the person reviews |
| Review loop | `check_suggestions`, `get_pending_feedback`, `resolve_feedback` | the agent reads what the person accepted, rejected or asked for |
| Versions | `snapshot_section`, `list_versions`, `get_version_content`, `select_active_version`, `rename_version`, `get_activity` | |
| Quality gate | `get_quality_gate`, `submit_quality_findings` | the agent audits; DocForge stores and enforces |
| Artifacts | `list_artifacts`, `create_artifact` | diagrams, tables and decision notes anchored in the text |
| Layout documents | `create_layout_document`, `get_layout_map`, `get_layout_document`, `apply_layout_ops`, `preview_layout`, `measure_component`, `calibrate_style`, `render_page`, `review_layout`, `find_layout` | see [Layout documents](layout-documents.md) |
| Layout collaboration | `get_layout_notes`, `request_review`, `resolve_layout_note`, `reply_layout_note`, `save_layout_version`, `list_layout_versions`, `restore_layout_version` | comments addressed to the agent, review requests, versions |
| Layout themes | `list_layout_themes`, `apply_layout_theme`, `save_layout_theme` | |

Two choices shape the tools:

- **Small answers.** Responses are written for the agent's context window: an outline before the full text, a write summary instead of the whole document, a layout map at the level of detail asked for (`summary`, `pages`, `full`). Each call costs the agent the whole conversation again, so fewer and smaller round trips matter more than completeness.
- **Errors that say what to do.** A refused operation names the field and the fix; a stale write says to read again; a layout side effect is reported, not refused.

## Resources and prompts

| URI | Content |
|---|---|
| `docforge://guide/system-prompt` | the orientation brief: how DocForge works, the write policy, which tool to use when |
| `docforge://guide/layout` | the layout format: grid, components, operations, how to work in few calls |
| `docforge://recipes`, `docforge://recipes/{workflow}` | step-by-step playbooks: safe rewrite, incremental draft, suggestion review loop, collaborative edit, quality gate |
| `docforge://writing`, `docforge://writing/{type}` | writing guides for ADRs, postmortems, runbooks and RFCs |
| `docforge://documents`, `docforge://document/{id}`, `docforge://document/{id}/versions` | the person's documents as resources |

The orientation brief is also a named prompt (`docforge_orientation`), so clients that support MCP prompts can inject it without the agent having to ask for it.

## Telemetry

After every tool call the server reports, in a background task that never delays or fails the tool: the tool's name, whether it worked, how long it took, and how many characters it returned (≈ tokens × 4). The report goes to the backend with the agent's key, so it lands on the right account. `DOCFORGE_TELEMETRY=off` turns it off.

## Running it

```bash
cd packages/mcp
pip install -e ".[dev]"
DOCFORGE_API_BASE=http://localhost:8000/api \
DOCFORGE_FRONTEND_BASE=http://localhost:5173 \
PORT=8001 docforge-mcp-server
pytest tests -q
```

`scripts/smoke-mcp.py` runs the whole flow against a running server (create a layout document, apply operations, read the map, save a version…) with a real key:

```bash
DOCFORGE_API_KEY=<key> python scripts/smoke-mcp.py --url http://localhost:8001/mcp
```
