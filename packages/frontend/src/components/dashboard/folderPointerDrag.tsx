import { useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface FolderDragState {
  active: boolean;
  folderId: string | null;
  name: string;
  x: number;
  y: number;
  targetId: string | null;
  hasTarget: boolean;
}

const idleState: FolderDragState = {
  active: false,
  folderId: null,
  name: "",
  x: 0,
  y: 0,
  targetId: null,
  hasTarget: false,
};

let state = idleState;
const listeners = new Set<() => void>();
const suppressedClicks = new Set<string>();

function publish(next: FolderDragState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resolveTarget(x: number, y: number, sourceId: string) {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>(
    "[data-folder-drop-target], [data-folder-drop-root]",
  );
  if (!element) return { hasTarget: false, targetId: null };
  const targetId = element.hasAttribute("data-folder-drop-root")
    ? null
    : element.dataset.folderDropTarget ?? null;
  return { hasTarget: targetId !== sourceId, targetId };
}

export function startFolderPointerDrag(
  event: ReactPointerEvent<HTMLElement>,
  folder: { id: string; name: string },
  onDrop: (folderId: string, parentId: string | null) => Promise<void>,
) {
  if (event.button !== 0) return;
  if ((event.target as HTMLElement).closest("[data-no-folder-drag]")) return;
  const startX = event.clientX;
  const startY = event.clientY;
  let started = false;
  const previousCursor = document.body.style.cursor;
  const previousUserSelect = document.body.style.userSelect;

  function move(pointerEvent: PointerEvent) {
    if (!started && Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) < 5) return;
    if (!started) {
      started = true;
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      document.body.dataset.folderDragging = "true";
    }
    pointerEvent.preventDefault();
    const target = resolveTarget(pointerEvent.clientX, pointerEvent.clientY, folder.id);
    publish({
      active: true,
      folderId: folder.id,
      name: folder.name,
      x: pointerEvent.clientX,
      y: pointerEvent.clientY,
      ...target,
    });
  }

  function finish(pointerEvent: PointerEvent) {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    delete document.body.dataset.folderDragging;
    if (!started) return;
    pointerEvent.preventDefault();
    suppressedClicks.add(folder.id);
    window.setTimeout(() => suppressedClicks.delete(folder.id), 0);
    const finished = state;
    publish(idleState);
    if (finished.hasTarget && finished.targetId !== folder.id) {
      void onDrop(folder.id, finished.targetId);
    }
  }

  function cancel() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    delete document.body.dataset.folderDragging;
    publish(idleState);
  }

  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", cancel);
}

export function consumeFolderDragClick(folderId: string) {
  if (!suppressedClicks.has(folderId)) return false;
  suppressedClicks.delete(folderId);
  return true;
}

export function useFolderDragState() {
  return useSyncExternalStore(subscribe, () => state, () => idleState);
}

export function FolderDragOverlay() {
  const drag = useFolderDragState();
  if (!drag.active) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        zIndex: "var(--z-modal)",
        left: drag.x + 12,
        top: drag.y + 12,
        display: "flex",
        alignItems: "center",
        gap: 7,
        maxWidth: 240,
        padding: "5px 8px",
        borderRadius: "var(--radius-sm)",
        background: "var(--color-surface-high)",
        color: "var(--color-text)",
        boxShadow: "0 5px 18px var(--color-sink)",
        fontSize: 11.5,
        pointerEvents: "none",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--color-heat-hi)", fontVariationSettings: "'FILL' 1" }}>folder</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{drag.name}</span>
    </div>
  );
}
