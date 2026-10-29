import { MCP_URL } from "@/utils/mcpUrl";
import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { TopBar } from "@/components/shared";
import { Button, Eyebrow, IconButton, InlineCode, Input, Page, PageHeader, Pill, RichText } from "@/components/ui";
import { apiListApiKeys, apiCreateApiKey, apiRevokeApiKey, apiUpdateApiKeyHarness } from "@/utils/api";
import { HARNESS_META, isHarness } from "@/utils/harness";
import type { ApiKey, ApiKeyCreateResponse } from "@/types";
import { useI18n } from "@/i18n";
import { relativeTime, shortDate } from "@/utils/time";

type Tab = "claude_code" | "codex" | "cursor" | "generic";
type T = (key: string, vars?: Record<string, string | number>) => string;

const TABS: Tab[] = ["claude_code", "codex", "cursor", "generic"];
const HARNESS_OPTIONS: Tab[] = ["claude_code", "codex", "cursor", "generic"];

const tabLabel = (tab: Tab, t: T) => (tab === "generic" ? t("mcp.genericAgent") : HARNESS_META[tab].label);

export function McpPage() {
  const { getToken } = useAuth();
  const { t, dateLocale } = useI18n();
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
      setError(t("mcp.errGenerate"));
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await apiRevokeApiKey(id, getToken);
      await refresh();
    } catch {
      setError(t("mcp.errRevoke"));
    }
  }

  async function handleUpdateHarness(keyId: string, newHarness: string | null) {
    try {
      await apiUpdateApiKeyHarness(keyId, newHarness, getToken);
      await refresh();
    } catch {
      setError(t("mcp.errUpdate"));
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
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
      <TopBar dashboardNav />

      <Page>
        <PageHeader title="DocForge MCP" lead={t("mcp.lead")} />

        {/* API tokens */}
        <section style={cardStyle}>
          <header style={headStyle}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t("mcp.tokens")}</span>
            <span style={{ fontSize: 11.5, color: "var(--color-faint)" }}>
              {keys ? t("mcp.activeCount", { count: keys.length }) : "…"}
            </span>
          </header>

          {/* New token */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-outline)" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <Input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder={t("mcp.tokenPlaceholder")}
                aria-label={t("mcp.tokenName")}
                style={{ flex: 1 }}
              />
              <Button variant="primary" icon="add" iconPosition="start" onClick={handleCreate} disabled={creating || !newKeyName.trim()}>
                {t("mcp.generate")}
              </Button>
            </div>

            <HarnessPicker selected={harness} onPick={(h) => setHarness(harness === h ? null : h)} />
          </div>

          {/* Newly created token */}
          {created && (
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--color-outline)", background: "var(--color-heat-tint)" }}>
              <Eyebrow tone="heat" style={{ marginBottom: 8 }}>{t("mcp.copyNow")}</Eyebrow>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code
                  className="df-mono"
                  style={{
                    flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--color-steel-hi)", background: "var(--color-bg)",
                    border: "1px solid var(--color-outline)", borderRadius: "var(--radius-sm)", padding: "8px 12px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                >
                  {created.key}
                </code>
                <Button icon={copied === "new-key" ? "check" : "content_copy"} iconPosition="start" onClick={() => copy(created.key, "new-key")}>
                  {copied === "new-key" ? t("mcp.copied") : t("common.copy")}
                </Button>
                <IconButton icon="close" label={t("common.close")} onClick={() => setCreated(null)} />
              </div>
            </div>
          )}

          {error && <div style={{ padding: "8px 20px", fontSize: 12.5, color: "var(--color-error)" }}>{error}</div>}

          {/* Token list */}
          <div>
            {keys === null && <EmptyRow>{t("common.loading")}</EmptyRow>}
            {keys && keys.length === 0 && <EmptyRow>{t("mcp.noTokens")}</EmptyRow>}
            {keys && keys.map((k, i) => {
              const hMeta = k.harness && isHarness(k.harness) ? HARNESS_META[k.harness] : null;
              const isEditingThis = editingHarness === k.id;
              return (
                <div key={k.id} className="df-row" style={{ borderTop: i === 0 ? "none" : "1px solid var(--color-outline)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 14, padding: "11px 20px" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {hMeta && <img src={hMeta.logo} width={14} height={14} alt={hMeta.label} title={hMeta.label} />}
                        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>{k.name}</span>
                        <IconButton
                          icon={isEditingThis ? "close" : hMeta ? "edit" : "label"}
                          label={hMeta ? t("mcp.changeClient") : t("mcp.setClient")}
                          onClick={() => setEditingHarness(isEditingThis ? null : k.id)}
                          style={{ width: 22, height: 22 }}
                        />
                      </div>
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--color-faint)", marginTop: 2 }}>
                        {t("mcp.created", { date: shortDate(k.createdAt, dateLocale) })}
                        {k.lastUsedAt && ` · ${t("mcp.lastUsed", { time: relativeTime(k.lastUsedAt, dateLocale) })}`}
                      </span>
                    </div>
                    <Pill tone="steel" compact>{t("mcp.active")}</Pill>
                    <Button variant="ghost" icon="link_off" iconPosition="start" onClick={() => handleRevoke(k.id)} title={t("mcp.revokeTitle")}>
                      {t("mcp.revoke")}
                    </Button>
                  </div>
                  {isEditingThis && (
                    <div style={{ padding: "0 20px 12px" }}>
                      <HarnessPicker
                        selected={k.harness}
                        onPick={(h) => handleUpdateHarness(k.id, k.harness === h ? null : h)}
                        onClear={k.harness ? () => handleUpdateHarness(k.id, null) : undefined}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Client setup */}
        <section style={{ marginTop: 40 }}>
          <SectionTitle>{t("mcp.setup")}</SectionTitle>

          <div style={cardStyle}>
            <div role="tablist" style={{ display: "flex", borderBottom: "1px solid var(--color-outline)", padding: "0 4px", overflowX: "auto" }}>
              {TABS.map((id) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "10px 14px 11px",
                      fontSize: 13, fontWeight: active ? 600 : 500,
                      color: active ? "var(--color-text)" : "var(--color-faint)",
                      background: "none", border: "none", cursor: "pointer",
                      boxShadow: active ? "inset 0 -2px 0 var(--color-heat)" : "none",
                      fontFamily: "inherit", whiteSpace: "nowrap",
                      transition: "color var(--duration-fast) var(--ease-forge)",
                    }}
                  >
                    <img src={HARNESS_META[id].logo} width={16} height={16} alt="" style={{ opacity: active ? 1 : 0.45 }} />
                    {tabLabel(id, t)}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: "24px 28px" }}>
              <Callout>{t("mcp.setupInfo")}</Callout>
              {tab === "claude_code" && <ClaudeCodePanel copy={copy} copied={copied} t={t} />}
              {tab === "codex" && <CodexPanel copy={copy} copied={copied} t={t} />}
              {tab === "cursor" && <CursorPanel copy={copy} copied={copied} t={t} />}
              {tab === "generic" && <GenericPanel copy={copy} copied={copied} t={t} />}
            </div>
          </div>
        </section>

        {/* What your agent can access */}
        <section style={{ marginTop: 40 }}>
          <SectionTitle>{t("mcp.access")}</SectionTitle>
          <CapabilitiesCard t={t} />
        </section>

        {/* Tips */}
        <section style={{ marginTop: 40 }}>
          <SectionTitle>{t("mcp.tips")}</SectionTitle>
          <div style={{ ...cardStyle, padding: "18px 20px" }}>
            <Step num={1} title={t("mcp.tip1")}>
              <Note style={{ marginBottom: 10 }}>{t("mcp.tip1Body")}</Note>
              <CodeBlock text={t("mcp.tip1Prompt")} id="tip-sysprompt" copy={copy} copied={copied} t={t} />
            </Step>
          </div>
        </section>
      </Page>
    </div>
  );
}

// ─── Harness picker ──────────────────────────────────────────

function HarnessPicker({ selected, onPick, onClear }: { selected: string | null; onPick: (h: Tab) => void; onClear?: () => void }) {
  const { t } = useI18n();
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {HARNESS_OPTIONS.map((h) => {
        const meta = HARNESS_META[h];
        const active = selected === h;
        return (
          <button
            key={h}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(h)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: "var(--radius-sm)", fontSize: 11.5, fontWeight: 500,
              border: `1px solid ${active ? "var(--color-steel-line)" : "var(--color-outline)"}`,
              background: active ? "var(--color-steel-wash)" : "transparent",
              color: active ? "var(--color-steel-hi)" : "var(--color-faint)",
              cursor: "pointer", fontFamily: "inherit",
              transition: "border-color var(--duration-fast), background var(--duration-fast), color var(--duration-fast)",
            }}
          >
            <img src={meta.logo} width={13} height={13} alt="" style={{ opacity: active ? 1 : 0.5 }} />
            {h === "generic" ? t("mcp.genericAgent") : meta.label}
          </button>
        );
      })}
      {onClear && (
        <Button variant="ghost" icon="close" iconPosition="start" onClick={onClear} style={{ padding: "4px 10px" }}>
          {t("mcp.none")}
        </Button>
      )}
    </div>
  );
}

