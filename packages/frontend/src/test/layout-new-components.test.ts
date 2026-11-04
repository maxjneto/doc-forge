import { describe, expect, it } from "vitest";
import { createEngine, type Component, type LayoutDocument } from "@docforge-lib/layout";
import { createNodeRegistry } from "@docforge-lib/layout/node";
import { ADDABLE_TYPES, insertOps } from "@/components/layout-doc/defaults";
import { displayName, partsOf } from "@/components/layout-doc/names";
import { fitRow } from "@/components/layout-doc/panels/ContentEditor";
import { joinPrefix, splitPrefix } from "@/components/layout-doc/panels/FlowBlocksEditor";
import { masterOps } from "@/components/layout-doc/panels/PagePanel";
import { translate } from "@/i18n";

const engine = createEngine({ registry: createNodeRegistry() });
const t = (key: string, vars?: Record<string, string | number>) => translate("pt-BR", key, vars);
const base = {
  format: "docforge/layout",
  version: 4,
  meta: { title: "Relatório" },
  surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }],
  components: [{ id: "title", type: "text", content: { paragraphs: ["Q3"] }, at: { page: 1, x: 0, y: 0, w: 89 } }],
} as unknown as LayoutDocument;

describe("new component types in the editor", () => {
  it("adds every type from the menu with valid starter content, and names it", () => {
    for (const type of ADDABLE_TYPES) {
      const { ops, select } = insertOps(base, type, "title", 1, t);
      const r = engine.apply(base, ops);
      expect(r.ok, type).toBe(true);
      const added = r.doc?.components.find((c) => c.id === select) as Component;
      expect(added.type).toBe(type);
      expect(displayName(added, t), type).not.toBe(select);
      expect(r.diagnostics.filter((d) => d.severity === "error"), type).toEqual([]);
    }
  });

  it("reads and writes a flow paragraph's role as its prefix", () => {
    expect(splitPrefix("## Recursos")).toEqual({ role: "title-2", text: "Recursos" });
    expect(splitPrefix("texto")).toEqual({ role: "body", text: "texto" });
    expect(joinPrefix("quote", "dito")).toBe("> dito");
    expect(joinPrefix("body", "# não é título")).toBe("# não é título");
  });

  it("pads table rows by the columns they cover, keeping spanning cells", () => {
    expect(fitRow(["a"], 3)).toEqual(["a", "", ""]);
    expect(fitRow([{ text: "tudo", span: 3 }], 3)).toEqual([{ text: "tudo", span: 3 }]);
    expect(fitRow(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });

  it("offers only the parts a block has", () => {
    const table = { id: "t", type: "table", content: { columns: ["a"], rows: [] } } as unknown as Component;
    expect(partsOf(table)).toEqual(["header", "zebra"]);
    expect(partsOf({ ...table, content: { columns: ["a"], rows: [], footer: ["x"] } } as unknown as Component)).toContain("footer");
    expect(partsOf({ id: "c", type: "callout", content: { text: "x" }, props: { kind: "tip" } } as unknown as Component)).toEqual(["tip"]);
  });
});

describe("header and footer", () => {
  it("puts the title on top and page numbers at the bottom, and takes them away", () => {
    const layout = engine.layout(base);
    const on = engine.apply(base, masterOps(base, layout, { header: true, footer: true, pages: "except-first" }));
    expect(on.ok).toBe(true);
    const laid = engine.layout(on.doc);
    expect(laid.units.rows).toBe((layout.units.rows as number) - 10);
    expect(laid.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
    // Off again: no master left.
    const off = engine.apply(on.doc, masterOps(on.doc as LayoutDocument, laid, { header: false, footer: false, pages: "all" }));
    expect((off.doc?.surfaces[0] as { master?: unknown }).master).toBeUndefined();
  });

  it("keeps what an agent put in the master", () => {
    const agent = engine.apply(base, [{ op: "setMaster", master: { reserve: { top: 6 }, components: [{ id: "logo", type: "divider", at: { x: 0, y: 0, w: 10, h: 2 } }] } }]);
    const doc = agent.doc as LayoutDocument;
    const r = engine.apply(doc, masterOps(doc, engine.layout(doc), { header: false, footer: true, pages: "all" }));
    const master = (r.doc?.surfaces[0] as { master: { reserve: { top: number }; components: { id: string }[] } }).master;
    expect(master.components.map((c) => c.id)).toEqual(["logo", "master-page"]);
    expect(master.reserve.top).toBe(6);
  });
});
