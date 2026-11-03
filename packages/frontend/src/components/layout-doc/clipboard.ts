import type { Component, ComponentType, LayoutDocument } from "@docforge-lib/layout";
import { addOp, newComponentId, starterComponent } from "./defaults";

/** Marks text on the clipboard as a block of ours. */
export const CLIP_KIND = "docforge/component";

export interface ClipBlock {
  kind: typeof CLIP_KIND;
  version: 1;
  /** The component without its position (and without an id that would clash). */
  component: Record<string, unknown>;
  /** Its size where it was copied from; 0 when unknown. */
  box: { w: number; h?: number };
}

export type Pasted = { block: ClipBlock } | { text: string };

/**
 * The selected block as clipboard text: JSON that this editor, another document and an
 * agent can all read. Plain JSON (not a private clipboard format) so it also travels
 * through a chat or a terminal.
 */
export function blockOf(component: Component, box: { w: number; h?: number }): ClipBlock {
  const { at, ...rest } = component as Record<string, unknown>;
  const declared = (at ?? {}) as { h?: number | null };
  const h = declared.h ?? box.h;
  return { kind: CLIP_KIND, version: 1, component: rest, box: { w: box.w, ...(h ? { h } : {}) } };
}

export function serializeComponent(component: Component, box: { w: number; h?: number }): string {
  return JSON.stringify(blockOf(component, box), null, 2);
}

/** What clipboard text holds: one of our blocks, a bare component JSON (from an agent), or text. */
export function parseClipboard(text: string): Pasted | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj.kind === CLIP_KIND && obj.component && typeof obj.component === "object") {
        const block = obj as unknown as ClipBlock;
        return { block: { ...block, box: { w: Number(block.box?.w ?? 0) || 0, ...(block.box?.h ? { h: Number(block.box.h) } : {}) } } };
      }
      if (typeof obj.type === "string" && obj.content && typeof obj.content === "object") {
        const { at, ...rest } = obj;
        const declared = (at ?? {}) as { w?: number; h?: number | null };
        return { block: { kind: CLIP_KIND, version: 1, component: rest, box: { w: Number(declared.w ?? 0) || 0, ...(declared.h ? { h: declared.h } : {}) } } };
      }
    } catch {
      // Not JSON: it is text to paste as a paragraph.
    }
  }
  return { text: trimmed };
}

/**
 * Operations that put what was pasted under a new id: below a block when one is
 * selected, else at the end of the page. A copied block keeps its width; text becomes
 * a text block with a paragraph per blank-line-separated chunk.
 */
export function pasteOps(doc: LayoutDocument, pasted: Pasted, below: string | null, page: number, sample: (key: string) => string): { ops: unknown[]; select: string } {
  if ("text" in pasted) {
    const id = newComponentId(doc, "text");
    const paragraphs = pasted.text
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    const component = { ...starterComponent("text", id, sample), content: { paragraphs: paragraphs.length ? paragraphs : [pasted.text] } };
    return { ops: [addOp(component, "text", below, page)], select: id };
  }
  const type = String(pasted.block.component.type) as ComponentType;
  const id = newComponentId(doc, type);
  const component = { ...pasted.block.component, id };
  const { w, h } = pasted.block.box;
  if (!w) return { ops: [addOp(component, type, below, page)], select: id };
  const at = { ...(below ? { below } : { end: true as const, page }), w, ...(h ? { h } : {}) };
  return { ops: [{ op: "add", component, at }], select: id };
}
