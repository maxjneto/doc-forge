import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Folder } from "@/types";
import {
  apiCreateFolder,
  apiDeleteFolder,
  apiFetchFolders,
  apiUpdateFolder,
} from "@/utils/api";
import { Button, Input } from "@/components/ui";
import {
  consumeFolderDragClick,
  startFolderPointerDrag,
  useFolderDragState,
} from "./folderPointerDrag";
import { useDocumentDragState } from "./documentPointerDrag";
import { useI18n } from "@/i18n";

interface FolderRailProps {
  selected: string | null;
  onSelect: (folderId: string | null) => void;
  refreshTick?: number;
  sharedCount?: number;
  onSelectShared?: () => void;
  sharedSelected?: boolean;
  onDropDocument?: (documentId: string, folderId: string | null) => void;
  onFoldersChange?: (folders: Folder[]) => void;
  activeView?: LibraryView;
  onSelectView?: (view: LibraryView) => void;
  viewCounts?: { all: number; drafts: number; published: number };
}

export type LibraryView = "all" | "drafts" | "published";

const DOCUMENT_MIME = "application/x-docforge-document";

/** A navigable tree: documents and folders can be re-parented in place. */
export function FolderRail({
  selected,
  onSelect,
  refreshTick = 0,
  sharedCount = 0,
  onSelectShared,
  sharedSelected = false,
  onDropDocument,
  onFoldersChange,
  activeView = "all",
  onSelectView,
  viewCounts = { all: 0, drafts: 0, published: 0 },
}: FolderRailProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const initialized = useRef(false);
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const folderDrag = useFolderDragState();
  const documentDrag = useDocumentDragState();

  const refetch = useCallback(() => {
    apiFetchFolders(getToken)
      .then((next) => {
        setFolders(next);
        onFoldersChange?.(next);
        if (!initialized.current) {
          setExpanded(new Set(next.map((folder) => folder.id)));
          initialized.current = true;
        }
      })
      .catch(() => setError(t("folder.loadError")));
  }, [getToken, onFoldersChange, t]);

  useEffect(() => refetch(), [refetch, refreshTick]);

  const childrenOf = useCallback(
    (parentId: string | null) => folders.filter((folder) => folder.parentId === parentId),
    [folders],
  );

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startCreate(parentId: string | null) {
    setCreatingParent(parentId);
    setDraft("");
    if (parentId) setExpanded((current) => new Set(current).add(parentId));
  }

  async function create() {
    const name = draft.trim();
    if (!name || creatingParent === undefined) return;
    setError(null);
    try {
      const created = await apiCreateFolder(name, creatingParent, getToken);
      setCreatingParent(undefined);
      setDraft("");
      if (created.parentId) setExpanded((current) => new Set(current).add(created.parentId!));
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("folder.createError"));
    }
  }

  async function rename(folder: Folder) {
    const name = editingName.trim();
    setEditingId(null);
    if (!name || name === folder.name) return;
    try {
      await apiUpdateFolder(folder.id, { name }, getToken);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("folder.renameError"));
    }
  }

  async function remove(folder: Folder) {
    const confirmed = window.confirm(
      t("folder.deleteConfirm", { name: folder.name }),
    );
    if (!confirmed) return;
    try {
      await apiDeleteFolder(folder.id, getToken);
      if (selected === folder.id) onSelect(null);
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("folder.deleteError"));
    }
  }

  function dropProps(target: string | null) {
    return {
      onDragOver: (event: React.DragEvent) => {
        const types = event.dataTransfer.types;
        if (!types.includes(DOCUMENT_MIME)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
      },
      onDragEnter: (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setDropTarget(target);
      },
      onDragLeave: (event: React.DragEvent) => {
        event.stopPropagation();
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropTarget((current) => (current === target ? undefined : current));
      },
      onDrop: async (event: React.DragEvent) => {
        event.preventDefault();
        setDropTarget(undefined);
        const documentId = event.dataTransfer.getData(DOCUMENT_MIME);
        try {
          if (documentId && onDropDocument) {
            await onDropDocument(documentId, target);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : t("folder.moveError"));
        }
      },
    };
  }

  function createRow(parentId: string | null, depth: number) {
    if (creatingParent !== parentId) return null;
    return (
      <div style={{ display: "flex", gap: 6, padding: "4px 4px 4px", paddingLeft: 8 + depth * 16 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--df-amber-300)", marginTop: 5 }}>
          create_new_folder
        </span>
        <Input
          autoFocus
          value={draft}
          placeholder={t("folder.createPrompt")}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => { if (!draft.trim()) setCreatingParent(undefined); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void create();
            if (event.key === "Escape") setCreatingParent(undefined);
          }}
          style={{ height: 28, minWidth: 0 }}
        />
      </div>
    );
  }

  function row(folder: Folder, depth: number): React.ReactNode {
    const children = childrenOf(folder.id);
    const active = selected === folder.id;
    const isExpanded = expanded.has(folder.id);
    const editing = editingId === folder.id;
    const customDropTarget = folderDrag.active && folderDrag.hasTarget && folderDrag.targetId === folder.id;
    const documentDropTarget = documentDrag.active && documentDrag.hasTarget && documentDrag.targetId === folder.id;
    const activeDrop = dropTarget === folder.id || customDropTarget || documentDropTarget;
    return (
      <div key={folder.id}>
        <div
          data-folder-drop-target={folder.id}
          onPointerDown={(event) => {
            if (editing) return;
            startFolderPointerDrag(event, folder, async (movingId, parentId) => {
              await apiUpdateFolder(movingId, { parentId }, getToken);
              if (parentId) setExpanded((current) => new Set(current).add(parentId));
              refetch();
            });
          }}
          {...dropProps(folder.id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            minHeight: 32,
            padding: "3px 4px",
            paddingLeft: 4 + depth * 16,
            borderRadius: "var(--radius-sm)",
            background: activeDrop
              ? "var(--color-white-03)"
              : active ? "var(--color-heat-05)" : "transparent",
            boxShadow: activeDrop ? "inset 3px 0 0 var(--df-steel-200)" : "none",
            cursor: folderDrag.active && folderDrag.folderId === folder.id ? "grabbing" : "grab",
            touchAction: "none",
            transition: "background 100ms ease, box-shadow 100ms ease",
          }}
        >
          <button
            data-no-folder-drag
            onClick={(event) => { event.stopPropagation(); if (children.length) toggle(folder.id); }}
            aria-label={isExpanded ? t("folder.collapse") : t("folder.expand")}
            style={{ width: 18, padding: 0, border: 0, background: "transparent", color: "var(--df-faint)", cursor: children.length ? "pointer" : "default" }}
          >
            {children.length > 0 && (
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {isExpanded ? "expand_more" : "chevron_right"}
              </span>
            )}
          </button>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: activeDrop ? "var(--df-steel-100)" : active ? "var(--df-amber-300)" : "var(--df-faint)", fontVariationSettings: "'FILL' 1" }}>
            {activeDrop || (isExpanded && children.length) ? "folder_open" : "folder"}
          </span>
          {editing ? (
            <input
              data-no-folder-drag
              autoFocus
              value={editingName}
              onChange={(event) => setEditingName(event.target.value)}
              onBlur={() => void rename(folder)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void rename(folder);
                if (event.key === "Escape") setEditingId(null);
              }}
              style={{ flex: 1, minWidth: 0, background: "transparent", color: "var(--df-on-surface)", border: 0, borderBottom: "1px solid var(--color-heat-border)", outline: 0, font: "inherit" }}
            />
          ) : (
            <button
              onClick={() => { if (!consumeFolderDragClick(folder.id)) onSelect(folder.id); }}
              title={folder.name}
              style={{ flex: 1, minWidth: 0, padding: "3px 0", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", border: 0, background: "transparent", color: active ? "var(--df-amber-200)" : "var(--df-dim)", font: "inherit", fontSize: 12.5, cursor: folderDrag.active && folderDrag.folderId === folder.id ? "grabbing" : "grab" }}
            >
              {folder.name}
            </button>
          )}
          {folder.documentCount > 0 && (
            <span className="df-mono" title={t("folder.documentCount", { count: folder.documentCount })} style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
              {folder.documentCount}
            </span>
          )}
          <button data-no-folder-drag onClick={() => startCreate(folder.id)} title={t("folder.newSubfolder")} style={actionStyle}>+</button>
          <button data-no-folder-drag onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }} title={t("common.rename")} style={actionStyle}>✎</button>
          <button data-no-folder-drag onClick={() => void remove(folder)} title={t("common.delete")} style={actionStyle}>×</button>
        </div>
        {createRow(folder.id, depth + 1)}
        {isExpanded && children.map((child) => row(child, depth + 1))}
      </div>
    );
  }

  return (
    <nav style={{ width: "100%", minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <span className="df-mono" style={{ flex: 1, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--df-faint)" }}>
          › {t("dashboard.libraryShort")}
        </span>
        <Button variant="ghost" onClick={() => startCreate(null)} title={t("dashboard.newFolder")} style={{ padding: "2px 7px" }}>+</Button>
      </div>

      <div
        data-folder-drop-root
        {...dropProps(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 8px",
          borderRadius: "var(--radius-sm)",
          background: dropTarget === null || (folderDrag.active && folderDrag.hasTarget && folderDrag.targetId === null) || (documentDrag.active && documentDrag.hasTarget && documentDrag.targetId === null) ? "var(--color-white-03)" : activeView === "all" && selected === null && !sharedSelected ? "var(--color-heat-05)" : "transparent",
          boxShadow: dropTarget === null || (folderDrag.active && folderDrag.hasTarget && folderDrag.targetId === null) || (documentDrag.active && documentDrag.hasTarget && documentDrag.targetId === null) ? "inset 3px 0 0 var(--df-steel-200)" : "none",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 17, color: "var(--df-faint)" }}>home</span>
        <button onClick={() => { onSelectView?.("all"); onSelect(null); }} style={{ flex: 1, textAlign: "left", padding: 0, border: 0, background: "transparent", color: activeView === "all" && selected === null && !sharedSelected ? "var(--df-amber-200)" : "var(--df-dim)", font: "inherit", fontSize: 12.5, cursor: "pointer" }}>
          {t("dashboard.allDocuments")}
        </button>
        <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>{viewCounts.all}</span>
      </div>

      {onSelectView && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, margin: "3px 0 8px" }}>
          {([
            { id: "drafts" as const, label: t("dashboard.drafts"), icon: "edit_note", count: viewCounts.drafts },
            { id: "published" as const, label: t("common.published"), icon: "verified", count: viewCounts.published },
          ]).map((view) => (
            <button
              key={view.id}
              onClick={() => onSelectView(view.id)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 7px", borderRadius: "var(--radius-sm)", border: "1px solid var(--df-outline)", background: activeView === view.id ? "var(--color-heat-05)" : "transparent", color: activeView === view.id ? "var(--df-amber-200)" : "var(--df-faint)", font: "inherit", fontSize: 10.5, cursor: "pointer" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{view.icon}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{view.label}</span>
              <span className="df-mono" style={{ fontSize: 8.5 }}>{view.count}</span>
            </button>
          ))}
        </div>
      )}

      {createRow(null, 0)}
      <div style={{ marginTop: 2 }}>{childrenOf(null).map((folder) => row(folder, 0))}</div>

      {onSelectShared && (
        <button
          onClick={onSelectShared}
          style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "12px 8px 7px", border: 0, borderTop: "1px solid var(--df-outline)", background: "transparent", color: sharedSelected ? "var(--df-amber-200)" : "var(--df-dim)", font: "inherit", fontSize: 12.5, cursor: "pointer" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>group</span>
          <span style={{ flex: 1, textAlign: "left" }}>{t("dashboard.sharedWithMe")}</span>
          {sharedCount > 0 && <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>{sharedCount}</span>}
        </button>
      )}

      {error && <div style={{ marginTop: 10, padding: "8px", fontSize: 11, lineHeight: 1.4, color: "var(--df-error)" }}>{error}</div>}
    </nav>
  );
}

const actionStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "var(--df-mute)",
  cursor: "pointer",
  fontSize: 12,
};
