import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { ApplyResult, ComponentGeometry, Engine, LayoutDocument, LayoutResult, PageLayout, UnitBox } from "@docforge-lib/layout";
import type { LayoutRect } from "@/utils/api";
import type { Thread } from "./history";
import { useI18n } from "@/i18n";
import { displayName, isAlignedRow, rowRebuildOp, rowsOf, widthLabel } from "./names";
import { SelectionBar } from "./SelectionBar";
import { InlineTextEditor } from "./InlineTextEditor";
import { InlineKpiEditor, InlineTableEditor, inlineKind } from "./InlineBlockEditors";
import { insertOps, type InsertKey } from "./defaults";
import { SlashMenu } from "./SlashMenu";
import { track } from "./track";

/** The rendered page puts 24px around and between pages (lib screen CSS). */
const PAD = 24;
const HANDLE = 8;

interface PageFrame {
  index: number;
  top: number;
  left: number;
  page: PageLayout;
}

function framesOf(pages: PageLayout[]): { frames: PageFrame[]; width: number; height: number } {
  const width = Math.max(0, ...pages.map((p) => p.width)) + PAD * 2;
  let top = PAD;
  const frames = pages.map((page, index) => {
    const frame = { index, top, left: (width - page.width) / 2, page };
    top += page.height + PAD;
    return frame;
  });
  return { frames, width, height: top + PAD };
}

type DragKind = "move" | "resize-r" | "resize-l" | "resize-b" | "resize-rb";

interface Target {
  page: number;
  x: number;
  y: number;
  w: number;
  h?: number;
  /**
   * The fields the gesture changed. A resize writes only these: writing the drawn
   * position too would pin a box that was pushed down at the spot it was pushed to,
   * which reorders the layout and makes it jump.
   */
  only?: ("x" | "w" | "h")[];
}

type Gesture =
  | {
      kind: DragKind;
      id: string;
      startX: number;
      startY: number;
      origin: UnitBox;
      /** Pointer offset inside the box, in units, when the drag started. */
      grabX: number;
      grabY: number;
      moved: boolean;
      /** Rows the content needs: a box never gets shorter than this (the layout would grow it back). */
      minH: number;
    }
  | { kind: "annotate"; page: number; ux: number; uy: number; startX: number; startY: number; component: string | null };

/** Dragging a block along the row it belongs to: a new order, where it would go, and what to say. */
interface Reorder {
  order: string[];
  changed: boolean;
  /** Where the drop line is drawn, in units on the row's page. */
  line: { page: number; x: number; y: number; h: number };
  message: string;
}

interface DragView {
  id: string | null;
  target: Target | null;
  preview: LayoutResult | null;
  ok: boolean;
  annotate: LayoutRect | null;
  reorder?: Reorder | null;
  /** The kind of gesture, for the chip (resizing shows the size). */
  kind?: DragKind;
  /** The height asked for was below what the content needs. */
  clamped?: boolean;
}

const IDLE: DragView = { id: null, target: null, preview: null, ok: true, annotate: null };

export interface PageCanvasHandle {
  print: () => void;
  /** Scroll so this component is in view. */
  reveal: (id: string) => void;
  /** Scroll to the top of a page (slide). */
  goToPage: (page: number) => void;
}

interface PageCanvasProps {
  engine: Engine;
  content: LayoutDocument;
  surfaceId: string | undefined;
  layout: LayoutResult;
  html: string;
  editable: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  commit: (ops: unknown[], options?: { coalesce?: string }) => ApplyResult;
  preview: (ops: unknown[]) => ApplyResult;
  annotating: boolean;
  onAnnotate: (rect: LayoutRect) => void;
  /** While commenting, a click on a block anchors the comment to it. */
  onAnnotateComponent?: (id: string) => void;
  /** Open comment threads, drawn as numbered pins on the page. */
  threads: Thread[];
  /** The thread whose anchor is marked on the page. */
  focusedThread?: string | null;
  onPinClick?: (threadId: string) => void;
  /** "Comment" on the selected block's bar. */
  onCommentBlock?: (id: string) => void;
  /** The page in the middle of the view, as the person scrolls. */
  onVisiblePage?: (page: number) => void;
  /** Components to mark with a number (an agent's changes under review). */
  highlights?: Map<string, number>;
  zoom: number;
  announce: (message: string) => void;
  onOpenContent: () => void;
}

const sameBox = (a: UnitBox, b: UnitBox) => a.page === b.page && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

/**
 * The pages as they will print, with an editing layer on top.
 *
 * The pages stay in a sandboxed iframe (no script runs inside). The iframe is as
 * tall as the document and never scrolls, so a layer laid over it can use the
 * engine's geometry directly: page frames from `framesOf`, boxes in px inside
 * each page. Every gesture is turned into the same `place`/`remove` ops an agent
 * sends, previewed with the engine while dragging, and committed on release.
 */
