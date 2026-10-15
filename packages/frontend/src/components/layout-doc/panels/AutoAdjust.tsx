import { useState } from "react";
import type { ApplyResult, LayoutDocument, LayoutResult } from "@docforge/layout";
import { Button, Input, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { Field, Row, SectionTitle, Select } from "./fields";

type Strategy = "compact" | "heights" | "spacing" | "type";

interface Pending {
  ops: unknown[];
  summary: string;
  canApply: boolean;
}

/** "spacing ×0.75" → "espaçamentos ×0,75", in the person's language. */
function stepLabel(step: string, t: (key: string, vars?: Record<string, string | number>) => string, locale: string): string {
  const [name, factor] = step.split(" ×");
  const value = factor ? ` ×${Number(factor).toLocaleString(locale)}` : "";
  return `${t(`layout.fit.step.${name}`)}${value}`;
}

/**
 * Explicit, previewed adjustments: close empty space, or make the document fit a
 * number of pages with the strategies the person allows. Each one is tried first
 * and only applied after the person sees the result.
 */
export function AutoAdjust({
  doc,
  layout,
  commit,
  preview,
  readOnly,
}: {
  doc: LayoutDocument;
  layout: LayoutResult;
  commit: (ops: unknown[]) => ApplyResult;
  preview: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
}) {
  const { t, locale } = useI18n();
  const surface = doc.surfaces.find((s) => s.kind === "page");
  const limit = surface && surface.kind === "page" ? surface.maxPages : undefined;
  const [pages, setPages] = useState(String(limit ?? Math.max(1, layout.pages.length - 1)));
  const [strategies, setStrategies] = useState<Strategy[]>(["compact", "heights", "spacing", "type"]);
  const [minScale, setMinScale] = useState("0.85");
  const [acrossPages, setAcrossPages] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const tryCompact = () => {
    const ops = [{ op: "compact", ...(acrossPages ? { acrossPages: true } : {}) }];
    const result = preview(ops);
    if (!result.ok || !result.doc) return;
    const before = new Map(doc.components.map((c) => [c.id, JSON.stringify(c.at)] as const));
    const moved = result.doc.components.filter((c) => before.get(c.id) !== JSON.stringify(c.at)).map((c) => c.id);
    setPending({
      ops,
      summary: moved.length ? t("layout.fit.compactWill", { count: moved.length, ids: moved.slice(0, 6).join(", ") + (moved.length > 6 ? "…" : "") }) : t("layout.fit.compactNothing"),
      canApply: moved.length > 0,
    });
  };

  const tryFit = () => {
    const target = Math.max(1, Math.round(Number(pages)));
    const ops = [{ op: "fit", pages: target, strategies, minScale: Number(minScale) }];
    const result = preview(ops);
    const note = result.diagnostics.find((d) => d.code === "fit-result" || d.code === "fit-failed");
    const data = (note?.data ?? {}) as { pages?: number; before?: number; steps?: string[] };
    const steps = (data.steps ?? []).map((s) => stepLabel(s, t, locale)).join(", ");
    if (!note) return;
    if (note.code === "fit-failed") {
      setPending({ ops, summary: t("layout.fit.failed", { target, best: data.pages ?? "?", steps: steps || "—" }), canApply: false });
    } else if (!data.steps?.length) {
      setPending({ ops, summary: t("layout.fit.already", { target }), canApply: false });
    } else {
      setPending({ ops, summary: t("layout.fit.will", { before: data.before ?? layout.pages.length, after: data.pages ?? target, steps }), canApply: true });
    }
  };

  const toggle = (s: Strategy, on: boolean) => {
    setStrategies((list) => (on ? [...list, s] : list.filter((x) => x !== s)));
    setPending(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionTitle>{t("layout.fit.title")}</SectionTitle>
      <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.fit.lead")}</span>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        <Row style={{ alignItems: "flex-end" }}>
          <Field label={t("layout.fit.pages")} style={{ width: 96 }}>
            <Input type="number" min={1} value={pages} onChange={(e) => { setPages(e.target.value); setPending(null); }} />
          </Field>
          <Button variant="secondary" icon="fit_screen" iconPosition="start" disabled={!strategies.length} onClick={tryFit} style={{ flex: 1 }}>
            {t("layout.fit.try", { pages: Math.max(1, Math.round(Number(pages) || 1)) })}
          </Button>
        </Row>
        <Button variant="ghost" icon="vertical_align_top" iconPosition="start" onClick={tryCompact}>
          {t("layout.fit.compact")}
        </Button>
        <details className="df-disclosure">
          <summary style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.fit.options")}</summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 10 }}>
            {(["compact", "heights", "spacing", "type"] as const).map((s) => (
              <Switch key={s} checked={strategies.includes(s)} onChange={(on) => toggle(s, on)} label={t(`layout.fit.strategy.${s}`)} />
            ))}
            <Field label={t("layout.fit.minScale")}>
              <Select
                value={minScale}
                onChange={(v) => { setMinScale(v); setPending(null); }}
                options={["1", "0.95", "0.9", "0.85", "0.8", "0.75"].map((v) => ({ value: v, label: `${Math.round(Number(v) * 100)}%` }))}
              />
            </Field>
            <Switch checked={acrossPages} onChange={(on) => { setAcrossPages(on); setPending(null); }} label={t("layout.fit.acrossPages")} />
          </div>
        </details>
      </fieldset>

      {pending && (
        <div role="status" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: "var(--radius-sm)", background: pending.canApply ? "var(--color-steel-wash)" : "var(--color-warn-wash)", border: `1px solid ${pending.canApply ? "var(--color-steel-line)" : "var(--color-warn-line)"}` }}>
          <span style={{ ...textStyle.caption, color: "var(--color-text)" }}>{pending.summary}</span>
          <Row>
            {pending.canApply && (
              <Button
                variant="secondary"
                onClick={() => {
                  commit(pending.ops);
                  setPending(null);
                }}
              >
                {t("layout.fit.apply")}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setPending(null)}>
              {pending.canApply ? t("common.cancel") : t("common.close")}
            </Button>
          </Row>
        </div>
      )}
    </div>
  );
}
