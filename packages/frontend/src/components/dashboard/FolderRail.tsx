import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Folder } from "@/types";
import {
  apiCreateFolder,
  apiDeleteFolder,
  apiFetchFolders,
  apiUpdateFolder,
} from "@/utils/api";
import { Eyebrow, IconButton, Input } from "@/components/ui";
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
  archivedCount?: number;
  archivedSelected?: boolean;
  onSelectArchived?: () => void;
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
  archivedCount = 0,
  archivedSelected = false,
  onSelectArchived,
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
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-heat-hi)", marginTop: 5 }}>
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
          className={activeDrop ? "df-row df-row--drop" : "df-row"}
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
            minHeight: 30,
            padding: "0 4px",
            paddingLeft: 2 + depth * 14,
            borderRadius: "var(--radius-sm)",
            background: activeDrop ? undefined : active ? "var(--color-heat-tint)" : undefined,
            boxShadow: activeDrop ? undefined : active ? "inset 2px 0 0 var(--color-heat)" : undefined,
            cursor: folderDrag.active && folderDrag.folderId === folder.id ? "grabbing" : "pointer",
            touchAction: "none",
          }}
        >
          <button
            data-no-folder-drag
            onClick={(event) => { event.stopPropagation(); if (children.length) toggle(folder.id); }}
            aria-label={isExpanded ? t("folder.collapse") : t("folder.expand")}
            tabIndex={children.length ? 0 : -1}
            style={{ display: "grid", placeItems: "center", width: 18, height: 18, padding: 0, border: 0, background: "transparent", color: "var(--color-faint)", cursor: children.length ? "pointer" : "default", flexShrink: 0 }}
          >
            {children.length > 0 && (
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                {isExpanded ? "expand_more" : "chevron_right"}
              </span>
            )}
          </button>
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 17, color: activeDrop ? "var(--color-steel-hi)" : active ? "var(--color-heat-hi)" : "var(--color-faint)", fontVariationSettings: "'FILL' 1", flexShrink: 0 }}>
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
              aria-label={t("common.rename")}
              style={{ flex: 1, minWidth: 0, marginLeft: 4, background: "transparent", color: "var(--color-text)", border: 0, borderBottom: "1px solid var(--color-heat-line)", outline: 0, font: "inherit", fontSize: 12.5 }}
            />
          ) : (
            <button
              onClick={() => { if (!consumeFolderDragClick(folder.id)) onSelect(folder.id); }}
              title={folder.name}
              style={{ flex: 1, minWidth: 0, padding: "6px 0 6px 4px", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", border: 0, background: "transparent", color: active ? "var(--color-text)" : "var(--color-dim)", font: "inherit", fontSize: 12.5, cursor: "inherit" }}
            >
              {folder.name}
            </button>
          )}
          <div className="df-row-actions" style={{ gap: 0 }}>
            <IconButton data-no-folder-drag icon="create_new_folder" label={t("folder.newSubfolder")} onClick={() => startCreate(folder.id)} style={{ width: 24, height: 24 }} />
            <IconButton data-no-folder-drag icon="edit" label={t("common.rename")} onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }} style={{ width: 24, height: 24 }} />
            <IconButton data-no-folder-drag icon="delete" label={t("common.delete")} onClick={() => void remove(folder)} style={{ width: 24, height: 24 }} />
          </div>
          {folder.documentCount > 0 && (
            <span className="df-nav-count" title={t("folder.documentCount", { count: folder.documentCount })} style={{ marginLeft: 4, minWidth: 14, textAlign: "right" }}>
              {folder.documentCount}
            </span>
          )}
        </div>
        {createRow(folder.id, depth + 1)}
        {isExpanded && children.map((child) => row(child, depth + 1))}
      </div>
    );
  }

  const rootDrop =
    dropTarget === null ||
    (folderDrag.active && folderDrag.hasTarget && folderDrag.targetId === null) ||
    (documentDrag.active && documentDrag.hasTarget && documentDrag.targetId === null);
  const onLibraryRoot = activeView === "all" && selected === null && !sharedSelected && !archivedSelected;

  const views = [
    { id: "drafts" as const, label: t("dashboard.drafts"), icon: "edit_note", count: viewCounts.drafts },
    { id: "published" as const, label: t("dashboard.publishedView"), icon: "verified", count: viewCounts.published },
  ];

  return (
    <nav aria-label={t("dashboard.libraryShort")} style={{ width: "100%", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        data-folder-drop-root
        {...dropProps(null)}
        className={rootDrop ? "df-row--drop" : undefined}
        style={{ borderRadius: "var(--radius-sm)" }}
      >
        <button
          className={`df-nav-item${onLibraryRoot ? " df-nav-item--active" : ""}`}
          onClick={() => { onSelectView?.("all"); onSelect(null); }}
        >
          <span className="material-symbols-outlined" aria-hidden>home</span>
          {t("dashboard.allDocuments")}
          <span className="df-nav-count">{viewCounts.all}</span>
        </button>
      </div>

      {onSelectView && views.map((view) => (
        <button
          key={view.id}
          className={`df-nav-item${activeView === view.id && !sharedSelected && !archivedSelected ? " df-nav-item--active" : ""}`}
          onClick={() => onSelectView(view.id)}
        >
          <span className="material-symbols-outlined" aria-hidden>{view.icon}</span>
          {view.label}
          <span className="df-nav-count">{view.count}</span>
        </button>
      ))}

      {onSelectShared && (
        <button className={`df-nav-item${sharedSelected ? " df-nav-item--active" : ""}`} onClick={onSelectShared}>
          <span className="material-symbols-outlined" aria-hidden>group</span>
          {t("dashboard.sharedWithMe")}
          <span className="df-nav-count">{sharedCount}</span>
        </button>
      )}

      {onSelectArchived && (
        <button className={`df-nav-item${archivedSelected ? " df-nav-item--active" : ""}`} onClick={onSelectArchived}>
          <span className="material-symbols-outlined" aria-hidden>archive</span>
          {t("dashboard.archive")}
          <span className="df-nav-count">{archivedCount}</span>
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "18px 0 4px", paddingLeft: 10 }}>
        <Eyebrow style={{ flex: 1 }}>{t("dashboard.folders")}</Eyebrow>
        <IconButton icon="add" label={t("dashboard.newFolder")} onClick={() => startCreate(null)} style={{ width: 24, height: 24 }} />
      </div>

      {createRow(null, 0)}
      <div>{childrenOf(null).map((folder) => row(folder, 0))}</div>

      {error && <div style={{ marginTop: 10, padding: 8, fontSize: 11.5, lineHeight: 1.45, color: "var(--color-error)" }}>{error}</div>}
    </nav>
  );
}
