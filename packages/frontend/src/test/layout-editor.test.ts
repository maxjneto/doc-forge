import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEngine, type LayoutDocument } from "@docforge/layout";
import { createNodeRegistry } from "@docforge/layout/node";
import { describeChange } from "@/components/layout-doc/changes";
import { itemsToText, textToItems } from "@/components/layout-doc/panels/ContentEditor";
import { translate } from "@/i18n";

const api = vi.hoisted(() => ({
  apiApplyLayoutOps: vi.fn(),
  apiReplaceLayout: vi.fn(),
  apiGetLayout: vi.fn(),
}));
vi.mock("@/utils/api", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/utils/api")>()), ...api }));

import { LayoutConflictError } from "@/utils/api";
import { useLayoutEditor } from "@/components/layout-doc/useLayoutEditor";

const engine = createEngine({ registry: createNodeRegistry() });
const getToken = async () => "token";
const text = (id: string, y: number) => ({ id, type: "text", content: { paragraphs: [id] }, at: { page: 1, x: 0, y, w: 40 } });
const doc = (components: unknown[]): LayoutDocument =>
  ({ format: "docforge/layout", version: 2, surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }], components }) as LayoutDocument;
const ids = (d: LayoutDocument) => d.components.map((c) => c.id);
const ok = (revision: number) => ({ ok: true, revision, diagnostics: [], changes: [] });

