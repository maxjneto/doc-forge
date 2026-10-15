import { MCP_URL } from "@/utils/mcpUrl";


export function McpStepBlocks() {
  return (
    <section
      id="mcp"
      style={{
        borderTop: "1px solid var(--color-outline)",
        padding: "100px 0",
        position: "relative",
        background: "radial-gradient(ellipse 900px 700px at 80% 0%, var(--color-steel-tint), transparent 70%)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 56px 60px", textAlign: "center" }}>
        <span
          className="df-mono"
          style={{
            fontSize: 11.5,
            letterSpacing: "var(--tracking-eyebrow)",
            textTransform: "uppercase",
            color: "var(--color-heat-hi)",
            fontWeight: 600,
          }}
        >
          Path A · DocForge MCP · connect your agent
        </span>
        <h2 style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.030em", margin: "14px 0 14px" }}>
          Your agent&apos;s document workspace.{" "}
          <em style={{ fontStyle: "normal", color: "var(--color-heat-hi)" }}>You stay in the loop.</em>
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-dim)", lineHeight: 1.6, maxWidth: 620, margin: "0 auto" }}>
          DocForge is your agent's shared document workspace: the agent reads your repository with its own tools,
          sends changes through MCP, and you review or edit the same document in the browser.
        </p>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 56px", display: "flex", flexDirection: "column", gap: 48 }}>
        <StepBlock num="01" title="See it in motion." body='A 30-second look. On the left, Claude Code is editing through MCP. On the right, the same edit lands in DocForge in real-time. You can jump in any time — the agent sees your edits, you see theirs.'>
          <Recording />
        </StepBlock>

        <StepBlock num="02" title="Create a token and connect." body='Open DocForge MCP, generate a named API token, then use the client-specific setup below. The hosted endpoint uses Streamable HTTP.'>
          <InstallGrid />
        </StepBlock>

        <StepBlock num="03" title="Choose the collaboration loop." body="For a free-form document, the agent reads the current body and proposes or applies edits according to the document policy. For a structured document, it can run discovery, alignment, generation and audit step by step — with human approval at the alignment checkpoint.">
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
        border: "1px solid var(--color-outline)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-veil)",
        backdropFilter: "blur(6px)",
        padding: "28px 32px",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "48px 1fr", gap: 18, alignItems: "flex-start", marginBottom: 20 }}>
        <span
          className="df-mono"
          style={{ fontSize: 32, fontWeight: 600, color: "var(--color-steel)", letterSpacing: "-0.03em", lineHeight: 1 }}
        >
          {num}
        </span>
        <div>
          <h3 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{title}</h3>
          <p style={{ fontSize: 14, color: "var(--color-dim)", lineHeight: 1.55, margin: 0, maxWidth: 600 }}>{body}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Recording() {
  return (
    <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--color-sink)" }}>
      {/* Title bar */}
      <div
        style={{
          height: 36,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 8,
          borderBottom: "1px solid var(--color-outline)",
          background: "var(--color-sink)",
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--color-press)" }} />
          ))}
        </div>
        <span className="df-mono" style={{ margin: "0 auto", fontSize: 11.5, color: "var(--color-dim)", letterSpacing: "var(--tracking-data)" }}>
          payments-rfc.md · DocForge editor
        </span>
        <span
          className="df-mono"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            fontSize: 10, padding: "3px 8px", borderRadius: "var(--radius-pill)",
            color: "var(--color-heat-soft)", background: "var(--color-heat-wash)",
            border: "1px solid var(--color-heat-line)", letterSpacing: "var(--tracking-data)",
          }}
        >
          <span className="animate-df-pulse" style={{ width: 4, height: 4, borderRadius: "var(--radius-pill)", background: "var(--color-heat)" }} />
          Agent editing
        </span>
      </div>

      {/* Body: Claude Code terminal (left) + DocForge editor panels (right) */}
      <div style={{ display: "grid", gridTemplateColumns: "38% 62%", minHeight: 320 }}>
        {/* Claude Code terminal */}
        <div style={{ background: "var(--color-bg)", borderRight: "1px solid var(--color-outline)", display: "flex", flexDirection: "column" }}>
          <div
            className="df-mono"
            style={{
              padding: "7px 12px", borderBottom: "1px solid var(--color-outline)",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 10, color: "var(--color-steel-hi)", letterSpacing: "var(--tracking-data)",
            }}
          >
            <span style={{ padding: "2px 8px", border: "1px solid var(--color-outline)", borderRadius: "var(--radius-xs)", background: "var(--color-hover)", fontSize: 10 }}>
              CLAUDE CODE
            </span>
            <span style={{ color: "var(--color-faint)" }}>~/payments-rfc</span>
          </div>
          <div className="df-mono" style={{ padding: 12, flex: 1, fontSize: 11.5, lineHeight: 1.55, color: "var(--color-steel-hi)", overflow: "hidden" }}>
            <Ln color="var(--color-faint)">› user: tighten rollback section</Ln>
            <br />
            <Ln color="var(--color-heat-hi)">› docforge.read_section({"{"}</Ln>
            <Ln color="var(--color-steel-hi)" pad>section: "Implementation"</Ln>
            <Ln color="var(--color-heat-hi)">{"})"}</Ln>
            <Ln color="var(--color-steel)">✓ 482 tokens read</Ln>
            <br />
            <Ln color="var(--color-heat-hi)">› docforge.append_section({"{"}</Ln>
            <Ln color="var(--color-steel-hi)" pad>content: "## Rollback…"</Ln>
            <Ln color="var(--color-heat-hi)">{"})"}</Ln>
            <Ln color="var(--color-steel)">
              ✓ wrote 320 tokens
              <span
                className="animate-df-blink"
                style={{ display: "inline-block", width: 7, height: 12, background: "var(--color-steel)", verticalAlign: -2, marginLeft: 2 }}
              />
            </Ln>
          </div>
        </div>

        {/* DocForge editor: nav panel + center + version sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 88px", background: "var(--color-bg)" }}>
          {/* Nav panel (document outline) */}
          <div style={{ borderRight: "1px solid var(--color-outline)", padding: "10px 0", display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: "var(--color-faint)", textTransform: "uppercase", padding: "0 10px 6px" }}>Outline</span>
            {["Overview", "Implementation", "Rollback path", "Appendix"].map((h, i) => (
              <span
                key={h}
                className="df-mono"
                style={{
                  display: "block", fontSize: 10, padding: "4px 10px", cursor: "default",
                  color: i === 1 ? "var(--color-heat-soft)" : "var(--color-faint)",
                  background: i === 1 ? "var(--color-heat-tint)" : "transparent",
                  borderLeft: i === 1 ? "2px solid var(--color-heat)" : "2px solid transparent",
                  letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Center editor (markdown source) */}
          <div style={{ padding: "12px 14px", overflow: "hidden", display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: "var(--color-faint)", textTransform: "uppercase", marginBottom: 4 }}>Source</div>
            <span className="df-mono" style={{ fontSize: 11.5, color: "var(--color-heat-soft)" }}>## Implementation</span>
            <span style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.5 }}>
              Roll the async buffer behind a feature flag scoped to a single merchant cohort.
            </span>
            <span className="df-mono" style={{ fontSize: 11.5, color: "var(--color-heat-soft)", marginTop: 4 }}>## Rollback path</span>
            <span style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.5 }}>
              A second flag{" "}
              <span className="df-mono" style={{ fontSize: 10, color: "var(--color-heat-hi)", background: "var(--color-heat-wash)", padding: "0 3px", borderRadius: "var(--radius-xs)" }}>revert_async_buffer</span>{" "}
              restores sync confirmation in under 30s.
            </span>
            <span
              className="animate-df-typing"
              style={{ display: "inline-block", height: 10, background: "linear-gradient(90deg, var(--color-heat-strong), var(--color-heat-tint))", borderRadius: "var(--radius-xs)", marginTop: 2 }}
            />
          </div>

          {/* Version sidebar */}
          <div style={{ borderLeft: "1px solid var(--color-outline)", padding: "10px 0", display: "flex", flexDirection: "column", gap: 0 }}>
            <span className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: "var(--color-faint)", textTransform: "uppercase", padding: "0 8px 6px" }}>Versions</span>
            {[
              { label: "Agent write", time: "just now", agent: true },
              { label: "Auto-save", time: "2m ago", agent: false },
              { label: "Auto-save", time: "9m ago", agent: false },
            ].map((v, i) => (
              <div
                key={i}
                style={{
                  padding: "6px 8px",
                  borderTop: i === 0 ? "none" : "1px solid var(--color-outline)",
                  background: i === 0 ? "var(--color-heat-tint)" : "transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {v.agent && <span className="animate-df-pulse" style={{ width: 5, height: 5, borderRadius: "var(--radius-pill)", background: "var(--color-heat)", flexShrink: 0 }} />}
                  <span className="df-mono" style={{ fontSize: 10, color: v.agent ? "var(--color-heat-soft)" : "var(--color-dim)", letterSpacing: "var(--tracking-data)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.label}</span>
                </div>
                <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-data)", display: "block", marginTop: 2 }}>{v.time}</span>
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
    { id: "CC", name: "Claude Code", desc: "HTTP · CLI setup" },
    { id: "CD", name: "Claude Desktop", desc: "HTTP · server URL" },
    { id: "Cu", name: "Cursor", desc: "HTTP · JSON config" },
    { id: "Cx", name: "Codex", desc: "HTTP · env token" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      {agents.map((a) => (
        <div
          key={a.id}
          style={{
            border: "1px solid var(--color-outline)",
            borderRadius: "var(--radius-md)",
            background: "var(--color-sink)",
            padding: "16px 18px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            className="df-mono"
            style={{
              width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0,
              background: "var(--color-steel-wash)",
              border: "1px solid var(--color-steel-line)",
              display: "grid", placeItems: "center",
              color: "var(--color-steel-hi)", fontSize: 12.5, fontWeight: 700,
            }}
          >
            {a.id}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>{a.name}</div>
            <div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-data)", marginTop: 3 }}>{a.desc}</div>
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
    <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--color-bg)" }}>
      <div
        style={{
          height: 34,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 8,
          borderBottom: "1px solid var(--color-outline)",
          background: "var(--color-hover)",
        }}
      >
        <span className="df-mono" style={{ fontSize: 10, color: "var(--color-steel-hi)", letterSpacing: "var(--tracking-data)" }}>{file}</span>
        <span
          className="df-mono"
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            color: "var(--color-steel-hi)",
            padding: "4px 10px",
            border: "1px solid var(--color-outline)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-hover)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>content_copy</span>
          Copy
        </span>
      </div>
      <div
        className="df-mono"
        style={{ padding: "16px 18px", fontSize: 12.5, lineHeight: 1.65, color: "var(--color-steel-hi)" }}
      >
        {body}
      </div>
    </div>
  );
}

function TerminalSnippet() {
  return (
    <>
      <span style={{ color: "var(--color-faint)" }}># Add DocForge to Claude Code in one shot</span>
      <br />
      <span style={{ color: "var(--color-heat-hi)" }}>$</span> claude mcp add{" "}
      <span style={{ color: "var(--color-heat-soft)" }}>docforge</span> \
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;--server-url <span style={{ color: "var(--color-steel)" }}>{MCP_URL}</span> \
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;--auth-token <span style={{ color: "var(--color-steel)" }}>$DOCFORGE_TOKEN</span>
      <br />
      <br />
      <span style={{ color: "var(--color-steel)" }}>✓</span> authenticated as you
      <br />
      <span style={{ color: "var(--color-steel)" }}>✓</span> 5 documents in your workspace
      <br />
      <span style={{ color: "var(--color-steel)" }}>✓</span> docforge ready · 4 tools registered
    </>
  );
}

function JsonSnippet() {
  return (
    <>
      <span style={{ color: "var(--color-faint)" }}>// Paste into your MCP-capable client's config</span>
      <br />
      {"{"}
      <br />
      &nbsp;&nbsp;<span style={{ color: "var(--color-heat-soft)" }}>"mcpServers"</span>: {"{"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--color-heat-soft)" }}>"docforge"</span>: {"{"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--color-heat-soft)" }}>"command"</span>:{" "}
      <span style={{ color: "var(--color-steel)" }}>"npx"</span>,
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--color-heat-soft)" }}>"args"</span>: [
      <span style={{ color: "var(--color-steel)" }}>"-y"</span>,{" "}
      <span style={{ color: "var(--color-steel)" }}>"@docforge/mcp"</span>],
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--color-heat-soft)" }}>"env"</span>: {"{"}
      <br />
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: "var(--color-heat-soft)" }}>"DOCFORGE_TOKEN"</span>:{" "}
      <span style={{ color: "var(--color-steel)" }}>"df_…"</span>
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
    <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", background: "var(--color-sink)", overflow: "hidden" }}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-outline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          className="df-mono"
          style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: "var(--color-faint)", textTransform: "uppercase" }}
        >
          › Connection checklist
        </span>
        <span className="df-mono" style={{ fontSize: 11.5, color: "var(--color-heat-hi)" }}>3 / 6</span>
      </div>
      <ChItem state="done" label="Generate your DocForge API token" desc="DocForge MCP → API tokens → Generate · copy it once." />
      <ChItem state="done" label={<>Run <code className="df-mono" style={{ fontSize: 11.5 }}>claude mcp add docforge</code></>} desc="Or paste the config snippet into your client." />
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
  const icoBg = state === "done" ? "var(--color-heat-line)" : state === "now" ? "var(--color-heat)" : "transparent";
  const icoBorder = state === "future" ? "1px solid var(--color-mute)" : "none";
  const icoColor = state === "future" ? "var(--color-mute)" : state === "done" ? "var(--color-bg)" : "var(--color-on-heat)";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        gap: 10,
        padding: "11px 16px",
        borderTop: "1px solid var(--color-outline)",
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
          fontSize: 11.5,
          boxShadow: state === "now" ? "0 0 0 3px var(--color-heat-strong)" : "none",
        }}
      >
        {state === "done" && <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check</span>}
        {state === "now" && (
          <span className="material-symbols-outlined animate-df-pulse" style={{ fontSize: 11 }}>autorenew</span>
        )}
        {state === "future" && num}
      </div>
      <div>
        <div style={{ fontSize: 12.5, color: state === "future" ? "var(--color-faint)" : "var(--color-text)" }}>{label}</div>
        <div style={{ fontSize: 11.5, color: "var(--color-dim)", lineHeight: 1.45, marginTop: 2 }}>{desc}</div>
      </div>
    </div>
  );
}

