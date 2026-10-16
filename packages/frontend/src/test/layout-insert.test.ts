import { describe, expect, it } from "vitest";
import { createEngine, type Component, type LayoutDocument } from "@docforge-lib/layout";
import { createNodeRegistry } from "@docforge-lib/layout/node";
import { insertOps } from "@/components/layout-doc/defaults";
import { inlineKind } from "@/components/layout-doc/InlineBlockEditors";
import { isAlignedRow, rowRebuildOp, rowsOf } from "@/components/layout-doc/names";
import { translate } from "@/i18n";

const engine = createEngine({ registry: createNodeRegistry() });
const t = (key: string) => translate("pt-BR", key);
const base = {
  format: "docforge/layout",
  version: 3,
  surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }],
  components: [{ id: "title", type: "text", content: { paragraphs: ["Q3"] }, at: { page: 1, x: 0, y: 0, w: 89 } }],
} as unknown as LayoutDocument;

describe("insert below", () => {
  it("adds one block, or a whole row of indicators, below the chosen block", () => {
    const one = insertOps(base, "chart", "title", 1, t);
    const r1 = engine.apply(base, one.ops);
    expect(r1.ok).toBe(true);
    expect(r1.doc?.components.map((c) => c.id)).toEqual(["title", one.select]);

    const row = insertOps(base, "kpi-row", "title", 1, t);
    const r2 = engine.apply(base, row.ops);
    expect(r2.ok).toBe(true);
    const layout = engine.layout(r2.doc);
    expect(rowsOf(layout).map((r) => r.ids.length)).toEqual([1, 3]);
    expect(row.select).toBe("kpi-1");
  });

  it("puts a text beside a chart two to one", () => {
    const { ops } = insertOps(base, "text-chart", "title", 1, t);
    const layout = engine.layout(engine.apply(base, ops).doc);
    expect((layout.components["text-1"]?.box.w ?? 0) > (layout.components["chart-1"]?.box.w ?? 0) * 1.8).toBe(true);
  });
});

describe("reorder a row", () => {
  const withRow = engine.apply(base, insertOps(base, "kpi-row", "title", 1, t).ops).doc as LayoutDocument;
  const layout = engine.layout(withRow);

  it("swaps blocks and keeps their widths and the row's top", () => {
    expect(isAlignedRow(layout, ["kpi-1", "kpi-2", "kpi-3"])).toBe(true);
    const op = rowRebuildOp(layout, ["kpi-2", "kpi-1", "kpi-3"]);
    const after = engine.layout(engine.apply(withRow, [op]).doc);
    expect(after.components["kpi-2"]?.box.x).toBe(0);
    expect(after.components["kpi-1"]?.box.x).toBe(layout.components["kpi-2"]?.box.x);
    expect(after.components["kpi-1"]?.box.y).toBe(layout.components["kpi-1"]?.box.y);
  });

  it("does not treat loosely overlapping blocks as a row", () => {
    expect(isAlignedRow(layout, ["title", "kpi-1"])).toBe(false);
  });
});

describe("inlineKind", () => {
  it("edits plain KPIs and tables in place, and leaves rich ones to the panel", () => {
    expect(inlineKind({ id: "k", type: "kpi", content: { value: "1", label: "x", delta: "+2" } } as Component)).toBe("kpi");
    expect(inlineKind({ id: "t", type: "table", content: { columns: ["A", { header: "B" }], rows: [["1", 2]] } } as Component)).toBe("table");
    expect(inlineKind({ id: "t", type: "table", content: { columns: ["A"], rows: [[[{ text: "x", color: "$color.primary" }]]] } } as Component)).toBe(null);
    expect(inlineKind({ id: "c", type: "chart", content: { kind: "bar", categories: [], series: [] } } as Component)).toBe(null);
  });
});
