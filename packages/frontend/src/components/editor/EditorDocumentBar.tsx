import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiExportDocument, apiPublishDocument, type ExportFormat } from "@/utils/api";
import { Button, Pill } from "@/components/ui";
import { DocumentBar } from "@/components/document";
import { useI18n } from "@/i18n";

interface EditorDocumentBarProps {
  documentId: string;
  title: string;
  /** Pending changes awaiting review — drives the `IN REVIEW` state. */
  pendingChanges: number;
  /** Open blocking gate findings; publishing is refused while any remain. */
  blockingFindings: number;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
  savePending?: boolean;
  /** Whether the viewer may publish (editors and the owner). */
  canPublish: boolean;
  /** Pills every document shows the same way: the viewer's role, the agent via MCP. */
  context?: ReactNode;
  presence?: ReactNode;
  onPublished?: () => void;
  /** When given, the title in the breadcrumb is renamable in place. */
  onRenameTitle?: (title: string) => Promise<void>;
}

/**
 * The Markdown document's bar: its state and the publish gesture, on the bar
 * every document shares.
 *
 * `Publicar` is not decoration — the active version is the working draft, and
 * publishing marks the one people are meant to read. The gate can refuse it,
 * which is what makes the gate a gate rather than a report.
 */
export function EditorDocumentBar({
  documentId,
  title,
  pendingChanges,
  blockingFindings,
  publishedAt = null,
  hasUnpublishedChanges = false,
  savePending = false,
  canPublish,
  context,
  presence,
  onPublished,
  onRenameTitle,
}: EditorDocumentBarProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const blocked = blockingFindings > 0;

  async function publish() {
    if (busy || blocked || savePending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPublishDocument(documentId, getToken);
      setPublished(result.label);
      onPublished?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("editor.publishError"));
    } finally {
      setBusy(false);
    }
  }

  const state = blocked ? (
    <Pill tone="error" dot>
      {blockingFindings} {t(blockingFindings === 1 ? "editor.blocker" : "editor.blockers")}
    </Pill>
  ) : savePending ? (
    <Pill tone="warn">{t("editor.savingDraft")}</Pill>
  ) : pendingChanges > 0 ? (
    <Pill tone="heat">
      {t("editor.inReview")} · {pendingChanges} {t(pendingChanges === 1 ? "editor.change" : "editor.changes")}
    </Pill>
  ) : publishedAt && hasUnpublishedChanges ? (
    <Pill tone="heat" dot>
      {t("editor.unpublishedChanges")}
    </Pill>
  ) : published ? (
    // Just published in this session — a loop that closed (R3).
    <Pill tone="ok" dot>
      {t("editor.published")} · {published}
    </Pill>
  ) : publishedAt ? (
    // Published as a standing state — frozen, so steel (R2).
    <Pill tone="steel">{t("editor.published")}</Pill>
  ) : (
    <Pill tone="ghost">{t("common.draft")}</Pill>
  );

  return (
    <DocumentBar
      title={title}
      onRenameTitle={onRenameTitle}
      status={
        <>
          {state}
          {context}
        </>
      }
      presence={presence}
      error={error}
      actions={
        <>
          <div className="df-doc-bar__menu">
            <Button variant="secondary" icon="download" iconPosition="start" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((v) => !v)}>
              {t("editor.export")}
            </Button>
            {exportOpen && <ExportMenu documentId={documentId} onClose={() => setExportOpen(false)} />}
          </div>
          {canPublish && (
            <Button
              variant={blocked ? "secondary" : "primary"}
              disabled={busy || blocked || savePending}
              onClick={() => void publish()}
              title={blocked ? t("editor.resolveBlockers") : savePending ? t("editor.waitForSave") : t("editor.publishHint")}
            >
              {busy ? t("editor.publishing") : publishedAt ? t("editor.publishNewVersion") : t("editor.publish")}
            </Button>
          )}
        </>
      }
    />
  );
}

function ExportMenu({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function exportAs(format: ExportFormat) {
    setBusy(format);
    setError(null);
    try {
      // Rendered server-side from the last SAVED version, so unsaved typing is not in it.
      await apiExportDocument(documentId, format, getToken);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("editor.exportError"));
    } finally {
      setBusy(null);
    }
  }

  const items: { key: ExportFormat; icon: string; label: string; ext: string }[] = [
    { key: "md", icon: "code", label: "Markdown", ext: ".MD · PRO" },
    { key: "pdf", icon: "picture_as_pdf", label: "PDF", ext: ".PDF · PRO" },
    { key: "docx", icon: "description", label: "Word", ext: ".DOCX · PRO" },
  ];

  return (
    <div ref={ref} role="menu" className="df-menu" style={{ top: "calc(100% + 6px)", right: 0 }}>
      {items.map((item) => (
        <button key={item.key} type="button" role="menuitem" className="df-menu__item" disabled={busy !== null} onClick={() => void exportAs(item.key)}>
          <span className="material-symbols-outlined" aria-hidden>
            {item.icon}
          </span>
          <span style={{ flex: 1 }}>
            {item.label}
            <span className="df-mono df-menu__hint">{busy === item.key ? t("editor.exporting").toUpperCase() : item.ext}</span>
          </span>
        </button>
      ))}
      {error && <div className="df-menu__error">{error}</div>}
    </div>
  );
}
