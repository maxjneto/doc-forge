import type { CSSProperties } from "react";
import type { Tokens } from "@docforge/layout";
import { useI18n } from "@/i18n";
import { docFont } from "../fonts";

/**
 * A theme drawn as a tiny page: the page color, a title in the heading font, text,
 * three indicators and a chart in the theme's own colors. Built from the tokens
 * (no rendering engine), so a gallery of them costs nothing.
 */
export function ThemePreview({ tokens, slide, style }: { tokens: Tokens; slide?: boolean; style?: CSSProperties }) {
  const { t } = useI18n();
  const c = tokens.color;
  const radius = Math.min(Number(tokens.radius.m ?? 8), 12) / 2;
  const heading = docFont(String(tokens.font.heading ?? tokens.font.sans));
  const body = docFont(String(tokens.font.sans));
  return (
    <div
      aria-hidden
      className="df-theme-preview"
      style={{
        aspectRatio: slide ? "16 / 9" : "4 / 3",
        background: c.surface,
        color: c.text,
        borderColor: c.border,
        ...style,
      }}
    >
      <span className="df-theme-preview__title" style={{ fontFamily: heading, color: c.text }}>{t("layout.design.sampleTitle")}</span>
      <span className="df-theme-preview__text" style={{ fontFamily: body, color: c.muted }}>{t("layout.design.sampleText")}</span>
      <span className="df-theme-preview__row">
        {[c.primary, c.text, c.success].map((value, i) => (
          <span key={i} className="df-theme-preview__kpi" style={{ background: c.subtle, borderRadius: radius }}>
            <b style={{ fontFamily: heading, color: i === 0 ? value : c.text }}>{["42", "8,1", "+12%"][i]}</b>
            <i style={{ background: c.muted }} />
          </span>
        ))}
      </span>
      <span className="df-theme-preview__chart" style={{ borderColor: c.border }}>
        {[0.45, 0.7, 0.55, 0.9, 0.65].map((h, i) => (
          <i key={i} style={{ height: `${h * 100}%`, background: i % 2 ? c.chart2 : c.chart1, borderRadius: Math.min(radius, 2) }} />
        ))}
        <span className="df-theme-preview__mark" style={{ background: c.highlight, borderColor: c.primary }} />
      </span>
    </div>
  );
}
