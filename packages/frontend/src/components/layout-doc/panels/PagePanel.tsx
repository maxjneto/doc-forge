import { useEffect, useState } from "react";
import type { ApplyResult, LayoutDocument, LayoutResult, Surface } from "@docforge-lib/layout";
import { Button, Input, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { Field, Row, SectionTitle, Select } from "./fields";
import { AutoAdjust } from "./AutoAdjust";
import { describeChange } from "../changes";
import { MARGINS, TYPE_SCALES } from "../themes";
import { track } from "@/analytics";

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
    // The master is not part of this form (setSurface keeps it), so it does not count as a change.
    const { master: _master, ...bare } = surface;
    if (JSON.stringify(next) !== JSON.stringify(bare)) ops.push({ op: "setSurface", surface: next, ...(keepProportions ? { fitWidth: true } : {}) });
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

/** Ids of the master components this panel writes; anything else in the master (an agent's) is kept. */
const HEADER_ID = "master-title";
const FOOTER_ID = "master-page";
const BAND = 3;
const RESERVE = 5;

/** The ops that make the master hold a title header and/or a page-number footer, on `pages`. */
export function masterOps(doc: LayoutDocument, layout: LayoutResult, want: { header: boolean; footer: boolean; pages: "all" | "except-first" }): unknown[] {
  const surface = doc.surfaces[0] as Surface;
  if (surface.kind !== "page") return [];
  const master = surface.master;
  const others = (master?.components ?? []).filter((c) => c.id !== HEADER_ID && c.id !== FOOTER_ID);
  const reserve = master?.reserve ?? {};
  const fullRows = (layout.units.rows ?? 0) + (reserve.top ?? 0) + (reserve.bottom ?? 0);
  const cols = layout.units.cols;
  const caption = (text: string) => ({ paragraphs: [{ role: "caption", text }] });
  const components = [
    ...others,
    ...(want.header ? [{ id: HEADER_ID, type: "text", at: { x: 0, y: 0, w: cols, h: BAND }, content: caption("{title}") }] : []),
    ...(want.footer ? [{ id: FOOTER_ID, type: "text", at: { x: 0, y: Math.max(0, fullRows - BAND), w: cols, h: BAND }, style: { align: "right" }, content: caption("{page} / {pages}") }] : []),
  ];
  if (!components.length) return master ? [{ op: "removeMaster" }] : [];
  const top = want.header ? Math.max(RESERVE, others.length ? (reserve.top ?? 0) : 0) : others.length ? (reserve.top ?? 0) : 0;
  const bottom = want.footer ? Math.max(RESERVE, others.length ? (reserve.bottom ?? 0) : 0) : others.length ? (reserve.bottom ?? 0) : 0;
  return [{ op: "setMaster", master: { pages: want.pages, reserve: { top, bottom }, components } }];
}

/** Header and footer: the page master as two switches and a choice of pages. */
function MasterSection({ doc, layout, commit, readOnly }: { doc: LayoutDocument; layout: LayoutResult; commit: (ops: unknown[]) => ApplyResult; readOnly: boolean }) {
  const { t } = useI18n();
  const surface = doc.surfaces[0] as Surface;
  const master = surface.kind === "page" ? surface.master : undefined;
  const ids = new Set((master?.components ?? []).map((c) => c.id));
  const current = { header: ids.has(HEADER_ID), footer: ids.has(FOOTER_ID), pages: master?.pages === "except-first" ? ("except-first" as const) : ("all" as const) };
  const others = [...ids].filter((id) => id !== HEADER_ID && id !== FOOTER_ID);
  const change = (patch: Partial<typeof current>) => {
    const next = { ...current, ...patch };
    const ops = masterOps(doc, layout, next);
    if (!ops.length) return;
    commit(ops);
    track("layout_master_changed", { changed: Object.keys(patch).join(","), header: Boolean(next.header), footer: Boolean(next.footer) });
  };
  return (
    <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <SectionTitle>{t("layout.page.master")}</SectionTitle>
      <Switch checked={current.header} onChange={(header) => change({ header })} label={t("layout.page.masterHeader")} />
      <Switch checked={current.footer} onChange={(footer) => change({ footer })} label={t("layout.page.masterFooter")} />
      {(current.header || current.footer || others.length > 0) && (
        <Select
          label={t("layout.page.masterPages")}
          value={current.pages}
          onChange={(pages) => change({ pages: pages as "all" | "except-first" })}
          options={[
            { value: "all", label: t("layout.page.masterPages.all") },
            { value: "except-first", label: t("layout.page.masterPages.exceptFirst") },
          ]}
        />
      )}
      {others.length > 0 && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.page.masterOthers", { count: others.length })}</span>}
      <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.page.masterHint")}</span>
    </fieldset>
  );
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

      {surface.kind === "page" && <MasterSection doc={doc} layout={layout} commit={commit} readOnly={readOnly} />}
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
