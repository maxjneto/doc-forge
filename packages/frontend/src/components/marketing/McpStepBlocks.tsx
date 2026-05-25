
export function McpStepBlocks() {
  return (
    <section
      id="mcp"
      style={{
        borderTop: "1px solid var(--df-outline)",
        padding: "100px 0",
        position: "relative",
        background: "radial-gradient(ellipse 900px 700px at 80% 0%, rgba(138,160,184,0.05), transparent 70%)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 56px 60px", textAlign: "center" }}>
        <span
          className="df-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--df-steel-100)",
            fontWeight: 600,
          }}
        >
          Path B · DocForge MCP
        </span>
        <h2 style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.030em", margin: "14px 0 14px" }}>
          Or skip the phases.{" "}
          <em style={{ fontStyle: "normal", color: "var(--df-steel-100)" }}>Let your agent drive.</em>
        </h2>
        <p style={{ fontSize: 15.5, color: "var(--df-dim)", lineHeight: 1.6, maxWidth: 620, margin: "0 auto" }}>
          DocForge is your IDE agent's document workspace — the shared, version-controlled surface where your agent can
          write, you can edit, and you can both see what the other just did.
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 56px", display: "flex", flexDirection: "column", gap: 48 }}>
        <StepBlock num="01" title="See it in motion." body='A 30-second look. On the left, Claude Code is editing through MCP. On the right, the same edit lands in DocForge in real-time. You can jump in any time — the agent sees your edits, you see theirs.'>
          <Recording />
        </StepBlock>

        <StepBlock num="02" title="Connect in 30 seconds." body='One command for Claude Code or Claude Desktop. For others, paste your generated MCP config block. We&apos;ll guide you through the rest with a connection checklist.'>
          <InstallGrid />
        </StepBlock>

        <StepBlock num="03" title="Connect multiple agents at once." body="DocForge keeps a separate token per client — connect Claude Code, Claude Desktop, Cursor, and Codex simultaneously. Each agent sees the current document state and any edits made since the last sync.">
          <MultiAgentGrid />
        </StepBlock>
      </div>
    </section>
  );
}

