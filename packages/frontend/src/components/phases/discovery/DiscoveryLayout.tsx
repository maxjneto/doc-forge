import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { DiscoveryQuestion, SectionDefinition } from "@/types";
import { apiCreateDocument, apiGetDocumentType } from "@/utils/api";
import { InitialInput } from "./InitialInput";
import { SectionStepper } from "./SectionStepper";

import { Pill } from "@/components/ui";
import { useI18n } from "@/i18n";
// ProcessingState kept for potential reuse but no longer shown fullscreen

type DiscoverySubState = "input" | "forging";

interface DiscoveryLayoutProps {
  documentId: string | null;
  questions: DiscoveryQuestion[];
  onDocumentCreated?: (docId: string) => void;
  documentTypeSlug?: string;
  documentTitle?: string | null;
}

const GHOST_ZONES_DEFAULT = [
  { key: "context" },
  { key: "proposal" },
  { key: "implementation" },
  { key: "risks" },
];

function GhostDocument({ questions }: { questions: DiscoveryQuestion[] }) {
  const { t } = useI18n();
  const activeQuestion = questions.find((q) => q.answer === null && !q.skipped);
  const activeSectionKey = activeQuestion?.sectionKey ?? null;
  const [shimmeringZones, setShimmeringZones] = useState<Set<string>>(new Set());
  const prevZoneStatesRef = useRef<Record<string, "heated" | "heating" | "cold">>({});

  function getZoneState(zoneKey: string): "heated" | "heating" | "cold" {
    const zoneQuestions = questions.filter((q) => q.sectionKey === zoneKey);
    if (zoneQuestions.length === 0) return activeSectionKey === zoneKey ? "heating" : "cold";
    const allDone = zoneQuestions.every((q) => q.answer !== null || q.skipped);
    if (allDone) return "heated";
    if (activeSectionKey === zoneKey) return "heating";
    return "cold";
  }

  useEffect(() => {
    const newlyHeated = new Set<string>();
    GHOST_ZONES_DEFAULT.forEach((zone) => {
      const prev = prevZoneStatesRef.current[zone.key];
      const curr = getZoneState(zone.key);
      if (prev !== "heated" && curr === "heated") newlyHeated.add(zone.key);
      prevZoneStatesRef.current[zone.key] = curr;
    });
    if (newlyHeated.size > 0) {
      setShimmeringZones((prev) => new Set([...prev, ...newlyHeated]));
      setTimeout(() => {
        setShimmeringZones((prev) => {
          const next = new Set(prev);
          newlyHeated.forEach((k) => next.delete(k));
          return next;
        });
      }, 650);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  return (
    <div
      style={{
        borderRight: "none",
        padding: "32px 40px",
        overflow: "hidden",
        position: "relative",
        flex: 1,
        background: "radial-gradient(ellipse 600px 400px at 50% 30%, var(--color-heat-tint), transparent 65%)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div
            className="df-mono"
            style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-heat-hi)", marginBottom: 6 }}
          >
            {t("g.disc.ghostEyebrow")}
          </div>
          <div style={{ fontSize: 13, color: "var(--color-dim)" }}>
            {t("g.disc.ghostLead")}
          </div>
        </div>
        {activeSectionKey && (
          <Pill tone="heat">
            {t("g.disc.heating", { section: t(`section.${activeSectionKey}`) })}
          </Pill>
        )}
      </div>

      {/* Ghost doc */}
      <div
        style={{
          border: "1px solid var(--color-outline)",
          borderRadius: "var(--radius-md)",
          padding: "26px 28px",
          background: "var(--color-chrome)",
          height: "calc(100% - 80px)",
          overflow: "hidden",
        }}
      >
        {GHOST_ZONES_DEFAULT.map((zone, i) => {
          const state = getZoneState(zone.key);
          const isHeated = state === "heated";
          const isHeating = state === "heating";

          const isShimmering = shimmeringZones.has(zone.key);
          return (
            <div
              key={zone.key}
              style={{
                marginBottom: 22,
                padding: "14px 16px 16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid",
                position: "relative",
                overflow: "hidden",
                borderColor: isHeated
                  ? "var(--color-heat-line)"
                  : isHeating
                  ? "var(--color-heat-line)"
                  : "var(--color-outline)",
                background: isHeated
                  ? "var(--color-heat-tint)"
                  : isHeating
                  ? "var(--color-heat-wash)"
                  : "transparent",
                boxShadow: isHeating ? "0 0 0 4px var(--color-heat-tint)" : "none",
              }}
            >
              {isShimmering && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", borderRadius: "inherit" }}>
                  <div style={{
                    position: "absolute", top: 0, bottom: 0, left: 0, width: "40%",
                    background: "linear-gradient(90deg, transparent 0%, var(--color-heat-wash) 50%, transparent 100%)",
                    animation: "df-zone-shimmer 0.65s ease-out forwards",
                  }} />
                </div>
              )}
              {isHeating && (
                <div
                  className="animate-df-pulse"
                  style={{
                    position: "absolute",
                    left: -1,
                    top: -1,
                    bottom: -1,
                    width: 3,
                    background: "var(--color-heat)",
                    boxShadow: "0 0 12px var(--color-heat)",
                    borderRadius: "8px 0 0 8px",
                  }}
                />
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span
                  className="df-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "var(--tracking-eyebrow)",
                    color: isHeated
                      ? "var(--color-heat-line)"
                      : isHeating
                      ? "var(--color-heat-hi)"
                      : "var(--color-faint)",
                  }}
                >
                  › {t(`section.${zone.key}`)}
                  {isHeating && (
                    <span className="df-ember animate-df-pulse" style={{ marginLeft: 6 }} />
                  )}
                </span>
                <span
                  className="df-mono"
                  style={{
                    fontSize: 10,
                    color: isHeated
                      ? "var(--color-heat-line)"
                      : isHeating
                      ? "var(--color-heat-hi)"
                      : "var(--color-mute)",
                  }}
                >
                  {(isHeated ? t("g.state.forged") : isHeating ? t("g.state.heating") : t("g.state.preheat")).toUpperCase()}
                </span>
              </div>

              {[92, 78, 86, 64].slice(0, i === 2 ? 4 : 3).map((w, li) => (
                <span
                  key={li}
                  style={{
                    display: "block",
                    height: 6,
                    borderRadius: "var(--radius-xs)",
                    marginBottom: 7,
                    width: `${w}%`,
                    background: isHeated
                      ? "var(--color-heat-strong)"
                      : isHeating
                      ? "var(--color-heat-line)"
                      : "var(--color-hover)",
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
  documentTypeSlug = "rfc",
  documentTitle = null,
}: DiscoveryLayoutProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [subState, setSubState] = useState<DiscoverySubState>(
    documentId ? "forging" : "input"
  );
  const [sections, setSections] = useState<SectionDefinition[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    apiGetDocumentType(documentTypeSlug, getToken).then((dt) => {
      setSections(dt.sections.slice().sort((a, b) => a.order - b.order));
    }).catch(() => {});
  }, [documentTypeSlug, getToken]);

  useEffect(() => {
    if (documentId) setSubState("forging");
  }, [documentId]);

  const answeredCount = questions.filter((q) => q.answer !== null || q.skipped).length;
  const [countPulsing, setCountPulsing] = useState(false);
  const prevCountRef = useRef(answeredCount);

  useEffect(() => {
    if (answeredCount > prevCountRef.current) {
      setCountPulsing(true);
      const t = setTimeout(() => setCountPulsing(false), 500);
      prevCountRef.current = answeredCount;
      return () => clearTimeout(t);
    }
    prevCountRef.current = answeredCount;
  }, [answeredCount]);

  const handleSubmitInput = async (context: string, preferences: string) => {
    setSubmitError(null);
    setSubState("forging");
    try {
      const doc = await apiCreateDocument(
        documentTitle ?? "",
        context,
        getToken,
        preferences,
        documentTypeSlug
      );
      onDocumentCreated?.(doc.id);
    } catch (err) {
      setSubState("input");
      // apiCreateDocument reports an exhausted weekly quota as this code
      // (the old INSUFFICIENT_CREDITS check never matched).
      if (err instanceof Error && err.message === "WEEKLY_DOCUMENT_LIMIT_REACHED") {
        setSubmitError(t("g.disc.errLimit"));
      } else {
        setSubmitError(t("g.disc.errGeneric"));
      }
    }
  };

  const handleQuestionsComplete = () => {};

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
          {submitError && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--color-error-wash)", border: "1px solid var(--color-error-strong)", fontSize: 13, color: "var(--color-error)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", flexShrink: 0 }}>error</span>
              {submitError}
            </div>
          )}
          <InitialInput onSubmit={handleSubmitInput} />
        </div>
      </div>
    );
  }

  /* ── 2-column: stepper + ghost document ── */
  return (
    <div
      style={{
        height: "100%",
        paddingTop: 56,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 2fr", overflow: "hidden" }}>
        {/* Left: section stepper */}
        <div
          style={{
            borderRight: "1px solid var(--color-outline)",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{t("g.disc.title")}</div>
              <span
                className="df-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "var(--tracking-eyebrow)",
                  textTransform: "uppercase",
                  animation: countPulsing ? "df-counter-pulse 0.5s ease-out" : undefined,
                  color: "var(--color-faint)",
                }}
              >
                {t("g.disc.progress", { done: answeredCount, total: questions.length })}
              </span>
            </div>
          </div>

          {/* Stepper */}
          <div style={{ flex: 1, overflowY: "auto" }} className="hide-scrollbar">
            {documentId && sections.length > 0 && (
              <SectionStepper
                sections={sections}
                questions={questions}
                documentId={documentId}
                onComplete={handleQuestionsComplete}
              />
            )}
            {(!documentId || sections.length === 0) && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 0" }}>
                <div className="animate-df-pulse" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-heat)", flexShrink: 0 }} />
                <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-label)" }}>
                  {t("g.disc.analyzing")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Ghost document */}
        <GhostDocument questions={questions} />
      </div>
    </div>
  );
}
