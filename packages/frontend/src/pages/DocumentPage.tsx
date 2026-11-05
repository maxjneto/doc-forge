import { useParams } from "react-router-dom";
import { useCallback, useEffect, useState, lazy, Suspense } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setAnalyticsContext, track } from "@/analytics";
import { useDocument } from "@/hooks/useDocument";
import { EditorLayout } from "@/components/editor/EditorLayout";
import { canCommentAs, canEditAs, ContextPills, type DocumentRole } from "@/components/document";
import { TopBar } from "@/components/shared";
import { apiFetchMembers, apiUpdateDocumentTitle } from "@/utils/api";
import { useI18n } from "@/i18n";

// Layout documents pull in the layout engine and its fonts: load them only when one is opened.
const LayoutDocumentView = lazy(() => import("@/components/layout-doc/LayoutDocumentView"));

export function DocumentPage() {
  const { id: documentId = null } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const { t } = useI18n();

  const { document, sections, loading, refreshNow, sseTick, presenceTick } = useDocument(documentId, getToken);
  const [role, setRole] = useState<DocumentRole | null>(null);

  // What the viewer may do decides the editor they get, so it is known before either opens.
  useEffect(() => {
    if (!documentId) return;
    let cancelled = false;
    setRole(null);
    apiFetchMembers(documentId, getToken)
      .then((m) => !cancelled && setRole((m.myRole as DocumentRole) ?? "viewer"))
      // Without the members list, read-only is the safe default.
      .catch(() => !cancelled && setRole("viewer"));
    return () => {
      cancelled = true;
    };
  }, [documentId, getToken]);

  // Every event from inside the document says which one it is about and who is acting.
  const mode = document?.documentMode;
  useEffect(() => {
    if (!documentId || !mode || !role) return;
    setAnalyticsContext({ document_id: documentId, document_mode: mode, role });
    track("document_opened");
    return () => setAnalyticsContext(null);
  }, [documentId, mode, role]);

  const handleRenameTitle = useCallback(async (title: string) => {
    if (!documentId) return;
    await apiUpdateDocumentTitle(documentId, title, getToken);
    refreshNow();
  }, [documentId, getToken, refreshNow]);

  if (!document || !documentId || !role) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-bg">
        <div className="text-faint text-body animate-pulse">
          {loading || (document && !role) ? t("document.loading") : null}
        </div>
      </div>
    );
  }

  const canEdit = canEditAs(role);
  const context = <ContextPills role={role} viaMcp={Boolean(document.hasApiKeyActivity)} />;

  // Both kinds of document open in the same shell: the document bar carries the
  // title, so the top bar only brands and navigates.
  return (
    <div className="h-screen w-full overflow-hidden bg-bg text-text antialiased selection:bg-heat-strong">
      <TopBar />
      {document.documentMode === "layout" ? (
        <Suspense fallback={null}>
          <LayoutDocumentView
            documentId={documentId}
            title={document.title}
            onRenameTitle={canEdit ? handleRenameTitle : undefined}
            role={role}
            context={context}
            sseTick={sseTick}
            presenceTick={presenceTick}
          />
        </Suspense>
      ) : (
        <div className="animate-fade-in h-full w-full">
          <EditorLayout
            documentTitle={document.title}
            canEdit={canEdit}
            canComment={canCommentAs(role)}
            context={context}
            publishedAt={document.publishedAt}
            hasUnpublishedChanges={document.hasUnpublishedChanges}
            onPublished={refreshNow}
            onRenameTitle={handleRenameTitle}
            documentId={documentId}
            sections={sections}
            sseTick={sseTick}
            presenceTick={presenceTick}
          />
        </div>
      )}
    </div>
  );
}
