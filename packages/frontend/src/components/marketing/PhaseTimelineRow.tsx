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
        border: "1px solid var(--df-outline)",
        borderRadius: 14,
        background: "rgba(14,16,17,0.5)",
        padding: 8,
        overflow: "hidden",
      }}
    >
      {PHASES.map((p, i) => {
        const isDone = i < activeIndex;
        const isNow = i === activeIndex;
        const numColor = isNow ? "var(--df-amber-500)" : isDone ? "var(--df-amber-trail)" : "var(--df-mute)";
        const nameColor = isNow ? "#e3e2e2" : isDone ? "var(--df-on-soft, #c6c5c4)" : "var(--df-dim)";
        return (
          <div
            key={p.num}
            style={{
              flex: 1,
              padding: "18px 14px",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              textAlign: "center",
              position: "relative",
              borderLeft: i > 0 ? "1px solid var(--df-outline)" : "none",
            }}
          >
            <span
              className="df-mono"
              style={{ fontSize: 11, color: numColor, letterSpacing: "0.12em", fontWeight: 600 }}
            >
              {p.num}
            </span>
            <span
              className={isNow ? "animate-df-pulse" : undefined}
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: isNow
                  ? "var(--df-amber-500)"
                  : isDone
                  ? "var(--df-amber-trail)"
                  : "var(--df-mute)",
                boxShadow: isNow
                  ? "0 0 0 3px rgba(255,77,0,0.16), 0 0 10px rgba(255,77,0,0.55)"
                  : "none",
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 500, color: nameColor }}>{p.name}</span>
            <span style={{ fontSize: 11, color: "var(--df-faint)", marginTop: 4, lineHeight: 1.4, maxWidth: 120 }}>
              {p.desc}
            </span>
          </div>
        );
      })}
    </div>
  );
}
