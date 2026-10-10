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
        borderTop: "1px solid var(--color-outline)",
        borderBottom: "1px solid var(--color-outline)",
        textAlign: "center",
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "var(--tracking-eyebrow)",
          textTransform: "uppercase",
          color: "var(--color-faint)",
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
              color: "var(--color-dim)",
              letterSpacing: "var(--tracking-data)",
            }}
          >
            <span
              className="df-mono"
              style={{
                width: 18,
                height: 18,
                borderRadius: "var(--radius-xs)",
                display: "grid",
                placeItems: "center",
                background: "var(--color-hover)",
                border: "1px solid var(--color-outline)",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--color-steel-hi)",
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
