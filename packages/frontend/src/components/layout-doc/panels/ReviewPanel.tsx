import type { ApplyResult, Diagnostic, LayoutDocument, LayoutResult, ReviewFinding } from "@docforge-lib/layout";
import { textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { displayName } from "../names";
import { HealthSection } from "./HealthSection";

/**
 * What needs a look, apart from the structure: problems (something does not fit or
 * is broken) first, then the composition review agents also get (`review_layout`),
 * each with its fix one click away.
 */
export function ReviewPanel({
  doc,
  layout,
  problems,
  findings,
  commit,
  preview,
  readOnly,
  onShow,
}: {
  doc: LayoutDocument;
  layout: LayoutResult;
  problems: Diagnostic[];
  findings: ReviewFinding[];
  commit: (ops: unknown[]) => ApplyResult;
  preview: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
  onShow: (id: string) => void;
}) {
  const { t } = useI18n();
  const byId = new Map(doc.components.map((c) => [c.id, c] as const));
  const clean = problems.length === 0 && findings.length === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {clean && (
        <div className="df-empty">
          <span className="material-symbols-outlined" aria-hidden>
            task_alt
          </span>
          <span style={{ ...textStyle.bodySm, color: "var(--color-text)" }}>{t("layout.review.clean")}</span>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.review.cleanHint")}</span>
        </div>
      )}
      {problems.length > 0 && (
        <section className="df-callout df-callout--warn">
          <span style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.problemsCount", { count: problems.length })}</span>
          {problems.map((d, i) => {
            const c = d.component ? byId.get(d.component) : undefined;
            const placed = c && layout.components[c.id];
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: d.severity === "error" ? "var(--color-error)" : "var(--color-warn)", flexShrink: 0 }} />
                  {c && placed ? (
                    <button type="button" className="df-row" onClick={() => onShow(c.id)} style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-text)", background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
                      {displayName(c, t)}
                    </button>
                  ) : (
                    c && <span style={{ ...textStyle.caption, fontWeight: 600, color: "var(--color-text)" }}>{displayName(c, t)}</span>
                  )}
                </div>
                <span style={{ ...textStyle.caption, color: "var(--color-dim)" }} title={d.code}>
                  {d.message}
                </span>
              </div>
            );
          })}
        </section>
      )}
      <HealthSection doc={doc} findings={findings} commit={commit} preview={preview} readOnly={readOnly} onShow={onShow} />
    </div>
  );
}
