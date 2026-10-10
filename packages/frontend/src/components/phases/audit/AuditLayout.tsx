import { useState, useEffect } from "react";
import type { Phase, AuditProblem, Section, GuidedSectionType as SectionType } from "@/types";

import { Pill } from "@/components/ui";
import { useI18n } from "@/i18n";
const AUDIT_STEPS = ["g.au.s1", "g.au.s2", "g.au.s3", "g.au.s4"];

const SECTION_ORDER: SectionType[] = ["context", "proposal", "implementation", "risks"];

interface AuditLayoutProps {
  documentId: string;
  currentPhase: Phase;
  sections: Section[];
  auditProblems?: AuditProblem[];
}

type SectionScanState = "verified" | "scanning" | "problem" | "queued";

/** Severity → pill tone (grammar: blocking = error, gate warning = warn). */
const SEVERITY_TONE = { BLOCKER: "error", WARN: "warn", NIT: "ghost" } as const;
const PROBLEM_TONE = {
  error: { text: "var(--color-error)", line: "var(--color-error-line)", tint: "var(--color-error-tint)", strong: "var(--color-error-strong)" },
  warn: { text: "var(--color-warn)", line: "var(--color-warn-line)", tint: "var(--color-warn-tint)", strong: "var(--color-warn-strong)" },
};
const SEVERITY_KEY = { BLOCKER: "g.sev.blocker", WARN: "g.sev.warn", NIT: "g.sev.nit" } as const;

function severityLabel(severity: string): "BLOCKER" | "WARN" | "NIT" {
  const s = severity?.toLowerCase();
  if (s === "high" || s === "blocker" || s === "critical") return "BLOCKER";
  if (s === "medium" || s === "warn" || s === "warning") return "WARN";
  return "NIT";
}