// ─── Client panels ───────────────────────────────────────────

interface PanelProps {
  copy: (text: string, key: string) => void;
  copied: string | null;
  t: T;
}

function ClaudeCodePanel({ copy, copied, t }: PanelProps) {
  const cmd1 = `claude mcp add --transport http docforge ${MCP_URL} -H "Authorization: Bearer your_api_key_here"`;
  const cmd2 = `claude mcp list`;
  const cmd3 = `claude "${t("mcp.cc.prompt")}"`;
  return (
    <>
      <Step num={1} title={t("mcp.cc.s1")}>
        <CodeBlock text={cmd1} id="cc1" copy={copy} copied={copied} t={t} />
        <Note><RichText text={t("mcp.cc.n1")} /></Note>
      </Step>
      <Step num={2} title={t("mcp.cc.s2")}>
        <CodeBlock text={cmd2} id="cc2" copy={copy} copied={copied} t={t} />
        <Note><RichText text={t("mcp.cc.n2")} /></Note>
      </Step>
      <Step num={3} title={t("mcp.cc.s3")}>
        <CodeBlock text={cmd3} id="cc3" copy={copy} copied={copied} t={t} />
        <Note>{t("mcp.cc.n3")}</Note>
      </Step>
    </>
  );
}

function CodexPanel({ copy, copied, t }: PanelProps) {
  const posixEnv = `export DOCFORGE_API_KEY=your_api_key_here`;
  const powershellEnv = `$env:DOCFORGE_API_KEY = "your_api_key_here"`;
  const cmd1 = `codex mcp add docforge --url ${MCP_URL} --bearer-token-env-var DOCFORGE_API_KEY`;
  const toml = `[mcp_servers.docforge]\nurl = "${MCP_URL}"\nbearer_token_env_var = "DOCFORGE_API_KEY"\ndefault_tools_approval_mode = "prompt"`;
  const verify = `codex mcp get docforge\ncodex mcp list`;
  const smokeTest = `codex "${t("mcp.cx.prompt")}"`;
  return (
    <>
      <Step num={1} title={t("mcp.cx.s1")}>
        <Note style={{ marginBottom: 8 }}>{t("mcp.cx.posix")}</Note>
        <CodeBlock text={posixEnv} id="cx-env-posix" copy={copy} copied={copied} t={t} />
        <Note style={{ marginBottom: 8 }}>{t("mcp.cx.ps")}</Note>
        <CodeBlock text={powershellEnv} id="cx-env-powershell" copy={copy} copied={copied} t={t} />
        <Note>{t("mcp.cx.n1")}</Note>
      </Step>
      <Step num={2} title={t("mcp.cx.s2")}>
        <CodeBlock text={cmd1} id="cx1" copy={copy} copied={copied} t={t} />
        <Note>{t("mcp.cx.n2")}</Note>
      </Step>
      <Step num={3} title={t("mcp.cx.s3")}>
        <Note style={{ marginBottom: 8 }}><RichText text={t("mcp.cx.n3")} /></Note>
        <CodeBlock text={toml} id="cx2" copy={copy} copied={copied} t={t} toml />
      </Step>
      <Step num={4} title={t("mcp.cx.s4")}>
        <CodeBlock text={verify} id="cx3" copy={copy} copied={copied} t={t} />
        <Note>{t("mcp.cx.n4")}</Note>
      </Step>
      <Step num={5} title={t("mcp.cx.s5")}>
        <CodeBlock text={smokeTest} id="cx4" copy={copy} copied={copied} t={t} />
        <Note><RichText text={t("mcp.cx.n5")} /></Note>
      </Step>
    </>
  );
}

