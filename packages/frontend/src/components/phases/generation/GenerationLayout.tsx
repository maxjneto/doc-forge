import type { Section, SectionType } from "@/types";
import { SectionProgress } from "./SectionProgress";

interface GenerationLayoutProps {
  documentId: string;
  sections: Section[];
}

type GenerationStatus = "waiting" | "generating" | "done";

const SECTION_ORDER: { type: SectionType; label: string }[] = [
  { type: "context", label: "Context" },
  { type: "proposal", label: "Proposal" },
  { type: "implementation", label: "Implementation" },
  { type: "risks", label: "Risks & Alternatives" },
];

function getSectionStatus(section: Section | undefined): GenerationStatus {
  if (!section) return "waiting";
  if (section.activeVersionContent) return "done";
  if (section.status === "drafting") return "generating";
  return "waiting";
}

export function GenerationLayout({
  documentId: _documentId,
  sections,
}: GenerationLayoutProps) {
  const sectionStates = SECTION_ORDER.map((s) => {
    const section = sections.find((sec) => sec.sectionType === s.type);
    return {
      ...s,
      status: getSectionStatus(section),
    };
  });

  const currentGenerating = sectionStates.find(
    (s) => s.status === "generating"
  );

  // Phase transition to refinement is handled by DocumentPage polling

  return (
    <div style={{ height: '100%', paddingTop: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="px-6">
      <div style={{ width: '100%', maxWidth: '28rem' }}>
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold text-on-surface mb-2">
            Forging your RFC...
          </h2>
          <p className="text-sm text-on-surface-variant/60">
            Generating all 4 document sections
          </p>
        </div>

        <div className="space-y-4">
          {sectionStates.map((section) => (
            <SectionProgress
              key={section.type}
              label={section.label}
              status={section.status}
            />
          ))}
        </div>

        {currentGenerating && (
          <div className="mt-8 panel-depth rounded-xl p-5 bg-surface-container-low w-full animate-fade-in">
            <div className="space-y-2">
              <div className="h-3 bg-surface-container-high rounded animate-pulse w-full" />
              <div className="h-3 bg-surface-container-high rounded animate-pulse w-5/6" />
              <div className="h-3 bg-surface-container-high rounded animate-pulse w-4/6" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
