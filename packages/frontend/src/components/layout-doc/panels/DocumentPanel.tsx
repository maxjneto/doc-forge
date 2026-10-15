import { useEffect, useMemo, useState } from "react";
import { STYLE_PROPS, type ApplyResult, type LayoutDocument, type LayoutResult, type StyleProp, type StyleProps, type Surface } from "@docforge/layout";
import { Button, IconButton, Input, Pill, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { Field, Row, SectionTitle, Select } from "./fields";
import { AutoAdjust } from "./AutoAdjust";
import { ValueControl } from "./StyleEditor";
import { describeChange } from "../changes";
import { tokenName } from "../names";
import { currentTheme, DOC_THEMES, MARGINS } from "../themes";

type PageSize = "A4" | "Letter" | "custom";

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

function opsFor(doc: LayoutDocument, draft: PageDraft, keepProportions: boolean): unknown[] {
  const surface = doc.surfaces[0] as Surface;
  const ops: unknown[] = [];
  if (surface.kind === "page") {
    const size = draft.size === "custom" ? { width: Math.max(100, draft.width), height: Math.max(100, draft.height) } : draft.size;
    const maxPages = Number(draft.maxPages);
    const next = { id: surface.id, kind: "page", size, margin: Math.max(0, draft.margin), ...(maxPages >= 1 ? { maxPages: Math.round(maxPages) } : {}) };
    if (JSON.stringify(next) !== JSON.stringify(surface)) ops.push({ op: "setSurface", surface: next, ...(keepProportions ? { fitWidth: true } : {}) });
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

/**
 * What applies to the whole document: page, grid, language, colours and sizes
 * (tokens) and classes. Page and grid changes move things, so they are previewed
 * first: the person sees what would move before confirming.
 */
export function DocumentPanel({
  doc,
  layout,
  families,
  commit,
  preview,
  readOnly,
}: {
  doc: LayoutDocument;
  layout: LayoutResult;
  families: string[];
  commit: (ops: unknown[]) => ApplyResult;
  preview: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<PageDraft>(() => draftOf(doc));
  const [pending, setPending] = useState<ApplyResult | null>(null);
  const [keepProportions, setKeepProportions] = useState(true);
  const sourceKey = JSON.stringify(draftOf(doc));
  useEffect(() => {
    setDraft(JSON.parse(sourceKey) as PageDraft);
    setPending(null);
  }, [sourceKey]);

  const ops = opsFor(doc, draft, keepProportions);
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

  const surface = doc.surfaces[0] as Surface;
  const tokens = layout.tokens;
  const overridden = doc.tokens ?? {};

  // Classes: the ones with a style and the ones only used by components.
  const classes = useMemo(() => {
    const users = new Map<string, string[]>();
    for (const c of doc.components) for (const l of c.labels ?? []) users.set(l, [...(users.get(l) ?? []), c.id]);
    const names = new Set([...Object.keys(doc.styles?.labels ?? {}), ...users.keys()]);
    return [...names].sort().map((name) => ({ name, users: users.get(name) ?? [], style: doc.styles?.labels?.[name] ?? {} }));
  }, [doc]);
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [newClass, setNewClass] = useState("");
  const [addProp, setAddProp] = useState<StyleProp>("color");

  const theme = currentTheme(tokens.color);
  const margins = MARGINS.find((m) => m.px === draft.margin)?.key ?? "custom";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <SectionTitle>{t("layout.doc.page")}</SectionTitle>
        {surface.kind === "page" ? (
          <>
            <div role="radiogroup" aria-label={t("layout.doc.size")} className="df-seg">
              {(["A4", "Letter", "custom"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={draft.size === size}
                  aria-pressed={draft.size === size}
                  onClick={() =>
                    set({ size, ...(size === "custom" && !draft.width ? { width: Math.round(layout.pages[0]?.width ?? 794), height: Math.round(layout.pages[0]?.height ?? 1123) } : {}) })
                  }
                >
                  {size === "custom" ? t("layout.doc.customSize") : size === "Letter" ? t("layout.doc.letter") : size}
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
        {surface.kind === "page" && (
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
          <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: "var(--radius-sm)", background: "var(--color-warn-wash)", border: "1px solid var(--color-warn-line)" }}>
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

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionTitle>{t("layout.doc.theme")}</SectionTitle>
        <div role="radiogroup" aria-label={t("layout.doc.theme")} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {DOC_THEMES.map((th) => (
            <button
              key={th.key}
              type="button"
              role="radio"
              aria-checked={theme === th.key}
              className="df-theme"
              disabled={readOnly}
              onClick={() => commit([{ op: "setTokens", tokens: { color: th.colors } }])}
            >
              <span className="df-theme__palette" aria-hidden>
                {["text", "primary", "subtle", "chart2"].map((k) => (
                  <i key={k} style={{ background: th.colors[k] }} />
                ))}
              </span>
              {t(`layout.doc.themes.${th.key}`)}
            </button>
          ))}
        </div>
        <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.doc.themeHint")}</span>
      </div>

      <AutoAdjust doc={doc} layout={layout} commit={commit} preview={preview} readOnly={readOnly} />

      <details className="df-disclosure">
        <summary style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.doc.advanced")}</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 12 }}>
          <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <SectionTitle>{t("layout.doc.grid")}</SectionTitle>
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

            <SectionTitle>{t("layout.doc.language")}</SectionTitle>
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

          <SectionTitle>{t("layout.doc.colors")}</SectionTitle>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.doc.colorsHint")}</span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {Object.entries(tokens.color).map(([name, value]) => (
              <label key={name} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <input
                  type="color"
                  disabled={readOnly}
                  aria-label={tokenName("color", name, t)}
                  value={/^#[0-9a-f]{6}$/i.test(value) ? value : tokens.color.text}
                  onChange={(e) => commit([{ op: "setTokens", tokens: { color: { [name]: e.target.value } } }])}
                  style={{ width: 28, height: 24, padding: 0, border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-xs)", background: "transparent" }}
                />
                <span style={{ ...textStyle.caption, color: overridden.color?.[name] ? "var(--color-text)" : "var(--color-dim)" }} title={`$color.${name}`}>
                  {tokenName("color", name, t)}
                </span>
              </label>
            ))}
          </div>

          <SectionTitle>{t("layout.doc.sizes")}</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {Object.entries(tokens.size).map(([name, value]) => (
              <Field key={name} label={tokenName("size", name, t)}>
                <Input
                  type="number"
                  min={6}
                  disabled={readOnly}
                  defaultValue={value}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n) && n > 0 && n !== value) commit([{ op: "setTokens", tokens: { size: { [name]: n } } }]);
                  }}
                />
              </Field>
            ))}
          </div>

          <ClassesEditor
            classes={classes}
            tokens={tokens}
            families={families}
            layout={layout}
            commit={commit}
            readOnly={readOnly}
            openClass={openClass}
            setOpenClass={setOpenClass}
            newClass={newClass}
            setNewClass={setNewClass}
            addProp={addProp}
            setAddProp={setAddProp}
          />
        </div>
      </details>
    </div>
  );
}

function ClassesEditor({
  classes,
  tokens,
  families,
  layout,
  commit,
  readOnly,
  openClass,
  setOpenClass,
  newClass,
  setNewClass,
  addProp,
  setAddProp,
}: {
  classes: { name: string; users: string[]; style: StyleProps }[];
  tokens: LayoutResult["tokens"];
  families: string[];
  layout: LayoutResult;
  commit: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
  openClass: string | null;
  setOpenClass: (name: string | null) => void;
  newClass: string;
  setNewClass: (name: string) => void;
  addProp: StyleProp;
  setAddProp: (prop: StyleProp) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <SectionTitle>{t("layout.doc.classes")}</SectionTitle>
      <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.doc.classesHint")}</span>
      {classes.length === 0 && <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.doc.noClasses")}</span>}
      {classes.map((cls) => (
        <div key={cls.name} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
          <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              className="df-row"
              aria-expanded={openClass === cls.name}
              onClick={() => setOpenClass(openClass === cls.name ? null : cls.name)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: 0, padding: 0, cursor: "pointer", color: "inherit" }}
            >
              <Pill compact tone="steel" dot={false}>
                {cls.name}
              </Pill>
              <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
                {t("layout.doc.classUsage", { count: cls.users.length, props: Object.keys(cls.style).length })}
              </span>
            </button>
            {!readOnly && <IconButton icon="delete" label={t("layout.doc.deleteClass", { name: cls.name })} onClick={() => commit([{ op: "setStyle", layer: "label", label: cls.name, style: null }])} />}
          </Row>
          {openClass === cls.name && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
              {(Object.keys(cls.style) as StyleProp[]).map((prop) => (
                <div key={prop} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t(`layout.style.prop.${prop}`)}</span>
                    {!readOnly && (
                      <IconButton
                        icon="close"
                        label={t("layout.doc.removeProp")}
                        onClick={() => {
                          const rest = { ...cls.style };
                          delete rest[prop];
                          commit([
                            { op: "setStyle", layer: "label", label: cls.name, style: null },
                            { op: "setStyle", layer: "label", label: cls.name, style: rest },
                          ]);
                        }}
                      />
                    )}
                  </Row>
                  {!readOnly && (
                    <ValueControl
                      prop={prop}
                      written={cls.style[prop]}
                      value={cls.style[prop]}
                      tokens={tokens}
                      families={families}
                      onChange={(v) => commit([{ op: "setStyle", layer: "label", label: cls.name, style: { [prop]: v } }])}
                    />
                  )}
                </div>
              ))}
              {!readOnly && (
                <Row>
                  <Select
                    label={t("layout.doc.addProp")}
                    value={addProp}
                    onChange={(v) => setAddProp(v as StyleProp)}
                    options={STYLE_PROPS.filter((p) => !(p in cls.style)).map((p) => ({ value: p, label: t(`layout.style.prop.${p}`) }))}
                    style={{ flex: 1 }}
                  />
                  <Button
                    onClick={() => {
                      const prop = (STYLE_PROPS as StyleProp[]).includes(addProp) && !(addProp in cls.style) ? addProp : STYLE_PROPS.find((p) => !(p in cls.style));
                      if (!prop) return;
                      const sample = layout.components[cls.users[0] ?? ""]?.style[prop];
                      const fallback = sample?.written ?? sample?.value ?? defaultFor(prop);
                      commit([{ op: "setStyle", layer: "label", label: cls.name, style: { [prop]: fallback } }]);
                    }}
                  >
                    {t("layout.position.add")}
                  </Button>
                </Row>
              )}
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <Row>
          <Field label={t("layout.doc.newClass")} style={{ flex: 1 }}>
            <Input value={newClass} placeholder="destaque" onChange={(e) => setNewClass(e.target.value.replace(/[^\w-]/g, ""))} />
          </Field>
          <Button
            disabled={!newClass || classes.some((c) => c.name === newClass)}
            onClick={() => {
              commit([{ op: "setStyle", layer: "label", label: newClass, style: {} }]);
              setOpenClass(newClass);
              setNewClass("");
            }}
          >
            {t("layout.doc.createClass")}
          </Button>
        </Row>
      )}
    </>
  );
}

function defaultFor(prop: StyleProp): string | number | boolean {
  switch (prop) {
    case "italic":
      return true;
    case "align":
      return "left";
    case "fontWeight":
      return 600;
    case "borderWidth":
      return 1;
    case "fontFamily":
      return "$font.sans";
    case "fontSize":
      return "$size.m";
    case "lineHeight":
      return "$lineHeight.normal";
    case "radius":
      return "$radius.m";
    case "padding":
    case "gap":
      return "$space.3";
    default:
      return "$color.primary";
  }
}
