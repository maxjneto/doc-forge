import { useEffect, useState } from "react";

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
          border: "1px solid var(--df-outline)",
          borderRadius: 14,
          background: "rgba(14,16,17,0.6)",
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
              style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--df-amber-300)", fontWeight: 600 }}
            >
              Live preview
            </span>
            <span className="df-pill df-pill-heat">Foundry hot</span>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 6px" }}>
            Watch a section pour.
          </h3>
          <p style={{ fontSize: 13.5, color: "var(--df-dim)", lineHeight: 1.55, margin: 0 }}>
            Every section streams in parallel with its own progress bar — and a molten leading edge that tells you generation is alive, not stuck.
          </p>
        </div>
        <div
          style={{
            border: "1px solid var(--df-outline)",
            borderRadius: 10,
            padding: 18,
            background:
              "radial-gradient(ellipse 600px 300px at 50% 0%, rgba(255,77,0,0.06), transparent 70%), rgba(0,0,0,0.30)",
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
  const arrColor = isComplete ? "var(--df-amber-trail)" : isQueued ? "var(--df-mute)" : "var(--df-amber-300)";
  const labelColor = isQueued ? "var(--df-faint)" : isComplete ? "var(--df-on-soft, #c6c5c4)" : "#e3e2e2";
  const clockColor = isComplete ? "var(--df-amber-trail)" : isQueued ? "var(--df-mute)" : "var(--df-amber-300)";
  const clockText = clock ?? (isComplete ? "forged" : isQueued ? "queued" : "");

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr 100px 130px",
        gap: 14,
        alignItems: "center",
        padding: "10px 0",
        borderTop: "1px solid var(--df-outline)",
      }}
    >
      <span className="df-mono" style={{ color: arrColor }}>›</span>
      <span style={{ fontSize: 13, color: labelColor }}>{label}</span>
      <span
        className="df-mono"
        style={{ fontSize: 10.5, color: clockColor, textAlign: "right", letterSpacing: "0.04em" }}
      >
        {clockText}
      </span>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--df-outline)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className={isLive ? "animate-df-pour-fill" : undefined}
          style={{
            height: "100%",
            borderRadius: 999,
            width: isComplete ? "100%" : isLive ? "62%" : 0,
            background: isComplete
              ? "var(--df-amber-trail)"
              : "linear-gradient(90deg, var(--df-amber-700), var(--df-amber-500) 60%, var(--df-amber-300))",
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
                background: "linear-gradient(90deg, transparent, rgba(255,217,184,0.85))",
                filter: "blur(4px)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
