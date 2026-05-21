import { Icon } from "@/components/shared";
import type { AuditFinding, SectionType } from "@/types";

const SECTION_LABELS: Record<SectionType, string> = {
  context: "Context",
  proposal: "Proposal",
  implementation: "Implementation",
  risks: "Risks & Alternatives",
  body: "Document",
};

interface AuditWarningCardProps {
  finding: AuditFinding;
  onDismiss: (id: string) => void;
  onClick: (sectionType: SectionType) => void;
}

export function AuditWarningCard({ finding, onDismiss, onClick }: AuditWarningCardProps) {
  const isHigh = finding.severity === "high";

  return (
    <div
      onClick={() => onClick(finding.sectionType)}
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:brightness-110 group ${
        isHigh
          ? "border-error/25 bg-error-container/10"
          : "border-primary/20 bg-primary/5"
      }`}
    >
      <Icon
        name="warning"
        className={`mt-0.5 shrink-0 !text-[16px] ${isHigh ? "text-error" : "text-primary"}`}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              isHigh ? "text-error bg-error-container/20" : "text-primary bg-primary/10"
            }`}
          >
            {finding.severity}
          </span>
          <span className="text-[11px] text-on-surface-variant/60 font-medium">
            {SECTION_LABELS[finding.sectionType]}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant/80 leading-relaxed">{finding.description}</p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(finding.id);
        }}
        className="shrink-0 p-1 rounded text-on-surface-variant/40 hover:text-on-surface-variant/80 transition-colors opacity-0 group-hover:opacity-100"
        title="Dismiss"
      >
        <Icon name="close" className="!text-[14px]" />
      </button>
    </div>
  );
}
