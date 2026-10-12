import { useEffect, useState } from "react";

import { Pill } from "@/components/ui";
export function LiveSectionPourMock() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor(((Date.now() - start) / 1000) % 30)), 250);
    return () => clearInterval(id);
  }, []);
  const secs = elapsed.toString().padStart(2, "0");

  return (
    <section style={{ margin: "64px auto", maxWidth: 1100, padding: "0 56px" }}>
      <div
        style={{
          border: "1px solid var(--color-outline)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-veil)",
          padding: "24px 28px",
          backdropFilter: "blur(10px)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 36,
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span
              className="df-mono"
              style={{ fontSize: 11.5, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-heat-hi)", fontWeight: 600 }}
            >
              Live preview
            </span>
            <Pill tone="heat">Foundry hot</Pill>
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 6px" }}>
            Watch a section pour.
          </h3>
          <p style={{ fontSize: 13, color: "var(--color-dim)", lineHeight: 1.55, margin: 0 }}>
            Every section streams in parallel with its own progress bar — and a molten leading edge that tells you generation is alive, not stuck.
          </p>
        </div>
        <div
          style={{
            border: "1px solid var(--color-outline)",
            borderRadius: "var(--radius-md)",
            padding: 18,
            background:
              "radial-gradient(ellipse 600px 300px at 50% 0%, var(--color-heat-tint), transparent 70%), var(--color-sink)",
          }}
        >
          <Row label="Context" state="complete" />
          <Row label="Proposal" state="complete" />
          <Row label="Implementation" state="live" clock={`0:${secs} / ~0:30`} />
          <Row label="Risks" state="queued" />
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  state,
  clock,
}: {
  label: string;
  state: "complete" | "live" | "queued";
  clock?: string;
}) {
  const isComplete = state === "complete";
  const isLive = state === "live";
  const isQueued = state === "queued";
  const arrColor = isComplete ? "var(--color-heat-line)" : isQueued ? "var(--color-mute)" : "var(--color-heat-hi)";
  const labelColor = isQueued ? "var(--color-faint)" : isComplete ? "var(--color-dim)" : "var(--color-text)";
  const clockColor = isComplete ? "var(--color-heat-line)" : isQueued ? "var(--color-mute)" : "var(--color-heat-hi)";
  const clockText = clock ?? (isComplete ? "forged" : isQueued ? "queued" : "");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr 100px 130px",
        gap: 14,
        alignItems: "center",
        padding: "10px 0",
        borderTop: "1px solid var(--color-outline)",
      }}
    >
      <span className="df-mono" style={{ color: arrColor }}>›</span>
      <span style={{ fontSize: 13, color: labelColor }}>{label}</span>
      <span
        className="df-mono"
        style={{ fontSize: 11.5, color: clockColor, textAlign: "right", letterSpacing: "var(--tracking-data)" }}
      >
        {clockText}
      </span>
      <div
        style={{
          height: 6,
          borderRadius: "var(--radius-pill)",
          background: "var(--color-hover)",
          border: "1px solid var(--color-outline)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className={isLive ? "animate-df-pour-fill" : undefined}
          style={{
            height: "100%",
            borderRadius: "var(--radius-pill)",
            width: isComplete ? "100%" : isLive ? "62%" : 0,
            background: isComplete
              ? "var(--color-heat-line)"
              : "linear-gradient(90deg, var(--color-heat-deep), var(--color-heat) 60%, var(--color-heat-hi))",
            position: "relative",
          }}
        >
          {isLive && (
            <span
              style={{
                content: "''",
                position: "absolute",
                right: -2,
                top: -2,
                bottom: -2,
                width: 16,
                background: "linear-gradient(90deg, transparent, var(--color-spark))",
                filter: "blur(4px)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