function StepBlock({
  num,
  title,
  body,
  children,
}: {
  num: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--df-outline)",
        borderRadius: 16,
        background: "rgba(14,16,17,0.55)",
        backdropFilter: "blur(6px)",
        padding: "28px 32px",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 18, alignItems: "flex-start", marginBottom: 20 }}>
        <span
          className="df-mono"
          style={{ fontSize: 32, fontWeight: 600, color: "var(--df-steel-200)", letterSpacing: "-0.03em", lineHeight: 1 }}
        >
          {num}
        </span>
        <div>
          <h3 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{title}</h3>
          <p style={{ fontSize: 14, color: "var(--df-dim)", lineHeight: 1.55, margin: 0, maxWidth: 600 }}>{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Recording() {
  return (
    <div style={{ border: "1px solid var(--df-outline)", borderRadius: 10, overflow: "hidden", background: "rgba(0,0,0,0.3)" }}>
      {/* Title bar */}
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 8,
          borderBottom: "1px solid var(--df-outline)",
          background: "rgba(0,0,0,0.30)",
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          ))}
        </div>
        <span className="df-mono" style={{ margin: "0 auto", fontSize: 10.5, color: "var(--df-dim)", letterSpacing: "0.06em" }}>
          payments-rfc.md · DocForge editor
        </span>
        <span
          className="df-mono"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 9, padding: "3px 8px", borderRadius: 999,
            color: "var(--df-amber-200)", background: "rgba(255,77,0,0.10)",
            border: "1px solid rgba(255,77,0,0.30)", letterSpacing: "0.06em",
          }}
        >
          <span className="animate-df-pulse" style={{ width: 4, height: 4, borderRadius: 999, background: "var(--df-amber-500)" }} />
          Agent editing
        </span>
      </div>

      {/* Body: Claude Code terminal (left) + DocForge editor panels (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%", minHeight: 320 }}>
        {/* Claude Code terminal */}
        <div style={{ background: "#0a0b0c", borderRight: "1px solid var(--df-outline)", display: "flex", flexDirection: "column" }}>
          <div
            className="df-mono"
            style={{
              padding: "7px 12px", borderBottom: "1px solid var(--df-outline)",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 10, color: "var(--df-steel-100)", letterSpacing: "0.04em",
            }}
          >
            <span style={{ padding: "2px 8px", border: "1px solid var(--df-outline)", borderRadius: 3, background: "rgba(255,255,255,0.04)", fontSize: 9 }}>
              CLAUDE CODE
            </span>
            <span style={{ color: "var(--df-faint)" }}>~/payments-rfc</span>
          </div>
          <div className="df-mono" style={{ padding: 12, flex: 1, fontSize: 10.5, lineHeight: 1.55, color: "var(--df-steel-100)", overflow: "hidden" }}>
            <Ln color="var(--df-faint)">› user: tighten rollback section</Ln>
            <br />
            <Ln color="var(--df-amber-300)">› docforge.read_section({"{"}</Ln>
            <Ln color="var(--df-steel-100)" pad>section: "Implementation"</Ln>
            <Ln color="var(--df-amber-300)">{"})"}</Ln>
            <Ln color="var(--df-steel-200)">✓ 482 tokens read</Ln>
            <br />
            <Ln color="var(--df-amber-300)">› docforge.append_section({"{"}</Ln>
            <Ln color="var(--df-steel-100)" pad>content: "## Rollback…"</Ln>
            <Ln color="var(--df-amber-300)">{"})"}</Ln>
            <Ln color="var(--df-steel-200)">
              ✓ wrote 320 tokens
              <span
                className="animate-df-blink"
                style={{ display: "inline-block", width: 7, height: 12, background: "var(--df-steel-200)", verticalAlign: -2, marginLeft: 2 }}
              />
            </Ln>
          </div>
        </div>

        {/* DocForge editor: nav panel + center + version sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 88px", background: "#0d0e10" }}>
          {/* Nav panel (document outline) */}
          <div style={{ borderRight: "1px solid var(--df-outline)", padding: "10px 0", display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="df-mono" style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "var(--df-faint)", textTransform: "uppercase", padding: "0 10px 6px" }}>Outline</span>
            {["Overview", "Implementation", "Rollback path", "Appendix"].map((h, i) => (
              <span
                key={h}
                className="df-mono"
                style={{
                  display: "block", fontSize: 10, padding: "4px 10px", cursor: "default",
                  color: i === 1 ? "var(--df-amber-200)" : "var(--df-faint)",
                  background: i === 1 ? "rgba(255,77,0,0.06)" : "transparent",
                  borderLeft: i === 1 ? "2px solid var(--df-amber-500)" : "2px solid transparent",
                  letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Center editor (markdown source) */}
          <div style={{ padding: "12px 14px", overflow: "hidden", display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="df-mono" style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "var(--df-faint)", textTransform: "uppercase", marginBottom: 4 }}>Source</div>
            <span className="df-mono" style={{ fontSize: 11, color: "var(--df-amber-200)" }}>## Implementation</span>
            <span style={{ fontSize: 11, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.5 }}>
              Roll the async buffer behind a feature flag scoped to a single merchant cohort.
            </span>
            <span className="df-mono" style={{ fontSize: 11, color: "var(--df-amber-200)", marginTop: 4 }}>## Rollback path</span>
            <span style={{ fontSize: 11, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.5 }}>
              A second flag{" "}
              <span className="df-mono" style={{ fontSize: 10, color: "var(--df-amber-300)", background: "rgba(255,77,0,0.08)", padding: "0 3px", borderRadius: 2 }}>revert_async_buffer</span>{" "}
              restores sync confirmation in under 30s.
            </span>
            <span
              className="animate-df-typing"
              style={{ display: "inline-block", height: 10, background: "linear-gradient(90deg, rgba(255,77,0,0.25), rgba(255,77,0,0.04))", borderRadius: 2, marginTop: 2 }}
            />
          </div>

          {/* Version sidebar */}
          <div style={{ borderLeft: "1px solid var(--df-outline)", padding: "10px 0", display: "flex", flexDirection: "column", gap: 0 }}>
            <span className="df-mono" style={{ fontSize: 8.5, letterSpacing: "0.14em", color: "var(--df-faint)", textTransform: "uppercase", padding: "0 8px 6px" }}>Versions</span>
            {[
              { label: "Agent write", time: "just now", agent: true },
              { label: "Auto-save", time: "2m ago", agent: false },
              { label: "Auto-save", time: "9m ago", agent: false },
            ].map((v, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 8px",
                  borderTop: i === 0 ? "none" : "1px solid var(--df-outline)",
                  background: i === 0 ? "rgba(255,77,0,0.05)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {v.agent && <span className="animate-df-pulse" style={{ width: 5, height: 5, borderRadius: 999, background: "var(--df-amber-500)", flexShrink: 0 }} />}
                  <span className="df-mono" style={{ fontSize: 9, color: v.agent ? "var(--df-amber-200)" : "var(--df-dim)", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.label}</span>
                </div>
                <span className="df-mono" style={{ fontSize: 8.5, color: "var(--df-faint)", letterSpacing: "0.04em", display: "block", marginTop: 2 }}>{v.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MultiAgentGrid() {
  const agents = [
    { id: "CC", name: "Claude Code", desc: "stdio · one-command install" },
    { id: "CD", name: "Claude Desktop", desc: "stdio · json config" },
    { id: "Cu", name: "Cursor", desc: "stdio · json config" },
    { id: "Cx", name: "Codex", desc: "stdio · env token" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {agents.map((a) => (
        <div
          key={a.id}
          style={{
            border: "1px solid var(--df-outline)",
            borderRadius: 10,
            background: "rgba(0,0,0,0.20)",
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            className="df-mono"
            style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: "rgba(138,160,184,0.10)",
              border: "1px solid var(--df-steel-border)",
              display: "grid", placeItems: "center",
              color: "var(--df-steel-100)", fontSize: 12, fontWeight: 700,
            }}
          >
            {a.id}
          </span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: "#e3e2e2" }}>{a.name}</div>
            <div className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)", letterSpacing: "0.06em", marginTop: 3 }}>{a.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Ln({ color, pad, children }: { color: string; pad?: boolean; children: React.ReactNode }) {
  return (
    <span style={{ display: "block", whiteSpace: "nowrap", color, paddingLeft: pad ? 10 : 0 }}>{children}</span>
  );
}

function InstallGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.8fr)", gap: 24, alignItems: "flex-start" }}>
      <div>
        <Snippet file="claude code · terminal" body={<TerminalSnippet />} />
        <div style={{ height: 14 }} />
        <Snippet file="mcp config · claude desktop / cursor / codex" body={<JsonSnippet />} />
      </div>
      <Checklist />
    </div>
  );
}

function Snippet({ file, body }: { file: string; body: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--df-outline)", borderRadius: 10, overflow: "hidden", background: "#0a0b0c" }}>
      <div
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 8,
          borderBottom: "1px solid var(--df-outline)",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <span className="df-mono" style={{ fontSize: 10, color: "var(--df-steel-100)", letterSpacing: "0.04em" }}>{file}</span>
        <span
          className="df-mono"
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            color: "var(--df-steel-100)",
            padding: "4px 10px",
            border: "1px solid var(--df-outline)",
            borderRadius: 5,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>
          Copy
        </span>
      </div>
      <div
        className="df-mono"
        style={{ padding: "16px 18px", fontSize: 12.5, lineHeight: 1.65, color: "var(--df-steel-100)" }}
      >
        {body}
      </div>
    </div>
  );
}

function TerminalSnippet() {
  return (
    <>
      <span style={{ color: "var(--df-faint)" }}># Add DocForge to Claude Code in one shot</span>
      <br />
      <span style={{ color: "var(--df-amber-300)" }}>$</span> claude mcp add{" "}
      <span style={{ color: "var(--df-amber-200)" }}>docforge</span> \
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;--server-url <span style={{ color: "var(--df-steel-200)" }}>https://mcp.doc-forge.dev</span> \
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;--auth-token <span style={{ color: "var(--df-steel-200)" }}>$DOCFORGE_TOKEN</span>
      <br />
      <br />
      <span style={{ color: "var(--df-steel-200)" }}>✓</span> authenticated as you
      <br />
      <span style={{ color: "var(--df-steel-200)" }}>✓</span> 5 documents in your workspace
      <br />
      <span style={{ color: "var(--df-steel-200)" }}>✓</span> docforge ready · 4 tools registered
    </>
  );
}

function JsonSnippet() {
  return (
    <>
      <span style={{ color: "var(--df-faint)" }}>// Paste into your MCP-capable client's config</span>
      <br />
      {"{"}
      <br />
      &nbsp;&nbsp;<span style={{ color: "var(--df-amber-200)" }}>"mcpServers"</span>: {"{"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--df-amber-200)" }}>"docforge"</span>: {"{"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--df-amber-200)" }}>"command"</span>:{" "}
      <span style={{ color: "var(--df-steel-200)" }}>"npx"</span>,
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--df-amber-200)" }}>"args"</span>: [
      <span style={{ color: "var(--df-steel-200)" }}>"-y"</span>,{" "}
      <span style={{ color: "var(--df-steel-200)" }}>"@docforge/mcp"</span>],
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--df-amber-200)" }}>"env"</span>: {"{"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--df-amber-200)" }}>"DOCFORGE_TOKEN"</span>:{" "}
      <span style={{ color: "var(--df-steel-200)" }}>"df_…"</span>
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{"}"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;{"}"}
      <br />
      &nbsp;&nbsp;{"}"}
      <br />
      {"}"}
    </>
  );
}

function Checklist() {
  return (
    <div style={{ border: "1px solid var(--df-outline)", borderRadius: 10, background: "rgba(0,0,0,0.20)", overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--df-outline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="df-mono"
          style={{ fontSize: 10, letterSpacing: "0.16em", color: "var(--df-faint)", textTransform: "uppercase" }}
        >
          › Connection checklist
        </span>
        <span className="df-mono" style={{ fontSize: 11, color: "var(--df-amber-300)" }}>3 / 6</span>
      </div>
      <ChItem state="done" label="Generate your DocForge token" desc="Settings → MCP → New token · copied to clipboard." />
      <ChItem state="done" label={<>Run <code className="df-mono" style={{ fontSize: 11 }}>claude mcp add docforge</code></>} desc="Or paste the config snippet into your client." />
      <ChItem state="done" label="Restart your agent" desc="Most clients pick up new MCP servers on launch." />
      <ChItem state="now" label="Authorize the workspace" desc="First call from your agent triggers a browser auth prompt." />
      <ChItem state="future" num="4" label="Try a tool call" desc={<>Ask the agent: <em>"List my DocForge documents."</em></>} />
      <ChItem state="future" num="5" label="Open the workspace" desc="Watch your agent's edits land in real-time." />
    </div>
  );
}

function ChItem({
  state,
  num,
  label,
  desc,
}: {
  state: "done" | "now" | "future";
  num?: string;
  label: React.ReactNode;
  desc: React.ReactNode;
}) {
  const icoBg = state === "done" ? "var(--df-amber-trail)" : state === "now" ? "var(--df-amber-500)" : "transparent";
  const icoBorder = state === "future" ? "1px solid var(--df-mute)" : "none";
  const icoColor = state === "future" ? "var(--df-mute)" : state === "done" ? "#050608" : "#fff";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        gap: 10,
        padding: "11px 16px",
        borderTop: "1px solid var(--df-outline)",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          border: icoBorder,
          background: icoBg,
          color: icoColor,
          fontSize: 11,
          boxShadow: state === "now" ? "0 0 0 3px rgba(255,77,0,0.15)" : "none",
        }}
      >
        {state === "done" && <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>}
        {state === "now" && (
          <span className="material-symbols-outlined animate-df-pulse" style={{ fontSize: 11 }}>autorenew</span>
        )}
        {state === "future" && num}
      </div>
      <div>
        <div style={{ fontSize: 12.5, color: state === "future" ? "var(--df-faint)" : "#e3e2e2" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--df-dim)", lineHeight: 1.45, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

