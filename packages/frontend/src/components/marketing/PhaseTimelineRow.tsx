const PHASES = [
  { num: "01", name: "Discovery", desc: "Targeted follow-up questions per section" },
  { num: "02", name: "Alignment", desc: "Approve the section structure first" },
  { num: "03", name: "Generation", desc: "Sequential pour with shared context" },
  { num: "04", name: "Refinement", desc: "Section-scoped chat with version history" },
  { num: "05", name: "Audit", desc: "Cross-section consistency check" },
  { num: "06", name: "Completed", desc: "Export Markdown, PDF, or push to repo" },
];

export function PhaseTimelineRow({ activeIndex = 2 }: { activeIndex?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        border: "1px solid var(--color-outline)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-veil)",
        padding: 8,
        overflow: "hidden",
      }}
    >
      {PHASES.map((p, i) => {
        const isDone = i < activeIndex;
        const isNow = i === activeIndex;
        const numColor = isNow ? "var(--color-heat)" : isDone ? "var(--color-heat-line)" : "var(--color-mute)";
        const nameColor = isNow ? "var(--color-text)" : isDone ? "var(--color-dim)" : "var(--color-dim)";
        return (
          <div
            key={p.num}
            style={{
              flex: 1,
              padding: "18px 14px",
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              textAlign: "center",
              position: "relative",
              borderLeft: i > 0 ? "1px solid var(--color-outline)" : "none",
            }}
          >
            <span
              className="df-mono"
              style={{ fontSize: 11.5, color: numColor, letterSpacing: "var(--tracking-label)", fontWeight: 600 }}
            >
              {p.num}
            </span>
            <span
              className={isNow ? "animate-df-pulse" : undefined}
              style={{
                width: 6,
                height: 6,
                borderRadius: "var(--radius-pill)",
                background: isNow
                  ? "var(--color-heat)"
                  : isDone
                  ? "var(--color-heat-line)"
                  : "var(--color-mute)",
                boxShadow: isNow
                  ? "0 0 0 3px var(--color-heat-strong), 0 0 10px var(--color-heat-line)"
                  : "none",
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: nameColor }}>{p.name}</span>
            <span style={{ fontSize: 11.5, color: "var(--color-faint)", marginTop: 4, lineHeight: 1.4, maxWidth: 120 }}>
              {p.desc}
            </span>
          </div>
        );
      })}
    </div>
  );
}
