import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEngine, type Component, type LayoutDocument } from "@docforge-lib/layout";
import { createNodeRegistry } from "@docforge-lib/layout/node";
import { groupActivity } from "@/components/document/ActivityPanel";
import { blockOf, parseClipboard, pasteOps, serializeComponent } from "@/components/layout-doc/clipboard";
import { describeOps, summarizeOps } from "@/components/layout-doc/history";
import { translate } from "@/i18n";
import type { DocumentActivity } from "@/types";

const api = vi.hoisted(() => ({
  apiApplyLayoutOps: vi.fn(),
  apiReplaceLayout: vi.fn(),
  apiGetLayout: vi.fn(),
}));
vi.mock("@/utils/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/utils/api")>()), ...api }));

import { useLayoutEditor } from "@/components/layout-doc/useLayoutEditor";

const engine = createEngine({ registry: createNodeRegistry() });
const getToken = async () => "token";
const t = (key: string, vars?: Record<string, string | number>) => translate("pt-BR", key, vars);
const text = (id: string, y: number, w = 40) => ({ id, type: "text", content: { paragraphs: [`Texto ${id}`] }, at: { page: 1, x: 0, y, w } }) as unknown as Component;
const doc = (components: unknown[]): LayoutDocument =>
  ({ format: "docforge/layout", version: 4, surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }], components }) as LayoutDocument;

describe("clipboard: copying and pasting blocks", () => {
  const source = doc([text("a", 0), text("b", 10)]);

  it("serializes the block without its position and reads it back", () => {
    const serialized = serializeComponent(source.components[0] as Component, { w: 40, h: 8 });
    const parsed = parseClipboard(serialized);
    expect(parsed && "block" in parsed).toBe(true);
    const block = (parsed as { block: ReturnType<typeof blockOf> }).block;
    expect(block.component.at).toBeUndefined();
    expect(block.component.id).toBe("a");
    expect(block.box).toEqual({ w: 40, h: 8 });
  });

  it("pastes below the selected block under a new id, keeping the width", () => {
    const serialized = serializeComponent(source.components[0] as Component, { w: 30 });
    const { ops, select } = pasteOps(source, parseClipboard(serialized)!, "b", 1, (k) => k);
    expect(select).toBe("text-1");
    const result = engine.apply(source, ops);
    expect(result.ok).toBe(true);
    const pasted = result.doc?.components.find((c) => c.id === "text-1") as { at?: { w?: number; y?: number } } | undefined;
    expect(pasted?.at?.w).toBe(30);
    expect((pasted?.at?.y ?? 0) > 10).toBe(true);
  });

  it("pastes at the end of the page when nothing is selected", () => {
    const { ops } = pasteOps(source, { block: blockOf(source.components[1] as Component, { w: 0 }) }, null, 1, (k) => k);
    const result = engine.apply(source, ops);
    expect(result.ok).toBe(true);
    expect(result.doc?.components).toHaveLength(3);
  });

  it("reads a bare component JSON (as an agent would write it)", () => {
    const parsed = parseClipboard(JSON.stringify({ id: "kpi-9", type: "kpi", content: { value: "12", label: "Leads" }, at: { x: 0, y: 0, w: 20 } }));
    expect(parsed && "block" in parsed && parsed.block.box.w).toBe(20);
    const { ops, select } = pasteOps(source, parsed!, null, 1, (k) => k);
    expect(select).toBe("kpi-1");
    expect(engine.apply(source, ops).ok).toBe(true);
  });

  it("turns plain text into a text block, one paragraph per blank line", () => {
    const parsed = parseClipboard("Primeiro parágrafo\ncontinua aqui.\n\nSegundo parágrafo.");
    expect(parsed).toEqual({ text: "Primeiro parágrafo\ncontinua aqui.\n\nSegundo parágrafo." });
    const { ops } = pasteOps(source, parsed!, "a", 1, (k) => k);
    const added = (ops[0] as { component: { content: { paragraphs: string[] } } }).component;
    expect(added.content.paragraphs).toEqual(["Primeiro parágrafo continua aqui.", "Segundo parágrafo."]);
    expect(engine.apply(source, ops).ok).toBe(true);
  });

  it("ignores an empty clipboard", () => {
    expect(parseClipboard("   ")).toBeNull();
  });
});

