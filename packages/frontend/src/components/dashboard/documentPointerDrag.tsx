import { useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface DocumentDragState {
  active: boolean;
  documentId: string | null;
  title: string;
  x: number;
  y: number;
  targetId: string | null;
  hasTarget: boolean;
}

const idleState: DocumentDragState = {
  active: false,
  documentId: null,
  title: "",
  x: 0,
  y: 0,
  targetId: null,
  hasTarget: false,
};

let state = idleState;
const listeners = new Set<() => void>();
const suppressedClicks = new Set<string>();

function publish(next: DocumentDragState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resolveTarget(x: number, y: number) {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>(
    "[data-folder-drop-target], [data-folder-drop-root]",
  );
  if (!element) return { hasTarget: false, targetId: null };
  return {
    hasTarget: true,
    targetId: element.hasAttribute("data-folder-drop-root")
      ? null
      : element.dataset.folderDropTarget ?? null,
  };
}

export function startDocumentPointerDrag(
  event: ReactPointerEvent<HTMLElement>,
  documentItem: { id: string; title: string },
  onDrop: (folderId: string | null) => void | Promise<void>,
) {
  if (event.button !== 0) return;
  if ((event.target as HTMLElement).closest("[data-no-document-drag]")) return;
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
      document.body.dataset.documentDragging = "true";
    }
    pointerEvent.preventDefault();
    publish({
      active: true,
      documentId: documentItem.id,
      title: documentItem.title,
      x: pointerEvent.clientX,
      y: pointerEvent.clientY,
      ...resolveTarget(pointerEvent.clientX, pointerEvent.clientY),
    });
  }

  function cleanup() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", cancel);
    document.body.style.cursor = previousCursor;
    document.body.style.userSelect = previousUserSelect;
    delete document.body.dataset.documentDragging;
  }

  function finish(pointerEvent: PointerEvent) {
    cleanup();
    if (!started) return;
    pointerEvent.preventDefault();
    suppressedClicks.add(documentItem.id);
    window.setTimeout(() => suppressedClicks.delete(documentItem.id), 250);
    const finished = state;
    publish(idleState);
    if (finished.hasTarget) void onDrop(finished.targetId);
  }

  function cancel() {
    cleanup();
    publish(idleState);
  }

  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", cancel);
}

export function consumeDocumentDragClick(documentId: string) {
  if (!suppressedClicks.has(documentId)) return false;
  suppressedClicks.delete(documentId);
  return true;
}

export function useDocumentDragState() {
  return useSyncExternalStore(subscribe, () => state, () => idleState);
}

export function DocumentDragOverlay() {
  const drag = useDocumentDragState();
  if (!drag.active) return null;
  return (
    <div aria-hidden style={{ position: "fixed", zIndex: 100, left: drag.x + 12, top: drag.y + 12, display: "flex", alignItems: "center", gap: 7, maxWidth: 240, padding: "5px 8px", borderRadius: 5, background: "var(--df-surface-high)", color: "var(--df-on-surface)", boxShadow: "0 5px 18px var(--color-shade-20)", fontSize: 11.5, pointerEvents: "none" }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: "var(--df-dim)" }}>draft</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{drag.title}</span>
    </div>
  );
}