export function AuditLayout({ documentId: _documentId, currentPhase, sections, auditProblems = [] }: AuditLayoutProps) {
  const { t } = useI18n();
  const [auditStep, setAuditStep] = useState(0);
  const [scanIdx, setScanIdx] = useState(0);

  const isScanning = currentPhase === "audit" && auditProblems.length === 0;
  const hasProblems = auditProblems.length > 0;

  // Cycle audit step label
  useEffect(() => {
    if (!isScanning) return;
    const interval = setInterval(() => {
      setAuditStep((i) => (i + 1) % AUDIT_STEPS.length);
      setScanIdx((i) => Math.min(i + 1, SECTION_ORDER.length - 1));
    }, 2500);
    return () => clearInterval(interval);
  }, [isScanning]);

  // Group problems by section
  const problemsBySec = auditProblems.reduce<Record<string, AuditProblem[]>>((acc, p) => {
    const key = p.section || "general";
    acc[key] = [...(acc[key] ?? []), p];
    return acc;
  }, {});

  const blockerCount = auditProblems.filter(
    (p) => severityLabel(p.severity) === "BLOCKER"
  ).length;
  const warnCount = auditProblems.filter(
    (p) => severityLabel(p.severity) === "WARN"
  ).length;
  const nitCount = auditProblems.filter(
    (p) => severityLabel(p.severity) === "NIT"
  ).length;

  // X-ray section states
  function getScanState(idx: number): SectionScanState {
    if (hasProblems) {
      // For completed audit with problems, mark sections with issues
      const type = SECTION_ORDER[idx];
      const hasProblem = auditProblems.some(
        (p) => p.section?.toLowerCase().includes(type)
      );
      // The audit has finished: every section is either clean or flagged.
      // (scanIdx only advances during the live scan, so gating on it left
      // every section "queued" once findings arrived.)
      return hasProblem ? "problem" : "verified";
    }
    if (idx < scanIdx) return "verified";
    if (idx === scanIdx) return "scanning";
    return "queued";
  }

  const sectionLabel = (type: string) => t(`section.${type}`);

  return (
    <div
      style={{
        height: "100%",
        paddingTop: 56,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>

        {/* ── Left: X-ray doc preview ── */}
        <div
          style={{
            borderRight: "1px solid var(--color-outline)",
            padding: "32px 40px",
            overflow: "hidden",
            background:
              "radial-gradient(ellipse 700px 500px at 40% 40%, var(--color-heat-tint), transparent 70%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div
                className="df-mono"
                style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-heat-hi)", marginBottom: 6 }}
              >
                {t("g.au.xray", { state: isScanning ? t("g.au.live") : hasProblems ? t("g.au.complete") : t("g.au.pendingState") })}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-dim)" }}>
                {t("g.au.xrayLead")}
              </div>
            </div>
            {isScanning && (
              <Pill tone="heat">
                {t("g.au.scanning", { section: sectionLabel(SECTION_ORDER[scanIdx]) })}
              </Pill>
            )}
          </div>

          <div
            style={{
              border: "1px solid var(--color-outline)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-chrome)",
              padding: "22px 26px",
              height: "calc(100% - 80px)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {SECTION_ORDER.map((type, idx) => {
              const scanState = getScanState(idx);
              const isVerified = scanState === "verified";
              const isScanning_ = scanState === "scanning";
              const isProblem = scanState === "problem";

              const sectionProblems = auditProblems.filter((p) =>
                p.section?.toLowerCase().includes(type)
              );
              const hasSectionBlocker = sectionProblems.some(
                (p) => severityLabel(p.severity) === "BLOCKER"
              );

              // A flagged section takes the colour of its worst finding. Token
              // names are spelled out in full: Tailwind only emits theme
              // variables it can see literally in the source.
              const tone = hasSectionBlocker ? PROBLEM_TONE.error : PROBLEM_TONE.warn;

              const borderColor = isVerified
                ? "var(--color-steel-line)"
                : isScanning_
                ? "var(--color-heat-line)"
                : isProblem
                ? tone.line
                : "var(--color-outline)";

              const bg = isVerified
                ? "var(--color-steel-wash)"
                : isScanning_
                ? "var(--color-heat-wash)"
                : isProblem
                ? tone.tint
                : "transparent";

              const labelColor = isVerified
                ? "var(--color-steel-hi)"
                : isScanning_
                ? "var(--color-heat-hi)"
                : isProblem
                ? tone.text
                : "var(--color-mute)";

              const statusText = (isVerified
                ? t("g.au.verified")
                : isScanning_
                ? t("g.au.scanningRow")
                : isProblem
                ? hasSectionBlocker
                  ? `${t("g.sev.blocker")} · ${sectionProblems.length}`
                  : sectionProblems.length === 1 ? t("g.au.issue") : t("g.au.issues", { count: sectionProblems.length })
                : t("g.au.queued")).toUpperCase();

              const skelBg = isVerified
                ? "var(--color-steel-strong)"
                : isScanning_
                ? "var(--color-heat-strong)"
                : isProblem
                ? tone.strong
                : "var(--color-hover)";

              return (
                <div
                  key={type}
                  style={{
                    marginBottom: 18,
                    padding: "14px 16px",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${borderColor}`,
                    background: bg,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {isScanning_ && (
                    <div
                      className="animate-df-scan"
                      style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        height: 12,
                        background:
                          "linear-gradient(180deg, transparent 0%, var(--color-spark-soft) 50%, transparent 100%)",
                      }}
                    />
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      className="df-mono"
                      style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: labelColor }}
                    >
                      › {sectionLabel(type)}
                      {isScanning_ && (
                        <span className="df-ember animate-df-pulse" style={{ marginLeft: 6 }} />
                      )}
                    </span>
                    <span
                      className="df-mono"
                      style={{ fontSize: 10, color: labelColor }}
                    >
                      {statusText}
                    </span>
                  </div>

                  {[90, 70, 84].map((w, i) => (
                    <div
                      key={i}
                      style={{
                        height: 5,
                        borderRadius: "var(--radius-xs)",
                        background: skelBg,
                        marginBottom: 5,
                        width: `${w}%`,
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {sections.length === 0 && !isScanning && (
              <div
                style={{
                  position: "absolute",
                  inset: "50% 0 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  className="df-mono"
                  style={{ fontSize: 11.5, color: "var(--color-faint)" }}
                >
                  {t("g.au.noSections")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Findings panel ── */}
        <div
          style={{
            padding: "32px 36px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2
                style={{
                  fontSize: 21,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  margin: "0 0 4px",
                  color: "var(--color-text)",
                }}
              >
                {hasProblems ? t("g.au.titleCount", { count: auditProblems.length }) : t("g.au.title")}
              </h2>
              <div style={{ fontSize: 12.5, color: "var(--color-dim)" }}>
                {hasProblems ? t("g.au.leadDone") : t("g.au.leadRunning")}
              </div>
            </div>
            {hasProblems && warnCount + blockerCount > 0 && (
              <Pill tone="warn">
                {t("g.au.attention", { count: warnCount + blockerCount })}
              </Pill>
            )}
          </div>

          {/* Loading state */}
          {isScanning && !hasProblems && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <div style={{ position: "relative", width: 56, height: 56 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid var(--color-heat-line)",
                    animation: "pulse 1.6s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid var(--color-heat-line)",
                    animation: "spin 3s linear infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 12,
                    borderRadius: "50%",
                    background: "var(--color-heat-strong)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "var(--color-heat-hi)", fontSize: 18 }}
                  >
                    verified
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 6px", color: "var(--color-text)" }}>
                  {t("g.au.running")}
                </p>
                <p
                  key={auditStep}
                  className="animate-fade-in df-mono"
                  style={{ fontSize: 11.5, color: "var(--color-faint)", letterSpacing: "var(--tracking-data)" }}
                >
                  {t(AUDIT_STEPS[auditStep])}
                </p>
              </div>
            </div>
          )}

          {/* Severity stats */}
          {hasProblems && (
            <>
              <div style={{ display: "flex", gap: 14 }}>
                {[
                  { label: t("g.sev.blocker"), count: blockerCount, cls: "blocker" },
                  { label: t("g.sev.warn"),    count: warnCount,    cls: "warn" },
                  { label: t("g.sev.nit"),     count: nitCount,     cls: "nit" },
                ].map(({ label, count, cls }) => {
                  const style =
                    cls === "blocker"
                      ? { borderLeft: "2px solid var(--color-error)", labelColor: "var(--color-error)" }
                      : cls === "warn"
                      ? { borderLeft: "2px solid var(--color-warn)", labelColor: "var(--color-warn)" }
                      : { borderLeft: "2px solid var(--color-outline-md)", labelColor: "var(--color-faint)" };
                  return (
                    <div
                      key={cls}
                      style={{
                        border: "1px solid var(--color-outline)",
                        borderLeft: style.borderLeft,
                        borderRadius: "var(--radius-md)",
                        padding: "10px 14px",
                        flex: 1,
                        background: "var(--color-surface)",
                      }}
                    >
                      <div
                        className="df-mono"
                        style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: style.labelColor }}
                      >
                        › {label}
                      </div>
                      <div
                        className="df-mono"
                        style={{ fontSize: 21, fontWeight: 600, color: "var(--color-text)", letterSpacing: "-0.03em", marginTop: 4 }}
                      >
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Finding groups */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }} className="hide-scrollbar">
                {Object.entries(problemsBySec).map(([section, problems]) => (
                  <div
                    key={section}
                    style={{
                      border: "1px solid var(--color-outline)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--color-surface)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 16px",
                        background: "var(--color-hover)",
                        borderBottom: "1px solid var(--color-outline)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        className="df-mono"
                        style={{ fontSize: 10, fontWeight: 600, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-text)" }}
                      >
                        › {sectionLabel(section)}
                      </span>
                      <span
                        className="df-mono"
                        style={{ fontSize: 10, color: "var(--color-faint)" }}
                      >
                        {problems.length === 1 ? t("g.au.finding") : t("g.au.findings", { count: problems.length })}
                      </span>
                    </div>

                    {problems.map((problem, idx) => {
                      const label = severityLabel(problem.severity);
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "12px 16px",
                            borderBottom:
                              idx < problems.length - 1
                                ? "1px solid var(--color-outline)"
                                : "none",
                            display: "grid",
                            gridTemplateColumns: "96px 1fr",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <div><Pill tone={SEVERITY_TONE[label]} compact>{t(SEVERITY_KEY[label])}</Pill></div>
                          <div
                            style={{ fontSize: 12.5, color: "var(--color-dim)", lineHeight: 1.55 }}
                          >
                            {problem.issue}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
