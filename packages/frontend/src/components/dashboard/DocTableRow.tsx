import { useRef, useState } from "react";
import type { Document } from "@/types";
import { consumeDocumentDragClick, startDocumentPointerDrag } from "./documentPointerDrag";
import { IconButton, Pill, type PillTone } from "@/components/ui";
import { useI18n } from "@/i18n";
import { fullDate, relativeTime } from "@/utils/time";

/** Columns shared by every row of the library table, and its header. */
export const LIBRARY_GRID = "minmax(0,1fr) 196px 176px 96px 128px";

/**
 * The document's state as one pill (colour grammar R2/R5): steel = published
 * and frozen, heat = something in progress, ghost = a plain draft.
 */
function statusOf(doc: Document, t: (key: string, vars?: Record<string, string | number>) => string): { tone: PillTone; label: string; dot?: boolean } {
  if (doc.archivedAt) return { tone: "ghost", label: t("dashboard.archived") };
  if (doc.publishedAt && doc.hasUnpublishedChanges) return { tone: "heat", label: t("dashboard.unpublishedChanges") };
  if (doc.publishedAt) return { tone: "steel", label: t("common.published") };
  return { tone: "ghost", label: t("common.draft") };
}

export function DocTableRow({
  doc,
  location,
  onClick,
  onRename,
  onShare,
  onMoveToFolder,
  onRequestMove,
  onArchive,
  onRestore,
}: {
  doc: Document;
  /** Folder path shown under the title when the row is listed outside its folder. */
  location?: string | null;
  onClick: () => void;
  onRename: (docId: string, title: string) => Promise<void>;
  onShare?: () => void;
  /** Called when the row is dropped on a folder in the rail. */
  onMoveToFolder?: (folderId: string | null) => void;
  onRequestMove?: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
}) {
  const { t, dateLocale } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const status = statusOf(doc, t);
  const agent = doc.hasApiKeyActivity ? doc.lastApiKeyName : null;

  const startRename = () => {
    setTitleDraft(doc.title);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commitRename = async () => {
    setRenaming(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === doc.title) return;
    await onRename(doc.id, trimmed);
  };

  /** Row actions must neither open the document nor start a drag. */
  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="df-row"
      role="link"
      tabIndex={0}
      onClick={renaming ? undefined : () => { if (!consumeDocumentDragClick(doc.id)) onClick(); }}
      onKeyDown={(e) => { if (e.key === "Enter" && !renaming && e.target === e.currentTarget) onClick(); }}
      onPointerDown={(event) => {
        if (!renaming && onMoveToFolder) startDocumentPointerDrag(event, doc, onMoveToFolder);
      }}
      style={{
        display: "grid",
        gridTemplateColumns: LIBRARY_GRID,
        alignItems: "center",
        gap: 16,
        minHeight: 56,
        padding: "8px 16px 8px 18px",
        borderTop: "1px solid var(--color-outline)",
        cursor: renaming ? "default" : "pointer",
        touchAction: onMoveToFolder ? "none" : "auto",
      }}
    >
      {/* Name */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          className="material-symbols-outlined"
          aria-hidden
          style={{ fontSize: 20, color: doc.archivedAt ? "var(--color-mute)" : "var(--color-faint)", flexShrink: 0 }}
        >
          {doc.documentMode === "layout" ? "dashboard" : "description"}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {renaming ? (
            <input
              data-no-document-drag
              ref={inputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              maxLength={200}
              aria-label={t("common.rename")}
              style={{
                width: "100%",
                padding: "1px 0",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--color-text)",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--color-heat-line)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          ) : (
            <div
              title={doc.title}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: doc.archivedAt ? "var(--color-dim)" : "var(--color-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.title}
            </div>
          )}
          {location && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, fontSize: 11.5, color: "var(--color-faint)" }}>
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 13 }}>folder</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div style={{ minWidth: 0 }}>
        <Pill tone={status.tone} compact style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
          {status.label}
        </Pill>
      </div>

      {/* Agent */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, fontSize: 12.5 }}>
        {agent ? (
          <>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 15, color: "var(--color-steel)" }}>terminal</span>
            <span title={t("dashboard.lastEditedBy", { name: agent })} style={{ color: "var(--color-steel-hi)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {agent}
            </span>
          </>
        ) : (
          <span style={{ color: "var(--color-mute)" }}>—</span>
        )}
      </div>

      {/* Modified */}
      <span
        title={fullDate(doc.updatedAt, dateLocale)}
        style={{ fontSize: 12.5, color: "var(--color-faint)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
      >
        {relativeTime(doc.updatedAt, dateLocale)}
      </span>

      {/* Actions */}
      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 4 }}>
        <div className="df-row-actions">
          {!doc.archivedAt && <IconButton data-no-document-drag icon="edit" label={t("common.rename")} onClick={act(startRename)} />}
          {onRequestMove && <IconButton data-no-document-drag icon="drive_file_move" label={t("dashboard.move")} onClick={act(onRequestMove)} />}
          {onShare && !doc.archivedAt && <IconButton data-no-document-drag icon="person_add" label={t("common.share")} onClick={act(onShare)} />}
          {onArchive && <IconButton data-no-document-drag icon="archive" label={t("dashboard.archiveDocument")} onClick={act(onArchive)} />}
          {onRestore && <IconButton data-no-document-drag icon="unarchive" label={t("dashboard.restoreDocument")} onClick={act(onRestore)} />}
        </div>
        <span className="material-symbols-outlined df-row-chevron" aria-hidden style={{ fontSize: 18 }}>chevron_right</span>
      </div>
    </div>
  );
}
