import { defaultTokens, mergeTokens, type LayoutDocument, type TokenOverrides, type Tokens } from "@docforge-lib/layout";
import type { LayoutTheme } from "@/utils/api";

/**
 * Themes of the printed document (not the app). A theme is a set of the document's
 * own tokens; applying one is a `setTokens` op, so every block that uses a token
 * follows. Built-in and saved themes come from the backend (one list for people and
 * agents); this file holds what the editor computes about them. Literal colors are
 * the point here, which is why the token guard allows this file.
 */

/** Groups a theme always sets in full, so switching themes never leaves a value behind. */
const FULL_GROUPS = ["color", "font", "radius"] as const;

/** A theme's tokens with every color, font and radius filled from the library's defaults. */
export function completeTheme(tokens: TokenOverrides): TokenOverrides {
  const out: TokenOverrides = structuredClone(tokens);
  for (const group of FULL_GROUPS) out[group] = { ...defaultTokens[group], ...(tokens[group] ?? {}) } as never;
  return out;
}

/** The ops that apply a theme: its tokens (completed) and its name. */
export function themeOps(theme: Pick<LayoutTheme, "name" | "tokens">): unknown[] {
  return [
    { op: "setTokens", tokens: completeTheme(theme.tokens as TokenOverrides) },
    { op: "setMeta", meta: { theme: theme.name.slice(0, 120) } },
  ];
}

/** The document's tokens as a theme would save them: only what differs from the defaults. */
export function themeTokensOf(doc: LayoutDocument): TokenOverrides {
  return structuredClone(doc.tokens ?? {});
}

/** Which theme the document looks like now: the one named in meta when its colors still match, else any whose colors match. */
export function currentTheme(doc: LayoutDocument, themes: LayoutTheme[]): LayoutTheme | null {
  const colors = mergeTokens(doc.tokens).color;
  const matches = (theme: LayoutTheme) => {
    const wanted = { ...defaultTokens.color, ...((theme.tokens.color as Record<string, string>) ?? {}) };
    return Object.entries(wanted).every(([k, v]) => colors[k]?.toLowerCase() === String(v).toLowerCase());
  };
  const named = themes.find((th) => th.name === doc.meta?.theme);
  if (named && matches(named)) return named;
  return themes.find(matches) ?? null;
}

/** Merge a draft over the document's tokens, as the page would render it. */
export function withDraft(doc: LayoutDocument, draft: TokenOverrides | null): LayoutDocument {
  if (!draft) return doc;
  const tokens: TokenOverrides = structuredClone(doc.tokens ?? {});
  for (const [group, values] of Object.entries(draft)) {
    const key = group as keyof TokenOverrides;
    tokens[key] = { ...(tokens[key] ?? {}), ...(values as object) } as never;
  }
  return { ...doc, tokens };
}

/** How many single values a draft changes (for "N changes to apply"). */
export function draftSize(draft: TokenOverrides | null): number {
  return draft ? Object.values(draft).reduce((n, values) => n + Object.keys(values ?? {}).length, 0) : 0;
}

/** Color roles, grouped the way people think about a page. */
export const COLOR_GROUPS: { key: string; colors: string[] }[] = [
  { key: "page", colors: ["surface", "subtle", "border"] },
  { key: "text", colors: ["text", "muted"] },
  { key: "accent", colors: ["primary", "highlight"] },
  { key: "states", colors: ["success", "warning", "danger"] },
  { key: "charts", colors: ["chart1", "chart2", "chart3", "chart4", "chart5", "chart6"] },
];

/** Type scales: each multiplies the library's default sizes. "slides" is the scale for 1280 × 720 slides. */
export const TYPE_SCALES: { key: string; values: Record<string, number> }[] = [
  { key: "compact", values: { xs: 10, s: 12, m: 13, l: 16, xl: 19, xxl: 24, display: 30 } },
  { key: "normal", values: { ...defaultTokens.size } },
  { key: "large", values: { xs: 12, s: 14, m: 17, l: 21, xl: 26, xxl: 34, display: 44 } },
  { key: "slides", values: { xs: 14, s: 16, m: 20, l: 26, xl: 34, xxl: 44, display: 60 } },
];

/** Corner presets: the three radius tokens together. */
export const RADIUS_PRESETS: { key: string; values: Record<string, number> }[] = [
  { key: "square", values: { none: 0, s: 0, m: 0 } },
  { key: "soft", values: { none: 0, s: 2, m: 4 } },
  { key: "round", values: { none: 0, s: 4, m: 8 } },
  { key: "pill", values: { none: 0, s: 8, m: 16 } },
];

/** The preset whose values all match (null when changed by hand). */
export function presetKey(presets: { key: string; values: Record<string, number> }[], current: Record<string, number>): string | null {
  return presets.find((p) => Object.entries(p.values).every(([k, v]) => current[k] === v))?.key ?? null;
}

/** WCAG contrast ratio between two #rrggbb colors (1–21). */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) return 1;
    const n = parseInt(m[1] as string, 16);
    const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** Pairs a reader must be able to tell apart, checked on every palette change. */
export function readability(tokens: Tokens): { pair: [string, string]; ratio: number }[] {
  const c = tokens.color;
  const pairs: [string, string][] = [
    ["text", "surface"],
    ["muted", "surface"],
    ["text", "subtle"],
  ];
  return pairs.map((pair) => ({ pair, ratio: contrast(c[pair[0]] ?? "#000000", c[pair[1]] ?? "#ffffff") })).filter((r) => r.ratio < 4.5);
}

/** Margin presets, in px. */
export const MARGINS = [
  { key: "narrow", px: 24 },
  { key: "normal", px: 40 },
  { key: "wide", px: 64 },
] as const;

/** Colors offered in the color picker, beside the free choice: a balanced set that prints well. */
export const SUGGESTED_COLORS = [
  "#1a1c1e", "#5b6168", "#d9dce1", "#f3f4f6", "#ffffff", "#14161a",
  "#1f4fd8", "#14213d", "#5b4fe0", "#0b6e4f", "#12a4af", "#8a3b12",
  "#d94100", "#e8710a", "#f2a20c", "#c5221f", "#d01884", "#1e8e3e",
];
