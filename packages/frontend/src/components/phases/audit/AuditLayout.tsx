import { useState, useEffect } from "react";
import type { Phase, AuditProblem, Section, SectionType } from "@/types";

const AUDIT_STEPS = [
  "Checking cross-section references...",
  "Verifying technical consistency...",
  "Comparing proposal against implementation...",
  "Validating risk coverage...",
];

const SECTION_ORDER: SectionType[] = ["context", "proposal", "implementation", "risks"];

interface AuditLayoutProps {
  documentId: string;
  currentPhase: Phase;
  sections: Section[];
  auditProblems?: AuditProblem[];
}

type SectionScanState = "verified" | "scanning" | "problem" | "queued";

function getSeverityColor(severity: string): { color: string; borderColor: string; bg: string } {
  const s = severity?.toLowerCase();
  if (s === "high" || s === "blocker" || s === "critical") {
    return {
      color: "var(--df-error, #e86464)",
      borderColor: "rgba(232,100,100,0.40)",
      bg: "rgba(232,100,100,0.08)",
    };
  }
  if (s === "medium" || s === "warn" || s === "warning") {
    return {
      color: "var(--df-amber-300, #ff8d4a)",
      borderColor: "rgba(255,77,0,0.30)",
      bg: "rgba(255,77,0,0.06)",
    };
  }
  return {
    color: "var(--df-steel-100, #b9c6d4)",
    borderColor: "var(--df-steel-border, rgba(138,160,184,0.35))",
    bg: "var(--df-steel-bg, rgba(138,160,184,0.10))",
  };
}

function severityLabel(severity: string): string {
  const s = severity?.toLowerCase();
  if (s === "high" || s === "blocker" || s === "critical") return "BLOCKER";
  if (s === "medium" || s === "warn" || s === "warning") return "WARN";
  return "NIT";
}

