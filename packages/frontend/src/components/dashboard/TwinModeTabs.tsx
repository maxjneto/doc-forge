export type TwinMode = "all" | "guided" | "pipeline" | "editor";

export function TwinModeTabs({
  value,
  onChange,
  counts,
}: {
  value: TwinMode;
  onChange: (next: TwinMode) => void;
  counts: Record<TwinMode, number>;
}) {
  return (
    <div role="tablist" style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
      <Tab active={value === "all"} onClick={() => onChange("all")} icon="apps" label="All" count={counts.all} />
      <Tab active={value === "guided"} onClick={() => onChange("guided")} badge="forger" label="Guided" count={counts.guided} />
      <Tab active={value === "pipeline"} onClick={() => onChange("pipeline")} badge="mcp" label="Agent pipeline" count={counts.pipeline} />
      <Tab active={value === "editor"} onClick={() => onChange("editor")} icon="edit_note" label="Editor" count={counts.editor} />
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        color: active ? "var(--df-text)" : "var(--df-dim)",
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
