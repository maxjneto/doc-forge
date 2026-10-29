import type { Folder } from "@/types";
import {
  consumeFolderDragClick,
  startFolderPointerDrag,
  useFolderDragState,
} from "./folderPointerDrag";
import { useDocumentDragState } from "./documentPointerDrag";
import { LIBRARY_GRID } from "./DocTableRow";
import { useI18n } from "@/i18n";

interface FolderTableRowProps {
  folder: Folder;
  childFolderCount: number;
  onOpen: () => void;
  onDropFolder: (folderId: string, parentId: string | null) => Promise<void>;
}

/** A folder in the library table — same row language as a document. */
export function FolderTableRow({
  folder,
  childFolderCount,
  onOpen,
  onDropFolder,
}: FolderTableRowProps) {
  const { t } = useI18n();
  const folderDrag = useFolderDragState();
  const documentDrag = useDocumentDragState();
  const isFolderDropTarget = folderDrag.active && folderDrag.hasTarget && folderDrag.targetId === folder.id;
  const isDocumentDropTarget = documentDrag.active && documentDrag.hasTarget && documentDrag.targetId === folder.id;
  const activeDrop = isFolderDropTarget || isDocumentDropTarget;
  const itemCount = (folder.directDocumentCount ?? 0) + childFolderCount;

  return (
    <div
      className={activeDrop ? "df-row df-row--drop" : "df-row"}
      role="link"
      tabIndex={0}
      aria-label={t("dashboard.openFolder")}
      data-folder-drop-target={folder.id}
      onClick={() => { if (!consumeFolderDragClick(folder.id)) onOpen(); }}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      onPointerDown={(event) => startFolderPointerDrag(event, folder, onDropFolder)}
      style={{
        display: "grid",
        gridTemplateColumns: LIBRARY_GRID,
        alignItems: "center",
        gap: 16,
        minHeight: 56,
        padding: "8px 16px 8px 18px",
        borderTop: "1px solid var(--color-outline)",
        cursor: folderDrag.active && folderDrag.folderId === folder.id ? "grabbing" : "pointer",
        touchAction: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span
          className="material-symbols-outlined"
          aria-hidden
          style={{ fontSize: 20, color: activeDrop ? "var(--color-steel-hi)" : "var(--color-dim)", fontVariationSettings: "'FILL' 1", flexShrink: 0 }}
        >
          {activeDrop ? "folder_open" : "folder"}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 500, color: "var(--color-text)" }}>
            {folder.name}
          </div>
          <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--color-faint)" }}>
            {itemCount === 1 ? t("dashboard.itemCount") : t("dashboard.itemsCount", { count: itemCount })}
          </div>
        </div>
      </div>

      <span />
      <span />
      <span />

      <div style={{ justifySelf: "end", display: "flex", alignItems: "center" }}>
        <span className="material-symbols-outlined df-row-chevron" aria-hidden style={{ fontSize: 18 }}>chevron_right</span>
      </div>
    </div>
  );
}
