# docforge-mcp

MCP server for DocForge. Lets an AI agent (e.g. Claude Code) read and write to a shared live document that the user watches update in real-time in their browser.

## How it works

1. The agent calls `create_document` → gets a URL → shares it with the user
2. The user opens the URL in their browser
3. The agent reads local files (via its own file tools), then calls `write_section`
4. The user's browser updates instantly via SSE — no copy-pasting required
5. The agent calls `snapshot_section` to save named checkpoints

---

## Transport

Streamable HTTP only. Deploy `docforge-mcp-server` once; users connect via URL and an `X-API-Key` header.

---

## Deploy

```bash
cd packages/mcp
pip install -e .

# Required
export DOCFORGE_API_BASE="https://api.yourdomain.com/api"
export DOCFORGE_FRONTEND_BASE="https://yourdomain.com"

# Optional (default: 0.0.0.0:8001)
export HOST="0.0.0.0"
export PORT="8001"

docforge-mcp-server
```

Or with Docker:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY packages/mcp .
RUN pip install -e .
ENV DOCFORGE_API_BASE=https://api.yourdomain.com/api
ENV DOCFORGE_FRONTEND_BASE=https://yourdomain.com
EXPOSE 8001
CMD ["docforge-mcp-server"]
```

### User config (Claude Code)

Each user generates their own API key in DocForge (top-bar → **API Keys**), then adds to `~/.claude.json`:

```json
{
  "mcpServers": {
    "docforge": {
      "type": "http",
      "url": "https://mcp.yourdomain.com/mcp",
      "headers": {
        "X-API-Key": "their-key-here"
      }
    }
  }
}
```

No env vars, no local install — just a URL and their key.

---

## Generating an API key

Open DocForge in your browser → top-bar → **API Keys** → Generate. Give it a descriptive name like `Claude Code — work laptop`. The key is shown once — copy it.

---

## Example prompt

```
Read the files in ./src and generate a technical specification in DocForge.
Show me the URL as soon as you create it so I can follow along.
```

The agent will:
1. Check your credits with `get_user_info`
2. Create a document and show you the URL
3. Read your source files
4. Stream content into DocForge section by section
5. Save a version snapshot when done

---

## Multiple agents

Create **one API key per agent tool / environment**. Names appear in the Activity panel and version history.

| Key name | Use case |
|---|---|
| `Claude Code — work` | Claude Code on the work laptop |
| `Claude Code — home` | Claude Code on the home machine |
| `Windsurf` | Windsurf IDE MCP integration |

**Best practices:**
- Call `list_versions` before a major write to see who last edited
- Use `snapshot_section` before and after large rewrites
- Revoke a key when you retire an agent integration

---

## What the agent sees

When connected, an agent can read `docforge://guide/system-prompt` for an orientation brief — mental model, the read-before-write loop, snapshot strategy, and a full tool inventory. It's the canonical agent-facing description of the server, kept in sync with the code. Read it yourself if you want to know exactly what your agent is told.

There are also workflow recipes at `docforge://recipes/{slug}` — short procedural playbooks (`safe-rewrite`, `collaborative-edit`, `incremental-draft`) the agent can pull in when relevant.

---

## Tools reference

See [TOOLS.md](TOOLS.md) for full parameter documentation of every tool and resource.
