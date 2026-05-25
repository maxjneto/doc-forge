const AGENTS = [
  { id: "CC", name: "Claude Code" },
  { id: "CD", name: "Claude Desktop" },
  { id: "Cu", name: "Cursor" },
  { id: "Cx", name: "Codex" },
];

export function AgentBadgesStrip() {
  return (
    <section
      style={{
        maxWidth: 1100,
        margin: "0 auto 80px",
        padding: "32px 56px",
        borderTop: "1px solid var(--df-outline)",
        borderBottom: "1px solid var(--df-outline)",
        textAlign: "center",
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--df-faint)",
          marginBottom: 20,
        }}
      >
        Speaks MCP with the tools you already use
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 36, flexWrap: "wrap" }}>
        {AGENTS.map((a) => (
          <span
            key={a.id}
            className="df-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              color: "var(--df-dim)",
              letterSpacing: "0.04em",
            }}
          >
            <span
              className="df-mono"
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                display: "grid",
                placeItems: "center",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--df-outline)",
                fontSize: 9,
                fontWeight: 700,
                color: "var(--df-steel-100)",
              }}
            >
              {a.id}
            </span>
            {a.name}
          </span>
        ))}
      </div>
    </section>
  );
}
