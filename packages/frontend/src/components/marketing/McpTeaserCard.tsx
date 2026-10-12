import { useNavigate } from "react-router-dom";

export function McpTeaserCard() {
  const navigate = useNavigate();

  return (
    <section style={{ maxWidth: 1100, margin: "80px auto 60px", padding: "0 56px" }}>
      <div
        style={{
          border: "1px solid var(--color-outline)",
          borderRadius: "var(--radius-lg)",
          background:
            "radial-gradient(ellipse 400px 200px at 80% 50%, var(--color-steel-wash), transparent 60%), linear-gradient(180deg, var(--color-veil), var(--color-veil))",
          padding: "44px 48px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 48,
          alignItems: "center",
        }}
      >
        <div>
          <span
            className="df-mono"
            style={{ fontSize: 11.5, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-heat-hi)", fontWeight: 600 }}
          >
            Path A · DocForge MCP · the main way in
          </span>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", margin: "14px 0 14px" }}>
            Your agent drives.
            <br />
            <em style={{ fontStyle: "normal", color: "var(--color-heat-hi)" }}>You review every change.</em>
          </h2>
          <p style={{ fontSize: 14, color: "var(--color-dim)", lineHeight: 1.6, margin: "0 0 22px" }}>
            DocForge speaks MCP — the Model Context Protocol that connects Claude Code, Codex, Cursor, and other MCP-capable clients to your documents. Your agent reads and writes through a shared workspace; depending on the document policy, a write is applied directly or becomes a reviewable suggestion. Activity, feedback, versions and optional quality gates stay in DocForge.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/how-it-works#mcp")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--color-steel-hi)",
                padding: "10px 18px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid var(--color-steel-line)",
                background: "var(--color-steel-wash)",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>terminal</span>
              Connect your agent
            </button>
            <button
              onClick={() => navigate("/how-it-works")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--color-dim)",
                padding: "10px 18px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid var(--color-outline-md)",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              How it works
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </button>
          </div>
        </div>

        <Vis />
      </div>
    </section>
  );
}

function Vis() {
  return (
    <div
      style={{
        border: "1px solid var(--color-outline)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--color-sink)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: 240,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          background: "var(--color-bg)",
          borderRight: "1px solid var(--color-outline)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--color-steel-hi)", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-outline-md)" }} />
            ))}
          </div>
          <span>claude code · payments-rfc</span>
        </div>
        <div style={{ color: "var(--color-faint)", fontSize: 11.5, lineHeight: 1.4 }}>
          › docforge.read_section("Implementation")
        </div>
        <div style={{ color: "var(--color-heat-hi)", fontSize: 11.5, lineHeight: 1.4 }}>
          › docforge.append_section({"{"}
        </div>
        <div style={{ color: "var(--color-steel-hi)", fontSize: 11.5, lineHeight: 1.4 }}>
          &nbsp;&nbsp;section: "Implementation",
        </div>
        <div style={{ color: "var(--color-steel-hi)", fontSize: 11.5, lineHeight: 1.4 }}>
          &nbsp;&nbsp;content: "## Rollback path…",
        </div>
        <div style={{ color: "var(--color-heat-hi)", fontSize: 11.5, lineHeight: 1.4 }}>
          {"})"}
        </div>
        <div style={{ color: "var(--color-steel)", fontSize: 11.5, lineHeight: 1.4 }}>
          ✓ wrote 320 tokens
        </div>
        <div style={{ color: "var(--color-faint)", fontSize: 11.5, marginTop: "auto" }}>↳ live in DocForge →</div>
      </div>
      <div
        style={{
          padding: 16,
          background: "linear-gradient(180deg, var(--color-heat-tint), var(--color-sink))",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-heat-hi)",
            letterSpacing: "var(--tracking-label)",
            paddingBottom: 8,
            borderBottom: "1px solid var(--color-outline)",
          }}
        >
          <span>› RFC-0142</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              color: "var(--color-heat-soft)",
              padding: "2px 8px",
              borderRadius: "var(--radius-pill)",
              background: "var(--color-heat-wash)",
              border: "1px solid var(--color-heat-line)",
            }}
          >
            <span
              className="animate-df-pulse"
              style={{ width: 5, height: 5, borderRadius: "var(--radius-pill)", background: "var(--color-heat)" }}
            />
            Claude Code editing
          </span>
        </div>
        <div
          className="df-mono"
          style={{ fontSize: 11.5, color: "var(--color-heat-hi)", marginTop: 6, letterSpacing: "var(--tracking-label)" }}
        >
          › IMPLEMENTATION
        </div>
        <div>
          <Skel width="88%" />
          <Skel width="74%" />
          <Skel width="92%" />
          <Skel width="60%" amber />
        </div>
      </div>
    </div>
  );
}

function Skel({ width, amber }: { width: string; amber?: boolean }) {
  return (
    <span
      className={amber ? "animate-df-typing" : undefined}
      style={{
        display: "block",
        height: 6,
        borderRadius: "var(--radius-xs)",
        background: amber ? "var(--color-heat-line)" : "var(--color-outline)",
        marginBottom: 5,
        width: amber ? undefined : width,
      }}
    />
  );
}
