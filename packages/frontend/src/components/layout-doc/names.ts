import type { Component, LayoutResult } from "@docforge/layout";

type T = (key: string, vars?: Record<string, string | number>) => string;
type Json = Record<string, unknown>;

/** Markdown subset and runs → plain text, for names and summaries. */
export function plainText(value: unknown): string {
  if (typeof value === "string") {
    return value
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*`_]/g, "")
      .trim();
  }
  if (Array.isArray(value)) return value.map((run) => (run && typeof run === "object" && "text" in run ? plainText((run as Json).text) : "")).join("");
  return "";
}

const clip = (text: string, max = 38) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/**
 * What people call a component: its own words ("Receita", "Relatório do 3º trimestre"),
 * not its id. Falls back to the type ("Gráfico") and then to the id.
 */
export function displayName(component: Component, t: T): string {
  const c = ((component as { content?: Json }).content ?? {}) as Json;
  const type = t(`layout.type.${component.type}`);
  const first = (list: unknown, key?: string): string => {
    if (!Array.isArray(list) || !list.length) return "";
    const item = list[0] as unknown;
    if (key && item && typeof item === "object") return plainText((item as Json)[key]);
    if (item && typeof item === "object" && "text" in (item as Json)) return plainText((item as Json).text);
    return plainText(item);
  };
  let name = "";
  switch (component.type) {
    case "text":
      name = first(c.paragraphs);
      break;
    case "kpi":
      name = plainText(c.label) || plainText(c.value);
      break;
    case "card":
      name = plainText(c.title) || plainText(c.eyebrow);
      break;
    case "list":
      name = first(c.items);
      break;
    case "steps":
      name = first(c.steps, "title");
      break;
    case "timeline":
      name = first(c.events, "title");
      break;
    case "table": {
      const cols = Array.isArray(c.columns) ? c.columns.map((col) => (typeof col === "string" ? col : plainText((col as Json).header))) : [];
      name = cols.length ? `${type}: ${cols.slice(0, 3).join(", ")}` : "";
      break;
    }
    case "chart": {
      const series = Array.isArray(c.series) ? c.series.map((s) => String((s as Json).name ?? "")).filter(Boolean) : [];
      name = series.length ? `${type}: ${series.slice(0, 2).join(", ")}` : "";
      break;
    }
    case "code":
      name = c.language && c.language !== "text" ? `${type} ${String(c.language)}` : "";
      break;
    case "image":
      name = plainText(c.alt);
      break;
    default:
      name = "";
  }
  return clip(name || type || component.id);
}

const FRACTIONS: Record<string, string> = { "1/4": "¼", "1/3": "⅓", "1/2": "½", "2/3": "⅔", "3/4": "¾", "1/1": "1" };

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** How many guide columns a box spans when its edges sit on guides; null otherwise. */
export function guideSpan(box: { x: number; w: number }, layout: LayoutResult): { first: number; last: number } | null {
  const start = layout.guides.find((g) => g.x === box.x);
  const end = layout.guides.find((g) => g.x + g.w === box.x + box.w);
  return start && end && end.col >= start.col ? { first: start.col, last: end.col } : null;
}

/** "⅓ da largura", "4 de 12 colunas" or "52% da largura": widths in words people use. */
export function widthLabel(box: { x: number; w: number }, layout: LayoutResult, t: T): string {
  const total = layout.guides.length;
  const span = guideSpan(box, layout);
  if (span && total) {
    const n = span.last - span.first + 1;
    if (n === total) return t("layout.width.full");
    const d = gcd(n, total);
    const symbol = FRACTIONS[`${n / d}/${total / d}`];
    return symbol ? t("layout.width.fraction", { f: symbol }) : t("layout.width.cols", { n, total });
  }
  const cols = layout.units.cols || 1;
  return t("layout.width.percent", { p: Math.round((box.w / cols) * 100) });
}

/** Blocks drawn side by side, from the layout (the lib computes it; nothing is stored). */
export { rowsOf, type RowGroup } from "@docforge/layout";

const COLOR_KEYS = ["text", "muted", "primary", "surface", "subtle", "border", "success", "danger", "warning", "highlight"];

/** A token's name in the person's language: "$color.subtle" → "Fundo suave", "$size.l" → "G". */
export function tokenName(group: string, key: string, t: T): string {
  if (group === "color") {
    const chart = /^chart(\d)$/.exec(key);
    if (chart) return t("layout.token.color.chart", { n: chart[1] as string });
    return COLOR_KEYS.includes(key) ? t(`layout.token.color.${key}`) : key;
  }
  const known = t(`layout.token.${group}.${key}`);
  return known === `layout.token.${group}.${key}` ? key : known;
}

/**
 * The `row` op that lays out these components side by side in `order`, keeping
 * each one's width (in guide columns when they sit on guides) and lining up their
 * tops. `extra` overrides (equal `widths`, `align: "stretch"`).
 */
export function rowRebuildOp(layout: LayoutResult, order: string[], extra: Record<string, unknown> = {}): Record<string, unknown> | null {
  const boxes = order.map((id) => layout.components[id]?.declared);
  if (boxes.some((b) => !b) || !order.length) return null;
  const declared = boxes as NonNullable<(typeof boxes)[number]>[];
  const spans = declared.map((b) => guideSpan(b, layout));
  const exact = spans.every(Boolean);
  const widths = declared.map((b, i) => (exact ? spans[i]!.last - spans[i]!.first + 1 : b.w));
  const cols = exact ? [Math.min(...spans.map((sp) => sp!.first)), Math.max(...spans.map((sp) => sp!.last))] : undefined;
  return {
    op: "row",
    items: order,
    page: declared[0]!.page,
    y: Math.min(...declared.map((b) => b.y)),
    widths,
    ...(cols ? { cols } : {}),
    ...extra,
  };
}

/** A row people would call a row: its blocks start at (about) the same height. Chains of loosely overlapping blocks are not reordered. */
export function isAlignedRow(layout: LayoutResult, ids: string[]): boolean {
  const tops = ids.map((id) => layout.components[id]?.declared.y).filter((y): y is number => y !== undefined);
  return tops.length === ids.length && ids.length > 1 && Math.max(...tops) - Math.min(...tops) <= 2;
}
