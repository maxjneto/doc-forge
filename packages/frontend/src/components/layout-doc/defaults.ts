import type { ComponentType, LayoutDocument } from "@docforge-lib/layout";

/** Order of the "Add" menu: the everyday ones first. */
export const ADDABLE_TYPES: ComponentType[] = ["text", "kpi", "card", "list", "table", "chart", "steps", "timeline", "code", "image", "divider"];

/** Material Symbols name for each component type. */
export const TYPE_ICON: Record<ComponentType, string> = {
  text: "notes",
  list: "format_list_bulleted",
  table: "table",
  code: "code",
  steps: "format_list_numbered",
  timeline: "timeline",
  kpi: "speed",
  card: "crop_landscape",
  chart: "bar_chart",
  image: "image",
  divider: "horizontal_rule",
};

/** Guide columns a new component spans by default (narrow things side by side, the rest across). */
const DEFAULT_COLS: Record<ComponentType, [number, number]> = {
  text: [1, 12],
  list: [1, 6],
  table: [1, 12],
  code: [1, 12],
  steps: [1, 6],
  timeline: [1, 6],
  kpi: [1, 4],
  card: [1, 4],
  chart: [1, 6],
  image: [1, 6],
  divider: [1, 12],
};

/** Starter content for a new component: something visible to replace, never empty. */
export function starterComponent(type: ComponentType, id: string, sample: (key: string) => string): Record<string, unknown> {
  const s = sample;
  switch (type) {
    case "text":
      return { id, type, content: { paragraphs: [{ role: "title-2", text: s("layout.sample.title") }, s("layout.sample.paragraph")] } };
    case "list":
      return { id, type, content: { items: [s("layout.sample.item1"), s("layout.sample.item2"), s("layout.sample.item3")] } };
    case "table":
      return {
        id,
        type,
        content: {
          columns: [s("layout.sample.column1"), s("layout.sample.column2")],
          rows: [
            [s("layout.sample.cell"), "1"],
            [s("layout.sample.cell"), "2"],
          ],
        },
      };
    case "code":
      return { id, type, content: { code: "// …", language: "text" } };
    case "steps":
      return { id, type, content: { steps: [{ title: s("layout.sample.step1") }, { title: s("layout.sample.step2") }] } };
    case "timeline":
      return { id, type, content: { events: [{ date: s("layout.sample.date"), title: s("layout.sample.event") }] } };
    case "kpi":
      return { id, type, content: { value: "42", label: s("layout.sample.kpi") } };
    case "card":
      return { id, type, content: { title: s("layout.sample.cardTitle"), text: s("layout.sample.cardText") } };
    case "chart":
      return { id, type, content: { kind: "bar", categories: ["A", "B", "C"], series: [{ name: s("layout.sample.series"), values: [3, 5, 4] }] } };
    case "image":
      return {
        id,
        type,
        content: {
          // A neutral placeholder; the person swaps the source in the content panel.
          src: "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='240'%3E%3Crect width='400' height='240' fill='%23eceef1'/%3E%3C/svg%3E",
          alt: s("layout.sample.alt"),
          width: 400,
          height: 240,
        },
      };
    case "divider":
      return { id, type, props: { kind: "line" } };
  }
}

/** The `add` op for a new component: under the selected one, or at the end of the page in view. */
export function addOp(component: Record<string, unknown>, type: ComponentType, below: string | null, page: number): unknown {
  const { at: _ignored, ...rest } = component;
  const cols = DEFAULT_COLS[type];
  const at = below ? { below, cols } : { end: true, page, cols };
  return { op: "add", component: rest, at: type === "kpi" ? { ...at, h: 14 } : at };
}

/** `kpi-3`: the type plus the first free number. */
export function newComponentId(doc: LayoutDocument, type: ComponentType): string {
  const taken = new Set(doc.components.map((c) => c.id));
  for (let n = 1; ; n++) {
    const id = `${type}-${n}`;
    if (!taken.has(id)) return id;
  }
}

/** What the "/" menu offers: every type, plus two compositions built with the `row` op. */
export type InsertKey = ComponentType | "kpi-row" | "text-chart";
export const INSERT_KEYS: InsertKey[] = ["text", "kpi-row", "text-chart", ...ADDABLE_TYPES.filter((t) => t !== "text")];
export const INSERT_ICON: Record<InsertKey, string> = { ...TYPE_ICON, "kpi-row": "view_column", "text-chart": "vertical_split" };

/**
 * Ops that insert `key` under `below` (or at the end of `page`), and the id to select
 * afterwards. New ids are unique against the document and each other.
 */
export function insertOps(doc: LayoutDocument, key: InsertKey, below: string | null, page: number, sample: (k: string) => string): { ops: unknown[]; select: string } {
  const taken = new Set(doc.components.map((c) => c.id));
  const fresh = (type: ComponentType) => {
    for (let n = 1; ; n++) {
      const id = `${type}-${n}`;
      if (!taken.has(id)) {
        taken.add(id);
        return id;
      }
    }
  };
  const where = below ? { below } : { end: true as const, page };
  if (key === "kpi-row") {
    const items = [0, 1, 2].map(() => starterComponent("kpi", fresh("kpi"), sample));
    return { ops: [{ op: "row", ...where, h: 14, items }], select: String(items[0]?.id) };
  }
  if (key === "text-chart") {
    const text = starterComponent("text", fresh("text"), sample);
    const chart = starterComponent("chart", fresh("chart"), sample);
    return { ops: [{ op: "row", ...where, widths: [2, 1], align: "top", items: [text, chart] }], select: String(text.id) };
  }
  const id = fresh(key);
  return { ops: [addOp(starterComponent(key, id, sample), key, below, page)], select: id };
}
