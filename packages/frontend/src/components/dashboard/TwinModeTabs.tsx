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
        borderRadius: "var(--radius-md)",
        fontSize: 13,
        fontWeight: 500,
        color: active ? "var(--color-text)" : "var(--color-dim)",
        background: active ? "var(--color-heat-tint)" : "transparent",
        border: `1px solid ${active ? "var(--color-heat-strong)" : "transparent"}`,
        cursor: "pointer",
        transition: "all 0.15s",
        fontFamily: "inherit",
      }}
    >
      {icon && (
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-faint)" }}>{icon}</span>
      )}
      {badge && <Badge kind={badge} />}
      {label}
      <span
        className="df-mono"
        style={{
          fontSize: 11.5,
          fontWeight: 600,
          padding: "2px 7px",
          borderRadius: "var(--radius-pill)",
          background: active ? "var(--color-heat-strong)" : "var(--color-hover)",
          color: active ? "var(--color-heat-soft)" : "var(--color-faint)",
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
      ? "linear-gradient(135deg, var(--color-heat), var(--color-heat-deep))"
      : "linear-gradient(135deg, var(--color-steel), color-mix(in srgb, var(--color-steel) 30%, var(--color-bg)))";
  const shadow =
    kind === "forger" ? "0 0 8px var(--color-heat-line)" : "0 0 8px var(--color-steel-line)";
  return (
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: "var(--radius-xs)",
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
          background: "var(--color-on-heat)",
          clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
        }}
      />
    </span>
  );
}
