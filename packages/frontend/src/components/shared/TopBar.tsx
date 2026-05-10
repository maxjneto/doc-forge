import { useState } from "react";
import { Link } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";
import { useWorkspaceStore, SECTION_LABELS } from "@/store";
import { useKilnAudio } from "@/hooks/useKilnAudio";
import type { Phase } from "@/types";

const PHASE_STEPS: { id: Phase; label: string; num: string }[] = [
  { id: "discovery",   label: "Discovery",   num: "01" },
  { id: "alignment",   label: "Alignment",   num: "02" },
  { id: "generation",  label: "Generation",  num: "03" },
  { id: "refinement",  label: "Refinement",  num: "04" },
  { id: "audit",       label: "Audit",       num: "05" },
  { id: "completed",   label: "Completed",   num: "06" },
];

const PHASE_ORDER = PHASE_STEPS.map((p) => p.id);

function getStepState(
  stepId: Phase,
  current: Phase
): "done" | "now" | "future" {
  const stepIdx = PHASE_ORDER.indexOf(stepId);
  const currIdx = PHASE_ORDER.indexOf(current);
  if (stepIdx < currIdx) return "done";
  if (stepIdx === currIdx) return "now";
  return "future";
}

// ─── Heating status badge ────────────────────────────────────

function HeatingBadge({ status }: { status: string }) {
  if (status === "refining" || status === "drafting") {
    return (
      <span className="df-pill df-pill-heat" style={{ fontSize: 9.5, padding: "3px 8px" }}>
        Heating
      </span>
    );
  }
  if (status === "finalized") {
    return (
      <span className="df-pill df-pill-steel" style={{ fontSize: 9.5, padding: "3px 8px" }}>
        Forged
      </span>
    );
  }
  return (
    <span className="df-pill df-pill-ghost" style={{ fontSize: 9.5, padding: "3px 8px" }}>
      Queued
    </span>
  );
}

// ─── Refinement breadcrumb ───────────────────────────────────

function RefinementBreadcrumb({ docTitle }: { docTitle?: string }) {
  const activeSection = useWorkspaceStore((s) => s.activeSection);
  const sections = useWorkspaceStore((s) => s.sections);
  const currentSection = sections.find((s) => s.sectionType === activeSection);
  const sectionLabel = SECTION_LABELS[activeSection] ?? activeSection;
  const sectionStatus = currentSection?.status ?? "pending";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginLeft: 24,
        fontFamily: "var(--df-font-mono, 'JetBrains Mono', monospace)",
        fontSize: 11,
        letterSpacing: "0.06em",
      }}
    >
      {docTitle && (
        <>
          <span style={{ color: "var(--df-faint, rgba(227,226,226,0.38))", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {docTitle.length > 22 ? docTitle.slice(0, 22) + "…" : docTitle}
          </span>
          <span style={{ color: "var(--df-mute, rgba(227,226,226,0.18))" }}>›</span>
        </>
      )}
      <span style={{ color: "var(--df-dim, rgba(227,226,226,0.62))", fontWeight: 500 }}>
        {sectionLabel}
      </span>
      <span style={{ color: "var(--df-mute, rgba(227,226,226,0.18))" }}>›</span>
      <HeatingBadge status={sectionStatus} />
    </div>
  );
}

// ─── Kiln audio toggle ───────────────────────────────────────

function KilnToggle() {
  const [active, setActive] = useState(false);
  const { start, stop } = useKilnAudio();

  const toggle = () => {
    if (active) {
      stop();
      setActive(false);
    } else {
      start();
      setActive(true);
    }
  };

  return (
    <button
      onClick={toggle}
      title={active ? "Mute kiln ambience" : "Play kiln ambience"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${active ? "rgba(255,77,0,0.45)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
        background: active ? "rgba(255,77,0,0.08)" : "transparent",
        color: active ? "var(--df-amber-300, #ff8d4a)" : "var(--df-faint, rgba(227,226,226,0.38))",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 14 }}
      >
        {active ? "volume_up" : "volume_off"}
      </span>
      <span
        className="df-mono"
        style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        Kiln
      </span>
      {active && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--df-amber-500, #ff4d00)",
            boxShadow: "0 0 6px var(--df-amber-500)",
            animation: "df-pulse 1.6s ease-in-out infinite",
          }}
        />
      )}
    </button>
  );
}

// ─── TopBar ──────────────────────────────────────────────────

interface TopBarProps {
  phase?: Phase;
  phaseLabel?: string;
  credits?: number;
  docTitle?: string;
}

export function TopBar({ phase, credits, docTitle }: TopBarProps) {
  const isCompleted = phase === "completed";
  const isRefinement = phase === "refinement";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        background: "rgba(13,14,15,0.92)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        display: "flex",
        alignItems: "center",
        padding: "0 22px",
        gap: 18,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <Link
        to="/home"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            background: "linear-gradient(135deg, var(--df-amber-500, #ff4d00), var(--df-amber-700, #6e1d00))",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 0 14px rgba(255,77,0,0.45)",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              background: "#fff",
              clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
            }}
          />
        </div>
        <span
          className="df-mono"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "#e3e2e2",
          }}
        >
          DOCFORGE
        </span>
      </Link>

      {/* Refinement breadcrumb or phase stepper */}
      {isRefinement ? (
        <RefinementBreadcrumb docTitle={docTitle} />
      ) : phase ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginLeft: 28,
          }}
        >
          {PHASE_STEPS.map((step, i) => {
            const state =
              isCompleted && step.id === "completed"
                ? "now-steel"
                : getStepState(step.id, phase);
            const isDone = state === "done";
            const isNow = state === "now";
            const isNowSteel = state === "now-steel";

            const color = isDone
              ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
              : isNow
              ? "var(--df-amber-500, #ff4d00)"
              : isNowSteel
              ? "var(--df-steel-100, #b9c6d4)"
              : "var(--df-mute, rgba(227,226,226,0.18))";

            return (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i > 0 && (
                  <div
                    style={{
                      width: 18,
                      height: 1,
                      background: isDone || isNowSteel
                        ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                        : "var(--df-mute, rgba(227,226,226,0.18))",
                    }}
                  />
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    className={isNow ? "animate-df-pulse" : ""}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: color,
                      opacity: isDone || isNow || isNowSteel ? 1 : 0.55,
                      boxShadow: isNow
                        ? "0 0 0 3px rgba(255,77,0,0.18), 0 0 12px rgba(255,77,0,0.6)"
                        : isNowSteel
                        ? "0 0 0 3px var(--df-steel-bg-strong, rgba(138,160,184,0.22))"
                        : "none",
                    }}
                  />
                  <span
                    className="df-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.10em",
                      textTransform: "uppercase",
                      color,
                    }}
                  >
                    {step.num} {step.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {/* Kiln audio toggle (refinement only) */}
        {isRefinement && <KilnToggle />}

        {/* Doc title / credits (non-refinement) */}
        {!isRefinement && docTitle && phase ? (
          <span
            className="df-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--df-dim, rgba(227,226,226,0.62))",
              border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
              borderRadius: 4,
              padding: "4px 10px",
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {docTitle.length > 28 ? docTitle.slice(0, 28) + "…" : docTitle}
          </span>
        ) : !isRefinement && credits !== undefined ? (
          <span
            className="df-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--df-dim, rgba(227,226,226,0.62))",
              border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
              borderRadius: 4,
              padding: "4px 10px",
            }}
          >
            CREDITS ·{" "}
            <b style={{ color: "var(--df-amber-300, #ff8d4a)" }}>{credits}</b>
          </span>
        ) : null}

        <UserButton />
      </div>
    </header>
  );
}
