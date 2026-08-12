import { useAuth } from "@clerk/clerk-react";
import type { Section } from "@/types";
import { apiExportDocument } from "@/utils/api";

interface AuditSuccessProps {
  documentId: string;
  sections: Section[];
}

export function AuditSuccess({ documentId, sections }: AuditSuccessProps) {
  const { getToken } = useAuth();
  const handleExport = () => void apiExportDocument(documentId, "md", getToken);

  return (
    <div className="h-full pt-[64px] flex flex-col items-center px-6 overflow-y-auto">
      <div className="max-w-4xl w-full py-12">
        {/* Success banner */}
        <div className="rounded-xl p-4 bg-green-500/10 border border-green-500/30 mb-8">
          <p className="text-sm text-green-400 font-medium text-center">
            ✓ Audit passed - RFC is consistent
          </p>
        </div>

        {/* Document preview */}
        <div className="panel-depth rounded-xl p-8 bg-surface-container-low mb-8">
          {sections.map((section) => {
            if (!section.activeVersionContent) return null;

            return (
              <div key={section.id} className="mb-6 last:mb-0">
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm text-on-surface/90 leading-relaxed">
                    {section.activeVersionContent}
                  </div>
                </div>
                <hr className="border-outline-variant/20 my-6 last:hidden" />
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleExport}
            className="px-6 py-3 bg-primary-container text-on-primary-container rounded-lg font-medium text-sm hover:brightness-110 transition-all active:scale-[0.98]"
          >
            ⬇ Export Markdown
          </button>
          <button
            onClick={() => {
              // TODO: backend endpoint to reopen document for editing
            }}
            className="px-6 py-3 bg-surface-container-high text-on-surface rounded-lg font-medium text-sm hover:brightness-110 transition-all active:scale-[0.98] border border-outline-variant/20"
          >
            ↩ Reopen for editing
          </button>
        </div>
      </div>
    </div>
  );
}
