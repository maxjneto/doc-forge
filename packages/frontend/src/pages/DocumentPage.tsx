import { useParams } from "react-router-dom";
import { useCallback, useEffect, lazy, Suspense } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import { useDocument } from "@/hooks/useDocument";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { TopBar } from "@/components/shared";
import { apiUpdateDocumentTitle } from "@/utils/api";
import { useI18n } from "@/i18n";

// Layout documents pull in the layout engine and its fonts: load them only when one is opened.
const LayoutDocumentView = lazy(() => import("@/components/layout-doc/LayoutDocumentView"));

export function DocumentPage() {
  const { id: documentId = null } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const { t } = useI18n();

  const { document, sections, loading, refreshNow, sseTick } = useDocument(documentId, getToken);

  // Fire document_opened once when a document is loaded
  useEffect(() => {
    if (!documentId || !document) return;
    posthog.capture("document_opened", {
      document_id: documentId,
      document_type: document.documentMode,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, Boolean(document)]);

  const handleRenameTitle = useCallback(async (title: string) => {
    if (!documentId) return;
    await apiUpdateDocumentTitle(documentId, title, getToken);
    refreshNow();
  }, [documentId, getToken, refreshNow]);

  if (!document || !documentId) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bg">
        <div className="text-faint text-body animate-pulse">
          {loading ? t("document.loading") : null}
        </div>
      </div>
    );
  }

  if (document.documentMode === "layout") {
    return (
      <div className="h-screen w-full overflow-hidden bg-bg text-text antialiased selection:bg-heat-strong">
        <TopBar docTitle={document.title} onRenameTitle={handleRenameTitle} />
        <Suspense fallback={null}>
          <LayoutDocumentView documentId={documentId} sseTick={sseTick} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-bg text-text antialiased selection:bg-heat-strong">
      {/* In the editor the document bar carries the title (and its rename); the
          top bar repeating it would be a second copy of the same breadcrumb. */}
      <TopBar />
      <div className="animate-fade-in h-full w-full">
        <EditorLayout
          documentTitle={document.title}
          isMcpManaged={Boolean(document.hasApiKeyActivity)}
          publishedAt={document.publishedAt}
          hasUnpublishedChanges={document.hasUnpublishedChanges}
          onPublished={refreshNow}
          onRenameTitle={handleRenameTitle}
          documentId={documentId}
          sections={sections}
          sseTick={sseTick}
        />
      </div>
    </div>
  );
}
