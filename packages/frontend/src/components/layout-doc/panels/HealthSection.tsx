import { useState } from "react";
import type { ApplyResult, LayoutDocument, ReviewFinding } from "@docforge-lib/layout";
import { Button, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { displayName } from "../names";
import { track } from "../track";

interface HealthSectionProps {
  doc: LayoutDocument;
  findings: ReviewFinding[];
  commit: (ops: unknown[]) => ApplyResult;
  preview: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
  onShow: (id: string) => void;
}

const key = (f: ReviewFinding) => `${f.code}:${f.components.join(",")}:${f.page ?? ""}`;

/**
 * The composition review agents get from `review_layout`, in the person's words,
 * with the fix one click away. Fixes are the same ops; undo brings things back.
 */
export function HealthSection({ doc, findings, commit, preview, readOnly, onShow }: HealthSectionProps) {
  const { t } = useI18n();
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  const byId = new Map(doc.components.map((c) => [c.id, c] as const));
  const name = (id: string) => {
    const c = byId.get(id);
    return c ? displayName(c, t) : id;
  };
  const names = (ids: string[]) => ids.map((id) => `“${name(id)}”`).join(", ");
  const visible = findings.filter((f) => !ignored.has(key(f)));
  if (!visible.length) return null;

  const message = (f: ReviewFinding): string => {
    const d = f.data as Record<string, number>;
    switch (f.code) {
      case "empty-space":
        return t("layout.health.emptySpace", { name: name(f.components[0] as string), pct: Math.round(((d.height - d.needed) / d.height) * 100) });
      case "uneven-row":
        return t("layout.health.unevenRow", { names: names(f.components) });
      case "uneven-top":
        return t("layout.health.unevenTop", { names: names(f.components) });
      case "off-guide":
        return t("layout.health.offGuide", { name: name(f.components[0] as string) });
      case "page-balance":
        return t("layout.health.pageBalance", { page: f.page ?? 0, pct: Math.round((d.used ?? 0) * 100) });
      case "title-count":
        return t("layout.health.titleCount", { count: f.components.length });
      default:
        return f.message;
    }
  };

  const fix = (f: ReviewFinding) => {
    const result = preview(f.fixes);
    const fitFailed = result.diagnostics.find((d) => d.code === "fit-failed");
    if (!result.ok || fitFailed) {
      setFailed((all) => ({ ...all, [key(f)]: fitFailed ? t("layout.health.fitFailed", { pages: (f.data as { pages: number }).pages - 1 }) : t("layout.editor.refused") }));
      return;
    }
    if (commit(f.fixes).ok) track("layout_health_fixed", { code: f.code });
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.health.title", { count: visible.length })}</span>
      {visible.map((f) => (
        <div key={key(f)} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: "var(--radius-sm)", background: "var(--color-surface-high)" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span aria-hidden style={{ width: 7, height: 7, marginTop: 6, borderRadius: "50%", flexShrink: 0, background: f.severity === "warning" ? "var(--color-warn)" : "var(--color-steel)" }} />
            <span style={{ ...textStyle.bodySm, color: "var(--color-text)" }}>{message(f)}</span>
          </div>
          {failed[key(f)] && <span style={{ ...textStyle.caption, color: "var(--color-warn)" }}>{failed[key(f)]}</span>}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingLeft: 15 }}>
            {!readOnly && f.fixes.length > 0 && f.fixLabel && (
              <Button variant="secondary" onClick={() => fix(f)}>
                {t(`layout.health.fix.${f.fixLabel}`, { pages: ((f.data as { pages?: number }).pages ?? 2) - 1 })}
              </Button>
            )}
            {f.components[0] && (
              <Button variant="ghost" icon="my_location" iconPosition="start" onClick={() => onShow(f.components[0] as string)}>
                {t("layout.notes.show")}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                track("layout_health_ignored", { code: f.code });
                setIgnored((all) => new Set([...all, key(f)]));
              }}
            >
              {t("layout.health.ignore")}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}
