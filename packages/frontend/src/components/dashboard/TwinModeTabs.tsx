export type TwinMode = "all" | "forger" | "mcp";

export function TwinModeTabs({
  value,
  onChange,
  counts,
}: {
  value: TwinMode;
  onChange: (next: TwinMode) => void;
  counts: { all: number; forger: number; mcp: number };
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 18 }}>
      <Tab active={value === "all"} onClick={() => onChange("all")} icon="apps" label="All" count={counts.all} />
      <Tab active={value === "forger"} onClick={() => onChange("forger")} badge="forger" label="Forger" count={counts.forger} />
      <Tab active={value === "mcp"} onClick={() => onChange("mcp")} badge="mcp" label="MCP-managed" count={counts.mcp} />
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  badge,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon?: string;
  badge?: "forger" | "mcp";
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        color: active ? "#e3e2e2" : "var(--df-dim)",
        background: active ? "rgba(255,77,0,0.06)" : "transparent",
        border: `1px solid ${active ? "rgba(255,77,0,0.25)" : "transparent"}`,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "inherit",
      }}
    >
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--df-faint)" }}>{icon}</span>
      )}
      {badge && <Badge kind={badge} />}
      {label}
      <span
        className="df-mono"
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          padding: "2px 7px",
          borderRadius: 999,
          background: active ? "rgba(255,77,0,0.15)" : "rgba(255,255,255,0.05)",
          color: active ? "var(--df-amber-200)" : "var(--df-faint)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function Badge({ kind }: { kind: "forger" | "mcp" }) {
  const bg =
    kind === "forger"
      ? "linear-gradient(135deg, var(--df-amber-500), var(--df-amber-700))"
      : "linear-gradient(135deg, var(--df-steel-200), #2d3a48)";
  const shadow =
    kind === "forger" ? "0 0 8px rgba(255,77,0,0.30)" : "0 0 8px rgba(138,160,184,0.30)";
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: 4,
        display: "grid",
        placeItems: "center",
        background: bg,
        boxShadow: shadow,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          background: "#fff",
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        }}
      />
    </span>
  );
}
