import { useState, useEffect, useRef } from "react";
import type { DiscoveryQuestion, SectionDefinition } from "@/types";
import { FollowUpQuestions } from "./FollowUpQuestions";

type SectionState = "pending" | "forging" | "forged";

function getSectionState(sectionKey: string, questions: DiscoveryQuestion[]): SectionState {
  const sectionQuestions = questions.filter((q) => q.sectionKey === sectionKey);
  if (sectionQuestions.length === 0) return "pending";
  const allDone = sectionQuestions.every((q) => q.answer !== null || q.skipped);
  if (allDone) return "forged";
  return "forging";
}

function getActiveSection(sections: SectionDefinition[], questions: DiscoveryQuestion[]): string | null {
  // First: a section that has unanswered questions
  for (const section of sections) {
    if (getSectionState(section.sectionKey, questions) === "forging") return section.sectionKey;
  }
  // Second: the first pending section after all forged ones (waiting for AI to generate questions)
  let seenForged = false;
  for (const section of sections) {
    const state = getSectionState(section.sectionKey, questions);
    if (state === "forged") { seenForged = true; continue; }
    if (state === "pending" && seenForged) return section.sectionKey;
  }
  return null;
}

interface SectionStepperProps {
  sections: SectionDefinition[];
  questions: DiscoveryQuestion[];
  documentId: string;
  onComplete: () => void;
}