describe("describing a write before it is sent", () => {
  it("counts ops and names the blocks they touch, including new ones", () => {
    const summary = summarizeOps([
      { op: "edit", component: "a", paragraphs: [] },
      { op: "place", component: "a", at: { x: 1 } },
      { op: "add", component: { id: "kpi-1", type: "kpi" }, at: { below: "a" } },
      { op: "row", items: [{ id: "x" }, "y"] },
    ]);
    expect(summary.ops).toEqual({ edit: 1, place: 1, add: 1, row: 1 });
    expect(summary.components).toEqual(["a", "kpi-1", "x", "y"]);
  });

  it("gives the same line the history shows", () => {
    const nameOf = (id: string) => ({ a: "Visão geral" })[id] ?? id;
    expect(describeOps([{ op: "edit", component: "a" }], t, nameOf)).toBe("Editou “Visão geral”");
    expect(describeOps([{ op: "place", component: "a", at: { x: 2 } }], t, nameOf)).toBe(t("layout.history.op.place", { what: "“Visão geral”", count: 1 }));
  });
});

describe("useLayoutEditor sends what each write is called", () => {
  beforeEach(() => vi.resetAllMocks());
  const words = {
    describe: (ops: unknown[]) => `${ops.length} op`,
    undo: "Desfez",
    redo: "Refez",
    restore: "Restaurou",
  };

  it("passes the description with the ops and the undo note with the replace", async () => {
    api.apiApplyLayoutOps.mockResolvedValue({ ok: true, revision: 2, diagnostics: [], changes: [] });
    api.apiReplaceLayout.mockResolvedValue({ ok: true, revision: 3, diagnostics: [], changes: [] });
    const { result } = renderHook(() => useLayoutEditor(engine, "d1", { content: doc([text("a", 0)]), revision: 1, updatedAt: null }, getToken, 0, words));
    act(() => {
      result.current.commit([{ op: "place", component: "a", at: { x: 10 } }]);
    });
    await waitFor(() => expect(result.current.revision).toBe(2));
    expect(api.apiApplyLayoutOps).toHaveBeenCalledWith("d1", expect.anything(), 1, getToken, "1 op");
    act(() => result.current.undo());
    await waitFor(() => expect(result.current.revision).toBe(3));
    expect(api.apiReplaceLayout).toHaveBeenCalledWith("d1", expect.anything(), 2, getToken, "Desfez");
  });
});

describe("activity groups bursts of edits", () => {
  const at = (minutesAgo: number) => new Date(Date.UTC(2026, 10, 3, 12, 60 - minutesAgo)).toISOString();
  const entry = (id: string, actorId: string, actionType: DocumentActivity["actionType"], minutesAgo: number): DocumentActivity => ({
    id,
    actionType,
    description: null,
    actorId,
    actorName: actorId,
    isAgent: false,
    isMe: false,
    onBehalfOf: null,
    harness: null,
    bytesDelta: null,
    versionId: null,
    createdAt: at(minutesAgo),
  });

  it("joins the same actor's edits within 15 minutes and keeps everything else apart", () => {
    const groups = groupActivity([
      entry("1", "max", "layout_updated", 1),
      entry("2", "max", "layout_updated", 3),
      entry("3", "max", "snapshot", 4),
      entry("4", "max", "layout_updated", 5),
      entry("5", "agent", "layout_updated", 6),
      entry("6", "max", "write", 30),
      entry("7", "max", "write", 50),
    ]);
    expect(groups.map((g) => g.map((e) => e.id))).toEqual([["1", "2"], ["3"], ["4"], ["5"], ["6"], ["7"]]);
  });
});
