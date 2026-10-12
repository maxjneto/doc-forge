import type { AuditFinding } from "@/types";
import type { AnchorPrecision } from "@/utils/documentStructure";
import { Pill } from "@/components/ui";
import { useI18n } from "@/i18n";

interface EditorFindingCalloutProps {
  finding: AuditFinding;
  /** How much of the anchor survived — shown when it degraded. */
  precision: AnchorPrecision;
  /** The paragraph the finding sits in, so the phrase can be underlined. */
  paragraph?: string;
}

/**
 * A gate finding drawn where it applies, with the offending phrase underlined.
 *
 * This is the payoff of the anchor cascade: the agent reports a phrase, and it
 * gets placed even after the surrounding prose was rewritten. When the phrase
 * itself is gone the callout still renders, at section precision, saying so —
 * a stale finding must never vanish silently.
 */
export function EditorFindingCallout({
  finding,
  precision,
  paragraph,
}: EditorFindingCalloutProps) {
  const { t } = useI18n();
  const blocking = finding.severity === "high";

  // Split the paragraph around the quote so only the offending words carry the
  // underline.
  let before = "";
  let hit = "";
  let after = "";
  if (paragraph && finding.quote) {
    const at = paragraph.indexOf(finding.quote);
    if (at !== -1) {
      before = paragraph.slice(0, at);
      hit = finding.quote;
      after = paragraph.slice(at + finding.quote.length);
    }
  }

  return (
    <div
      style={{
        margin: "16px 0",
        padding: "16px 18px",
        border: `1px solid ${blocking ? "var(--color-heat-line)" : "var(--color-warn-line)"}`,
        borderRadius: "var(--radius-md)",
        background: blocking
          ? "linear-gradient(180deg, var(--color-heat-tint), var(--color-surface))"
          : "var(--color-warn-wash)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <Pill tone={blocking ? "heat" : "warn"} dot={false}>
          {t(blocking ? "editor.blocking" : "editor.warning").toUpperCase()}
        </Pill>
        {finding.category && (
          <span
            className="df-mono"
            style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", color: "var(--color-faint)" }}
          >
            {finding.category.toUpperCase()}
          </span>
        )}
        {precision !== "quote" && (
          <span
            className="df-mono"
            title={t("editor.anchorChanged")}
            style={{ fontSize: 10, color: "var(--color-mute)" }}
          >
            {t("editor.approximateAnchor").toUpperCase()}
          </span>
        )}
      </div>

      {hit ? (
        <div style={{ fontSize: 13, lineHeight: 1.85, color: "var(--color-dim)" }}>
          {before}
          <span
            style={{
              color: "var(--color-heat-pale)",
              textDecoration: "underline",
              textDecorationColor: "var(--color-heat)",
              textUnderlineOffset: 5,
            }}
          >
            {hit}
          </span>
          {after}
        </div>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--color-dim)" }}>
          {finding.description}
        </div>
      )}

      {hit && (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--color-faint)", marginTop: 10 }}>
          {finding.description}
        </div>
      )}
    </div>
  );
}