function CursorPanel({ copy, copied, t }: PanelProps) {
  const json = `{\n  "mcpServers": {\n    "docforge": {\n      "url": "${MCP_URL}",\n      "headers": {\n        "Authorization": "Bearer \${env:DOCFORGE_API_KEY}"\n      }\n    }\n  }\n}`;
  const cmd2 = `export DOCFORGE_API_KEY=your_api_key_here`;
  return (
    <>
      <Step num={1} title={t("mcp.cu.s1")}>
        <Note style={{ marginBottom: 8 }}><RichText text={t("mcp.cu.n1")} /></Note>
        <CodeBlock text={json} id="cu1" copy={copy} copied={copied} t={t} />
      </Step>
      <Step num={2} title={t("mcp.cx.s1")}>
        <CodeBlock text={cmd2} id="cu2" copy={copy} copied={copied} t={t} />
        <Note>{t("mcp.cu.n2")}</Note>
      </Step>
      <Step num={3} title={t("mcp.cu.s3")}>
        <Note><RichText text={t("mcp.cu.n3")} /></Note>
      </Step>
    </>
  );
}

function GenericPanel({ copy, copied, t }: PanelProps) {
  const url = MCP_URL;
  const auth = `Authorization: Bearer your_api_key_here`;
  const transport = `# Streamable HTTP\nurl = "${MCP_URL}"`;
  return (
    <>
      <Step num={1} title={t("mcp.gn.s1")}>
        <CodeBlock text={url} id="gn1" copy={copy} copied={copied} t={t} />
        <Note>{t("mcp.gn.n1")}</Note>
      </Step>
      <Step num={2} title={t("mcp.gn.s2")}>
        <CodeBlock text={auth} id="gn2" copy={copy} copied={copied} t={t} />
        <Note><RichText text={t("mcp.gn.n2")} /></Note>
      </Step>
      <Step num={3} title={t("mcp.gn.s3")}>
        <Note style={{ marginBottom: 8 }}><RichText text={t("mcp.gn.n3")} /></Note>
        <CodeBlock text={transport} id="gn3" copy={copy} copied={copied} t={t} comment />
      </Step>
      <hr style={{ border: "none", borderTop: "1px solid var(--color-outline)", margin: "20px 0" }} />
      <Note><RichText text={t("mcp.gn.help")} /></Note>
    </>
  );
}

