import { useEffect, useState } from "react";
import type { Section, SectionType } from "@/types";

import { Pill } from "@/components/ui";
import { useI18n } from "@/i18n";
interface GenerationLayoutProps {
  documentId: string;
  sections: Section[];
}

type GenerationStatus = "waiting" | "generating" | "done";

const SECTION_ORDER: { type: SectionType }[] = [
  { type: "context" },
  { type: "proposal" },
  { type: "implementation" },
  { type: "risks" },
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
        borderRadius: "var(--radius-pill)",
        background: "var(--color-hover)",
        border: "1px solid var(--color-outline)",
        position: "relative",
        overflow: "hidden",
        minWidth: 180,
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: "var(--radius-pill)",
          width: `${animatedWidth}%`,
          background: isDone
            ? "var(--color-heat-line)"
            : "linear-gradient(90deg, var(--color-heat-deep), var(--color-heat) 60%, var(--color-heat-hi))",
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
                "linear-gradient(90deg, transparent, var(--color-spark))",
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
  const { t } = useI18n();
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
        background: "var(--color-bg)",
        padding: "56px",
      }}
    >
      <div
        style={{
          width: 880,
          maxWidth: "100%",
          border: "1px solid var(--color-outline)",
          borderRadius: "var(--radius-lg)",
          padding: "32px 38px",
          background:
            "radial-gradient(ellipse 800px 400px at 50% 0%, var(--color-heat-tint), transparent 70%), var(--color-veil)",
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
            <Pill tone="heat" style={{ marginBottom: 8 }}>
              {t("g.gen.hot")}
            </Pill>
            <h2
              style={{
                fontSize: 21,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                margin: "4px 0 0",
                color: "var(--color-text)",
              }}
            >
              {t("g.gen.pouring")}{" "}
              <em style={{ fontStyle: "normal", color: "var(--color-heat-hi)" }}>
                {t("g.gen.sections", { count: SECTION_ORDER.length })}
              </em>
            </h2>
          </div>
          <span
            className="df-mono"
            style={{
              fontSize: 11.5,
              color: "var(--color-dim)",
              letterSpacing: "var(--tracking-data)",
            }}
          >
            {t("g.gen.live")}
          </span>
        </div>

        {/* Section rows */}
        {sectionStates.map((s, i) => {
          const isDone = s.status === "done";
          const isGenerating = s.status === "generating";
          const arrowColor = isDone
            ? "var(--color-heat-line)"
            : isGenerating
            ? "var(--color-heat-hi)"
            : "var(--color-heat-deep)";

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
                borderTop: i === 0 ? "none" : "1px solid var(--color-outline)",
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
                    color: isDone ? "var(--color-dim)" : "var(--color-text)",
                  }}
                >
                  {t(`section.${s.type}`)}
                </div>
                {peek && (
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--color-faint)",
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
                  fontSize: 11.5,
                  letterSpacing: "var(--tracking-data)",
                  textAlign: "right",
                  color: isDone
                    ? "var(--color-heat-line)"
                    : isGenerating
                    ? "var(--color-heat-hi)"
                    : "var(--color-heat-deep)",
                }}
              >
                {isDone ? t("g.gen.forged") : isGenerating ? t("g.gen.pouringRow") : t("g.gen.queued")}
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
            borderTop: "1px solid var(--color-outline)",
          }}
        >
          <span
            className="df-mono"
            style={{
              fontSize: 11.5,
              color: "var(--color-faint)",
              letterSpacing: "var(--tracking-data)",
            }}
          >
            {t("g.gen.footer", { done: doneCount, total: SECTION_ORDER.length })}
            {generatingCount > 0 && t("g.gen.footerPouring", { count: generatingCount })}
            {doneCount === SECTION_ORDER.length && t("g.gen.complete")}
          </span>
        </div>

        {/* Skeleton preview of the section being generated */}
        {currentGenerating && (
          <div
            style={{
              marginTop: 16,
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              background: "var(--color-chrome)",
              border: "1px solid var(--color-outline)",
            }}
            className="animate-fade-in"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[92, 78, 86, 64, 55].map((w, i) => (
                <div
                  key={i}
                  style={{
                    height: 6,
                    borderRadius: "var(--radius-xs)",
                    width: `${w}%`,
                    background: "var(--color-heat-strong)",
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
