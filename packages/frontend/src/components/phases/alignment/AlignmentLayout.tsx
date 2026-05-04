import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Section, SectionType } from "@/types";
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

const SECTION_META: Record<SectionType, { icon: string; label: string }> = {
  context: { icon: "description", label: "Context" },
  proposal: { icon: "lightbulb", label: "Proposal" },
  implementation: { icon: "build", label: "Implementation" },
  risks: { icon: "warning", label: "Risks & Alternatives" },
};

const SECTION_ORDER: SectionType[] = [
  "context",
  "proposal",
  "implementation",
  "risks",
];

export function AlignmentLayout({
  documentId,
  sections,
}: AlignmentLayoutProps) {
  const { getToken } = useAuth();
  const [cards, setCards] = useState<Record<SectionType, CardState>>(() => {
    const initial: Record<string, CardState> = {};
    for (const type of SECTION_ORDER) {
      const section = sections.find((s) => s.sectionType === type);
      initial[type] = {
        status: "pending",
        summary: section?.summary ?? "",
        rejectionReason: "",
      };
    }
    return initial as Record<SectionType, CardState>;
  });

  const [confirming, setConfirming] = useState(false);

  // Sync summaries from polling data
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
  const allApproved = SECTION_ORDER.every(
    (type) => cards[type].status === "approved"
  );

  const handleApprove = (type: SectionType) => {
    setCards((prev) => ({
      ...prev,
      [type]: { ...prev[type], status: "approved" },
    }));
  };

  const handleStartEdit = (type: SectionType) => {
    setCards((prev) => ({
      ...prev,
      [type]: { ...prev[type], status: "editing" },
    }));
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
    // Polling will update sections with new summaries → useEffect above resets status
  };

  const handleConfirm = async () => {
    setConfirming(true);
    await apiSendEvent(documentId, "approved_alignment", {
      all_approved: true,
    }, getToken);
    // Polling will detect phase change to "generation" → DocumentPage switches layout
  };

  return (
    <div className="h-full pt-[64px] flex flex-col items-center justify-center px-6">
      <div className="max-w-3xl w-full">
        {!hasSummaries ? (
          <div className="flex justify-center mt-12 animate-fade-in">
            <ForgeLoader steps={ALIGNMENT_STEPS} stepInterval={3500} />
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <h2 className="text-lg font-semibold text-on-surface mb-2">
                Validate the document direction
              </h2>
              <p className="text-sm text-on-surface-variant/60">
                Approve or adjust the summary of each section before generating the
                full document.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {SECTION_ORDER.map((type) => (
                <SummaryCard
                  key={type}
                  icon={SECTION_META[type].icon}
                  label={SECTION_META[type].label}
                  summary={cards[type].summary}
                  status={cards[type].status}
                  onApprove={() => handleApprove(type)}
                  onStartEdit={() => handleStartEdit(type)}
                  onReject={(reason) => handleReject(type, reason)}
                />
              ))}
            </div>

            {allApproved && (
              <div className="flex justify-center animate-fade-in">
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="px-6 py-3 bg-primary-container text-on-primary-container rounded-lg font-medium text-sm hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {confirming ? "Confirming..." : "Confirm and Generate Document →"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