// ─── Capabilities ────────────────────────────────────────────

const TOOL_NAMES = [
  "get_user_info", "list_documents", "create_document", "get_document", "get_section",
  "write_section", "append_section", "patch_section", "check_suggestions", "get_pending_feedback",
  "reply_feedback", "resolve_feedback", "snapshot_section", "list_versions", "get_version_content", "select_active_version",
  "rename_version", "get_activity", "get_document_url", "get_quality_gate", "submit_quality_findings",
  "list_artifacts", "create_artifact",
];

const RESOURCES: { uri: string; key: string }[] = [
  { uri: "docforge://documents", key: "documents" },
  { uri: "docforge://document/{id}", key: "document" },
  { uri: "docforge://document/{id}/versions", key: "versions" },
  { uri: "docforge://guide/system-prompt", key: "guide" },
  { uri: "docforge://recipes", key: "recipes" },
  { uri: "docforge://recipes/{slug}", key: "recipe" },
];

function CapabilitiesCard({ t }: { t: T }) {
  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14, rowGap: 7, alignItems: "baseline", justifyItems: "start", fontSize: 12.5 };
  const desc: React.CSSProperties = { fontSize: 12.5, color: "var(--color-dim)", lineHeight: 1.45 };
  return (
    <div style={cardStyle}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-outline)" }}>
        <Eyebrow style={{ marginBottom: 12 }}>{t("mcp.tools")}</Eyebrow>
        <div style={grid}>
          {TOOL_NAMES.map((name) => (
            <React.Fragment key={name}>
              <InlineCode>{name}</InlineCode>
              <span style={desc}>{t(`mcp.tool.${name}`)}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--color-outline)" }}>
        <Eyebrow style={{ marginBottom: 12 }}>{t("mcp.resources")}</Eyebrow>
        <div style={grid}>
          {RESOURCES.map(({ uri, key }) => (
            <React.Fragment key={uri}>
              <InlineCode>{uri}</InlineCode>
              <span style={desc}>{t(`mcp.res.${key}`)}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        <Eyebrow style={{ marginBottom: 12 }}>{t("mcp.prompts")}</Eyebrow>
        <div style={{ ...grid, marginBottom: 12 }}>
          <InlineCode>docforge_orientation</InlineCode>
          <span style={desc}>{t("mcp.promptDesc")}</span>
        </div>
        <Callout><RichText text={t("mcp.promptNote")} /></Callout>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 14px" }}>{children}</h2>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex", gap: 8, alignItems: "flex-start",
        background: "var(--color-hover)", border: "1px solid var(--color-outline)",
        borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 20,
        fontSize: 12.5, color: "var(--color-dim)", lineHeight: 1.55,
      }}
    >
      <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, flexShrink: 0, marginTop: 1, color: "var(--color-steel)" }}>info</span>
      <span>{children}</span>
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span
          className="df-mono"
          style={{
            width: 20, height: 20, borderRadius: "var(--radius-pill)",
            background: "var(--color-hover)", border: "1px solid var(--color-outline-md)",
            fontSize: 10, fontWeight: 600, color: "var(--color-dim)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          {num}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}>{title}</span>
      </div>
      <div style={{ paddingLeft: 30 }}>{children}</div>
    </div>
  );
}

interface CodeBlockProps {
  text: string;
  id: string;
  copy: (t: string, k: string) => void;
  copied: string | null;
  t: T;
  toml?: boolean;
  comment?: boolean;
}

function CodeBlock({ text, id, copy, copied, t, toml, comment }: CodeBlockProps) {
  const isCopied = copied === id;

  const renderContent = () => {
    if (toml) {
      return text.split("\n").map((line, i) => {
        const sectionMatch = line.match(/^\[(.+)\]$/);
        const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
        if (sectionMatch) return <span key={i} style={{ color: "var(--color-heat-hi)" }}>{line}{"\n"}</span>;
        if (kvMatch) {
          return (
            <span key={i}>
              <span style={{ color: "var(--color-heat-soft)" }}>{kvMatch[1]}</span>
              <span style={{ color: "var(--color-dim)" }}> = </span>
              <span style={{ color: "var(--color-steel)" }}>{kvMatch[2]}</span>
              {"\n"}
            </span>
          );
        }
        return <span key={i}>{line}{"\n"}</span>;
      });
    }
    if (comment) {
      return text.split("\n").map((line, i) => (
        <span key={i} style={{ color: line.startsWith("#") ? "var(--color-faint)" : "var(--color-steel-hi)" }}>
          {line}{"\n"}
        </span>
      ));
    }
    return text;
  };

  // The code scrolls on its own; the copy button sits beside it, never on top.
  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 8,
        padding: "6px 6px 6px 14px", marginBottom: 6,
        background: "var(--color-sink)", border: "1px solid var(--color-outline)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <pre
        className="df-mono df-scroll-thin"
        style={{
          flex: 1, minWidth: 0, margin: 0, padding: "6px 0",
          overflowX: "auto", whiteSpace: "pre",
          fontSize: 12.5, lineHeight: 1.6, color: "var(--color-steel-hi)",
        }}
      >
        {renderContent()}
      </pre>
      <Button
        variant="ghost"
        icon={isCopied ? "check" : "content_copy"}
        iconPosition="start"
        onClick={() => copy(text, id)}
        style={{ flexShrink: 0, padding: "6px 9px" }}
      >
        {isCopied ? t("mcp.copied") : t("common.copy")}
      </Button>
    </div>
  );
}

function Note({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ fontSize: 12.5, color: "var(--color-dim)", lineHeight: 1.55, margin: 0, ...style }}>{children}</p>;
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "16px 20px", fontSize: 12.5, color: "var(--color-faint)", lineHeight: 1.5 }}>{children}</div>;
}

// ─── Styles ──────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--color-outline)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface)",
  overflow: "hidden",
};

const headStyle: React.CSSProperties = {
  padding: "14px 20px",
  borderBottom: "1px solid var(--color-outline)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
