import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { apiPublishDocument } from "@/utils/api";
import { Button, IconButton, Pill } from "@/components/ui";
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
  /** When given, the title in the breadcrumb is renamable in place. */
  onRenameTitle?: (title: string) => Promise<void>;
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
  onRenameTitle,
}: EditorDocumentBarProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  async function commitRename() {
    setRenaming(false);
    const next = titleDraft.trim();
    if (!next || next === title || !onRenameTitle) return;
    await onRenameTitle(next);
  }

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
        borderBottom: "1px solid var(--color-outline)",
        background: "var(--color-chrome)",
      }}
    >
      <button
        onClick={() => navigate("/")}
        style={{
          fontSize: 12.5,
          color: "var(--color-faint)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0,
        }}
      >
        {t("editor.documents")}
      </button>
      <span style={{ fontSize: 12.5, color: "var(--color-mute)" }}>/</span>
      {renaming ? (
        <input
          autoFocus
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => void commitRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commitRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          maxLength={200}
          aria-label={t("common.rename")}
          style={{
            width: 320,
            padding: "2px 0",
            fontSize: 12.5,
            fontWeight: 600,
            color: "var(--color-text)",
            background: "transparent",
            border: 0,
            borderBottom: "1px solid var(--color-heat-line)",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
      ) : (
        <span
          className={onRenameTitle ? "df-row" : undefined}
          style={{ display: "inline-flex", alignItems: "center", gap: 2, minWidth: 0, borderRadius: "var(--radius-xs)" }}
        >
          <span
            title={title}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--color-text)",
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          {onRenameTitle && (
            <span className="df-row-actions">
              <IconButton
                icon="edit"
                label={t("common.rename")}
                onClick={() => { setTitleDraft(title); setRenaming(true); }}
                style={{ width: 24, height: 24 }}
              />
            </span>
          )}
        </span>
      )}

      {blocked ? (
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
      )}

      {isMcpManaged && <Pill tone="steel">{t("editor.mcpManaged")}</Pill>}

      <span style={{ flex: 1 }} />

      {error && (
        <span style={{ fontSize: 11.5, color: "var(--color-error)", maxWidth: 380, lineHeight: 1.4 }}>
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
