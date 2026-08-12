import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { apiPublishDocument } from "@/utils/api";
import { Button, Pill } from "@/components/ui";
import { useI18n } from "@/i18n";

interface EditorDocumentBarProps {
  documentId: string;
  title: string;
  /** Pending changes awaiting review — drives the `IN REVIEW` state. */
  pendingChanges: number;
  /** Open blocking gate findings; publishing is refused while any remain. */
  blockingFindings: number;
  isMcpManaged: boolean;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
  savePending?: boolean;
  onPublished?: () => void;
}

/**
 * The document bar from the v4 mock: breadcrumb, state, and the publish
 * gesture.
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
  isMcpManaged,
  publishedAt = null,
  hasUnpublishedChanges = false,
  savePending = false,
  onPublished,
}: EditorDocumentBarProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);

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

  return (
    <div
      style={{
        height: 52,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 20px",
        borderBottom: "1px solid var(--df-outline)",
        background: "var(--color-chrome)",
      }}
    >
      <button
        onClick={() => navigate("/")}
        style={{
          fontSize: 12.5,
          color: "var(--df-faint)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0,
        }}
      >
        {t("editor.documents")}
      </button>
      <span style={{ fontSize: 12.5, color: "var(--df-mute)" }}>/</span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--df-on-surface)",
          maxWidth: 320,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>

      {blocked ? (
        <Pill tone="heat">
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
      ) : published || publishedAt ? (
        <Pill tone="ok" dot>
          {t("editor.published")}{published ? ` · ${published}` : ""}
        </Pill>
      ) : (
        <Pill tone="ghost">{t("common.draft")}</Pill>
      )}

      {isMcpManaged && <Pill tone="ghost">mcp-managed</Pill>}

      <span style={{ flex: 1 }} />

      {error && (
        <span style={{ fontSize: 11.5, color: "var(--df-error)", maxWidth: 380, lineHeight: 1.4 }}>
          {error}
        </span>
      )}

      <Button
        variant={blocked ? "secondary" : "primary"}
        disabled={busy || blocked || savePending}
        onClick={() => void publish()}
        title={
          blocked
            ? t("editor.resolveBlockers")
            : savePending
              ? t("editor.waitForSave")
            : t("editor.publishHint")
        }
      >
        {busy ? t("editor.publishing") : publishedAt ? t("editor.publishNewVersion") : t("editor.publish")}
      </Button>
    </div>
  );
}
