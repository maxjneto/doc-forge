import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEngine, type ApplyResult, type Component, type LayoutDocument } from "@docforge-lib/layout";
import { createNodeRegistry } from "@docforge-lib/layout/node";
import { I18nProvider, translate } from "@/i18n";
import { partLabel, partsOf } from "@/components/layout-doc/names";
import { StyleEditor } from "@/components/layout-doc/panels/StyleEditor";

const engine = createEngine({ registry: createNodeRegistry() });
const t = (key: string, vars?: Record<string, string | number>) => translate("pt-BR", key, vars);
const table = { id: "t", type: "table", content: { columns: ["A", "B"], rows: [["1", "2"], ["3", "4"]] }, at: { page: 1, x: 0, y: 0, w: 60 } } as unknown as Component;
const doc = (components: unknown[]): LayoutDocument =>
  ({ format: "docforge/layout", version: 4, surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }], components }) as LayoutDocument;

describe("parts of a block", () => {
  it("lists the library's parts, and the roles a text block uses", () => {
    expect(partsOf(table)).toEqual(["header", "zebra"]);
    expect(partsOf({ id: "k", type: "kpi", content: { value: "1", label: "x" } } as Component)).toEqual(["label", "delta"]);
    expect(partsOf({ id: "x", type: "text", content: { paragraphs: [{ role: "title-2", text: "T" }, "a", "b", { role: "quote", text: "q" }] } } as Component)).toEqual(["title-2", "body", "quote"]);
    expect(partsOf({ id: "c", type: "chart", content: { kind: "bar", categories: ["a"], series: [{ name: "s", values: [1] }] } } as Component)).toEqual([]);
  });

  it("names parts for people", () => {
    expect(partLabel("table", "zebra", t)).toBe("Linhas alternadas");
    expect(partLabel("text", "title-2", t)).toBe(t("layout.role.title-2"));
    expect(partLabel("chart", "odd", t)).toBe("odd");
  });
});

describe("StyleEditor writes where it says", () => {
  const setup = (part: string | null, scopeType = false) => {
    const d = doc([table]);
    const layout = engine.layout(d);
    const commit = vi.fn(() => ({ ok: true, doc: d, diagnostics: [], changes: [], map: "", summary: "" }) as unknown as ApplyResult);
    const onPart = vi.fn();
    render(
      <I18nProvider>
        <StyleEditor doc={d} component={table} geometry={layout.components.t!} tokens={layout.tokens} families={[]} commit={commit} readOnly={false} part={part} onPart={onPart} />
      </I18nProvider>,
    );
    if (scopeType) fireEvent.click(screen.getByRole("radio", { name: /^(All|Tod)/i }));
    return { commit, onPart };
  };

  it("styles the header of this block only through `styles`", () => {
    const { commit } = setup("header");
    fireEvent.click(screen.getByRole("group", { name: /background|fundo/i }).querySelector("button")!);
    expect(commit).toHaveBeenCalledWith([{ op: "update", component: "t", styles: { header: { background: "$color.text" } } }]);
  });

  it("styles the header of every table through the document selector", () => {
    const { commit } = setup("header", true);
    fireEvent.click(screen.getByRole("group", { name: /background|fundo/i }).querySelector("button")!);
    expect(commit).toHaveBeenCalledWith([{ op: "setStyle", layer: "document", selector: "table.header", style: { background: "$color.text" } }]);
  });

  it("styles the whole block as before, and offers the parts", () => {
    const { commit, onPart } = setup(null);
    fireEvent.click(screen.getByRole("group", { name: /background|fundo/i }).querySelector("button")!);
    expect(commit).toHaveBeenCalledWith([{ op: "update", component: "t", style: { background: "$color.text" } }]);
    fireEvent.click(screen.getByRole("radio", { name: /striped|alternadas/i }));
    expect(onPart).toHaveBeenCalledWith("zebra");
  });

  it("applies a ready-made look to the block and its parts", () => {
    const { commit } = setup(null);
    fireEvent.click(screen.getByRole("button", { name: /dark header|cabeçalho escuro/i }));
    expect(commit).toHaveBeenCalledWith([
      { op: "update", component: "t", style: null, styles: null },
      { op: "update", component: "t", styles: { header: { background: "$color.text", color: "$color.surface" } } },
    ]);
  });
});