export function AuditLayout({ documentId: _documentId, currentPhase, sections, auditProblems = [] }: AuditLayoutProps) {
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
      if (idx < scanIdx) return hasProblem ? "problem" : "verified";
      return "queued";
    }
    if (idx < scanIdx) return "verified";
    if (idx === scanIdx) return "scanning";
    return "queued";
  }

  const sectionLabel: Record<SectionType, string> = {
    context: "Context",
    proposal: "Proposal",
    implementation: "Implementation",
    risks: "Risks",
  };

  return (
    <div
      style={{
        height: "100%",
        paddingTop: 56,
        display: "flex",
        flexDirection: "column",
        background: "var(--df-bg, #0a0b0c)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>

        {/* ── Left: X-ray doc preview ── */}
        <div
          style={{
            borderRight: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
            padding: "32px 40px",
            overflow: "hidden",
            background:
              "radial-gradient(ellipse 700px 500px at 40% 40%, rgba(255,77,0,0.025), transparent 70%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div
                className="df-mono"
                style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--df-amber-300, #ff8d4a)", marginBottom: 6 }}
              >
                X-ray scan · {isScanning ? "live" : hasProblems ? "complete" : "pending"}
              </div>
              <div style={{ fontSize: 13, color: "var(--df-dim, rgba(227,226,226,0.62))" }}>
                Each section is checked for cross-references and consistency.
              </div>
            </div>
            {isScanning && (
              <span className="df-pill df-pill-heat">
                Scanning · {sectionLabel[SECTION_ORDER[scanIdx]]}
              </span>
            )}
          </div>

          <div
            style={{
              border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
              borderRadius: 10,
              background: "rgba(13,14,15,0.6)",
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

              const borderColor = isVerified
                ? "var(--df-steel-border, rgba(138,160,184,0.35))"
                : isScanning_
                ? "rgba(255,77,0,0.45)"
                : isProblem
                ? "rgba(232,100,100,0.40)"
                : "var(--df-outline, rgba(255,255,255,0.06))";

              const bg = isVerified
                ? "var(--df-steel-bg, rgba(138,160,184,0.10))"
                : isScanning_
                ? "rgba(255,77,0,0.08)"
                : isProblem
                ? "rgba(232,100,100,0.05)"
                : "transparent";

              const labelColor = isVerified
                ? "var(--df-steel-100, #b9c6d4)"
                : isScanning_
                ? "var(--df-amber-300, #ff8d4a)"
                : isProblem
                ? "var(--df-error, #e86464)"
                : "var(--df-mute, rgba(227,226,226,0.18))";

              const statusText = isVerified
                ? hasSectionBlocker
                  ? `1 BLOCKER`
                  : sectionProblems.length > 0
                  ? `${sectionProblems.length} WARN`
                  : "VERIFIED"
                : isScanning_
                ? "SCANNING…"
                : isProblem
                ? `${sectionProblems.length} ISSUE${sectionProblems.length > 1 ? "S" : ""}`
                : "QUEUED";

              const skelBg = isVerified
                ? "rgba(138,160,184,0.20)"
                : isScanning_
                ? "rgba(255,77,0,0.20)"
                : isProblem
                ? "rgba(232,100,100,0.18)"
                : "rgba(255,255,255,0.04)";

              return (
                <div
                  key={type}
                  style={{
                    marginBottom: 18,
                    padding: "14px 16px",
                    borderRadius: 8,
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
                          "linear-gradient(180deg, transparent 0%, rgba(255,217,184,0.50) 50%, transparent 100%)",
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
                      style={{ fontSize: 10, letterSpacing: "0.14em", color: labelColor }}
                    >
                      › {sectionLabel[type]}
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
                        borderRadius: 2,
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
                  style={{ fontSize: 11, color: "var(--df-faint, rgba(227,226,226,0.38))" }}
                >
                  No sections to scan
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
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  margin: "0 0 4px",
                  color: "#e3e2e2",
                }}
              >
                Audit{hasProblems ? ` · ${auditProblems.length} findings` : ""}
              </h2>
              <div style={{ fontSize: 12.5, color: "var(--df-dim, rgba(227,226,226,0.62))" }}>
                {hasProblems
                  ? "Review each finding. Fix in place opens the workspace with the issue pre-quoted."
                  : "Running the coherence audit across all sections."}
              </div>
            </div>
            {hasProblems && warnCount + blockerCount > 0 && (
              <span className="df-pill df-pill-warn">
                {warnCount + blockerCount} issues require attention
              </span>
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
                    border: "2px solid rgba(255,77,0,0.30)",
                    animation: "pulse 1.6s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: "2px solid rgba(255,77,0,0.60)",
                    animation: "spin 3s linear infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 12,
                    borderRadius: "50%",
                    background: "rgba(255,77,0,0.20)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: "var(--df-amber-300, #ff8d4a)", fontSize: 18 }}
                  >
                    verified
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 14, fontWeight: 500, margin: "0 0 6px", color: "#e3e2e2" }}>
                  Running audit
                </p>
                <p
                  key={auditStep}
                  className="animate-fade-in df-mono"
                  style={{ fontSize: 11, color: "var(--df-faint, rgba(227,226,226,0.38))", letterSpacing: "0.06em" }}
                >
                  {AUDIT_STEPS[auditStep]}
                </p>
              </div>
            </div>
          )}

          {/* Severity stats */}
          {hasProblems && (
            <>
              <div style={{ display: "flex", gap: 14 }}>
                {[
                  { label: "Blocker", count: blockerCount, cls: "blocker" },
                  { label: "Warn",    count: warnCount,    cls: "warn" },
                  { label: "Nit",     count: nitCount,     cls: "nit" },
                ].map(({ label, count, cls }) => {
                  const style =
                    cls === "blocker"
                      ? { borderLeft: "2px solid var(--df-error, #e86464)", labelColor: "var(--df-error, #e86464)" }
                      : cls === "warn"
                      ? { borderLeft: "2px solid var(--df-amber-300, #ff8d4a)", labelColor: "var(--df-amber-300, #ff8d4a)" }
                      : { borderLeft: "2px solid var(--df-steel-200, #8aa0b8)", labelColor: "var(--df-steel-100, #b9c6d4)" };
                  return (
                    <div
                      key={cls}
                      style={{
                        border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
                        borderLeft: style.borderLeft,
                        borderRadius: 8,
                        padding: "10px 14px",
                        flex: 1,
                        background: "rgba(18,20,20,0.5)",
                      }}
                    >
                      <div
                        className="df-mono"
                        style={{ fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: style.labelColor }}
                      >
                        › {label}
                      </div>
                      <div
                        className="df-mono"
                        style={{ fontSize: 22, fontWeight: 600, color: "#e3e2e2", letterSpacing: "-0.03em", marginTop: 4 }}
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
                      border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
                      borderRadius: 10,
                      background: "rgba(18,20,20,0.5)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 16px",
                        background: "rgba(255,255,255,0.02)",
                        borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        className="df-mono"
                        style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--df-amber-300, #ff8d4a)" }}
                      >
                        › {section}
                      </span>
                      <span
                        className="df-mono"
                        style={{ fontSize: 10, color: "var(--df-faint, rgba(227,226,226,0.38))" }}
                      >
                        {problems.length} finding{problems.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {problems.map((problem, idx) => {
                      const sev = getSeverityColor(problem.severity);
                      const label = severityLabel(problem.severity);
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: "12px 16px",
                            borderBottom:
                              idx < problems.length - 1
                                ? "1px solid var(--df-outline, rgba(255,255,255,0.06))"
                                : "none",
                            display: "grid",
                            gridTemplateColumns: "70px 1fr auto",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            className="df-mono"
                            style={{
                              fontSize: 9.5,
                              letterSpacing: "0.14em",
                              padding: "3px 7px",
                              borderRadius: 4,
                              textAlign: "center",
                              border: `1px solid ${sev.borderColor}`,
                              color: sev.color,
                              background: sev.bg,
                            }}
                          >
                            {label}
                          </span>
                          <div
                            style={{ fontSize: 12.5, color: "var(--df-on-surface-soft, #c6c5c4)", lineHeight: 1.55 }}
                          >
                            {problem.issue}
                          </div>
                          <span
                            className="df-pill df-pill-warn"
                            style={{ fontSize: 10, padding: "3px 8px", cursor: "default" }}
                          >
                            {label === "BLOCKER" ? "Fix required" : "Review"}
                          </span>
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
