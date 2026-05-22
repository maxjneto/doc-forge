import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Phase } from "@/types";
import { useDocument } from "@/hooks/useDocument";
import { usePhase } from "@/hooks/usePhase";
import { PhaseTransition } from "@/components/shared/PhaseTransition";
import { DiscoveryLayout } from "@/components/phases/discovery/DiscoveryLayout";
import { AlignmentLayout } from "@/components/phases/alignment/AlignmentLayout";
import { GenerationLayout } from "@/components/phases/generation/GenerationLayout";
import { CompletedLayout } from "@/components/phases/completed";
import { WorkspaceLayout } from "@/components/workspace";
import { EditorLayout } from "@/components/phases/editor/EditorLayout";
import { AuditLayout } from "@/components/phases/audit/AuditLayout";
import { ForgeLoader, TopBar } from "@/components/shared";
import { apiUpdateDocumentTitle } from "@/utils/api";

export function DocumentPage() {
  const { id: urlId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { getToken } = useAuth();
  const isNew = urlId === "new";
  const locationState = location.state as { documentTypeSlug?: string; documentTitle?: string | null } | null;
  const documentTypeSlug = locationState?.documentTypeSlug ?? "rfc";
  const documentTitle = locationState?.documentTitle ?? null;

  // For new documents, documentId starts as null until created
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);
  const activeDocId = isNew ? createdDocId : (urlId ?? null);

  const { document, sections, discoveryQuestions, auditProblems, loading, refreshNow, sseTick } = useDocument(activeDocId, getToken);

  const currentPhase: Phase = document?.currentPhase ?? "discovery";
  const { config } = usePhase(currentPhase);

  const handleRenameTitle = useCallback(async (title: string) => {
    if (!activeDocId) return;
    await apiUpdateDocumentTitle(activeDocId, title, getToken);
    refreshNow();
  }, [activeDocId, getToken, refreshNow]);

  const handleDocumentCreated = (docId: string) => {
    setCreatedDocId(docId);
    navigate(`/document/${docId}`, { replace: true });
  };

  if (loading && !document && !isNew) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-on-surface-variant/60 text-sm animate-pulse">
          Loading document...
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background text-on-surface antialiased selection:bg-primary/30">
      <TopBar phase={currentPhase} phaseLabel={config?.label} docTitle={document?.title} onRenameTitle={document ? handleRenameTitle : undefined} />
      <PhaseTransition phase={currentPhase}>
        {currentPhase === "discovery" && (
          <DiscoveryLayout
            documentId={activeDocId}
            questions={discoveryQuestions}
            onDocumentCreated={handleDocumentCreated}
            documentTypeSlug={documentTypeSlug}
            documentTitle={documentTitle}
          />
        )}
        {currentPhase === "alignment" && (
          <AlignmentLayout
            documentId={activeDocId!}
            sections={sections}
          />
        )}
        {currentPhase === "generation" && (
          <GenerationLayout
            documentId={activeDocId!}
            sections={sections}
          />
        )}
        {currentPhase === "refinement" && (
          sections.every((s) => s.status === "finalized") ? (
            <div className="h-full pt-[64px] flex items-center justify-center px-6">
              <ForgeLoader
                steps={[
                  { message: "Finalizing your document...", detail: "Preparing the completed draft" },
                  { message: "Running quality checks...", detail: "Verifying section consistency" },
                  { message: "Wrapping up...", detail: "Almost there" },
                ]}
                stepInterval={3500}
              />
            </div>
          ) : (
            <WorkspaceLayout
              documentId={activeDocId!}
              sections={sections}
            />
          )
        )}
        {currentPhase === "audit" && (
          <AuditLayout
            documentId={activeDocId!}
            currentPhase={currentPhase}
            sections={sections}
            auditProblems={auditProblems}
          />
        )}
        {currentPhase === "completed" && (
          <CompletedLayout
            documentId={activeDocId!}
            sections={sections}
            onSaved={refreshNow}
          />
        )}
        {currentPhase === "editing" && (
          <EditorLayout
            documentId={activeDocId!}
            sections={sections}
            sseTick={sseTick}
          />
        )}
      </PhaseTransition>
    </div>
  );
}
