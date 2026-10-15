import type { CSSProperties } from "react";

/**
 * Type roles for the inline-style world. Same scale as the `--text-*` tokens
 * in index.css (which Tailwind exposes as `text-label`, `text-caption`…);
 * spread one into `style` instead of picking a fontSize by eye:
 *
 *   <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
 */
const mono = "var(--font-mono)";

export const textStyle = {
  /** Status, metadata, pill — mono caps. */
  label: {
    fontFamily: mono,
    fontSize: "var(--text-label)",
    fontWeight: 600,
    letterSpacing: "var(--tracking-label)",
    textTransform: "uppercase",
    lineHeight: 1,
  },
  /** Section kicker — `› STRUCTURE`. */
  eyebrow: {
    fontFamily: mono,
    fontSize: "var(--text-label)",
    fontWeight: 600,
    letterSpacing: "var(--tracking-eyebrow)",
    textTransform: "uppercase",
    lineHeight: 1,
  },
  /** Form field label in dense editors — sans, sentence case (mono caps get hard to scan in long forms). */
  fieldLabel: { fontSize: "var(--text-caption)", fontWeight: 500, lineHeight: 1.3 },
  /** Group heading inside a side panel — sans, sentence case. */
  group: { fontSize: "var(--text-body-sm)", fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.005em" },
  /** Timestamp, author, dense-list metadata. */
  caption: { fontSize: "var(--text-caption)", lineHeight: 1.45 },
  /** List row, side-panel item. */
  bodySm: { fontSize: "var(--text-body-sm)", lineHeight: 1.5 },
  /** Button, nav, tab label. */
  ui: { fontSize: "var(--text-body-sm)", fontWeight: 500, lineHeight: 1.2 },
  /** Code, diff, counters. */
  code: { fontFamily: mono, fontSize: "var(--text-code)", lineHeight: 1.7, letterSpacing: "normal" },
  /** Reading text, agent rationale. */
  body: { fontSize: "var(--text-body)", lineHeight: 1.65 },
  /** Panel and card title. */
  title: { fontSize: "var(--text-title)", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.3 },
  /** Page section heading. */
  heading: { fontSize: "var(--text-heading)", fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.25 },
  /** Page title. */
  display: { fontSize: "var(--text-display)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15 },
  /** Marketing hero only. */
  hero: { fontSize: "var(--text-hero)", fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1.02 },
} satisfies Record<string, CSSProperties>;
