import type { Folder } from "@/types";
import {
  consumeFolderDragClick,
  startFolderPointerDrag,
  useFolderDragState,
} from "./folderPointerDrag";
import { useDocumentDragState } from "./documentPointerDrag";

interface FolderTableRowProps {
  folder: Folder;
  childFolderCount: number;
  onOpen: () => void;
  onDropFolder: (folderId: string, parentId: string | null) => Promise<void>;
}

export function FolderTableRow({
  folder,
  childFolderCount,
  onOpen,
  onDropFolder,
}: FolderTableRowProps) {
  const folderDrag = useFolderDragState();
  const documentDrag = useDocumentDragState();
  const isFolderDropTarget = folderDrag.active && folderDrag.hasTarget && folderDrag.targetId === folder.id;
  const isDocumentDropTarget = documentDrag.active && documentDrag.hasTarget && documentDrag.targetId === folder.id;
  const activeDrop = isFolderDropTarget || isDocumentDropTarget;
  const itemCount = (folder.directDocumentCount ?? 0) + childFolderCount;

  return (
    <div
      data-folder-drop-target={folder.id}
      onClick={() => { if (!consumeFolderDragClick(folder.id)) onOpen(); }}
      onPointerDown={(event) => startFolderPointerDrag(event, folder, onDropFolder)}
      style={{
        display: "grid",
        gridTemplateColumns: "22px minmax(0,1fr) 280px 130px 130px",
        alignItems: "center",
        gap: 16,
        minHeight: 67,
        padding: "12px 22px",
        borderTop: "1px solid var(--df-outline)",
        background: activeDrop ? "var(--color-white-03)" : "transparent",
        boxShadow: activeDrop ? "inset 3px 0 0 var(--df-steel-200)" : "none",
        cursor: folderDrag.active && folderDrag.folderId === folder.id ? "grabbing" : "grab",
        touchAction: "none",
        transition: "background 100ms ease, box-shadow 100ms ease",
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 21, color: activeDrop ? "var(--df-steel-100)" : "var(--df-amber-300)", fontVariationSettings: "'FILL' 1" }}
      >
        {activeDrop ? "folder_open" : "folder"}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13.5, fontWeight: 500, color: "var(--df-on-surface)" }}>
          {folder.name}
        </div>
        <div className="df-mono" style={{ marginTop: 4, fontSize: 9.5, letterSpacing: "0.07em", color: "var(--df-faint)" }}>
          PASTA
        </div>
      </div>

      <div className="df-mono" style={{ fontSize: 10.5, color: "var(--df-faint)" }}>
        {itemCount} ite{itemCount === 1 ? "m" : "ns"}
      </div>

      <span className="df-mono" style={{ fontSize: 10.5, color: "var(--df-mute)" }}>—</span>

      <span style={{ justifySelf: "end", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--df-faint)" }}>
        Abrir
        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>chevron_right</span>
      </span>

    </div>
  );
}
