import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { Document, Section, GuidedSectionType as SectionType } from "@/types";
import {
  apiApprovePipelineAlignment,
  apiRejectPipelineAlignment,
  apiSendEvent,
} from "@/utils/api";
import { ForgeLoader } from "@/components/shared";
import { SummaryCard } from "./SummaryCard";

import { useI18n } from "@/i18n";
const ALIGNMENT_STEPS = [
  { message: "g.al.s1", detail: "g.al.s1d" },
  { message: "g.al.s2", detail: "g.al.s2d" },
  { message: "g.al.s3", detail: "g.al.s3d" },
  { message: "g.al.s4", detail: "g.al.s4d" },
];

interface AlignmentLayoutProps {
  documentId: string;
  sections: Section[];
  documentMode?: Document["documentMode"];
}

type CardStatus = "pending" | "approved" | "editing" | "regenerating";

interface CardState {
  status: CardStatus;
  summary: string;
  rejectionReason: string;
}


const SECTION_ORDER: SectionType[] = [
  "context",
  "proposal",
  "implementation",
  "risks",
];

export function AlignmentLayout({ documentId, sections, documentMode }: AlignmentLayoutProps) {
  const { t } = useI18n();
  const { getToken } = useAuth();
  const isPipeline = documentMode === "pipeline";
  const [cards, setCards] = useState<Record<SectionType, CardState>>(() => {
    const initial: Record<string, CardState> = {};
    for (const type of SECTION_ORDER) {
      const section = sections.find((s) => s.sectionType === type);
      initial[type] = { status: "pending", summary: section?.summary ?? "", rejectionReason: "" };
    }
    return initial as Record<SectionType, CardState>;
  });

  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
    if (isPipeline) {
      // BYOA pipeline: rejection unblocks the run and becomes agent feedback,
      // scoped to this section (section_key, not a string-prefixed comment) —
      // the user's agent revises the summaries and resubmits.
      setCards((prev) => ({
        ...prev,
        [type]: { ...prev[type], status: "pending", rejectionReason: reason },
      }));
      await apiRejectPipelineAlignment(documentId, reason, getToken, type);
      return;
    }
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
    setConfirmError(null);
    try {
      if (isPipeline) {
        await apiApprovePipelineAlignment(documentId, getToken);
        return;
      }
      await apiSendEvent(documentId, "approved_alignment", { all_approved: true }, getToken);
    } catch {
      // Backend gate refused (e.g. a section still has open feedback from a
      // rejection the client didn't know about) — surface it instead of
      // leaving the button stuck on "Confirming…" forever.
      setConfirmError(t("g.al.err"));
    } finally {
      setConfirming(false);
    }
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
        background: "var(--color-bg)",
        overflow: "hidden",
      }}
    >
      {!hasSummaries ? (
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div className="animate-fade-in">
            <ForgeLoader steps={ALIGNMENT_STEPS.map((step) => ({ message: t(step.message), detail: t(step.detail) }))} stepInterval={3500} />
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
              border: "1px solid var(--color-outline)",
              borderRadius: "var(--radius-md)",
              padding: "16px 22px",
              background: "var(--color-veil)",
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                className="df-mono"
                style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-heat-hi)" }}
              >
                {t("g.al.eyebrow")}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {t("g.al.title")}
              </span>
              <span
                className="df-mono"
                style={{ fontSize: 11.5, color: "var(--color-dim)" }}
              >
                <span style={{ color: "var(--color-heat-hi)" }}>{t("g.al.approved", { count: approvedCount })}</span>
                {revisingCount > 0 && (
                  <> · <span style={{ color: "var(--color-heat-hi)" }}>{t("g.al.revising", { count: revisingCount })}</span></>
                )}
                {" · "}
                <span style={{ color: "var(--color-faint)" }}>{t("g.al.hint")}</span>
              </span>
            </div>

            {/* Progress meter */}
            <div
              style={{
                flex: 1,
                maxWidth: 360,
                height: 6,
                borderRadius: "var(--radius-pill)",
                background: "var(--color-hover)",
                border: "1px solid var(--color-outline)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(approvedCount / SECTION_ORDER.length) * 100}%`,
                  background:
                    "linear-gradient(90deg, var(--color-heat-deep), var(--color-heat) 60%, var(--color-heat-hi))",
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
                        "linear-gradient(90deg, transparent, var(--color-spark))",
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
                  borderRadius: "var(--radius-sm)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  border: "1px solid var(--color-heat)",
                  background: "var(--color-heat)",
                  color: "var(--color-on-heat)",
                  cursor: !allApproved || confirming ? "not-allowed" : "pointer",
                  opacity: !allApproved || confirming ? 0.55 : 1,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: allApproved
                    ? "0 0 0 1px var(--color-heat-strong), 0 4px 14px var(--color-heat-strong)"
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
                        "linear-gradient(120deg, transparent 0%, var(--color-sheen) 35%, transparent 65%)",
                      pointerEvents: "none",
                    }}
                  />
                )}
                {confirming ? t("g.al.confirming") : t("g.al.confirm")}
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  arrow_forward
                </span>
              </button>
              {confirmError && (
                <div
                  className="df-mono"
                  style={{ marginTop: 6, fontSize: 11.5, color: "var(--color-error)", maxWidth: 220, textAlign: "right" }}
                >
                  {confirmError}
                </div>
              )}
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
              alignContent: "start",
            }}
            className="hide-scrollbar"
          >
            {SECTION_ORDER.map((type) => (
              <SummaryCard
                key={type}
                label={t(`section.${type}`)}
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
