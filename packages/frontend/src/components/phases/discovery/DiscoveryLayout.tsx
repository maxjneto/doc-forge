import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { DiscoveryQuestion } from "@/types";
import { apiCreateDocument } from "@/utils/api";
import { InitialInput } from "./InitialInput";
import { ProcessingState } from "./ProcessingState";
import { FollowUpQuestions } from "./FollowUpQuestions";

type DiscoverySubState = "input" | "processing" | "questions";

interface DiscoveryLayoutProps {
  documentId: string | null;
  questions: DiscoveryQuestion[];
  onDocumentCreated?: (docId: string) => void;
  documentTypeSlug?: string;
}

const GHOST_ZONES = [
  { name: "Context" },
  { name: "Proposal" },
  { name: "Implementation" },
  { name: "Risks" },
];

function GhostDocument({ answeredCount, totalCount }: { answeredCount: number; totalCount: number }) {
  const heatFraction = totalCount > 0 ? answeredCount / totalCount : 0;

  function getZoneState(zoneIdx: number): "heated" | "heating" | "cold" {
    const threshold = (zoneIdx / GHOST_ZONES.length);
    const nextThreshold = ((zoneIdx + 1) / GHOST_ZONES.length);
    if (heatFraction >= nextThreshold) return "heated";
    if (heatFraction >= threshold) return "heating";
    return "cold";
  }

  return (
    <div
      style={{
        borderRight: "none",
        padding: "32px 40px",
        overflow: "hidden",
        position: "relative",
        flex: 1,
        background: "radial-gradient(ellipse 600px 400px at 50% 30%, rgba(255,77,0,0.025), transparent 65%)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div
            className="df-mono"
            style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--df-amber-300, #ff8d4a)", marginBottom: 6 }}
          >
            Ghost Document · live preview
          </div>
          <div style={{ fontSize: 13, color: "var(--df-dim, rgba(227,226,226,0.62))" }}>
            Sections heat as your answers land.
          </div>
        </div>
        {answeredCount > 0 && (
          <span className="df-pill df-pill-heat">
            Heating · zone {Math.min(answeredCount, GHOST_ZONES.length)}
          </span>
        )}
      </div>

      {/* Ghost doc */}
      <div
        style={{
          border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          borderRadius: 10,
          padding: "26px 28px",
          background: "rgba(13,14,15,0.6)",
          height: "calc(100% - 80px)",
          overflow: "hidden",
        }}
      >
        {GHOST_ZONES.map((zone, i) => {
          const state = getZoneState(i);
          const isHeated = state === "heated";
          const isHeating = state === "heating";

          return (
            <div
              key={zone.name}
              style={{
                marginBottom: 22,
                padding: "14px 16px 16px",
                borderRadius: 8,
                border: "1px solid",
                position: "relative",
                borderColor: isHeated
                  ? "rgba(255,77,0,0.30)"
                  : isHeating
                  ? "rgba(255,77,0,0.45)"
                  : "var(--df-outline, rgba(255,255,255,0.06))",
                background: isHeated
                  ? "rgba(255,77,0,0.05)"
                  : isHeating
                  ? "rgba(255,77,0,0.08)"
                  : "transparent",
                boxShadow: isHeating ? "0 0 0 4px rgba(255,77,0,0.04)" : "none",
                overflow: "hidden",
              }}
            >
              {/* Pulsing left edge on heating */}
              {isHeating && (
                <div
                  className="animate-df-pulse"
                  style={{
                    position: "absolute",
                    left: -1,
                    top: -1,
                    bottom: -1,
                    width: 3,
                    background: "var(--df-amber-500, #ff4d00)",
                    boxShadow: "0 0 12px var(--df-amber-500)",
                    borderRadius: "8px 0 0 8px",
                  }}
                />
              )}

              {/* Zone header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span
                  className="df-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: isHeated
                      ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                      : isHeating
                      ? "var(--df-amber-300, #ff8d4a)"
                      : "var(--df-faint, rgba(227,226,226,0.38))",
                  }}
                >
                  › {zone.name}
                  {isHeating && (
                    <span
                      className="df-ember animate-df-pulse"
                      style={{ marginLeft: 6 }}
                    />
                  )}
                </span>
                <span
                  className="df-mono"
                  style={{
                    fontSize: 10,
                    color: isHeated
                      ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                      : isHeating
                      ? "var(--df-amber-300, #ff8d4a)"
                      : "var(--df-mute, rgba(227,226,226,0.18))",
                  }}
                >
                  {isHeated ? "FORGED" : isHeating ? "HEATING" : "PRE-HEAT"}
                </span>
              </div>

              {/* Skeleton lines */}
              {[92, 78, 86, 64].slice(0, i === 2 ? 4 : 3).map((w, li) => (
                <span
                  key={li}
                  style={{
                    display: "block",
                    height: 6,
                    borderRadius: 2,
                    marginBottom: 7,
                    width: `${w}%`,
                    background: isHeated
                      ? "rgba(255,77,0,0.22)"
                      : isHeating
                      ? "rgba(255,77,0,0.30)"
                      : "rgba(255,255,255,0.04)",
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DiscoveryLayout({
  documentId,
  questions,
  onDocumentCreated,
  documentTypeSlug = "document",
}: DiscoveryLayoutProps) {
  const { getToken } = useAuth();
  const getInitialSubState = (): DiscoverySubState => {
    if (!documentId) return "input";
    if (questions.length > 0) return "questions";
    return "processing";
  };

  const [subState, setSubState] = useState<DiscoverySubState>(getInitialSubState);

  useEffect(() => {
    if (documentId && questions.length > 0) {
      setSubState("questions");
    }
  }, [documentId, questions.length]);

  const answeredCount = questions.filter(
    (q) => q.answer !== null || q.skipped
  ).length;

  const handleSubmitInput = async (context: string, preferences: string) => {
    setSubState("processing");
    const doc = await apiCreateDocument(
      "New Document",
      context,
      getToken,
      preferences,
      documentTypeSlug
    );
    onDocumentCreated?.(doc.id);
  };

  const handleQuestionsComplete = () => {
    setSubState("processing");
  };

  /* ── Full-screen input / processing (before questions) ── */
  if (subState === "input") {
    return (
      <div
        style={{
          height: "100%",
          paddingTop: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "56px 24px 24px",
          overflow: "auto",
        }}
      >
        <div className="animate-fade-in" style={{ width: "100%", maxWidth: "56rem" }}>
          <InitialInput onSubmit={handleSubmitInput} />
        </div>
      </div>
    );
  }

  if (subState === "processing") {
    return (
      <div
        style={{
          height: "100%",
          paddingTop: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="animate-fade-in" style={{ width: "100%", maxWidth: "28rem", textAlign: "center" }}>
          <ProcessingState />
        </div>
      </div>
    );
  }

  /* ── 2-column Q&A + ghost document ── */
  return (
    <div
      style={{
        height: "100%",
        paddingTop: 56,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--df-bg, #0a0b0c)",
      }}
    >
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 2fr", overflow: "hidden" }}>
        {/* Left: Q&A panel */}
        <div
          style={{
            borderRight: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            overflow: "hidden",
          }}
        >
          {/* Gauge */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>A few questions to enrich the context</div>
                <span
                  className="df-mono"
                  style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--df-faint, rgba(227,226,226,0.38))" }}
                >
                  Heat builds as you answer
                </span>
              </div>
              <span
                className="df-mono"
                style={{ fontSize: 11, color: "var(--df-amber-300, #ff8d4a)" }}
              >
                {answeredCount} / {questions.length} forged
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              {questions.map((q, i) => {
                const done = q.answer !== null || q.skipped;
                const isNow = i === answeredCount && !done;
                return (
                  <div
                    key={q.id}
                    style={{
                      flex: 1,
                      height: 4,
                      borderRadius: 2,
                      background: done
                        ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                        : isNow
                        ? "linear-gradient(90deg, var(--df-amber-700, #6e1d00), var(--df-amber-500, #ff4d00))"
                        : "rgba(255,255,255,0.04)",
                      border: done || isNow ? "none" : "1px solid var(--df-outline)",
                      boxShadow: isNow ? "0 0 8px rgba(255,77,0,0.6)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Questions */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {documentId && (
              <FollowUpQuestions
                documentId={documentId}
                questions={questions}
                onComplete={handleQuestionsComplete}
              />
            )}
          </div>
        </div>

        {/* Right: Ghost document */}
        <GhostDocument answeredCount={answeredCount} totalCount={questions.length} />
      </div>
    </div>
  );
}