export function SectionStepper({ sections, questions, documentId, onComplete }: SectionStepperProps) {
  const activeKey = getActiveSection(sections, questions);
  const [forgedFlash, setForgedFlash] = useState<Set<string>>(new Set());
  const [showEmbers, setShowEmbers] = useState(false);
  const prevStatesRef = useRef<Record<string, SectionState>>({});
  const prevActiveKeyRef = useRef<string | null>(activeKey);

  useEffect(() => {
    const newlyForged = new Set<string>();
    sections.forEach((s) => {
      const prev = prevStatesRef.current[s.sectionKey];
      const curr = getSectionState(s.sectionKey, questions);
      if (prev === "forging" && curr === "forged") newlyForged.add(s.sectionKey);
      prevStatesRef.current[s.sectionKey] = curr;
    });
    if (newlyForged.size > 0) {
      setForgedFlash((prev) => new Set([...prev, ...newlyForged]));
      setTimeout(() => {
        setForgedFlash((prev) => {
          const next = new Set(prev);
          newlyForged.forEach((k) => next.delete(k));
          return next;
        });
      }, 750);
    }
  }, [questions, sections]);

  useEffect(() => {
    if (prevActiveKeyRef.current !== null && activeKey === null && sections.length > 0) {
      setShowEmbers(true);
      const t = setTimeout(() => setShowEmbers(false), 1600);
      return () => clearTimeout(t);
    }
    prevActiveKeyRef.current = activeKey;
  }, [activeKey, sections.length]);

  const EMBER_POSITIONS = [8, 18, 30, 42, 54, 66, 78, 88];

  return (
    <div style={{ position: "relative" }}>
      {showEmbers && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 0, pointerEvents: "none", zIndex: 20 }}>
          {EMBER_POSITIONS.map((left, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                bottom: 0,
                left: `${left}%`,
                width: i % 3 === 0 ? 5 : 3,
                height: i % 3 === 0 ? 5 : 3,
                borderRadius: "50%",
                background: i % 2 === 0 ? "var(--df-amber-500, #ff4d00)" : "var(--df-amber-300, #ff8d4a)",
                boxShadow: "0 0 6px var(--df-amber-500, #ff4d00)",
                animation: `df-ember-float ${1.0 + (i % 3) * 0.15}s ease-out ${i * 70}ms forwards`,
              }}
            />
          ))}
        </div>
      )}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sections.map((section, i) => {
        const state = getSectionState(section.sectionKey, questions);
        const isActive = section.sectionKey === activeKey;
        const sectionQuestions = questions.filter((q) => q.sectionKey === section.sectionKey);

        const isFlashing = forgedFlash.has(section.sectionKey);
        const isWaiting = isActive && state === "pending"; // active but no questions yet
        return (
          <div key={section.sectionKey}>
            {/* Section header row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid",
                borderColor: state === "forged"
                  ? "var(--df-steel-border, rgba(138,160,184,0.35))"
                  : isActive
                  ? "rgba(255,77,0,0.35)"
                  : "var(--df-outline, rgba(255,255,255,0.06))",
                background: state === "forged"
                  ? "rgba(138,160,184,0.05)"
                  : isActive
                  ? "rgba(255,77,0,0.05)"
                  : "transparent",
                transition: "border-color 0.3s, background 0.3s",
                animation: isFlashing
                  ? "df-forge-flash 0.75s ease-out"
                  : state === "forged"
                  ? "df-section-forged-pulse 3s ease-in-out infinite"
                  : undefined,
              }}
            >
              {/* State indicator */}
              <div style={{ flexShrink: 0 }}>
                {state === "forged" ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14, color: "var(--df-steel-100, #b9c6d4)" }}
                  >
                    check_circle
                  </span>
                ) : isActive ? (
                  <div
                    className="animate-df-pulse"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--df-amber-500, #ff4d00)",
                      boxShadow: "0 0 8px var(--df-amber-500)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
                      background: "transparent",
                    }}
                  />
                )}
              </div>

              {/* Section number + name */}
              <span
                className="df-mono"
                style={{ fontSize: 10, letterSpacing: "0.12em" }}
              >
                <span
                  style={{
                    color: state === "forged"
                      ? "var(--df-steel-100, #b9c6d4)"
                      : isActive
                      ? "var(--df-amber-300, #ff8d4a)"
                      : "var(--df-mute, rgba(227,226,226,0.18))",
                    marginRight: 8,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    color: state === "forged"
                      ? "var(--df-steel-100, #b9c6d4)"
                      : isActive
                      ? "#e3e2e2"
                      : "var(--df-faint, rgba(227,226,226,0.38))",
                  }}
                >
                  {section.displayName}
                </span>
              </span>

              {/* Status pill */}
              <span style={{ marginLeft: "auto" }}>
                {state === "forged" && (
                  <span className="df-pill df-pill-steel" style={{ fontSize: 9, padding: "2px 6px" }}>
                    Forged
                  </span>
                )}
                {isActive && !isWaiting && (
                  <span className="df-pill df-pill-heat" style={{ fontSize: 9, padding: "2px 6px" }}>
                    Forging
                  </span>
                )}
                {isWaiting && (
                  <span className="df-pill df-pill-heat" style={{ fontSize: 9, padding: "2px 6px", opacity: 0.7 }}>
                    Analyzing
                  </span>
                )}
                {state === "pending" && !isActive && (
                  <span className="df-pill df-pill-ghost" style={{ fontSize: 9, padding: "2px 6px" }}>
                    Pending
                  </span>
                )}
              </span>
            </div>

            {/* Inline questions (accordion) */}
            {isActive && sectionQuestions.length > 0 && (
              <div
                className="animate-fade-in"
                style={{
                  marginTop: 8,
                  marginLeft: 18,
                  paddingLeft: 14,
                  borderLeft: "1px solid rgba(255,77,0,0.25)",
                }}
              >
                <FollowUpQuestions
                  documentId={documentId}
                  questions={sectionQuestions}
                  onComplete={() => {
                    const allDone = questions.every((q) => q.answer !== null || q.skipped);
                    if (allDone) onComplete();
                  }}
                />
              </div>
            )}

            {/* Waiting for questions from this section */}
            {isActive && sectionQuestions.length === 0 && (
              <div
                className="animate-fade-in"
                style={{
                  marginTop: 8,
                  marginLeft: 18,
                  paddingLeft: 14,
                  borderLeft: "1px solid rgba(255,77,0,0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                }}
              >
                <div
                  className="animate-df-pulse"
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--df-amber-500, #ff4d00)",
                    flexShrink: 0,
                  }}
                />
                <span
                  className="df-mono"
                  style={{ fontSize: 10, color: "var(--df-faint, rgba(227,226,226,0.38))", letterSpacing: "0.12em" }}
                >
                  Analyzing section…
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
    </div>
  );
}
