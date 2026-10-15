import { describe, expect, it } from "vitest";
import { createEngine, type Component, type LayoutDocument } from "@docforge/layout";
import { createNodeRegistry } from "@docforge/layout/node";
import { displayName, rowsOf, tokenName, widthLabel } from "@/components/layout-doc/names";
import { translate } from "@/i18n";

const engine = createEngine({ registry: createNodeRegistry() });
const t = (key: string, vars?: Record<string, string | number>) => translate("pt-BR", key, vars);
const doc = (components: unknown[]): LayoutDocument =>
  ({ format: "docforge/layout", version: 2, surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }], components }) as LayoutDocument;

describe("displayName", () => {
  it("uses the component's own words, without markdown", () => {
    expect(displayName({ id: "t", type: "text", content: { paragraphs: [{ role: "title-1", text: "Relatório do **3º** trimestre" }] } } as Component, t)).toBe(
      "Relatório do 3º trimestre",
    );
    expect(displayName({ id: "k", type: "kpi", content: { value: "R$ 4,2 mi", label: "Receita" } } as Component, t)).toBe("Receita");
    expect(displayName({ id: "x", type: "table", content: { columns: ["Região", { header: "Receita" }], rows: [] } } as Component, t)).toBe("Tabela: Região, Receita");
  });

  it("falls back to the type, never to an empty name", () => {
    expect(displayName({ id: "d", type: "divider" } as Component, t)).toBe(t("layout.type.divider"));
  });
});

describe("widthLabel and rowsOf", () => {
  // Guides are resolved when the op runs: place by cols through apply.
  const result = engine.apply(doc([{ id: "t", type: "text", content: { paragraphs: ["Q3"] }, at: { page: 1, x: 0, y: 0, w: 89 } }]), [
    { op: "add", component: { id: "a", type: "kpi", content: { value: "1", label: "A" } }, at: { page: 1, cols: [1, 4], y: 20, h: 12 } },
    { op: "add", component: { id: "b", type: "kpi", content: { value: "2", label: "B" } }, at: { page: 1, cols: [5, 8], y: 20, h: 12 } },
    { op: "add", component: { id: "c", type: "kpi", content: { value: "3", label: "C" } }, at: { page: 1, cols: [9, 12], y: 20, h: 12 } },
    { op: "add", component: { id: "half", type: "kpi", content: { value: "4", label: "D" } }, at: { page: 1, cols: [1, 6], y: 40, h: 12 } },
  ]);
  const layout = engine.layout(result.doc);

  it("names widths by guide fractions", () => {
    expect(widthLabel(layout.components.a!.box, layout, t)).toBe("⅓ da largura");
    expect(widthLabel(layout.components.half!.box, layout, t)).toBe("½ da largura");
    expect(widthLabel(layout.components.t!.box, layout, t)).toBe("Largura inteira");
  });

  it("groups blocks drawn side by side, left to right", () => {
    expect(rowsOf(layout).map((r) => r.ids)).toEqual([["t"], ["a", "b", "c"], ["half"]]);
  });
});

describe("tokenName", () => {
  it("translates tokens and keeps unknown keys", () => {
    expect(tokenName("color", "subtle", t)).toBe("Fundo suave");
    expect(tokenName("color", "chart3", t)).toBe("Gráfico 3");
    expect(tokenName("size", "l", t)).toBe("G");
    expect(tokenName("color", "brand", t)).toBe("brand");
  });
});
