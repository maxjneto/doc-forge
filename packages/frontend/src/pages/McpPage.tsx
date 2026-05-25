import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { TopBar } from "@/components/shared";
import { apiListApiKeys, apiCreateApiKey, apiRevokeApiKey, apiUpdateApiKeyHarness } from "@/utils/api";
import { HARNESS_META, isHarness } from "@/utils/harness";
import type { ApiKey, ApiKeyCreateResponse } from "@/types";

type Tab = "claude_code" | "codex" | "cursor" | "generic";

const TABS: { id: Tab; label: string }[] = [
  { id: "claude_code", label: "Claude Code" },
  { id: "codex",       label: "Codex" },
  { id: "cursor",      label: "Cursor" },
  { id: "generic",     label: "Generic agent" },
];

const HARNESS_OPTIONS: Tab[] = ["claude_code", "codex", "cursor", "generic"];

export function McpPage() {
  const { getToken } = useAuth();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [harness, setHarness] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("claude_code");
  const [copied, setCopied] = useState<string | null>(null);
  const [editingHarness, setEditingHarness] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await apiListApiKeys(getToken);
      setKeys(data.filter((k) => !k.revokedAt));
    } catch {
      setKeys([]);
    }
  }

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    refresh();
  }, [getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    const name = newKeyName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const result = await apiCreateApiKey(name, getToken, harness);
      setCreated(result);
      setNewKeyName("");
      setHarness(null);
      await refresh();
    } catch {
      setError("Failed to generate token.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await apiRevokeApiKey(id, getToken);
      await refresh();
    } catch {
      setError("Failed to revoke token.");
    }
  }

  async function handleUpdateHarness(keyId: string, newHarness: string | null) {
    try {
      await apiUpdateApiKeyHarness(keyId, newHarness, getToken);
      await refresh();
    } catch {
      setError("Failed to update token.");
    }
    setEditingHarness(null);
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--df-bg, #0a0b0c)", color: "#e3e2e2", display: "flex", flexDirection: "column", fontFamily: "'Inter', sans-serif" }}>
      <TopBar dashboardNav />

      <main style={{ flex: 1, paddingTop: 56 + 36, paddingBottom: 80, paddingLeft: 56, paddingRight: 56, maxWidth: 960, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>DocForge MCP</h1>
          <p style={{ fontSize: 13, color: "var(--df-dim)", margin: 0 }}>
            Connect Claude Code, Codex, Cursor, or any MCP-compatible agent to your DocForge workspace.
          </p>
        </div>

        {/* API Keys section */}
        <section style={cardStyle}>
          <header style={headStyle}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>API tokens</span>
            <span className="df-mono" style={{ fontSize: 10, color: "var(--df-faint)", letterSpacing: "0.10em" }}>
              {keys ? `${keys.length} active` : "…"}
            </span>
          </header>

          {/* New key form */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--df-outline)" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Token name (e.g. Claude Code – laptop)"
                style={{
                  flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid var(--df-outline)",
                  borderRadius: 6, padding: "7px 12px", color: "#e3e2e2", fontSize: 13,
                  outline: "none", fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newKeyName.trim()}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600,
                  background: "var(--df-amber-500)", color: "#fff",
                  border: "1px solid var(--df-amber-500)", cursor: creating ? "wait" : "pointer",
                  opacity: !newKeyName.trim() ? 0.5 : 1,
                  boxShadow: "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)",
                  fontFamily: "inherit",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
                Generate
              </button>
            </div>

            {/* Harness picker */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {HARNESS_OPTIONS.map((h) => {
                const meta = HARNESS_META[h];
                const active = harness === h;
                return (
                  <button
                    key={h}
                    onClick={() => setHarness(active ? null : h)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "4px 10px", borderRadius: 6, fontSize: 11.5, fontWeight: 500,
                      border: active ? "1px solid var(--df-steel-border)" : "1px solid var(--df-outline)",
                      background: active ? "var(--df-steel-bg)" : "transparent",
                      color: active ? "var(--df-steel-100)" : "var(--df-faint)",
                      cursor: "pointer", fontFamily: "inherit",
                      transition: "border-color 0.15s, background 0.15s, color 0.15s",
                    }}
                  >
                    <img src={meta.logo} width={13} height={13} alt="" style={{ opacity: active ? 1 : 0.5 }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Newly created key banner */}
          {created && (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--df-outline)", background: "rgba(255,77,0,0.05)" }}>
              <div className="df-mono" style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--df-amber-300)", textTransform: "uppercase", marginBottom: 6 }}>
                Copy your token now — it won't be shown again.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <code
                  className="df-mono"
                  style={{
                    flex: 1, fontSize: 12, color: "var(--df-steel-100)", background: "#0a0b0c",
                    border: "1px solid var(--df-outline)", borderRadius: 5, padding: "8px 12px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {created.key}
                </code>
                <button
                  onClick={() => copy(created.key, "new-key")}
                  style={ghostBtnStyle}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                  {copied === "new-key" ? "Copied" : "Copy"}
                </button>
                <button onClick={() => setCreated(null)} style={{ ...ghostBtnStyle, border: "none" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ padding: "8px 20px", fontSize: 12, color: "var(--df-error, #f55)" }}>{error}</div>
          )}

          {/* Key list */}
          <div>
            {keys === null && <EmptyRow>Loading…</EmptyRow>}
            {keys && keys.length === 0 && <EmptyRow>No active tokens. Generate one above to connect your first agent.</EmptyRow>}
            {keys && keys.map((k, i) => {
              const hMeta = k.harness && isHarness(k.harness) ? HARNESS_META[k.harness] : null;
              const isEditingThis = editingHarness === k.id;
              return (
                <div
                  key={k.id}
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--df-outline)",
                  }}
                >
                  <div
                    style={{
                      display: "grid", gridTemplateColumns: "1fr auto auto",
                      alignItems: "center", gap: 14,
                      padding: "11px 20px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, color: hMeta ? hMeta.fg : "#e3e2e2" }}>{k.name}</span>
                          {hMeta ? (
                            <img src={hMeta.logo} width={14} height={14} alt={hMeta.label} title={hMeta.label} style={{ opacity: 0.85 }} />
                          ) : null}
                          {/* Edit harness button */}
                          <button
                            onClick={() => setEditingHarness(isEditingThis ? null : k.id)}
                            title={hMeta ? "Change client" : "Set client"}
                            style={{
                              display: "inline-flex", alignItems: "center",
                              background: "none", border: "none", cursor: "pointer",
                              padding: 2, color: isEditingThis ? "var(--df-dim)" : "var(--df-faint)",
                              fontFamily: "inherit",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                              {isEditingThis ? "close" : hMeta ? "edit" : "label"}
                            </span>
                          </button>
                        </div>
                        <span className="df-mono" style={{ display: "block", fontSize: 10, color: "var(--df-faint)", letterSpacing: "0.06em", marginTop: 2 }}>
                          Created {new Date(k.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                        </span>
                      </div>
                    </div>
                    <span
                      className="df-mono"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        fontSize: 9.5, padding: "3px 9px", borderRadius: 999,
                        color: hMeta ? hMeta.fg : "var(--df-steel-100)",
                        background: hMeta ? hMeta.bg : "var(--df-steel-bg)",
                        border: `1px solid ${hMeta ? hMeta.border : "var(--df-steel-border)"}`,
                        letterSpacing: "0.08em", textTransform: "uppercase",
                      }}
                    >
                      Active
                    </span>
                    <button
                      onClick={() => handleRevoke(k.id)}
                      title="Revoke token"
                      style={{ ...ghostBtnStyle, color: "var(--df-faint)", gap: 4 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>link_off</span>
                      Revoke
                    </button>
                  </div>
                  {/* Inline harness picker */}
                  {isEditingThis && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "0 20px 12px" }}>
                      {HARNESS_OPTIONS.map((h) => {
                        const m = HARNESS_META[h];
                        const isActive = k.harness === h;
                        return (
                          <button
                            key={h}
                            onClick={() => handleUpdateHarness(k.id, isActive ? null : h)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                              border: isActive ? `1px solid ${m.border}` : "1px solid var(--df-outline)",
                              background: isActive ? m.bg : "transparent",
                              color: isActive ? m.fg : "var(--df-faint)",
                              cursor: "pointer", fontFamily: "inherit",
                              transition: "border-color 0.15s, background 0.15s, color 0.15s",
                            }}
                          >
                            <img src={m.logo} width={11} height={11} alt="" style={{ opacity: isActive ? 1 : 0.5 }} />
                            {m.label}
                          </button>
                        );
                      })}
                      {k.harness && (
                        <button
                          onClick={() => handleUpdateHarness(k.id, null)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                            border: "1px solid var(--df-outline)", background: "transparent",
                            color: "var(--df-faint)", cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>close</span>
                          None
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Client setup section */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 18px" }}>Client setup</h2>

          <div style={{ border: "1px solid var(--df-outline)", borderRadius: 12, background: "rgba(18,20,20,0.5)", overflow: "hidden" }}>
            {/* Tab bar */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--df-outline)", padding: "0 4px" }}>
              {TABS.map((t) => {
                const meta = HARNESS_META[t.id];
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "10px 14px 11px",
                      fontSize: 13, fontWeight: active ? 500 : 400,
                      color: active ? "#e3e2e2" : "var(--df-faint)",
                      background: "none", border: "none", cursor: "pointer",
                      borderBottom: active ? "2px solid #e3e2e2" : "2px solid transparent",
                      marginBottom: -1,
                      fontFamily: "inherit",
                      transition: "color 0.15s",
                    }}
                  >
                    <img src={meta.logo} width={16} height={16} alt="" style={{ opacity: active ? 1 : 0.45 }} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Panels */}
            <div style={{ padding: "24px 28px" }}>
              {/* Info box */}
              <div style={{
                display: "flex", gap: 8, alignItems: "flex-start",
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--df-outline)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 24,
                fontSize: 13, color: "var(--df-dim)", lineHeight: 1.5,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0, marginTop: 1, color: "var(--df-steel-200)" }}>info</span>
                Generate an API token in the section above and copy it before following these steps.
              </div>

              {tab === "claude_code" && <ClaudeCodePanel copy={copy} copied={copied} />}
              {tab === "codex"       && <CodexPanel copy={copy} copied={copied} />}
              {tab === "cursor"      && <CursorPanel copy={copy} copied={copied} />}
              {tab === "generic"     && <GenericPanel copy={copy} copied={copied} />}
            </div>
          </div>
        </section>
        {/* What your agent can access */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 18px" }}>What your agent can access</h2>
          <CapabilitiesCard />
        </section>

        {/* Tips */}
        <section style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 18px" }}>Tips</h2>
          <div style={cardStyle}>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--df-outline)",
                  fontSize: 11, fontWeight: 500, color: "var(--df-dim)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>1</span>
                <span style={{ fontSize: 13, color: "#e3e2e2", fontWeight: 500, paddingTop: 1 }}>
                  Tell your agent to read the orientation guide first
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--df-dim)", lineHeight: 1.5, margin: "0 0 10px 30px" }}>
                Agents in new environments default to tool discovery and may skip the orientation resource entirely.
                Paste this into your first message to make sure they start from the right mental model.
              </p>
              <div style={{ marginLeft: 30 }}>
                <CodeBlock
                  text={`Before doing anything else, read the resource at docforge://guide/system-prompt.`}
                  id="tip-sysprompt"
                  copy={copy}
                  copied={copied}
                />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// ─── Panel props ─────────────────────────────────────────────

interface PanelProps {
  copy: (text: string, key: string) => void;
  copied: string | null;
}

// ─── Claude Code ─────────────────────────────────────────────

function ClaudeCodePanel({ copy, copied }: PanelProps) {
  const cmd1 = `claude mcp add --transport http docforge https://mcp.doc-forge.dev/mcp -H "Authorization: Bearer your_api_key_here"`;
  const cmd2 = `claude mcp list`;
  const cmd3 = `claude "Create a technical spec for the auth module using DocForge"`;
  return (
    <>
      <Step num={1} title="Add the DocForge MCP server">
        <CodeBlock text={cmd1} id="cc1" copy={copy} copied={copied} />
        <Note>Alternatively, add it manually to <Mono>~/.claude/mcp.json</Mono>.</Note>
      </Step>
      <Step num={2} title="Verify the connection">
        <CodeBlock text={cmd2} id="cc2" copy={copy} copied={copied} />
        <Note>You should see <Mono>docforge</Mono> listed as a connected server.</Note>
      </Step>
      <Step num={3} title="Start using DocForge in your agent">
        <CodeBlock text={cmd3} id="cc3" copy={copy} copied={copied} />
        <Note>Claude Code will automatically use DocForge tools when relevant. You can also ask for a specific tool by name.</Note>
      </Step>
    </>
  );
}

// ─── Codex ───────────────────────────────────────────────────

function CodexPanel({ copy, copied }: PanelProps) {
  const cmd1 = `codex mcp add docforge --url https://mcp.doc-forge.dev/mcp`;
  const toml = `[mcp_servers.docforge]\nurl = "https://mcp.doc-forge.dev/mcp"\nbearer_token_env_var = "DOCFORGE_API_KEY"\ndefault_tools_approval_mode = "prompt"`;
  const cmd3 = `export DOCFORGE_API_KEY=your_api_key_here\ncodex mcp list`;
  return (
    <>
      <Step num={1} title="Add the DocForge MCP server via CLI">
        <CodeBlock text={cmd1} id="cx1" copy={copy} copied={copied} />
        <Note>Or edit <Mono>~/.codex/config.toml</Mono> directly (see step 2).</Note>
      </Step>
      <Step num={2} title="Configure authentication in config.toml">
        <CodeBlock text={toml} id="cx2" copy={copy} copied={copied} toml />
      </Step>
      <Step num={3} title="Export your API key and verify">
        <CodeBlock text={cmd3} id="cx3" copy={copy} copied={copied} />
        <Note>Add the <Mono>export</Mono> line to your shell profile (<Mono>~/.zshrc</Mono> or <Mono>~/.bashrc</Mono>) to persist it.</Note>
      </Step>
    </>
  );
}

// ─── Cursor ──────────────────────────────────────────────────

function CursorPanel({ copy, copied }: PanelProps) {
  const json = `{\n  "mcpServers": {\n    "docforge": {\n      "url": "https://mcp.doc-forge.dev/mcp",\n      "headers": {\n        "Authorization": "Bearer \${env:DOCFORGE_API_KEY}"\n      }\n    }\n  }\n}`;
  const cmd2 = `export DOCFORGE_API_KEY=your_api_key_here`;
  return (
    <>
      <Step num={1} title="Create or edit your MCP config">
        <Note style={{ marginBottom: 8 }}>For global access, edit <Mono>~/.cursor/mcp.json</Mono>. For project-only, create <Mono>.cursor/mcp.json</Mono> at the project root.</Note>
        <CodeBlock text={json} id="cu1" copy={copy} copied={copied} />
      </Step>
      <Step num={2} title="Set your API key in the environment">
        <CodeBlock text={cmd2} id="cu2" copy={copy} copied={copied} />
        <Note>Add this to your shell profile to persist across sessions. Cursor reads env variables at startup.</Note>
      </Step>
      <Step num={3} title="Enable in Cursor settings">
        <Note>Go to <strong>Cursor Settings → MCP</strong>. DocForge should appear under available servers. Toggle it on. You'll see DocForge tools listed under <em>Available Tools</em> in the Agent chat.</Note>
      </Step>
    </>
  );
}

// ─── Generic ─────────────────────────────────────────────────

function GenericPanel({ copy, copied }: PanelProps) {
  const url = `https://mcp.doc-forge.dev/mcp`;
  const auth = `Authorization: Bearer your_api_key_here`;
  const transport = `# Streamable HTTP (recommended)\nurl = "https://mcp.doc-forge.dev/mcp"\n\n# SSE (legacy clients)\nurl = "https://mcp.doc-forge.dev/mcp/sse"`;
  return (
    <>
      <Step num={1} title="Server URL">
        <CodeBlock text={url} id="gn1" copy={copy} copied={copied} />
        <Note>This is your MCP endpoint. Use it wherever your agent accepts an MCP server URL.</Note>
      </Step>
      <Step num={2} title="Authentication">
        <CodeBlock text={auth} id="gn2" copy={copy} copied={copied} />
        <Note>Pass your DocForge API key as a Bearer token in the <Mono>Authorization</Mono> header on every request.</Note>
      </Step>
      <Step num={3} title="Transport">
        <Note style={{ marginBottom: 8 }}>DocForge supports <strong>Streamable HTTP</strong> and <strong>SSE</strong>. Check your client's docs for which transport to configure.</Note>
        <CodeBlock text={transport} id="gn3" copy={copy} copied={copied} comment />
      </Step>
      <hr style={{ border: "none", borderTop: "1px solid var(--df-outline)", margin: "20px 0" }} />
      <p style={{ fontSize: 13, color: "var(--df-dim)", lineHeight: 1.5 }}>
        Need help? Reach out at <Mono>support@docforge.dev</Mono>.
      </p>
    </>
  );
}

// ─── Capabilities card ────────────────────────────────────────

const TOOLS_INFO = [
  { name: "get_user_info",         desc: "Check your account name, email, and remaining credits." },
  { name: "list_documents",        desc: "List all your editor documents." },
  { name: "create_document",       desc: "Create a new document (costs 1 credit)." },
  { name: "get_document",          desc: "Read a document's current body content and metadata." },
  { name: "write_section",         desc: "Replace the full document body with new Markdown in real time." },
  { name: "snapshot_section",      desc: "Save a named version checkpoint." },
  { name: "list_versions",         desc: "List all saved version checkpoints for a document." },
  { name: "get_version_content",   desc: "Read any version's content, including inactive ones." },
  { name: "select_active_version", desc: "Switch which version the user sees in their browser." },
  { name: "rename_version",        desc: "Update a version's label or change summary." },
  { name: "get_activity",          desc: "See recent writes, snapshots, and version switches by all actors." },
  { name: "get_document_url",      desc: "Get the browser URL to share with the user." },
];

const RESOURCES_INFO = [
  { uri: "docforge://documents",               desc: "JSON list of all your documents." },
  { uri: "docforge://document/{id}",           desc: "Current body content as Markdown." },
  { uri: "docforge://document/{id}/versions",  desc: "JSON version history." },
  { uri: "docforge://guide/system-prompt",     desc: "Agent orientation brief (also exposed as a prompt — see below)." },
  { uri: "docforge://recipes",                 desc: "Index of available workflow recipe slugs." },
  { uri: "docforge://recipes/{slug}",          desc: "Full procedural recipe (safe-rewrite, collaborative-edit, incremental-draft)." },
];

function CapabilitiesCard() {
  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
    color: "var(--df-faint)", marginBottom: 12, fontFamily: "var(--df-mono-font, monospace)",
  };
  const descStyle: React.CSSProperties = { fontSize: 12, color: "var(--df-dim)", lineHeight: 1.45 };
  const amberPill: React.CSSProperties = {
    fontSize: 11.5, color: "var(--df-amber-200)", background: "rgba(255,77,0,0.08)",
    padding: "1px 5px", borderRadius: 3, fontFamily: "var(--df-mono-font, monospace)",
    whiteSpace: "nowrap" as const,
  };
  const steelPill: React.CSSProperties = {
    fontSize: 11, color: "var(--df-steel-100)", background: "rgba(255,255,255,0.04)",
    padding: "1px 5px", borderRadius: 3, fontFamily: "var(--df-mono-font, monospace)",
    whiteSpace: "nowrap" as const,
  };

  return (
    <div style={cardStyle}>
      {/* Tools */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--df-outline)" }}>
        <div className="df-mono" style={labelStyle}>Tools</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 6, alignItems: "baseline" }}>
          {TOOLS_INFO.map(({ name, desc }) => (
            <React.Fragment key={name}>
              <code className="df-mono" style={amberPill}>{name}</code>
              <span style={descStyle}>{desc}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Resources */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--df-outline)" }}>
        <div className="df-mono" style={labelStyle}>Resources</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 6, alignItems: "baseline" }}>
          {RESOURCES_INFO.map(({ uri, desc }) => (
            <React.Fragment key={uri}>
              <code className="df-mono" style={steelPill}>{uri}</code>
              <span style={descStyle}>{desc}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Prompts */}
      <div style={{ padding: "16px 20px" }}>
        <div className="df-mono" style={labelStyle}>Prompts</div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 6, alignItems: "baseline", marginBottom: 12 }}>
          <code className="df-mono" style={steelPill}>docforge_orientation</code>
          <span style={descStyle}>The same agent orientation brief as the resource above.</span>
        </div>
        <div style={{
          display: "flex", gap: 8, alignItems: "flex-start",
          background: "rgba(255,255,255,0.02)", border: "1px solid var(--df-outline)",
          borderRadius: 7, padding: "9px 12px",
          fontSize: 12, color: "var(--df-dim)", lineHeight: 1.55,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, flexShrink: 0, marginTop: 1, color: "var(--df-faint)" }}>info</span>
          <span>
            The system prompt is exposed as both a resource (<code className="df-mono" style={{ ...steelPill, fontSize: 11 }}>docforge://guide/system-prompt</code>) and a named MCP prompt (<code className="df-mono" style={{ ...steelPill, fontSize: 11 }}>docforge_orientation</code>).
            {" "}The resource lets an agent fetch it on demand by URI. The prompt surfaces it through <code className="df-mono" style={{ ...steelPill, fontSize: 11 }}>prompts/list</code> so clients that support MCP prompts can inject it automatically — without the agent needing to know to ask for it first.
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "rgba(255,255,255,0.04)", border: "1px solid var(--df-outline)",
          fontSize: 11, fontWeight: 500, color: "var(--df-dim)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>{num}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: "#e3e2e2" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

interface CodeBlockProps {
  text: string;
  id: string;
  copy: (t: string, k: string) => void;
  copied: string | null;
  toml?: boolean;
  comment?: boolean;
}

function CodeBlock({ text, id, copy, copied, toml, comment }: CodeBlockProps) {
  const isCopied = copied === id;

  const renderContent = () => {
    if (toml) {
      return text.split("\n").map((line, i) => {
        const sectionMatch = line.match(/^\[(.+)\]$/);
        const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (sectionMatch) {
          return <span key={i} style={{ color: "var(--df-amber-300)" }}>{line}{"\n"}</span>;
        }
        if (kvMatch) {
          return (
            <span key={i}>
              <span style={{ color: "var(--df-amber-200)" }}>{kvMatch[1]}</span>
              <span style={{ color: "var(--df-dim)" }}> = </span>
              <span style={{ color: "var(--df-steel-200)" }}>{kvMatch[2]}</span>
              {"\n"}
            </span>
          );
        }
        return <span key={i}>{line}{"\n"}</span>;
      });
    }
    if (comment) {
      return text.split("\n").map((line, i) => (
        <span key={i} style={{ color: line.startsWith("#") ? "var(--df-faint)" : "var(--df-steel-100)" }}>
          {line}{"\n"}
        </span>
      ));
    }
    return text;
  };

  return (
    <div
      className="df-mono"
      style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid var(--df-outline)",
        borderRadius: 8, padding: "12px 44px 12px 14px",
        fontSize: 12.5, color: "var(--df-steel-100)",
        position: "relative", whiteSpace: "pre", overflowX: "auto", lineHeight: 1.6,
        marginBottom: 6,
      }}
    >
      {renderContent()}
      <button
        onClick={() => copy(text, id)}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(18,20,20,0.9)", border: "1px solid var(--df-outline)",
          borderRadius: 5, padding: "3px 8px",
          fontSize: 11, color: isCopied ? "var(--df-steel-100)" : "var(--df-faint)",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
        {isCopied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Note({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 12.5, color: "var(--df-dim)", lineHeight: 1.5, margin: 0, ...style }}>
      {children}
    </p>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="df-mono" style={{ fontSize: 11.5, color: "var(--df-amber-200)", background: "rgba(255,77,0,0.08)", padding: "1px 5px", borderRadius: 3 }}>
      {children}
    </code>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--df-outline)",
  borderRadius: 12,
  background: "rgba(18,20,20,0.5)",
  overflow: "hidden",
};

const headStyle: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--df-outline)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const ghostBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "5px 10px",
  background: "transparent",
  border: "1px solid var(--df-outline-md, rgba(255,255,255,0.09))",
  borderRadius: 6,
  color: "var(--df-dim)",
  cursor: "pointer",
  fontSize: 11.5,
  fontFamily: "inherit",
};

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "16px 20px", fontSize: 12, color: "var(--df-faint)", lineHeight: 1.5 }}>{children}</div>
  );
}
