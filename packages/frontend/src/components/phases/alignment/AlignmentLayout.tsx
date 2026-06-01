import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { Section, GuidedSectionType as SectionType } from "@/types";
import { apiSendEvent } from "@/utils/api";
import { ForgeLoader } from "@/components/shared";
import { SummaryCard } from "./SummaryCard";

const ALIGNMENT_STEPS = [
  { message: "Analyzing your answers...", detail: "Extracting key requirements" },
  { message: "Mapping document structure...", detail: "Organizing sections" },
  { message: "Drafting section summaries...", detail: "Preparing alignment view" },
  { message: "Almost ready...", detail: "Finalizing section content" },
];

interface AlignmentLayoutProps {
  documentId: string;
  sections: Section[];
}

type CardStatus = "pending" | "approved" | "editing" | "regenerating";

interface CardState {
  status: CardStatus;
  summary: string;
  rejectionReason: string;
}

const SECTION_META: Record<SectionType, { label: string }> = {
  context:        { label: "Context" },
  proposal:       { label: "Proposal" },
  implementation: { label: "Implementation" },
  risks:          { label: "Risks & Alternatives" },
};

const SECTION_ORDER: SectionType[] = [
  "context",
  "proposal",
  "implementation",
  "risks",
];

export function AlignmentLayout({ documentId, sections }: AlignmentLayoutProps) {
  const { getToken } = useAuth();
  const [cards, setCards] = useState<Record<SectionType, CardState>>(() => {
    const initial: Record<string, CardState> = {};
    for (const type of SECTION_ORDER) {
      const section = sections.find((s) => s.sectionType === type);
      initial[type] = { status: "pending", summary: section?.summary ?? "", rejectionReason: "" };
    }
    return initial as Record<SectionType, CardState>;
  });

  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setCards((prev) => {
      const updated = { ...prev };
      let changed = false;
      for (const type of SECTION_ORDER) {
        const section = sections.find((s) => s.sectionType === type);
        if (section?.summary && section.summary !== updated[type].summary) {
          updated[type] = {
            ...updated[type],
            summary: section.summary,
            status: updated[type].status === "regenerating" ? "pending" : updated[type].status,
          };
          changed = true;
        }
      }
      return changed ? updated : prev;
    });
  }, [sections]);

  const hasSummaries = SECTION_ORDER.some((type) => cards[type].summary);
  const allApproved = SECTION_ORDER.every((type) => cards[type].status === "approved");
  const approvedCount = SECTION_ORDER.filter((type) => cards[type].status === "approved").length;
  const revisingCount = SECTION_ORDER.filter((type) => cards[type].status === "regenerating").length;

  const handleApprove = (type: SectionType) => {
    setCards((prev) => ({ ...prev, [type]: { ...prev[type], status: "approved" } }));
  };

  const handleStartEdit = (type: SectionType) => {
    setCards((prev) => ({ ...prev, [type]: { ...prev[type], status: "editing" } }));
  };

  const handleReject = async (type: SectionType, reason: string) => {
    setCards((prev) => ({
      ...prev,
      [type]: { ...prev[type], status: "regenerating", rejectionReason: reason },
    }));
    await apiSendEvent(documentId, "approved_alignment", {
      all_approved: false,
      rejected: [{ section: type, reason }],
    }, getToken);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    await apiSendEvent(documentId, "approved_alignment", { all_approved: true }, getToken);
  };

  const handleReopen = (type: SectionType) => {
    setCards((prev) => ({ ...prev, [type]: { ...prev[type], status: "pending" } }));
    posthog.capture("alignment_section_reopened", { document_id: documentId, section_type: type });
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
      {!hasSummaries ? (
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div className="animate-fade-in">
            <ForgeLoader steps={ALIGNMENT_STEPS} stepInterval={3500} />
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "36px 56px",
            gap: 24,
            overflow: "hidden",
          }}
        >
          {/* Progress card */}
          <div
            style={{
              border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
              borderRadius: 10,
              padding: "16px 22px",
              background: "rgba(18,20,20,0.5)",
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="df-mono"
                style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--df-amber-300, #ff8d4a)" }}
              >
                Align before generation
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Approve each summary or send notes back.
              </span>
              <span
                className="df-mono"
                style={{ fontSize: 11, color: "var(--df-dim, rgba(227,226,226,0.62))" }}
              >
                <span style={{ color: "var(--df-amber-300, #ff8d4a)" }}>{approvedCount} approved</span>
                {revisingCount > 0 && (
                  <> · <span style={{ color: "var(--df-amber-300, #ff8d4a)" }}>{revisingCount} in revision</span></>
                )}
                {" · "}
                <span style={{ color: "var(--df-steel-100, #b9c6d4)" }}>approve all to pour</span>
              </span>
            </div>

            {/* Progress meter */}
            <div
              style={{
                flex: 1,
                maxWidth: 360,
                height: 6,
                borderRadius: 999,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(approvedCount / SECTION_ORDER.length) * 100}%`,
                  background:
                    "linear-gradient(90deg, var(--df-amber-700, #6e1d00), var(--df-amber-500, #ff4d00) 60%, var(--df-amber-300, #ff8d4a))",
                  position: "relative",
                  transition: "width 0.4s ease",
                }}
              >
                {approvedCount < SECTION_ORDER.length && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 16,
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,217,184,0.65))",
                      filter: "blur(4px)",
                    }}
                  />
                )}
              </div>
            </div>

            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={handleConfirm}
                disabled={!allApproved || confirming}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  border: "1px solid var(--df-amber-500, #ff4d00)",
                  background: "var(--df-amber-500, #ff4d00)",
                  color: "#fff",
                  cursor: !allApproved || confirming ? "not-allowed" : "pointer",
                  opacity: !allApproved || confirming ? 0.55 : 1,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: allApproved
                    ? "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)"
                    : "none",
                }}
              >
                {allApproved && !confirming && (
                  <div
                    className="animate-df-shimmer"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.20) 35%, transparent 65%)",
                      pointerEvents: "none",
                    }}
                  />
                )}
                {confirming ? "Confirming…" : "Confirm and pour"}
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  arrow_forward
                </span>
              </button>
            </div>
          </div>

          {/* 2-column card grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 16,
              flex: 1,
              overflow: "auto",
            }}
            className="hide-scrollbar"
          >
            {SECTION_ORDER.map((type) => (
              <SummaryCard
                key={type}
                label={SECTION_META[type].label}
                summary={cards[type].summary}
                status={cards[type].status}
                locked={confirming}
                onApprove={() => handleApprove(type)}
                onStartEdit={() => handleStartEdit(type)}
                onReject={(reason) => handleReject(type, reason)}
                onReopen={() => handleReopen(type)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
