import { useCallback, useEffect, useRef, useState } from "react";
import type { ApplyResult, Engine, LayoutDocument } from "@docforge-lib/layout";
import {
  apiApplyLayoutOps,
  apiGetLayout,
  apiReplaceLayout,
  LayoutConflictError,
  type LayoutState,
} from "@/utils/api";

type GetToken = () => Promise<string | null>;

/** A write waiting to reach the server. */
type Job = { kind: "ops"; ops: unknown[]; coalesce?: string } | { kind: "replace"; content: LayoutDocument };

interface UndoEntry {
  content: LayoutDocument;
  coalesce?: string;
  at: number;
}

export type SaveStatus = "saved" | "saving" | "error";

/** Something the person should know about the document as a whole (shown once, then dismissed). */
export type EditorNotice = { kind: "external" } | { kind: "conflict-dropped" } | { kind: "save-failed" };

/** Someone else's write, kept so the person can review it change by change. */
export interface ExternalChange {
  before: LayoutDocument;
  fromRevision: number;
  toRevision: number;
}

export interface CommitOptions {
  /** Consecutive commits with the same key within a short time are one undo step and one write (keyboard nudges). */
  coalesce?: string;
}

export interface LayoutEditor {
  content: LayoutDocument;
  revision: number;
  status: SaveStatus;
  notice: EditorNotice | null;
  dismissNotice: () => void;
  /** The last write from someone else (an agent), with the version before it; null once reviewed. */
  external: ExternalChange | null;
  dismissExternal: () => void;
  /** Replace the whole document (restore a past version): one undo step, saved like any change. */
  replaceAll: (content: LayoutDocument) => void;
  /** Apply operations: instantly on screen, then saved in order. Nothing happens when the result is not ok. */
  commit: (ops: unknown[], options?: CommitOptions) => ApplyResult;
  /** Try operations without applying them. */
  preview: (ops: unknown[]) => ApplyResult;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

const COALESCE_MS = 900;

/**
 * Local-first editing of a layout document.
 *
 * Every change runs through the same library the server uses, so the screen
 * updates at once and the server can only agree. Writes go out one at a time
 * with the revision they were based on: when someone else (an agent) wrote in
 * between, the server answers 409 and the pending operations are applied again
 * on top of the new version. Undo restores a whole snapshot (a replace), so it
 * is only offered for this person's own changes since the last external write.
 */
export function useLayoutEditor(
  engine: Engine,
  documentId: string,
  initial: LayoutState,
  getToken: GetToken,
  sseTick: number,
): LayoutEditor {
  const [content, setContent] = useState<LayoutDocument>(initial.content as LayoutDocument);
  const [revision, setRevision] = useState(initial.revision);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [notice, setNotice] = useState<EditorNotice | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<LayoutDocument[]>([]);
  const [external, setExternal] = useState<ExternalChange | null>(null);

  const contentRef = useRef(content);
  const revisionRef = useRef(initial.revision);
  const queue = useRef<Job[]>([]);
  const busy = useRef(false);
  const tickWhileBusy = useRef(false);
  const checkServerRef = useRef<() => Promise<void>>(async () => undefined);

  const show = useCallback((next: LayoutDocument) => {
    contentRef.current = next;
    setContent(next);
  }, []);

  /** Take the server's version as the truth: pending writes and history are dropped. */
  const resync = useCallback(
    async (why: EditorNotice | null) => {
      const server = await apiGetLayout(documentId, getToken);
      queue.current = [];
      revisionRef.current = server.revision;
      setRevision(server.revision);
      show(server.content as LayoutDocument);
      setUndoStack([]);
      setRedoStack([]);
      if (why) setNotice(why);
    },
    [documentId, getToken, show],
  );

  /** Someone wrote first: replay the pending operations on their version. */
  const rebase = useCallback(async () => {
    const server = await apiGetLayout(documentId, getToken);
    let next = server.content as LayoutDocument;
    const kept: Job[] = [];
    let dropped = false;
    for (const job of queue.current) {
      if (job.kind === "replace") {
        // An undo snapshot would erase what the other writer did.
        dropped = true;
        continue;
      }
      const result = engine.apply(next, job.ops);
      if (!result.ok || !result.doc) {
        dropped = true;
        continue;
      }
      next = result.doc;
      kept.push(job);
    }
    queue.current = kept;
    revisionRef.current = server.revision;
    setRevision(server.revision);
    show(next);
    setUndoStack([]);
    setRedoStack([]);
    setNotice(dropped ? { kind: "conflict-dropped" } : { kind: "external" });
  }, [documentId, engine, getToken, show]);

  const pump = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setStatus("saving");
    try {
      while (queue.current.length) {
        const job = queue.current[0] as Job;
        try {
          const result =
            job.kind === "ops"
              ? await apiApplyLayoutOps(documentId, job.ops, revisionRef.current, getToken)
              : await apiReplaceLayout(documentId, job.content, revisionRef.current, getToken);
          if (!result.ok) {
            await resync({ kind: "save-failed" });
            break;
          }
          queue.current.shift();
          revisionRef.current = result.revision;
          setRevision(result.revision);
        } catch (error) {
          if (error instanceof LayoutConflictError) {
            await rebase();
            continue;
          }
          await resync({ kind: "save-failed" }).catch(() => setNotice({ kind: "save-failed" }));
          setStatus("error");
          return;
        }
      }
      setStatus("saved");
    } finally {
      busy.current = false;
    }
    if (tickWhileBusy.current) {
      tickWhileBusy.current = false;
      void checkServerRef.current().catch(() => undefined);
    }
  }, [documentId, getToken, rebase, resync]);

  /** An SSE event arrived: pick up a write from someone else (an agent through MCP). */
  const checkServer = useCallback(async () => {
    if (busy.current || queue.current.length) {
      tickWhileBusy.current = true;
      return;
    }
    const server = await apiGetLayout(documentId, getToken);
    if (server.revision === revisionRef.current || busy.current || queue.current.length) return;
    // Keep where the review starts: the first unreviewed version, even across several writes.
    const before = contentRef.current;
    const fromRevision = revisionRef.current;
    setExternal((current) => ({ before: current?.before ?? before, fromRevision: current?.fromRevision ?? fromRevision, toRevision: server.revision }));
    revisionRef.current = server.revision;
    setRevision(server.revision);
    show(server.content as LayoutDocument);
    setUndoStack([]);
    setRedoStack([]);
    setNotice({ kind: "external" });
  }, [documentId, getToken, show]);

  checkServerRef.current = checkServer;

  const firstTick = useRef(sseTick);
  useEffect(() => {
    if (sseTick === firstTick.current) return;
    void checkServer().catch(() => undefined);
  }, [sseTick, checkServer]);

  const enqueue = useCallback(
    (job: Job) => {
      const last = queue.current[queue.current.length - 1];
      // A nudge that has not left yet is replaced by the newer one (same target, absolute position).
      if (job.kind === "ops" && job.coalesce && last?.kind === "ops" && last.coalesce === job.coalesce && queue.current.length > 1) {
        queue.current[queue.current.length - 1] = job;
      } else {
        queue.current.push(job);
      }
      void pump();
    },
    [pump],
  );

  const preview = useCallback((ops: unknown[]) => engine.apply(contentRef.current, ops), [engine]);

  const commit = useCallback(
    (ops: unknown[], options: CommitOptions = {}) => {
      const before = contentRef.current;
      const result = engine.apply(before, ops);
      if (!result.ok || !result.doc) return result;
      const now = Date.now();
      setUndoStack((stack) => {
        const top = stack[stack.length - 1];
        if (options.coalesce && top?.coalesce === options.coalesce && now - top.at < COALESCE_MS) {
          return [...stack.slice(0, -1), { ...top, at: now }];
        }
        return [...stack.slice(-99), { content: before, coalesce: options.coalesce, at: now }];
      });
      setRedoStack([]);
      show(result.doc);
      enqueue({ kind: "ops", ops, coalesce: options.coalesce });
      return result;
    },
    [engine, enqueue, show],
  );

  const undo = useCallback(() => {
    const top = undoStack[undoStack.length - 1];
    if (!top) return;
    // Read now: the updater runs later, after show() has replaced the ref.
    const current = contentRef.current;
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack((stack) => [...stack, current]);
    show(top.content);
    enqueue({ kind: "replace", content: top.content });
  }, [enqueue, show, undoStack]);

  const replaceAll = useCallback(
    (next: LayoutDocument) => {
      const current = contentRef.current;
      setUndoStack((stack) => [...stack.slice(-99), { content: current, at: Date.now() }]);
      setRedoStack([]);
      show(next);
      enqueue({ kind: "replace", content: next });
    },
    [enqueue, show],
  );

  const redo = useCallback(() => {
    const top = redoStack[redoStack.length - 1];
    if (!top) return;
    const current = contentRef.current;
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack((stack) => [...stack, { content: current, at: 0 }]);
    show(top);
    enqueue({ kind: "replace", content: top });
  }, [enqueue, redoStack, show]);

  return {
    content,
    revision,
    status,
    notice,
    dismissNotice: () => setNotice(null),
    external,
    dismissExternal: () => setExternal(null),
    replaceAll,
    commit,
    preview,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undo,
    redo,
  };
}
