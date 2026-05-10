import { useEffect, useState } from "react";
import type { Section, SectionType } from "@/types";

interface GenerationLayoutProps {
  documentId: string;
  sections: Section[];
}

type GenerationStatus = "waiting" | "generating" | "done";

const SECTION_ORDER: { type: SectionType; label: string }[] = [
  { type: "context",        label: "Context" },
  { type: "proposal",       label: "Proposal" },
  { type: "implementation", label: "Implementation" },
  { type: "risks",          label: "Risks & Alternatives" },
];

function getSectionStatus(section: Section | undefined): GenerationStatus {
  if (!section) return "waiting";
  if (section.activeVersionContent) return "done";
  if (section.status === "drafting") return "generating";
  return "waiting";
}

function PourBar({ status }: { status: GenerationStatus }) {
  const [animatedWidth, setAnimatedWidth] = useState(
    status === "done" ? 100 : status === "generating" ? 0 : 0
  );

  useEffect(() => {
    if (status === "generating") {
      const t = setTimeout(() => setAnimatedWidth(65), 50);
      return () => clearTimeout(t);
    }
    if (status === "done") {
      setAnimatedWidth(100);
    } else {
      setAnimatedWidth(0);
    }
  }, [status]);

  const isDone = status === "done";
  const isGenerating = status === "generating";

  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        position: "relative",
        overflow: "hidden",
        minWidth: 180,
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 999,
          width: `${animatedWidth}%`,
          background: isDone
            ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
            : "linear-gradient(90deg, var(--df-amber-700, #6e1d00), var(--df-amber-500, #ff4d00) 60%, var(--df-amber-300, #ff8d4a))",
          transition: "width 8s ease-out",
          position: "relative",
        }}
      >
        {isGenerating && (
          <div
            style={{
              position: "absolute",
              right: -2,
              top: -2,
              bottom: -2,
              width: 18,
              background:
                "linear-gradient(90deg, transparent, rgba(255,217,184,0.85))",
              filter: "blur(5px)",
            }}
          />
        )}
      </div>
    </div>
  );
}

export function GenerationLayout({
  documentId: _documentId,
  sections,
}: GenerationLayoutProps) {
  const sectionStates = SECTION_ORDER.map((s) => {
    const section = sections.find((sec) => sec.sectionType === s.type);
    return { ...s, status: getSectionStatus(section), section };
  });

  const doneCount = sectionStates.filter((s) => s.status === "done").length;
  const generatingCount = sectionStates.filter((s) => s.status === "generating").length;
  const currentGenerating = sectionStates.find((s) => s.status === "generating");

  return (
    <div
      style={{
        height: "100%",
        paddingTop: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--df-bg, #0a0b0c)",
        padding: "56px",
      }}
    >
      <div
        style={{
          width: 880,
          maxWidth: "100%",
          border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          borderRadius: 14,
          padding: "32px 38px",
          background:
            "radial-gradient(ellipse 800px 400px at 50% 0%, rgba(255,77,0,0.06), transparent 70%), rgba(18,20,20,0.55)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 28,
          }}
        >
          <div>
            <span className="df-pill df-pill-heat" style={{ marginBottom: 8, display: "inline-flex" }}>
              Foundry hot
            </span>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "4px 0 0",
                color: "#e3e2e2",
              }}
            >
              Pouring{" "}
              <em style={{ fontStyle: "normal", color: "var(--df-amber-300, #ff8d4a)" }}>
                {SECTION_ORDER.length} sections
              </em>
            </h2>
          </div>
          <span
            className="df-mono"
            style={{
              fontSize: 11,
              color: "var(--df-dim, rgba(227,226,226,0.62))",
              letterSpacing: "0.04em",
            }}
          >
            streaming live
          </span>
        </div>

        {/* Section rows */}
        {sectionStates.map((s, i) => {
          const isDone = s.status === "done";
          const isGenerating = s.status === "generating";
          const arrowColor = isDone
            ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
            : isGenerating
            ? "var(--df-amber-300, #ff8d4a)"
            : "var(--df-amber-700, #6e1d00)";

          const peek = s.section?.summary
            ? `"${s.section.summary.slice(0, 90)}…"`
            : null;

          return (
            <div
              key={s.type}
              style={{
                display: "grid",
                gridTemplateColumns: "22px 1fr 100px 200px",
                gap: 16,
                alignItems: "center",
                padding: "14px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--df-outline, rgba(255,255,255,0.06))",
              }}
            >
              {/* Arrow */}
              <span
                className="df-mono"
                style={{ fontSize: 14, color: arrowColor }}
              >
                ›
              </span>

              {/* Label + peek */}
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: isDone ? "var(--df-dim, rgba(227,226,226,0.62))" : "#e3e2e2",
                  }}
                >
                  {s.label}
                </div>
                {peek && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--df-faint, rgba(227,226,226,0.38))",
                      marginTop: 5,
                      lineHeight: 1.45,
                      fontStyle: "italic",
                    }}
                  >
                    {peek}
                  </div>
                )}
              </div>

              {/* Clock / status */}
              <div
                className="df-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textAlign: "right",
                  color: isDone
                    ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                    : isGenerating
                    ? "var(--df-amber-300, #ff8d4a)"
                    : "var(--df-amber-700, #6e1d00)",
                }}
              >
                {isDone ? "forged" : isGenerating ? "pouring…" : "queued"}
              </div>

              {/* Pour bar */}
              <PourBar status={s.status} />
            </div>
          );
        })}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          }}
        >
          <span
            className="df-mono"
            style={{
              fontSize: 11,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              letterSpacing: "0.04em",
            }}
          >
            {doneCount} / {SECTION_ORDER.length} forged
            {generatingCount > 0 && ` · ${generatingCount} pouring`}
            {doneCount === SECTION_ORDER.length && " · complete"}
          </span>
        </div>

        {/* Skeleton preview of the section being generated */}
        {currentGenerating && (
          <div
            style={{
              marginTop: 16,
              borderRadius: 10,
              padding: "16px 20px",
              background: "rgba(13,14,15,0.6)",
              border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
            }}
            className="animate-fade-in"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[92, 78, 86, 64, 55].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 6,
                    borderRadius: 2,
                    width: `${w}%`,
                    background: "rgba(255,77,0,0.18)",
                    animation: "pulse 1.6s ease-in-out infinite",
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