export const PageCanvas = forwardRef<PageCanvasHandle, PageCanvasProps>(function PageCanvas(props, ref) {
  const {
    engine,
    content,
    surfaceId,
    layout,
    html,
    editable,
    selected,
    onSelect,
    commit,
    preview,
    annotating,
    onAnnotate,
    onAnnotateComponent,
    threads,
    focusedThread,
    onPinClick,
    onCommentBlock,
    onVisiblePage,
    highlights,
    zoom,
    announce,
    onOpenContent,
  } = props;
  const { t } = useI18n();
  const layer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const frames = useRef<[HTMLIFrameElement | null, HTMLIFrameElement | null]>([null, null]);
  const gesture = useRef<Gesture | null>(null);
  /** The block under a pointer-down while commenting (a click comments on it). */
  const annotateOn = useRef<string | null>(null);
  const raf = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragView>(IDLE);
  /** The text block being edited in place, if any. */
  const [inline, setInline] = useState<string | null>(null);
  /** Edit where it is drawn when the block allows it; otherwise open the content panel. */
  const editContent = (id: string) => {
    const component = content.components.find((c) => c.id === id);
    if (editable && component && inlineKind(component) && layout.components[id]) {
      onSelect(id);
      setInline(id);
    } else onOpenContent();
  };
  /** The "/" menu opened on a selected block (from the keyboard), with what was typed. */
  const [slash, setSlash] = useState<{ below: string; query: string } | null>(null);
  /** A block just inserted, to open for editing once it is laid out. */
  const [pendingEdit, setPendingEdit] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingEdit || !layout.components[pendingEdit]) return;
    const component = content.components.find((c) => c.id === pendingEdit);
    setPendingEdit(null);
    if (component && inlineKind(component)) setInline(pendingEdit);
  }, [pendingEdit, layout, content.components]);
  const insert = (key: InsertKey, below: string, via: "slash-text" | "slash-block") => {
    track("layout_block_inserted", { key, via });
    const page = layout.components[below]?.box.page ?? 1;
    const { ops, select } = insertOps(content, key, below, page, (k) => t(k));
    const result = commit(ops);
    if (!result.ok) return announce(t("layout.editor.refused"));
    onSelect(select);
    announce(t("layout.editor.announceAdded", { id: select }));
    setPendingEdit(select);
  };

  const names = useMemo(() => new Map(content.components.map((c) => [c.id, displayName(c, t)] as const)), [content.components, t]);
  const nameOf = useCallback((id: string) => names.get(id) ?? id, [names]);
  const view = drag.preview ?? layout;
  const geometry = useMemo(() => framesOf(view.pages.length ? view.pages : layout.pages), [view.pages, layout.pages]);
  const unit = layout.grid.unit;
  const cols = layout.units.cols;

  // Two iframes: the next render loads in the hidden one and swaps in when ready, so edits never flash white.
  const [slots, setSlots] = useState<[string, string]>([html, ""]);
  const [active, setActive] = useState<0 | 1>(0);
  useEffect(() => {
    setSlots((current) => {
      if (current[active] === html) return current;
      const next: [string, string] = [...current] as [string, string];
      next[active === 0 ? 1 : 0] = html;
      return next;
    });
  }, [html, active]);
  const onFrameLoad = (slot: 0 | 1) => {
    if (slot !== active && slots[slot] === html) setActive(slot);
  };

  useImperativeHandle(ref, () => ({
    print: () => frames.current[active]?.contentWindow?.print(),
    reveal: (id: string) => {
      const g = layout.components[id];
      const frame = g ? geometry.frames[g.box.page - 1] : null;
      if (!g || !frame || !scroller.current) return;
      const top = (frame.top + frame.page.content.y + g.box.y * unit) * zoom - 80;
      scroller.current.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    },
    goToPage: (page: number) => {
      const frame = geometry.frames[page - 1];
      if (!frame || !scroller.current) return;
      scroller.current.scrollTo({ top: Math.max(0, (frame.top - PAD / 2) * zoom), behavior: "smooth" });
    },
  }));

  // Which page is in the middle of the view (the slide rail follows it).
  const lastVisible = useRef(0);
  const onScroll = () => {
    const el = scroller.current;
    if (!el || !onVisiblePage) return;
    const middle = (el.scrollTop + el.clientHeight / 2) / zoom;
    const frame = geometry.frames.find((f) => middle < f.top + f.page.height + PAD / 2) ?? geometry.frames[geometry.frames.length - 1];
    const page = (frame?.index ?? 0) + 1;
    if (page !== lastVisible.current) {
      lastVisible.current = page;
      onVisiblePage(page);
    }
  };

  /** Pointer position → page and units (fractional), from the layer's own coordinates. */
  const locate = useCallback(
    (clientX: number, clientY: number) => {
      const rect = layer.current?.getBoundingClientRect();
      if (!rect) return null;
      const px = (clientX - rect.left) / zoom;
      const py = (clientY - rect.top) / zoom;
      const list = framesOf(layout.pages).frames;
      let frame = list[list.length - 1];
      for (const f of list) {
        if (py < f.top + f.page.height + PAD / 2) {
          frame = f;
          break;
        }
      }
      if (!frame) return null;
      const c = frame.page.content;
      return { page: frame.index + 1, ux: (px - frame.left - c.x) / unit, uy: (py - frame.top - c.y) / unit, rows: frame.page.rows };
    },
    [layout.pages, unit, zoom],
  );

  /** Pointer position → units on a given page, wherever the pointer is (resizing stays on the box's page). */
  const locateOn = useCallback(
    (clientX: number, clientY: number, page: number) => {
      const rect = layer.current?.getBoundingClientRect();
      const frame = framesOf(layout.pages).frames[page - 1];
      if (!rect || !frame) return null;
      const c = frame.page.content;
      return { page, ux: ((clientX - rect.left) / zoom - frame.left - c.x) / unit, uy: ((clientY - rect.top) / zoom - frame.top - c.y) / unit };
    },
    [layout.pages, unit, zoom],
  );

  const snapX = useCallback(
    (x: number, w: number, free: boolean) => {
      if (free) return x;
      for (const g of layout.guides) {
        if (Math.abs(x - g.x) <= 1) return g.x;
        if (Math.abs(x + w - (g.x + g.w)) <= 1) return g.x + g.w - w;
      }
      return x;
    },
    [layout.guides],
  );

  const snapEnd = useCallback(
    (end: number, free: boolean) => {
      if (free) return end;
      for (const g of layout.guides) {
        if (Math.abs(end - (g.x + g.w)) <= 1) return g.x + g.w;
        if (Math.abs(end - g.x) <= 1) return g.x;
      }
      return end;
    },
    [layout.guides],
  );

  const targetFor = useCallback(
    (g: Extract<Gesture, { id: string }>, clientX: number, clientY: number, free: boolean): Target | null => {
      const o = g.origin;
      // Moving follows the pointer across pages; resizing measures on the box's own page.
      const at = g.kind === "move" ? locate(clientX, clientY) : locateOn(clientX, clientY, o.page);
      if (!at) return null;
      const clampX = (x: number, w: number) => Math.max(0, Math.min(cols - w, x));
      switch (g.kind) {
        case "move": {
          const x = clampX(snapX(Math.round(at.ux - g.grabX), o.w, free), o.w);
          const y = Math.max(0, Math.round(at.uy - g.grabY));
          return { page: at.page, x, y, w: o.w };
        }
        case "resize-r": {
          const end = Math.max(o.x + 1, Math.min(cols, snapEnd(Math.round(at.ux), free)));
          return { page: o.page, x: o.x, y: o.y, w: end - o.x, only: ["w"] };
        }
        case "resize-l": {
          const end = o.x + o.w;
          const x = Math.max(0, Math.min(end - 1, snapEnd(Math.round(at.ux), free)));
          return { page: o.page, x, y: o.y, w: end - x, only: ["x", "w"] };
        }
        case "resize-b":
        case "resize-rb": {
          const h = Math.max(g.minH, Math.round(at.uy - o.y));
          const w = g.kind === "resize-rb" ? Math.max(1, Math.min(cols, snapEnd(Math.round(at.ux), free)) - o.x) : o.w;
          return { page: o.page, x: o.x, y: o.y, w, h, only: g.kind === "resize-rb" ? ["w", "h"] : ["h"] };
        }
      }
    },
    [cols, locate, locateOn, snapEnd, snapX],
  );

  /** Asked for less height than the content needs (the box stays at the minimum). */
  const isClamped = useCallback(
    (g: Extract<Gesture, { id: string }>, clientY: number) => {
      if (g.kind !== "resize-b" && g.kind !== "resize-rb") return false;
      const at = locateOn(0, clientY, g.origin.page);
      return !!at && Math.round(at.uy - g.origin.y) < g.minH;
    },
    [locateOn],
  );

  /** Stop a gesture without applying it (Escape, a lost pointer). */
  const cancelGesture = useCallback(() => {
    gesture.current = null;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    setDrag(IDLE);
  }, []);
  const gestureActive = drag.id !== null || drag.annotate !== null;
  useEffect(() => {
    if (!gestureActive) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelGesture();
        announce(t("layout.editor.dragCancelled"));
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", cancelGesture);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", cancelGesture);
    };
  }, [gestureActive, cancelGesture, announce, t]);

  const placeOp = (id: string, target: Target) => ({
    op: "place",
    component: id,
    at: target.only
      ? Object.fromEntries(target.only.filter((k) => target[k] !== undefined).map((k) => [k, target[k]]))
      : { page: target.page, x: target.x, y: target.y, w: target.w, ...(target.h !== undefined ? { h: target.h } : {}) },
  });

  const describeResult = useCallback(
    (id: string, result: ApplyResult) => {
      const after = engine.layout(result.doc, surfaceId).components[id];
      const moved = result.changes.filter((c) => c.code === "moved" || c.code === "moved-page").length;
      const where = after ? t("layout.editor.announcePlace", { id: nameOf(id), page: after.box.page, x: after.box.x, y: after.box.y, w: after.box.w, h: after.box.h }) : nameOf(id);
      return moved ? `${where} ${t("layout.editor.announcePushed", { count: moved })}` : where;
    },
    [engine, surfaceId, t, nameOf],
  );

  /**
   * While a block is dragged inside the band of its own row (same page, between the
   * row's top and bottom), the drag reorders the row instead of moving the block freely:
   * nothing is left with a hole, and the widths travel with the blocks.
   */
  const reorderFor = useCallback(
    (id: string, page: number, ux: number, uy: number): Reorder | null => {
      const row = rowsOf(layout).find((r) => r.ids.includes(id));
      if (!row || !isAlignedRow(layout, row.ids) || page !== row.page) return null;
      const boxes = row.ids.map((rid) => layout.components[rid]!.box);
      const top = Math.min(...boxes.map((b) => b.y));
      const bottom = Math.max(...boxes.map((b) => b.y + b.h));
      if (uy < top - 1 || uy > bottom + 1) return null;
      const others = row.ids.filter((rid) => rid !== id);
      const centers = others.map((rid) => {
        const b = layout.components[rid]!.box;
        return b.x + b.w / 2;
      });
      const index = centers.filter((c) => c < ux).length;
      const order = [...others.slice(0, index), id, ...others.slice(index)];
      const before = others[index - 1];
      const after = others[index];
      const edge = (rid: string, side: "l" | "r") => {
        const b = layout.components[rid]!.box;
        return side === "l" ? b.x : b.x + b.w;
      };
      const x = before && after ? (edge(before, "r") + edge(after, "l")) / 2 : before ? edge(before, "r") + 1 : edge(after as string, "l") - 1;
      const message = after
        ? t("layout.editor.reorderBefore", { name: nameOf(id), other: nameOf(after) })
        : t("layout.editor.reorderAfter", { name: nameOf(id), other: nameOf(before as string) });
      return { order, changed: order.join("|") !== row.ids.join("|"), line: { page, x, y: top, h: bottom - top }, message };
    },
    [layout, nameOf, t],
  );

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "annotate") {
      const at = locate(e.clientX, e.clientY);
      if (!at || at.page !== g.page) return;
      const x0 = Math.floor(Math.min(g.ux, at.ux));
      const y0 = Math.floor(Math.min(g.uy, at.uy));
      const x1 = Math.ceil(Math.max(g.ux, at.ux));
      const y1 = Math.ceil(Math.max(g.uy, at.uy));
      setDrag((d) => ({ ...d, annotate: { page: g.page, x: Math.max(0, x0), y: Math.max(0, y0), w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) } }));
      return;
    }
    if (!g.moved && Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 4) return;
    g.moved = true;
    const { clientX, clientY, altKey } = e;
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const current = gesture.current;
      if (!current || current.kind === "annotate") return;
      if (current.kind === "move" && !altKey) {
        const at = locate(clientX, clientY);
        const reorder = at ? reorderFor(current.id, at.page, at.ux, at.uy) : null;
        if (reorder) {
          setDrag({ id: current.id, target: null, preview: null, ok: true, annotate: null, reorder });
          return;
        }
      }
      const target = targetFor(current, clientX, clientY, altKey);
      if (!target) return;
      const result = preview([placeOp(current.id, target)]);
      setDrag({
        id: current.id,
        target,
        preview: result.ok && result.doc ? engine.layout(result.doc, surfaceId) : null,
        ok: result.ok,
        annotate: null,
        reorder: null,
        kind: current.kind,
        clamped: isClamped(current, clientY),
      });
    });
  };

  const endGesture = (e: PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    layer.current?.releasePointerCapture?.(e.pointerId);
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (!g) return;
    if (g.kind === "annotate") {
      const rect = drag.annotate;
      setDrag(IDLE);
      // A click on a block (no drag) comments on the block; a drag comments on the area.
      const clicked = Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 4;
      if (clicked && g.component && onAnnotateComponent) onAnnotateComponent(g.component);
      else if (rect) onAnnotate(rect);
      return;
    }
    if (g.moved && g.kind === "move" && !e.altKey) {
      const at = locate(e.clientX, e.clientY);
      const reorder = at ? reorderFor(g.id, at.page, at.ux, at.uy) : null;
      if (reorder) {
        setDrag(IDLE);
        if (!reorder.changed) return;
        const op = rowRebuildOp(layout, reorder.order);
        const result = op ? commit([op]) : null;
        if (result?.ok) track("layout_row_reordered", { via: "drag", items: reorder.order.length });
        announce(result?.ok ? reorder.message : t("layout.editor.refused"));
        return;
      }
    }
    const target = g.moved ? targetFor(g, e.clientX, e.clientY, e.altKey) : null;
    setDrag(IDLE);
    if (!target) return;
    const o = g.origin;
    if (target.page === o.page && target.x === o.x && target.y === o.y && target.w === o.w && target.h === undefined) return;
    const result = commit([placeOp(g.id, target)]);
    announce(result.ok ? describeResult(g.id, result) : t("layout.editor.refused"));
  };

  const startBoxGesture = (e: PointerEvent, id: string, kind: DragKind, piece: UnitBox) => {
    if (e.button !== 0) return;
    if (annotating) {
      // Commenting: the layer starts the gesture; remember the block in case it is a click.
      annotateOn.current = id;
      return;
    }
    if (!editable) return;
    e.stopPropagation();
    const g = layout.components[id];
    const at = locate(e.clientX, e.clientY);
    if (!g || !at) return;
    onSelect(id);
    // Captured by the layer, which stays mounted: the handle that started a resize
    // disappears while dragging, and a capture on it would be lost with it.
    layer.current?.setPointerCapture?.(e.pointerId);
    gesture.current = {
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      origin: g.box,
      grabX: at.ux - piece.x,
      grabY: at.uy - piece.y,
      moved: false,
      minH: g.sizing === "content" ? Math.max(1, Math.ceil(g.needed / unit - 1e-6)) : 1,
    };
  };

  const startLayerGesture = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (annotating) {
      const at = locate(e.clientX, e.clientY);
      const component = annotateOn.current;
      annotateOn.current = null;
      if (!at) return;
      layer.current?.setPointerCapture?.(e.pointerId);
      gesture.current = { kind: "annotate", page: at.page, ux: at.ux, uy: at.uy, startX: e.clientX, startY: e.clientY, component };
      setDrag((d) => ({ ...d, annotate: { page: at.page, x: Math.floor(at.ux), y: Math.floor(at.uy), w: 1, h: 1 } }));
      return;
    }
    onSelect(null);
  };

  const nudge = (e: KeyboardEvent, id: string) => {
    const g = layout.components[id];
    if (!g || !editable) return;
    const o = g.box;
    const big = e.shiftKey;
    const nextGuide = (x: number, dir: 1 | -1) => {
      const starts = layout.guides.map((guide) => guide.x).sort((a, b) => a - b);
      return dir > 0 ? (starts.find((s) => s > x) ?? x) : ([...starts].reverse().find((s) => s < x) ?? 0);
    };
    let target: Target | null = null;
    let op: unknown = null;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (e.altKey) {
          const w = Math.max(1, Math.min(cols - o.x, o.w + dir * (big ? 4 : 1)));
          target = { page: o.page, x: o.x, y: o.y, w, only: ["w"] };
        } else {
          const x = big ? nextGuide(o.x, dir) : o.x + dir;
          target = { page: o.page, x: Math.max(0, Math.min(cols - o.w, x)), y: o.y, w: o.w, only: ["x"] };
        }
        break;
      }
      case "ArrowUp":
      case "ArrowDown": {
        const dir = e.key === "ArrowDown" ? 1 : -1;
        if (e.altKey) target = { page: o.page, x: o.x, y: o.y, w: o.w, h: Math.max(1, (g.declared.h ?? o.h) + dir * (big ? 5 : 1)), only: ["h"] };
        else target = { page: o.page, x: o.x, y: Math.max(0, o.y + dir * (big ? 5 : 1)), w: o.w };
        break;
      }
      case "Delete":
      case "Backspace":
        op = { op: "remove", component: id };
        break;
      case "Enter":
        e.preventDefault();
        editContent(id);
        return;
      case "/":
        e.preventDefault();
        setSlash({ below: id, query: "" });
        return;
      case "Escape":
        onSelect(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    const result = commit([op ?? placeOp(id, target as Target)], { coalesce: op ? undefined : `nudge:${id}` });
    if (op) {
      announce(result.ok ? t("layout.editor.announceRemoved", { id }) : t("layout.editor.refused"));
      if (result.ok) onSelect(null);
    } else announce(result.ok ? describeResult(id, result) : t("layout.editor.refused"));
  };

  /** Where each open comment's pin goes: the top-right corner of its block or area. */
  const pins = useMemo(() => {
    const out: { id: string; number: number; page: number; x: number; y: number; area: LayoutRect | null; component: string | null; agent: boolean }[] = [];
    for (const th of threads) {
      if (!th.number) continue;
      const { rect, component } = th.root.anchor;
      const g = component ? layout.components[component] : undefined;
      if (g) out.push({ id: th.root.id, number: th.number, page: g.box.page, x: g.box.x + g.box.w, y: g.box.y, area: null, component: component ?? null, agent: th.root.forAgent });
      else if (rect) out.push({ id: th.root.id, number: th.number, page: rect.page ?? 1, x: rect.x + rect.w, y: rect.y, area: rect, component: null, agent: th.root.forAgent });
    }
    return out;
  }, [threads, layout.components]);

  const pagePx = (frame: PageFrame, box: { x: number; y: number; w: number; h: number }): CSSProperties => ({
    left: frame.left + frame.page.content.x + box.x * unit,
    top: frame.top + frame.page.content.y + box.y * unit,
    width: box.w * unit,
    height: box.h * unit,
  });

  const boxes: { id: string; g: ComponentGeometry; piece: UnitBox; index: number }[] = [];
  for (const [id, g] of Object.entries(layout.components)) g.pieces.forEach((piece, index) => boxes.push({ id, g, piece, index }));
  boxes.sort((a, b) => a.piece.page - b.piece.page || a.piece.y - b.piece.y || a.piece.x - b.piece.x);

  const typeLabel = (type: string) => t(`layout.type.${type}`);
  const docFrames = framesOf(layout.pages).frames;

  return (
    <div ref={scroller} onScroll={onScroll} style={{ flex: 1, overflow: "auto", background: "var(--color-sink)" }}>
      <div style={{ width: geometry.width * zoom, height: geometry.height * zoom, margin: "0 auto", position: "relative" }}>
        <div style={{ width: geometry.width, height: geometry.height, transform: `scale(${zoom})`, transformOrigin: "0 0", position: "absolute", left: 0, top: 0 }}>
          {([0, 1] as const).map((slot) => (
            <iframe
              key={slot}
              ref={(el) => {
                frames.current[slot] = el;
              }}
              title={slot === active ? (content.meta?.title ?? "layout") : "next render"}
              srcDoc={slots[slot]}
              onLoad={() => onFrameLoad(slot)}
              // No scripts in the rendered page: same-origin is only there so fonts load and print() can be called.
              sandbox="allow-same-origin allow-modals"
              scrolling="no"
              tabIndex={-1}
              aria-hidden={slot !== active}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: framesOf(layout.pages).width,
                height: framesOf(layout.pages).height,
                border: 0,
                background: "transparent",
                visibility: slot === active ? "visible" : "hidden",
                pointerEvents: editable || annotating ? "none" : "auto",
              }}
            />
          ))}

          <div
            ref={layer}
            role="application"
            aria-label={t("layout.editor.canvasLabel")}
            onPointerDown={startLayerGesture}
            onPointerMove={onPointerMove}
            onPointerUp={endGesture}
            onPointerCancel={endGesture}
            style={{
              position: "absolute",
              inset: 0,
              cursor: annotating ? "crosshair" : "default",
              pointerEvents: editable || annotating ? "auto" : "none",
            }}
          >
            {/* Pages the drag would add, outlined so the target is visible. */}
            {geometry.frames.slice(layout.pages.length).map((frame) => (
              <div
                key={`new-${frame.index}`}
                className="df-layout-ghost"
                style={{ left: frame.left, top: frame.top, width: frame.page.width, height: frame.page.height, border: "2px dashed var(--color-warn-line)" }}
              />
            ))}

            {/* Guide columns of the page under the drag. */}
            {drag.target &&
              (() => {
                const frame = geometry.frames[drag.target.page - 1];
                if (!frame) return null;
                return layout.guides.map((g) => (
                  <div
                    key={`guide-${g.col}`}
                    className="df-layout-ghost"
                    style={{ ...pagePx(frame, { x: g.x, y: 0, w: g.w, h: frame.page.rows }), background: "var(--color-steel-tint)" }}
                  />
                ));
              })()}

            {boxes.map(({ id, g, piece, index }) => {
              const frame = docFrames[piece.page - 1];
              if (!frame) return null;
              const isSelected = selected === id;
              const dragging = drag.id === id;
              return (
                <div
                  key={`${id}-${index}`}
                  className={`df-layout-box${editable ? "" : " df-layout-box--readonly"}${annotating ? " df-layout-box--comment" : ""}`}
                  data-selected={isSelected}
                  data-moved={g.shifted > 0 && index === 0}
                  data-changed={highlights?.has(id) || undefined}
                  role="button"
                  tabIndex={index === 0 ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={t("layout.editor.boxLabel", {
                    id: nameOf(id),
                    type: typeLabel(g.type),
                    page: piece.page,
                    x: piece.x,
                    y: piece.y,
                    w: piece.w,
                    h: piece.h,
                  })}
                  onPointerDown={(e) => startBoxGesture(e, id, "move", piece)}
                  onFocus={() => onSelect(id)}
                  onDoubleClick={() => editContent(id)}
                  onKeyDown={(e) => nudge(e, id)}
                  style={{ ...pagePx(frame, piece), opacity: dragging ? 0.35 : 1 }}
                >
                  {highlights?.has(id) && index === 0 && (
                    <span className="df-change-mark df-change-mark--page" aria-hidden>
                      {highlights.get(id)}
                    </span>
                  )}
                  {isSelected && index === 0 && !dragging && (
                    <>
                      {!editable && (
                        <span className="df-layout-chip" style={{ left: 0, top: -24 }} title={`${id} · x${piece.x} y${piece.y} · ${piece.w}×${piece.h}`}>
                          {nameOf(id)} · {widthLabel(piece, layout, t)}
                        </span>
                      )}
                      {editable && (
                        <>
                          <Handle side="l" onDown={(e) => startBoxGesture(e, id, "resize-l", piece)} />
                          <Handle side="r" onDown={(e) => startBoxGesture(e, id, "resize-r", piece)} />
                          <Handle side="b" onDown={(e) => startBoxGesture(e, id, "resize-b", piece)} />
                          <Handle side="rb" onDown={(e) => startBoxGesture(e, id, "resize-rb", piece)} />
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Tools for the selected block, next to it (kept at screen size whatever the zoom). */}
            {editable &&
              selected &&
              !drag.id &&
              !annotating &&
              !inline &&
              !slash &&
              (() => {
                const g = layout.components[selected];
                const frame = g ? docFrames[g.box.page - 1] : undefined;
                if (!g || !frame) return null;
                const box = pagePx(frame, g.box);
                const top = Number(box.top);
                const above = top - frame.top > 56;
                // A block on the right half gets the bar aligned to its right edge, so it never runs off the page.
                const fromRight = Number(box.left) + Number(box.width) / 2 > frame.left + frame.page.width / 2;
                return (
                  <SelectionBar
                    id={selected}
                    doc={content}
                    layout={layout}
                    commit={commit}
                    onOpenContent={() => editContent(selected)}
                    onComment={onCommentBlock ? () => onCommentBlock(selected) : undefined}
                    onRemoved={() => onSelect(null)}
                    announce={announce}
                    style={{
                      left: fromRight ? Number(box.left) + Number(box.width) : box.left,
                      top: above ? top - 44 / zoom : top + Number(box.height) + 8 / zoom,
                      transform: fromRight ? `translateX(-100%) scale(${1 / zoom})` : `scale(${1 / zoom})`,
                      transformOrigin: fromRight ? "100% 0" : "0 0",
                    }}
                  />
                );
              })()}

            {/* A block edited in place, over its drawing: text, KPI or table. */}
            {inline &&
              (() => {
                const g = layout.components[inline];
                const component = content.components.find((c) => c.id === inline);
                const frame = g ? docFrames[g.box.page - 1] : undefined;
                const kind = component ? inlineKind(component) : null;
                if (!g || !frame || !component || !kind) return null;
                const box = pagePx(frame, g.box);
                const place = { position: "absolute" as const, left: box.left, top: box.top, width: box.width, minHeight: box.height };
                const save = (set: Record<string, unknown>, remove: string[] = []) => {
                  track("layout_inline_edit", { kind, fields: Object.keys(set).length + remove.length });
                  const result = commit([{ op: "edit", component: component.id, set, ...(remove.length ? { remove } : {}) }]);
                  announce(result.ok ? describeResult(component.id, result) : t("layout.editor.refused"));
                };
                const close = (change: { set: Record<string, unknown>; remove: string[] } | null) => {
                  setInline(null);
                  if (change) save(change.set, change.remove);
                };
                if (kind === "kpi") return <InlineKpiEditor key={inline} component={component} geometry={g} doc={content} tokens={layout.tokens} style={{ ...place, height: box.height }} onDone={close} />;
                if (kind === "table") return <InlineTableEditor key={inline} component={component} geometry={g} doc={content} tokens={layout.tokens} style={place} onDone={close} />;
                return (
                  <InlineTextEditor
                    key={inline}
                    component={component}
                    doc={content}
                    tokens={layout.tokens}
                    style={place}
                    onDone={(paragraphs) => {
                      setInline(null);
                      if (paragraphs) save({ paragraphs });
                    }}
                    onInsert={(key) => insert(key, component.id, "slash-text")}
                  />
                );
              })()}

            {/* "/" on a selected block: insert something below it. */}
            {slash &&
              (() => {
                const g = layout.components[slash.below];
                const frame = g ? docFrames[g.box.page - 1] : undefined;
                if (!g || !frame) return null;
                const box = pagePx(frame, g.box);
                return (
                  <SlashMenu
                    query={slash.query}
                    onQuery={(query) => setSlash({ ...slash, query })}
                    onPick={(key) => {
                      setSlash(null);
                      insert(key, slash.below, "slash-block");
                    }}
                    onClose={() => setSlash(null)}
                    style={{ position: "absolute", left: box.left, top: Number(box.top) + Number(box.height) + 8, zIndex: "var(--z-popover)", transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}
                  />
                );
              })()}

            {/* Reordering a row: the drop line and, under the row, what will happen. */}
            {drag.reorder &&
              (() => {
                const frame = docFrames[drag.reorder.line.page - 1];
                if (!frame) return null;
                const { x, y, h } = drag.reorder.line;
                const line = pagePx(frame, { x, y, w: 0, h });
                return (
                  <>
                    <div className="df-layout-ghost df-reorder-line" style={{ left: Number(line.left) - 2, top: Number(line.top) - 4, width: 4, height: Number(line.height) + 8 }} />
                    <span
                      className="df-layout-chip"
                      role="status"
                      style={{ left: Number(line.left), top: Number(line.top) + Number(line.height) + 10, transform: `translateX(-50%) scale(${1 / zoom})`, transformOrigin: "50% 0" }}
                    >
                      {drag.reorder.changed ? drag.reorder.message : t("layout.editor.reorderSame")}
                    </span>
                  </>
                );
              })()}

            {/* While dragging: where the box lands, and what it would push. */}
            {drag.preview &&
              Object.values(drag.preview.components).flatMap((g) => {
                const before = layout.components[g.id];
                const isDragged = g.id === drag.id;
                if (!isDragged && before && sameBox(before.box, g.box) && before.pieces.length === g.pieces.length) return [];
                return g.pieces.map((piece, index) => {
                  const frame = geometry.frames[piece.page - 1];
                  if (!frame) return null;
                  return (
                    <div
                      key={`ghost-${g.id}-${index}`}
                      className="df-layout-ghost"
                      style={{
                        ...pagePx(frame, piece),
                        border: isDragged ? "2px solid var(--color-heat-strong)" : "1px dashed var(--color-warn-line)",
                        background: isDragged ? "var(--color-heat-tint)" : "var(--color-warn-tint)",
                      }}
                    >
                      {index === 0 && (
                        <span className="df-layout-chip" style={{ left: 0, top: -24 }}>
                          {isDragged
                            ? drag.kind && drag.kind !== "move"
                              ? `${widthLabel(piece, layout, t)} · ${t("layout.editor.heightChip", { px: piece.h * unit })}${drag.clamped ? ` · ${t("layout.editor.minHeight")}` : ""}`
                              : `${nameOf(g.id)} · ${t("layout.structure.page", { n: piece.page })} · ${widthLabel(piece, layout, t)}`
                            : before && before.box.page !== g.box.page
                              ? `${nameOf(g.id)} ${t("layout.editor.newPageChip", { page: g.box.page })}`
                              : t("layout.editor.pushedChip", { name: nameOf(g.id) })}
                        </span>
                      )}
                    </div>
                  );
                });
              })}
            {drag.target && !drag.ok && <span className="df-layout-chip" style={{ left: 8, top: 4, color: "var(--color-error)" }}>{t("layout.editor.refused")}</span>}

            {/* The marked comment's anchor, and every open comment as a numbered pin. */}
            {focusedThread &&
              (() => {
                const pin = pins.find((p) => p.id === focusedThread);
                const frame = pin ? docFrames[pin.page - 1] : undefined;
                if (!pin || !frame) return null;
                const box = pin.area ?? (pin.component ? layout.components[pin.component]?.box : undefined);
                if (!box) return null;
                return <div className="df-layout-ghost df-pin-focus" style={pagePx(frame, { x: box.x, y: box.y, w: box.w, h: box.h })} />;
              })()}
            {pins.map((pin) => {
              const frame = docFrames[pin.page - 1];
              if (!frame) return null;
              const at = pagePx(frame, { x: pin.x, y: pin.y, w: 0, h: 0 });
              return (
                <button
                  key={pin.id}
                  type="button"
                  className="df-pin"
                  data-agent={pin.agent || undefined}
                  data-focused={focusedThread === pin.id || undefined}
                  aria-label={t("layout.comments.pin", { n: pin.number })}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onPinClick?.(pin.id)}
                  style={{ left: Number(at.left) - 10, top: Number(at.top) - 12, transform: `scale(${1 / zoom})` }}
                >
                  {pin.number}
                </button>
              );
            })}
            {drag.annotate &&
              (() => {
                const frame = docFrames[(drag.annotate.page ?? 1) - 1];
                if (!frame) return null;
                return (
                  <div
                    className="df-layout-ghost"
                    style={{ ...pagePx(frame, drag.annotate), border: "2px dashed var(--color-warn-strong)", background: "var(--color-warn-wash)" }}
                  />
                );
              })()}
          </div>
        </div>
      </div>
    </div>
  );
});

function Handle({ side, onDown }: { side: "l" | "r" | "b" | "rb"; onDown: (e: PointerEvent) => void }) {
  const style: CSSProperties =
    side === "l"
      ? { left: -HANDLE / 2, top: "50%", width: HANDLE, height: HANDLE * 2, marginTop: -HANDLE, cursor: "ew-resize" }
      : side === "r"
        ? { right: -HANDLE / 2, top: "50%", width: HANDLE, height: HANDLE * 2, marginTop: -HANDLE, cursor: "ew-resize" }
        : side === "b"
          ? { bottom: -HANDLE / 2, left: "50%", width: HANDLE * 2, height: HANDLE, marginLeft: -HANDLE, cursor: "ns-resize" }
          : { right: -HANDLE / 2, bottom: -HANDLE / 2, width: HANDLE, height: HANDLE, cursor: "nwse-resize" };
  return <span className="df-layout-handle" aria-hidden onPointerDown={onDown} style={style} />;
}
