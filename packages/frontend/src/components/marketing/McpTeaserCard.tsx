import { useNavigate } from "react-router-dom";

export function McpTeaserCard() {
  const navigate = useNavigate();

  return (
    <section style={{ maxWidth: 1100, margin: "80px auto 60px", padding: "0 56px" }}>
      <div
        style={{
          border: "1px solid var(--df-outline)",
          borderRadius: 16,
          background:
            "radial-gradient(ellipse 400px 200px at 80% 50%, rgba(138,160,184,0.08), transparent 60%), linear-gradient(180deg, rgba(14,16,17,0.8), rgba(14,16,17,0.4))",
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
            style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--df-steel-100)", fontWeight: 600 }}
          >
            Path B · DocForge MCP
          </span>
          <h2 style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", margin: "14px 0 14px" }}>
            Or skip the phases.
            <br />
            <em style={{ fontStyle: "normal", color: "var(--df-steel-100)" }}>Let your agent drive.</em>
          </h2>
          <p style={{ fontSize: 14.5, color: "var(--df-dim)", lineHeight: 1.6, margin: "0 0 22px" }}>
            DocForge speaks MCP — the Model Context Protocol that connects Claude Code, Cursor, Codex, Zed, Continue, and any other MCP-capable client to your documents. They edit, you watch, you both share version history. No more pasting markdown between tools.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => navigate("/how-it-works#mcp")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "var(--df-steel-100)",
                padding: "10px 18px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid var(--df-steel-border)",
                background: "var(--df-steel-bg)",
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
                color: "var(--df-dim)",
                padding: "10px 18px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                border: "1px solid var(--df-outline-md)",
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
        border: "1px solid var(--df-outline)",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(0,0,0,0.3)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: 240,
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          background: "#0a0b0c",
          borderRight: "1px solid var(--df-outline)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: "var(--df-font-mono)",
          fontSize: 11,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--df-steel-100)", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.10)" }} />
            ))}
          </div>
          <span>claude code · payments-rfc</span>
        </div>
        <div style={{ color: "var(--df-faint)", fontSize: 10.5, lineHeight: 1.4 }}>
          › docforge.read_section("Implementation")
        </div>
        <div style={{ color: "var(--df-amber-300)", fontSize: 10.5, lineHeight: 1.4 }}>
          › docforge.append_section({"{"}
        </div>
        <div style={{ color: "var(--df-steel-100)", fontSize: 10.5, lineHeight: 1.4 }}>
          &nbsp;&nbsp;section: "Implementation",
        </div>
        <div style={{ color: "var(--df-steel-100)", fontSize: 10.5, lineHeight: 1.4 }}>
          &nbsp;&nbsp;content: "## Rollback path…",
        </div>
        <div style={{ color: "var(--df-amber-300)", fontSize: 10.5, lineHeight: 1.4 }}>
          {"})"}
        </div>
        <div style={{ color: "var(--df-steel-200)", fontSize: 10.5, lineHeight: 1.4 }}>
          ✓ wrote 320 tokens
        </div>
        <div style={{ color: "var(--df-faint)", fontSize: 10.5, marginTop: "auto" }}>↳ live in DocForge →</div>
      </div>
      <div
        style={{
          padding: 16,
          background: "linear-gradient(180deg, rgba(255,77,0,0.04), rgba(0,0,0,0.30))",
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
            fontFamily: "var(--df-font-mono)",
            fontSize: 10,
            color: "var(--df-amber-300)",
            letterSpacing: "0.10em",
            paddingBottom: 8,
            borderBottom: "1px solid var(--df-outline)",
          }}
        >
          <span>› RFC-0142</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              color: "var(--df-amber-200)",
              padding: "2px 8px",
              borderRadius: 999,
              background: "rgba(255,77,0,0.10)",
              border: "1px solid rgba(255,77,0,0.30)",
            }}
          >
            <span
              className="animate-df-pulse"
              style={{ width: 5, height: 5, borderRadius: 999, background: "var(--df-amber-500)" }}
            />
            Claude Code editing
          </span>
        </div>
        <div
          className="df-mono"
          style={{ fontSize: 11, color: "var(--df-amber-300)", marginTop: 6, letterSpacing: "0.10em" }}
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
        borderRadius: 2,
        background: amber ? "rgba(255,77,0,0.30)" : "rgba(255,255,255,0.06)",
        marginBottom: 5,
        width: amber ? undefined : width,
      }}
    />
  );
}
