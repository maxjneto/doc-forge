import type { CSSProperties } from "react";
import { defaultPresets, resolveStyle, type Component, type LayoutDocument, type ResolvedStyle, type Tokens } from "@docforge/layout";

/**
 * A component's style (or one of its parts: a text role, a KPI label, a table
 * header) resolved with the library's own cascade, so editors drawn over the page
 * look like what they replace. Regions are left out: they only shift a few
 * values and the editor is temporary.
 */
export function componentStyle(component: Component, doc: LayoutDocument, tokens: Tokens, variant?: string): ResolvedStyle {
  return resolveStyle(
    {
      tokens,
      presets: defaultPresets,
      document: doc.styles?.document ?? {},
      regions: [],
      labelStyles: doc.styles?.labels ?? {},
      componentLabels: component.labels ?? [],
      componentStyle: component.style,
    },
    component.type,
    variant,
  ).style;
}

/** The text part of a resolved style as CSS. */
export function textCss(style: ResolvedStyle, overrides: Partial<ResolvedStyle> = {}): CSSProperties {
  const s = { ...style, ...overrides };
  return {
    fontFamily: `${s.fontFamily}, sans-serif`,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    color: s.color,
    textAlign: s.align,
    fontStyle: s.italic ? "italic" : "normal",
  };
}

/** Same as `textCss`, as an inline style string (for HTML built outside React). */
export function textCssString(style: ResolvedStyle): string {
  const css = textCss(style);
  return [
    `font-family:${css.fontFamily}`,
    `font-size:${String(css.fontSize)}px`,
    `font-weight:${String(css.fontWeight)}`,
    `line-height:${String(css.lineHeight)}`,
    `color:${String(css.color)}`,
    `text-align:${String(css.textAlign)}`,
    css.fontStyle === "italic" ? "font-style:italic" : "",
  ]
    .filter(Boolean)
    .join(";");
}