describe("useLayoutEditor", () => {
  beforeEach(() => vi.resetAllMocks());

  const start = (initial = doc([text("a", 0)])) => renderHook(({ tick }) => useLayoutEditor(engine, "d1", { content: initial, revision: 1, updatedAt: null }, getToken, tick), { initialProps: { tick: 0 } });

  it("shows a change at once and saves it with the revision it was based on", async () => {
    api.apiApplyLayoutOps.mockResolvedValue(ok(2));
    const { result } = start();
    act(() => {
      result.current.commit([{ op: "place", component: "a", at: { x: 10 } }]);
    });
    expect(result.current.content.components[0]?.at?.x).toBe(10);
    await waitFor(() => expect(result.current.revision).toBe(2));
    expect(api.apiApplyLayoutOps).toHaveBeenCalledWith("d1", [{ op: "place", component: "a", at: { x: 10 } }], 1, getToken);
    expect(result.current.status).toBe("saved");
  });

  it("refuses an op the library refuses, without saving anything", () => {
    const { result } = start();
    let outcome = null as ReturnType<typeof result.current.commit> | null;
    act(() => {
      outcome = result.current.commit([{ op: "place", component: "nope", at: { x: 1 } }]);
    });
    expect(outcome?.ok).toBe(false);
    expect(api.apiApplyLayoutOps).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
  });

  it("on a conflict, applies the pending ops again on top of the other writer's version", async () => {
    api.apiApplyLayoutOps.mockRejectedValueOnce(new LayoutConflictError(5)).mockResolvedValueOnce(ok(6));
    api.apiGetLayout.mockResolvedValue({ content: doc([text("a", 0), text("agent", 60)]), revision: 5, updatedAt: null });
    const { result } = start();
    act(() => {
      result.current.commit([{ op: "add", component: { id: "mine", type: "divider" }, at: { page: 1, x: 0, y: 30, w: 10 } }]);
    });
    await waitFor(() => expect(result.current.revision).toBe(6));
    expect(ids(result.current.content)).toEqual(["a", "agent", "mine"]);
    expect(api.apiApplyLayoutOps).toHaveBeenLastCalledWith("d1", expect.any(Array), 5, getToken);
    expect(result.current.notice).toEqual({ kind: "external" });
    expect(result.current.canUndo).toBe(false);
  });

  it("drops what cannot be applied on the new version and says so", async () => {
    api.apiApplyLayoutOps.mockRejectedValueOnce(new LayoutConflictError(5));
    // The other writer removed "a"; placing it no longer makes sense.
    api.apiGetLayout.mockResolvedValue({ content: doc([text("agent", 0)]), revision: 5, updatedAt: null });
    const { result } = start();
    act(() => {
      result.current.commit([{ op: "place", component: "a", at: { x: 5 } }]);
    });
    await waitFor(() => expect(result.current.notice).toEqual({ kind: "conflict-dropped" }));
    expect(ids(result.current.content)).toEqual(["agent"]);
    expect(result.current.revision).toBe(5);
  });

  it("undo restores the snapshot and saves it as a replace; redo brings the change back", async () => {
    api.apiApplyLayoutOps.mockResolvedValue(ok(2));
    api.apiReplaceLayout.mockResolvedValueOnce(ok(3)).mockResolvedValueOnce(ok(4));
    const { result } = start();
    act(() => {
      result.current.commit([{ op: "place", component: "a", at: { y: 20 } }]);
    });
    await waitFor(() => expect(result.current.revision).toBe(2));
    act(() => result.current.undo());
    expect(result.current.content.components[0]?.at?.y).toBe(0);
    await waitFor(() => expect(result.current.revision).toBe(3));
    expect(api.apiReplaceLayout).toHaveBeenCalledWith("d1", expect.objectContaining({ components: [expect.objectContaining({ at: { page: 1, x: 0, y: 0, w: 40 } })] }), 2, getToken);
    act(() => result.current.redo());
    await waitFor(() => expect(result.current.revision).toBe(4));
    expect(result.current.content.components[0]?.at?.y).toBe(20);
  });

  it("keyboard nudges in a row are one undo step", async () => {
    api.apiApplyLayoutOps.mockImplementation(async () => ok(2));
    const { result } = start();
    for (const x of [1, 2, 3]) {
      act(() => {
        result.current.commit([{ op: "place", component: "a", at: { x } }], { coalesce: "nudge:a" });
      });
    }
    await waitFor(() => expect(result.current.status).toBe("saved"));
    api.apiReplaceLayout.mockResolvedValue(ok(3));
    act(() => result.current.undo());
    expect(result.current.content.components[0]?.at?.x).toBe(0);
    expect(result.current.canUndo).toBe(false);
  });

  it("picks up a write from someone else on an SSE tick", async () => {
    api.apiGetLayout.mockResolvedValue({ content: doc([text("a", 0), text("agent", 60)]), revision: 9, updatedAt: null });
    const { result, rerender } = start();
    rerender({ tick: 1 });
    await waitFor(() => expect(result.current.revision).toBe(9));
    expect(ids(result.current.content)).toEqual(["a", "agent"]);
    expect(result.current.notice).toEqual({ kind: "external" });
    // The version before stays for the review, and the comparison names the agent's block.
    expect(result.current.external).toMatchObject({ fromRevision: 1, toRevision: 9 });
    expect(ids(result.current.external!.before)).toEqual(["a"]);
    const comparison = engine.compare(result.current.external!.before, result.current.content);
    expect(comparison.edits.map((e) => `${e.component}:${e.kinds.join("+")}`)).toEqual(["agent:added"]);
    expect(engine.restore(result.current.external!.before, result.current.content, "agent")).toEqual([{ op: "remove", component: "agent" }]);
  });

  it("keeps the first unreviewed version across several external writes", async () => {
    const { result, rerender } = start();
    api.apiGetLayout.mockResolvedValueOnce({ content: doc([text("a", 0), text("b", 60)]), revision: 2, updatedAt: null });
    rerender({ tick: 1 });
    await waitFor(() => expect(result.current.revision).toBe(2));
    api.apiGetLayout.mockResolvedValueOnce({ content: doc([text("a", 0), text("b", 60), text("c", 90)]), revision: 3, updatedAt: null });
    rerender({ tick: 2 });
    await waitFor(() => expect(result.current.revision).toBe(3));
    expect(result.current.external).toMatchObject({ fromRevision: 1, toRevision: 3 });
    expect(ids(result.current.external!.before)).toEqual(["a"]);
    act(() => result.current.dismissExternal());
    expect(result.current.external).toBeNull();
  });
});

describe("list items as text", () => {
  it("round-trips nesting and checkboxes", () => {
    const items = ["um", { text: "dois", items: ["dois.um", { text: "feito", checked: true }] }, { text: "aberto", checked: false }];
    const text = itemsToText(items);
    expect(text).toBe("um\ndois\n  dois.um\n  [x] feito\n[ ] aberto");
    expect(textToItems(text)).toEqual(items);
  });
});

describe("changes in the person's language", () => {
  const t = (key: string, vars?: Record<string, string | number>) => translate("pt-BR", key, vars);
  it("says who moved, how far and why", () => {
    const change = { code: "moved", component: "kpi", message: "x", data: { before: { page: 1, x: 0, y: 12 }, after: { page: 1, x: 0, y: 28 }, pushedBy: "titulo" } };
    expect(describeChange(change, t)).toBe("kpi desceu 16 unidades, empurrado por titulo.");
    expect(describeChange({ ...change, code: "moved-page", data: { ...change.data, after: { page: 2, x: 0, y: 0 } } }, t)).toBe("kpi foi da página 1 para a 2, empurrado por titulo.");
  });
  it("falls back to the library's message when it has no data", () => {
    expect(describeChange({ code: "moved", component: "kpi", message: "kpi moved", data: null }, t)).toBe("kpi moved");
  });
});
