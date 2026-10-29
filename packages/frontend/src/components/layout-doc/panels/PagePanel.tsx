import { useEffect, useState } from "react";
import type { ApplyResult, LayoutDocument, LayoutResult, Surface } from "@docforge-lib/layout";
import { Button, Input, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { Field, Row, SectionTitle, Select } from "./fields";
import { AutoAdjust } from "./AutoAdjust";
import { describeChange } from "../changes";
import { MARGINS, TYPE_SCALES } from "../themes";

type PageSize = "A4" | "Letter" | "Slide" | "custom";

interface PageDraft {
  size: PageSize;
  width: number;
  height: number;
  margin: number;
  maxPages: string;
  unit: number;
  columns: number;
  gutter: number;
  gap: number;
}

function draftOf(doc: LayoutDocument): PageDraft {
  const surface = doc.surfaces[0] as Surface;
  const grid = { unit: 8, columns: 12, gutter: 16, gap: 2, ...doc.grid };
  const margin = typeof surface.margin === "number" ? surface.margin : surface.margin.top;
  if (surface.kind === "continuous") {
    return { size: "custom", width: surface.width, height: 0, margin, maxPages: "", ...grid };
  }
  const size = typeof surface.size === "string" ? surface.size : "custom";
  const dims = typeof surface.size === "string" ? { width: 0, height: 0 } : surface.size;
  return { size, width: Math.round(dims.width), height: Math.round(dims.height), margin, maxPages: surface.maxPages ? String(surface.maxPages) : "", ...grid };
}

/** Ops for the page and grid as drafted; switching to or from slides can also swap the type scale. */
function opsFor(doc: LayoutDocument, draft: PageDraft, keepProportions: boolean, retype: boolean): unknown[] {
  const surface = doc.surfaces[0] as Surface;
  const ops: unknown[] = [];
  if (surface.kind === "page") {
    const size = draft.size === "custom" ? { width: Math.max(100, draft.width), height: Math.max(100, draft.height) } : draft.size;
    const maxPages = Number(draft.maxPages);
    const next = { id: surface.id, kind: "page", size, margin: Math.max(0, draft.margin), ...(maxPages >= 1 && draft.size !== "Slide" ? { maxPages: Math.round(maxPages) } : {}) };
    if (JSON.stringify(next) !== JSON.stringify(surface)) ops.push({ op: "setSurface", surface: next, ...(keepProportions ? { fitWidth: true } : {}) });
    const wasSlide = surface.size === "Slide";
    const isSlide = draft.size === "Slide";
    if (retype && wasSlide !== isSlide) {
      const scale = TYPE_SCALES.find((s) => s.key === (isSlide ? "slides" : "normal"));
      if (scale) ops.push({ op: "setTokens", tokens: { size: scale.values } });
    }
  } else {
    const next = { ...surface, width: Math.max(100, draft.width), margin: Math.max(0, draft.margin) };
    if (JSON.stringify(next) !== JSON.stringify(surface)) ops.push({ op: "setSurface", surface: next, ...(keepProportions ? { fitWidth: true } : {}) });
  }
  const current = { unit: 8, columns: 12, gutter: 16, gap: 2, ...doc.grid };
  const grid: Record<string, number> = {};
  for (const key of ["unit", "columns", "gutter", "gap"] as const) if (draft[key] !== current[key]) grid[key] = draft[key];
  if (Object.keys(grid).length) ops.push({ op: "setGrid", grid });
  return ops;
}

/** Each format drawn to scale, so the choice is visual. */
const FORMATS: { key: PageSize; ratio: number; icon?: string }[] = [
  { key: "A4", ratio: 210 / 297 },
  { key: "Letter", ratio: 8.5 / 11 },
  { key: "Slide", ratio: 16 / 9 },
  { key: "custom", ratio: 1, icon: "tune" },
];

/**
 * The page the document is printed on: format (A4, Letter, 16:9 slides or free),
 * margins, page limit, grid and language. Changes that move things are previewed
 * first, with what would move, before the person confirms.
 */
export function PagePanel({
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
  const { t } = useI18n();
  const [draft, setDraft] = useState<PageDraft>(() => draftOf(doc));
  const [pending, setPending] = useState<ApplyResult | null>(null);
  const [keepProportions, setKeepProportions] = useState(true);
  const [retype, setRetype] = useState(true);
  const sourceKey = JSON.stringify(draftOf(doc));
  useEffect(() => {
    setDraft(JSON.parse(sourceKey) as PageDraft);
    setPending(null);
  }, [sourceKey]);

  const surface = doc.surfaces[0] as Surface;
  const ops = opsFor(doc, draft, keepProportions, retype);
  const set = (patch: Partial<PageDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setPending(null);
  };
  const tryApply = () => {
    const result = preview(ops);
    if (!result.ok) {
      setPending(result);
      return;
    }
    if (result.changes.length) setPending(result);
    else commit(ops);
  };
  const switchesFormat = surface.kind === "page" && (surface.size === "Slide") !== (draft.size === "Slide");
  const margins = MARGINS.find((m) => m.px === draft.margin)?.key ?? "custom";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <SectionTitle>{t("layout.page.format")}</SectionTitle>
        {surface.kind === "page" ? (
          <>
            <div role="radiogroup" aria-label={t("layout.page.format")} className="df-format-grid">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={draft.size === f.key}
                  className="df-format-card"
                  onClick={() =>
                    set({ size: f.key, ...(f.key === "custom" && !draft.width ? { width: Math.round(layout.pages[0]?.width ?? 794), height: Math.round(layout.pages[0]?.height ?? 1123) } : {}) })
                  }
                >
                  <span className="df-format-card__frame" aria-hidden>
                    {f.icon ? (
                      <span className="material-symbols-outlined">{f.icon}</span>
                    ) : (
                      <i style={f.ratio > 1 ? { width: 44, height: 44 / f.ratio } : { height: 44, width: 44 * f.ratio }} />
                    )}
                  </span>
                  <span className="df-format-card__name">{t(`layout.page.size.${f.key}`)}</span>
                  <span className="df-format-card__hint">{t(`layout.page.size.${f.key}.hint`)}</span>
                </button>
              ))}
            </div>
            {draft.size === "custom" && (
              <Row>
                <Field label={t("layout.doc.widthPx")} style={{ flex: 1 }}>
                  <Input type="number" min={100} value={draft.width} onChange={(e) => set({ width: Number(e.target.value) })} />
                </Field>
                <Field label={t("layout.doc.heightPx")} style={{ flex: 1 }}>
                  <Input type="number" min={100} value={draft.height} onChange={(e) => set({ height: Number(e.target.value) })} />
                </Field>
              </Row>
            )}
            {switchesFormat && <Switch checked={retype} onChange={setRetype} label={draft.size === "Slide" ? t("layout.page.retypeSlides") : t("layout.page.retypePage")} />}
          </>
        ) : (
          <Field label={t("layout.doc.widthPx")}>
            <Input type="number" min={100} value={draft.width} onChange={(e) => set({ width: Number(e.target.value) })} />
          </Field>
        )}
        <Field label={t("layout.doc.margins")}>
          <Row gap={6} style={{ alignItems: "center" }}>
            <div role="radiogroup" aria-label={t("layout.doc.margins")} className="df-seg" style={{ flex: 1 }}>
              {MARGINS.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={margins === m.key} aria-pressed={margins === m.key} onClick={() => set({ margin: m.px })}>
                  {t(`layout.doc.margin.${m.key}`)}
                </button>
              ))}
            </div>
            <Input type="number" min={0} aria-label={t("layout.doc.margin")} value={draft.margin} onChange={(e) => set({ margin: Number(e.target.value) })} style={{ width: 64 }} />
          </Row>
        </Field>
        {surface.kind === "page" && draft.size !== "Slide" && (
          <Field label={t("layout.doc.maxPages")} hint={t("layout.doc.maxPagesHint")}>
            <Input type="number" min={1} placeholder={t("layout.doc.noLimit")} value={draft.maxPages} onChange={(e) => set({ maxPages: e.target.value })} style={{ width: 120 }} />
          </Field>
        )}
        {ops.length > 0 && !pending && (
          <Row>
            <Button variant="secondary" onClick={tryApply}>
              {t("layout.doc.applyPage")}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(draftOf(doc))}>
              {t("common.cancel")}
            </Button>
          </Row>
        )}
        {pending && (
          <div role="alert" className="df-callout df-callout--warn">
            {pending.ok ? (
              <>
                <span style={{ ...textStyle.fieldLabel, color: "var(--color-text)" }}>{t("layout.doc.willMove", { count: pending.changes.length })}</span>
                {pending.changes.slice(0, 8).map((c, i) => (
                  <span key={i} style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
                    · {describeChange(c, t)}
                  </span>
                ))}
                <Row>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      commit(ops);
                      setPending(null);
                    }}
                  >
                    {t("layout.doc.confirm")}
                  </Button>
                  <Button variant="ghost" onClick={() => setPending(null)}>
                    {t("common.cancel")}
                  </Button>
                </Row>
              </>
            ) : (
              <span style={{ ...textStyle.caption, color: "var(--color-error)" }}>{pending.diagnostics.find((d) => d.severity === "error")?.message}</span>
            )}
          </div>
        )}
      </fieldset>

      <AutoAdjust doc={doc} layout={layout} commit={commit} preview={preview} readOnly={readOnly} />

      <details className="df-disclosure">
        <summary style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.page.gridAndLanguage")}</summary>
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0, paddingTop: 12 }}>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
            {t("layout.doc.gridSummary", { cols: layout.units.cols, rows: layout.units.rows ?? "∞", unit: layout.grid.unit })}
          </span>
          <Row>
            <Field label={t("layout.doc.columns")} style={{ flex: 1 }}>
              <Input type="number" min={1} max={48} value={draft.columns} onChange={(e) => set({ columns: Number(e.target.value) })} />
            </Field>
            <Field label={t("layout.doc.gutter")} style={{ flex: 1 }}>
              <Input type="number" min={0} value={draft.gutter} onChange={(e) => set({ gutter: Number(e.target.value) })} />
            </Field>
          </Row>
          <Row>
            <Field label={t("layout.doc.unit")} style={{ flex: 1 }}>
              <Input type="number" min={2} max={64} value={draft.unit} onChange={(e) => set({ unit: Number(e.target.value) })} />
            </Field>
            <Field label={t("layout.doc.gap")} style={{ flex: 1 }}>
              <Input type="number" min={0} max={16} value={draft.gap} onChange={(e) => set({ gap: Number(e.target.value) })} />
            </Field>
          </Row>
          <Switch
            checked={keepProportions}
            onChange={(on) => {
              setKeepProportions(on);
              setPending(null);
            }}
            label={t("layout.doc.keepProportions")}
          />
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.doc.gridHint")}</span>
          <Select
            label={t("layout.doc.language")}
            value={doc.meta?.locale ?? "en-US"}
            onChange={(locale) => commit([{ op: "setMeta", meta: { locale } }])}
            options={[
              { value: "pt-BR", label: "Português (Brasil) · 1.234,5" },
              { value: "en-US", label: "English (US) · 1,234.5" },
              { value: "es-ES", label: "Español · 1.234,5" },
            ]}
          />
        </fieldset>
      </details>
    </div>
  );
}
