import { useEffect, useState, type FocusEvent, type ReactNode } from "react";
import { TEXT_ROLES, type ApplyResult, type Component, type TextRole, type Tokens } from "@docforge-lib/layout";
import { Button, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { Paragraph } from "../ParagraphsEditable";
import { Field, ItemActions, move, Row, SectionTitle, Select, TextArea, TextInput as Input } from "./fields";
import { FlowBlocksEditor } from "./FlowBlocksEditor";
import { RichParagraphs } from "./RichParagraphs";

type Json = Record<string, unknown>;

/**
 * Rows pasted from a spreadsheet: tab-separated as Excel and Sheets copy them, or
 * `;` / `,` separated text. Quotes around a cell are dropped. Blank lines are skipped.
 */
export function parseSheet(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.includes(";")) ? ";" : ",";
  return lines.map((line) => line.split(sep).map((cell) => cell.trim().replace(/^"(.*)"$/s, "$1").replace(/""/g, '"')));
}

interface Draft {
  content: Json;
  props: Json;
}

/** Inline text may be explicit runs; the form edits it as plain text with the markdown subset. */
export function inlineToString(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((run) => (run && typeof run === "object" && "text" in run ? String((run as { text: unknown }).text) : "")).join("");
  return "";
}
const hasRuns = (value: unknown) => Array.isArray(value);

/** List items ⇄ text: one item per line, two spaces per level, `[x] ` / `[ ] ` for checks. */
type ListItem = string | { text: unknown; checked?: boolean; items?: ListItem[] };
export function itemsToText(items: ListItem[], depth = 0): string {
  return items
    .map((item) => {
      const pad = "  ".repeat(depth);
      if (typeof item === "string") return `${pad}${item}`;
      const check = item.checked === undefined ? "" : item.checked ? "[x] " : "[ ] ";
      const line = `${pad}${check}${inlineToString(item.text)}`;
      return item.items?.length ? `${line}\n${itemsToText(item.items, depth + 1)}` : line;
    })
    .join("\n");
}
export function textToItems(text: string): ListItem[] {
  const root: { items: ListItem[] } = { items: [] };
  const stack: { depth: number; node: { items?: ListItem[] } }[] = [{ depth: -1, node: root }];
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const depth = Math.floor((raw.length - raw.trimStart().length) / 2);
    let body = raw.trim();
    let checked: boolean | undefined;
    const match = /^\[( |x|X)\]\s*/.exec(body);
    if (match) {
      checked = match[1] !== " ";
      body = body.slice(match[0].length);
    }
    while ((stack[stack.length - 1]?.depth ?? -1) >= depth) stack.pop();
    const parent = (stack[stack.length - 1] as { node: { items?: ListItem[] } }).node;
    const item: { text: string; checked?: boolean; items?: ListItem[] } = { text: body, ...(checked !== undefined ? { checked } : {}) };
    (parent.items ??= []).push(item);
    stack.push({ depth, node: item });
  }
  // Plain items stay plain strings.
  const simplify = (items: ListItem[]): ListItem[] =>
    items.map((item) => {
      if (typeof item === "string") return item;
      const children = item.items?.length ? simplify(item.items) : undefined;
      if (item.checked === undefined && !children) return inlineToString(item.text);
      return { text: item.text, ...(item.checked !== undefined ? { checked: item.checked } : {}), ...(children ? { items: children } : {}) };
    });
  return simplify(root.items);
}

/** Columns a table row covers, counting cells that span several. */
const spanOf = (cell: unknown) => (cell && typeof cell === "object" && !Array.isArray(cell) ? Number((cell as Json).span ?? 1) : 1);
/** A row padded (or cut) to `n` columns, keeping cells that span. */
export function fitRow(row: unknown[], n: number): unknown[] {
  const out: unknown[] = [];
  let covered = 0;
  for (const cell of row) {
    if (covered >= n) break;
    out.push(cell);
    covered += spanOf(cell);
  }
  while (covered < n) {
    out.push("");
    covered++;
  }
  return out;
}

/** Scatter points ⇄ text: `x y` pairs separated by `;`. */
const pointsToText = (points: unknown) => (Array.isArray(points) ? points.map((p) => (Array.isArray(p) ? `${p[0]} ${p[1]}` : "")).join("; ") : "");
const textToPoints = (text: string) =>
  text
    .split(";")
    .map((pair) => pair.trim().split(/[\s,]+/).map(Number))
    .filter((p) => p.length === 2 && p.every((n) => Number.isFinite(n)));

const csv = (values: unknown[]) => values.map(String).join(", ");
const fromCsv = (text: string) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The content of one component as a form. Edits stay in a draft and are applied
 * (one `update` op) when focus leaves the form or on "Apply", so typing does not
 * create a revision per keystroke. An invalid draft is not applied: the error
 * from the library is shown and the draft is kept.
 */
export function ContentEditor({ component, tokens, commit, readOnly }: { component: Component; tokens: Tokens; commit: (ops: unknown[]) => ApplyResult; readOnly: boolean }) {
  const { t } = useI18n();
  const [pasting, setPasting] = useState(false);
  const [sheet, setSheet] = useState("");
  const [sheetHeader, setSheetHeader] = useState(true);
  const original: Draft = {
    content: ((component as { content?: Json }).content ?? {}) as Json,
    props: ((component as { props?: Json }).props ?? {}) as Json,
  };
  const [draft, setDraft] = useState<Draft>(original);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState<string | null>(null);

  const sourceKey = JSON.stringify(original);
  useEffect(() => {
    if (!dirty) {
      setDraft(JSON.parse(sourceKey) as Draft);
      setError(null);
    }
    // Only when the component changes from outside (another writer, undo).
  }, [sourceKey, component.id, dirty]);
  useEffect(() => {
    setDirty(false);
    setJson(null);
    setError(null);
  }, [component.id]);

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const setContent = (patch: Json) => set({ content: { ...draft.content, ...patch } });
  const setProps = (patch: Json) => {
    const props = { ...draft.props, ...patch };
    for (const key of Object.keys(props)) if (props[key] === undefined || props[key] === "") delete props[key];
    set({ props });
  };

  const apply = (next: Draft = draft) => {
    if (!dirty && next === draft) return;
    const props = Object.keys(next.props).length ? next.props : null;
    const result = commit([
      { op: "update", component: component.id, content: next.content, props: null },
      ...(props ? [{ op: "update", component: component.id, props }] : []),
    ]);
    if (result.ok) {
      setDirty(false);
      setError(null);
    } else {
      setError(result.diagnostics.find((d) => d.severity === "error")?.message ?? t("layout.editor.refused"));
    }
  };

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (dirty && !e.currentTarget.contains(e.relatedTarget as Node | null)) apply();
  };

  const c = draft.content;
  const p = draft.props;
  const labels = { up: t("layout.content.moveUp"), down: t("layout.content.moveDown"), remove: t("layout.content.remove") };
  const runsWarning = <span style={{ ...textStyle.caption, color: "var(--color-warn)" }}>{t("layout.content.runsWarning")}</span>;

  let form: ReactNode = null;
  switch (component.type) {
    case "text": {
      const paragraphs = ((c.paragraphs as Paragraph[]) ?? []).length ? (c.paragraphs as Paragraph[]) : [""];
      const defaultRole = (typeof p.role === "string" ? p.role : "body") as TextRole;
      form = (
        <>
          <Field label={t("layout.content.text")} hint={t("layout.content.richHint")}>
            {/* Remounted when the block changes from outside (undo, an agent) while nothing is being typed. */}
            <RichParagraphs key={dirty ? "editing" : sourceKey} value={paragraphs} defaultRole={defaultRole} tokens={tokens} onChange={(next) => setContent({ paragraphs: next.length ? next : [""] })} />
          </Field>
          <Field label={t("layout.content.defaultRole")} hint={t("layout.content.defaultRoleHint")}>
            <Select value={defaultRole} onChange={(role) => setProps({ role: role === "body" ? undefined : role })} options={TEXT_ROLES.map((role) => ({ value: role, label: t(`layout.role.${role}`) }))} />
          </Field>
        </>
      );
      break;
    }
    case "list": {
      form = (
        <>
          <Field label={t("layout.content.marker")}>
            <Select
              value={String(p.marker ?? "bullet")}
              onChange={(marker) => setProps({ marker: marker === "bullet" ? undefined : marker })}
              options={["bullet", "number", "check"].map((m) => ({ value: m, label: t(`layout.content.marker.${m}`) }))}
            />
          </Field>
          <Field label={t("layout.content.items")} hint={t("layout.content.itemsHint")}>
            <TextArea rows={8} value={itemsToText((c.items as ListItem[]) ?? [])} onChange={(e) => setContent({ items: textToItems(e.target.value) })} />
          </Field>
        </>
      );
      break;
    }
    case "table": {
      const columns = ((c.columns as unknown[]) ?? []).map((col) =>
        typeof col === "string" ? { header: col, align: "left" } : { header: String((col as Json).header ?? ""), align: String((col as Json).align ?? "left"), width: (col as Json).width },
      );
      // Cells keep whatever inline form they have; the panel only reshapes the table.
      const rows = ((c.rows as unknown[][]) ?? []).map((row) => fitRow(row, columns.length));
      const footer = Array.isArray(c.footer) ? fitRow(c.footer as unknown[], columns.length) : null;
      const autoWidths = p.columnWidths === "auto" || (p.columnWidths === undefined && columns.every((col) => col.width === undefined));
      const write = (cols: typeof columns, body: unknown[][]) =>
        setContent({
          columns: cols.map((col) => (col.align === "left" && col.width === undefined ? col.header : { header: col.header, ...(col.align !== "left" ? { align: col.align } : {}), ...(col.width !== undefined ? { width: col.width } : {}) })),
          rows: body,
          ...(footer ? { footer: fitRow(footer, cols.length) } : {}),
        });
      const moveColumn = (a: number, b: number) => write(move(columns, a, b), rows.map((r) => move(r, a, b)));
      const WEIGHTS = [0.5, 1, 1.5, 2, 3];
      form = (
        <>
          <SectionTitle>{t("layout.content.columns", { count: columns.length })}</SectionTitle>
          {columns.map((col, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
              <Row gap={4} style={{ alignItems: "center" }}>
                <Input aria-label={t("layout.content.header", { n: i + 1 })} value={col.header} onChange={(e) => write(columns.map((x, j) => (j === i ? { ...x, header: e.target.value } : x)), rows)} style={{ flex: 1, minWidth: 0, fontWeight: 600 }} />
                <ItemActions index={i} count={columns.length} labels={labels} onMove={moveColumn} onRemove={(j) => write(columns.filter((_, k) => k !== j), rows.map((r) => r.filter((_, k) => k !== j)))} />
              </Row>
              <Row gap={6} style={{ alignItems: "center" }}>
                <div role="group" aria-label={t("layout.content.align")} className="df-seg" style={{ flex: "0 0 auto" }}>
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} type="button" aria-pressed={col.align === a} title={t(`layout.style.align.${a}`)} aria-label={t(`layout.style.align.${a}`)} onClick={() => write(columns.map((x, j) => (j === i ? { ...x, align: a } : x)), rows)} style={{ padding: "3px 6px" }}>
                      <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 15 }}>
                        {`format_align_${a}`}
                      </span>
                    </button>
                  ))}
                </div>
                <Select
                  label={t("layout.content.weight")}
                  value={col.width === undefined ? "auto" : String(col.width)}
                  onChange={(v) => write(columns.map((x, j) => (j === i ? { ...x, width: v === "auto" ? undefined : Number(v) } : x)), rows)}
                  options={[{ value: "auto", label: t("layout.content.weightAuto") }, ...WEIGHTS.map((w) => ({ value: String(w), label: `${String(w).replace(".", ",")}×` }))]}
                  style={{ flex: 1 }}
                />
              </Row>
            </div>
          ))}
          <Button variant="ghost" icon="add" iconPosition="start" onClick={() => write([...columns, { header: t("layout.content.newColumn"), align: "left" }], rows.map((r) => [...r, ""]))}>
            {t("layout.content.addColumn")}
          </Button>
          <SectionTitle>{t("layout.content.rows", { count: rows.length })}</SectionTitle>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.content.cellsOnPage")}</span>
          <Row>
            <Button variant="ghost" icon="add" iconPosition="start" onClick={() => write(columns, [...rows, columns.map(() => "")])}>
              {t("layout.content.addRow")}
            </Button>
            <Button variant="ghost" icon="content_paste" iconPosition="start" aria-expanded={pasting} onClick={() => setPasting(!pasting)}>
              {t("layout.content.pasteSheet")}
            </Button>
          </Row>
          {pasting && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Field label={t("layout.content.pasteSheet")} hint={t("layout.content.pasteSheetHint")}>
                <TextArea rows={5} mono value={sheet} onChange={(e) => setSheet(e.target.value)} />
              </Field>
              <Switch checked={sheetHeader} onChange={setSheetHeader} label={t("layout.content.firstRowHeader")} />
              <Row style={{ justifyContent: "flex-end" }}>
                <Button
                  variant="secondary"
                  disabled={!sheet.trim()}
                  onClick={() => {
                    const parsed = parseSheet(sheet);
                    if (!parsed.length) return;
                    const header = sheetHeader ? (parsed[0] as string[]) : null;
                    const body = sheetHeader ? parsed.slice(1) : parsed;
                    const width = Math.max(...parsed.map((r) => r.length));
                    const cols = Array.from({ length: width }, (_, i) => ({ header: header?.[i] ?? columns[i]?.header ?? t("layout.content.newColumn"), align: columns[i]?.align ?? "left", width: columns[i]?.width }));
                    // Applied right away: the button that was clicked is about to disappear, so no blur would follow.
                    apply({
                      content: {
                        ...draft.content,
                        columns: cols.map((col) => (col.align === "left" && col.width === undefined ? col.header : { header: col.header, ...(col.align !== "left" ? { align: col.align } : {}), ...(col.width !== undefined ? { width: col.width } : {}) })),
                        rows: body.map((r) => cols.map((_, i) => r[i] ?? "")),
                      },
                      props: draft.props,
                    });
                    setSheet("");
                    setPasting(false);
                  }}
                >
                  {t("layout.content.pasteApply")}
                </Button>
              </Row>
            </div>
          )}
          <Switch checked={p.header !== false} onChange={(on) => setProps({ header: on ? undefined : false })} label={t("layout.content.headerRow")} />
          <Switch checked={p.zebra === true} onChange={(on) => setProps({ zebra: on || undefined })} label={t("layout.content.zebra")} />
          <Field label={t("layout.content.autoWidths")} hint={t("layout.content.autoWidthsHint")}>
            <Switch
              checked={autoWidths}
              onChange={(on) => {
                // Content-sized columns have no weights; fixed ones keep whatever weights they had.
                if (on) set({ content: { ...draft.content, columns: columns.map((col) => (col.align === "left" ? col.header : { header: col.header, align: col.align })) }, props: Object.fromEntries(Object.entries(draft.props).filter(([k]) => k !== "columnWidths")) });
                else setProps({ columnWidths: "fixed" });
              }}
              label={t("layout.content.autoWidthsLabel")}
            />
          </Field>
          <Switch checked={footer !== null} onChange={(on) => setContent({ footer: on ? columns.map(() => "") : undefined })} label={t("layout.content.footerRow")} />
          {footer && (
            <Row gap={4}>
              {footer.map((cell, i) => (
                <Input
                  key={i}
                  aria-label={t("layout.content.footerCell", { n: i + 1 })}
                  value={inlineToString(cell && typeof cell === "object" && !Array.isArray(cell) ? (cell as Json).text : cell)}
                  onChange={(e) => setContent({ footer: footer.map((x, j) => (j === i ? e.target.value : x)) })}
                  style={{ flex: 1, minWidth: 0 }}
                />
              ))}
            </Row>
          )}
          <Field label={t("layout.content.bars")} hint={t("layout.content.barsHint")}>
            <Select
              value={typeof p.bars === "string" ? p.bars : typeof p.bars === "number" ? (columns[p.bars]?.header ?? "") : ""}
              onChange={(bars) => setProps({ bars: bars || undefined })}
              options={[{ value: "", label: t("layout.content.barsNone") }, ...columns.map((col) => ({ value: col.header, label: col.header }))]}
            />
          </Field>
        </>
      );
      break;
    }
    case "code":
      form = (
        <>
          <Field label={t("layout.content.language")}>
            <Input value={String(c.language ?? "")} onChange={(e) => setContent({ language: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.code")}>
            <TextArea mono rows={10} value={String(c.code ?? "")} onChange={(e) => setContent({ code: e.target.value })} />
          </Field>
        </>
      );
      break;
    case "steps":
    case "timeline": {
      const key = component.type === "steps" ? "steps" : "events";
      const items: Json[] = ((c[key] as Json[]) ?? []).map((item) => ({ ...item, text: inlineToString(item.text) }));
      const write = (next: Json[]) => setContent({ [key]: next.map((item) => (item.text ? item : Object.fromEntries(Object.entries(item).filter(([k]) => k !== "text")))) });
      form = (
        <>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
              <Row>
                {key === "events" && (
                  <Field label={t("layout.content.date")} style={{ width: 90 }}>
                    <Input value={String(item.date ?? "")} onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                  </Field>
                )}
                <Field label={t("layout.content.title")} style={{ flex: 1 }}>
                  <Input value={String(item.title ?? "")} onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                </Field>
                <ItemActions index={i} count={items.length} labels={labels} onMove={(a, b) => write(move(items, a, b))} onRemove={(j) => write(items.filter((_, k) => k !== j))} />
              </Row>
              <TextArea aria-label={t("layout.content.text")} rows={2} value={String(item.text ?? "")} onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            </div>
          ))}
          <Button variant="ghost" icon="add" iconPosition="start" onClick={() => write([...items, key === "events" ? { date: "", title: "" } : { title: "" }])}>
            {t(key === "steps" ? "layout.content.addStep" : "layout.content.addEvent")}
          </Button>
        </>
      );
      break;
    }
    case "kpi":
      form = (
        <>
          <Row>
            <Field label={t("layout.content.value")} style={{ flex: 1 }}>
              <Input value={String(c.value ?? "")} onChange={(e) => setContent({ value: e.target.value })} />
            </Field>
            <Field label={t("layout.content.trend")}>
              <Select
                value={String(c.trend ?? "none")}
                onChange={(trend) => setContent({ trend: trend === "none" ? undefined : trend })}
                options={["none", "up", "down", "flat"].map((v) => ({ value: v, label: t(`layout.content.trend.${v}`) }))}
              />
            </Field>
          </Row>
          <Field label={t("layout.content.label")}>
            <Input value={String(c.label ?? "")} onChange={(e) => setContent({ label: e.target.value })} />
          </Field>
          <Field label={t("layout.content.delta")}>
            <Input value={String(c.delta ?? "")} onChange={(e) => setContent({ delta: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.sparkline")} hint={t("layout.content.sparklineHint")}>
            <Input
              value={csv((c.sparkline as unknown[]) ?? [])}
              onChange={(e) => {
                const values = fromCsv(e.target.value).map(Number).filter((n) => Number.isFinite(n));
                setContent({ sparkline: values.length >= 3 ? values.slice(0, 60) : undefined });
              }}
            />
          </Field>
          <Field label={t("layout.content.href")} hint={t("layout.content.hrefHint")}>
            <Input value={String(p.href ?? "")} onChange={(e) => setProps({ href: e.target.value })} />
          </Field>
        </>
      );
      break;
    case "card":
      form = (
        <>
          <Field label={t("layout.content.eyebrow")}>
            <Input value={String(c.eyebrow ?? "")} onChange={(e) => setContent({ eyebrow: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.title")}>
            <Input value={inlineToString(c.title)} onChange={(e) => setContent({ title: e.target.value })} />
          </Field>
          <Field label={t("layout.content.value")}>
            <Input value={String(c.value ?? "")} onChange={(e) => setContent({ value: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.text")}>
            <TextArea rows={3} value={inlineToString(c.text)} onChange={(e) => setContent({ text: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.footer")}>
            <Input value={inlineToString(c.footer)} onChange={(e) => setContent({ footer: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.href")} hint={t("layout.content.hrefHint")}>
            <Input value={String(p.href ?? "")} onChange={(e) => setProps({ href: e.target.value })} />
          </Field>
          {(hasRuns(c.title) || hasRuns(c.text)) && runsWarning}
        </>
      );
      break;
    case "chart": {
      const kind = String(c.kind ?? "bar");
      const scatter = kind === "scatter";
      const series = ((c.series as { name: string; values?: number[]; points?: unknown }[]) ?? []).map((s) => ({ name: s.name, values: scatter ? pointsToText(s.points) : csv(s.values ?? []) }));
      const write = (next: { name: string; values: string }[], asScatter = scatter) =>
        setContent({
          series: next.map((s) => (asScatter ? { name: s.name, points: textToPoints(s.values) } : { name: s.name, values: fromCsv(s.values).map(Number).filter((n) => Number.isFinite(n)) })),
        });
      // Scatter has points and no categories; the others the reverse. Switching keeps the names.
      const switchKind = (next: string) => {
        if ((next === "scatter") === scatter) return setContent({ kind: next });
        const toScatter = next === "scatter";
        set({
          content: {
            ...Object.fromEntries(Object.entries(draft.content).filter(([k]) => k !== "categories")),
            kind: next,
            ...(toScatter ? {} : { categories: ["A", "B", "C"] }),
            series: series.map((s) => (toScatter ? { name: s.name, points: [[1, 1], [2, 3], [3, 2]] } : { name: s.name, values: [1, 2, 3] })),
          },
          props: draft.props,
        });
      };
      const axis = (p.axis ?? {}) as Json;
      const setAxis = (patch: Json) => {
        const next = { ...axis, ...patch };
        for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === "") delete next[k];
        setProps({ axis: Object.keys(next).length ? next : undefined });
      };
      form = (
        <>
          <Field label={t("layout.content.chartKind")}>
            <Select value={kind} onChange={switchKind} options={["bar", "line", "area", "pie", "donut", "scatter"].map((k) => ({ value: k, label: t(`layout.content.chartKind.${k}`) }))} />
          </Field>
          {!scatter && (
            <Field label={t("layout.content.categories")} hint={t("layout.content.csvHint")}>
              <Input value={csv((c.categories as unknown[]) ?? [])} onChange={(e) => setContent({ categories: fromCsv(e.target.value) })} />
            </Field>
          )}
          {scatter && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.content.pointsHint")}</span>}
          {series.map((s, i) => (
            <Row key={i}>
              <Field label={t("layout.content.seriesName")} style={{ width: 110 }}>
                <Input value={s.name} onChange={(e) => write(series.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </Field>
              <Field label={t("layout.content.values")} style={{ flex: 1 }}>
                <Input value={s.values} onChange={(e) => write(series.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} />
              </Field>
              <ItemActions index={i} count={series.length} labels={labels} onMove={(a, b) => write(move(series, a, b))} onRemove={(j) => write(series.filter((_, k) => k !== j))} />
            </Row>
          ))}
          <Button variant="ghost" icon="add" iconPosition="start" onClick={() => write([...series, { name: t("layout.sample.series"), values: "" }])}>
            {t("layout.content.addSeries")}
          </Button>
          <Field label={t("layout.content.unit")}>
            <Input value={String(p.unit ?? "")} onChange={(e) => setProps({ unit: e.target.value })} />
          </Field>
          <Switch checked={p.values === true} onChange={(on) => setProps({ values: on || undefined })} label={t("layout.content.showValues")} />
          <Switch checked={p.legend !== false} onChange={(on) => setProps({ legend: on ? undefined : false })} label={t("layout.content.showLegend")} />
          <Switch checked={p.legendPosition === "right"} onChange={(on) => setProps({ legendPosition: on ? "right" : undefined })} label={t("layout.content.legendRight")} />
          {kind === "bar" && <Switch checked={p.orientation === "horizontal"} onChange={(on) => setProps({ orientation: on ? "horizontal" : undefined })} label={t("layout.content.horizontal")} />}
          {(kind === "bar" || kind === "area") && <Switch checked={p.stacked === true} onChange={(on) => setProps({ stacked: on || undefined })} label={t("layout.content.stacked")} />}
          {kind === "donut" && (
            <Field label={t("layout.content.center")} hint={t("layout.content.centerHint")}>
              <Input value={String(p.center ?? "")} onChange={(e) => setProps({ center: e.target.value || undefined })} />
            </Field>
          )}
          {kind !== "pie" && kind !== "donut" && (
            <Row>
              <Field label={t("layout.content.axisX")} style={{ flex: 1 }}>
                <Input value={String(axis.x ?? "")} onChange={(e) => setAxis({ x: e.target.value })} />
              </Field>
              <Field label={t("layout.content.axisY")} style={{ flex: 1 }}>
                <Input value={String(axis.y ?? "")} onChange={(e) => setAxis({ y: e.target.value })} />
              </Field>
            </Row>
          )}
        </>
      );
      break;
    }
    case "callout":
      form = (
        <>
          <Field label={t("layout.content.calloutKind")}>
            <Select
              value={String(p.kind ?? "note")}
              onChange={(kind) => setProps({ kind: kind === "note" ? undefined : kind })}
              options={["note", "tip", "warning", "important", "success"].map((k) => ({ value: k, label: t(`layout.content.calloutKind.${k}`) }))}
            />
          </Field>
          <Field label={t("layout.content.title")}>
            <Input value={String(c.title ?? "")} onChange={(e) => setContent({ title: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.text")}>
            <TextArea rows={4} value={inlineToString(c.text)} onChange={(e) => setContent({ text: e.target.value })} />
          </Field>
          <Switch checked={p.icon !== false} onChange={(on) => setProps({ icon: on ? undefined : false })} label={t("layout.content.icon")} />
          {hasRuns(c.text) && runsWarning}
        </>
      );
      break;
    case "tags": {
      // One tag per line; "text | color" keeps a tag's color (a token like $color.success or #hex).
      const items = ((c.items as unknown[]) ?? []).map((item) => (typeof item === "string" ? item : `${String((item as Json).text ?? "")}${(item as Json).color ? ` | ${String((item as Json).color)}` : ""}`));
      form = (
        <Field label={t("layout.content.tags")} hint={t("layout.content.tagsHint")}>
          <TextArea
            rows={6}
            value={items.join("\n")}
            onChange={(e) =>
              setContent({
                items: e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const [text, color] = line.split("|").map((s) => s.trim());
                    return color ? { text, color } : (text as string);
                  }),
              })
            }
          />
        </Field>
      );
      break;
    }
    case "progress": {
      const kind = String(p.kind ?? "bar");
      const items = ((c.items as Json[]) ?? []).map((item) => ({ ...item }));
      const write = (next: Json[]) => setContent({ items: next });
      const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
      form = (
        <>
          <Field label={t("layout.content.progressKind")}>
            <Select value={kind} onChange={(k) => setProps({ kind: k === "bar" ? undefined : k })} options={["bar", "stars", "dots"].map((k) => ({ value: k, label: t(`layout.content.progressKind.${k}`) }))} />
          </Field>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
              <Row gap={4} style={{ alignItems: "flex-end" }}>
                <Field label={t("layout.content.label")} style={{ flex: 1 }}>
                  <Input value={String(item.label ?? "")} onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                </Field>
                <ItemActions index={i} count={items.length} labels={labels} onMove={(a, b) => write(move(items, a, b))} onRemove={(j) => write(items.filter((_, k) => k !== j))} />
              </Row>
              <Row gap={4}>
                <Field label={t("layout.content.value")} style={{ flex: 1 }}>
                  <Input inputMode="decimal" value={String(item.value ?? "")} onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, value: num(e.target.value) ?? 0 } : x)))} />
                </Field>
                <Field label={t("layout.content.max")} style={{ flex: 1 }}>
                  <Input inputMode="decimal" value={item.max === undefined ? "" : String(item.max)} placeholder={kind === "bar" ? "100" : "5"} onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, max: num(e.target.value) } : x)).map((x) => (x.max === undefined ? Object.fromEntries(Object.entries(x).filter(([k]) => k !== "max")) : x)))} />
                </Field>
                <Field label={t("layout.content.shownAs")} style={{ flex: 1 }}>
                  <Input value={String(item.text ?? "")} onChange={(e) => write(items.map((x, j) => (j === i ? { ...x, text: e.target.value || undefined } : x)))} />
                </Field>
              </Row>
            </div>
          ))}
          <Button variant="ghost" icon="add" iconPosition="start" onClick={() => write([...items, { label: t("layout.sample.item1"), value: 50 }])}>
            {t("layout.content.addItem")}
          </Button>
          <Switch checked={p.showValue !== false} onChange={(on) => setProps({ showValue: on ? undefined : false })} label={t("layout.content.showValues")} />
        </>
      );
      break;
    }
    case "cover": {
      const meta = ((c.meta as Json[]) ?? []).map((m) => `${String(m.label ?? "")}: ${String(m.value ?? "")}`).join("\n");
      form = (
        <>
          <Field label={t("layout.content.eyebrow")}>
            <Input value={String(c.eyebrow ?? "")} onChange={(e) => setContent({ eyebrow: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.title")}>
            <Input value={String(c.title ?? "")} onChange={(e) => setContent({ title: e.target.value })} />
          </Field>
          <Field label={t("layout.content.subtitle")}>
            <TextArea rows={2} value={String(c.subtitle ?? "")} onChange={(e) => setContent({ subtitle: e.target.value || undefined })} />
          </Field>
          <Field label={t("layout.content.meta")} hint={t("layout.content.metaHint")}>
            <TextArea
              rows={3}
              value={meta}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean)
                  .map((line) => {
                    const at = line.indexOf(":");
                    return at < 0 ? { label: line, value: "" } : { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() };
                  });
                setContent({ meta: lines.length ? lines.slice(0, 8) : undefined });
              }}
            />
          </Field>
          <Field label={t("layout.content.background")} hint={t("layout.content.backgroundHint")}>
            <Input value={typeof p.background === "string" ? p.background : ""} onChange={(e) => setProps({ background: e.target.value || undefined })} />
          </Field>
          <Row>
            <Field label={t("layout.content.vertical")} style={{ flex: 1 }}>
              <Select value={String(p.vertical ?? "middle")} onChange={(v) => setProps({ vertical: v === "middle" ? undefined : v })} options={["top", "middle", "bottom"].map((v) => ({ value: v, label: t(`layout.content.vertical.${v}`) }))} />
            </Field>
            <Field label={t("layout.content.align")} style={{ flex: 1 }}>
              <Select value={String(p.align ?? "left")} onChange={(v) => setProps({ align: v === "left" ? undefined : v })} options={["left", "center"].map((v) => ({ value: v, label: t(`layout.style.align.${v}`) }))} />
            </Field>
          </Row>
          <Switch checked={p.fullBleed === true} onChange={(on) => setProps({ fullBleed: on || undefined })} label={t("layout.content.fullBleed")} />
        </>
      );
      break;
    }
    case "toc": {
      const levels = (p.levels as string[] | undefined) ?? ["title-1", "title-2"];
      const toggle = (level: string, on: boolean) => {
        const next = ["title-1", "title-2", "title-3"].filter((l) => (l === level ? on : levels.includes(l)));
        setProps({ levels: next.length && next.join() !== "title-1,title-2" ? next : undefined });
      };
      form = (
        <>
          <Field label={t("layout.content.title")} hint={t("layout.content.tocTitleHint")}>
            <Input value={String(c.title ?? "")} onChange={(e) => set({ content: e.target.value ? { title: e.target.value } : {}, props: draft.props })} />
          </Field>
          <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t("layout.content.tocLevels")}</span>
          {["title-1", "title-2", "title-3"].map((level) => (
            <Switch key={level} checked={levels.includes(level)} onChange={(on) => toggle(level, on)} label={t(`layout.role.${level}`)} />
          ))}
          <Switch checked={p.pages !== false} onChange={(on) => setProps({ pages: on ? undefined : false })} label={t("layout.content.tocPages")} />
          <Switch checked={p.leaders !== false} onChange={(on) => setProps({ leaders: on ? undefined : false })} label={t("layout.content.tocLeaders")} />
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.content.tocHint")}</span>
        </>
      );
      break;
    }
    case "flow":
      form = <FlowBlocksEditor blocks={((c.blocks as (string | Json)[]) ?? []).slice()} onChange={(blocks) => setContent({ blocks: blocks.length ? blocks : [""] })} />;
      break;
    case "image":
      form = (
        <>
          <Field label={t("layout.content.src")} hint={t("layout.content.srcHint")}>
            <Input value={String(c.src ?? "")} onChange={(e) => setContent({ src: e.target.value })} />
          </Field>
          <Field label={t("layout.content.alt")} hint={t("layout.content.altHint")}>
            <Input value={String(c.alt ?? "")} onChange={(e) => setContent({ alt: e.target.value })} />
          </Field>
          <Row>
            <Field label={t("layout.content.imageWidth")} style={{ flex: 1 }}>
              <Input type="number" min={1} value={Number(c.width ?? 1)} onChange={(e) => setContent({ width: Number(e.target.value) })} />
            </Field>
            <Field label={t("layout.content.imageHeight")} style={{ flex: 1 }}>
              <Input type="number" min={1} value={Number(c.height ?? 1)} onChange={(e) => setContent({ height: Number(e.target.value) })} />
            </Field>
          </Row>
          <Field label={t("layout.content.fit")}>
            <Select value={String(p.fit ?? "contain")} onChange={(fit) => setProps({ fit: fit === "contain" ? undefined : fit })} options={["contain", "cover"].map((f) => ({ value: f, label: t(`layout.content.fit.${f}`) }))} />
          </Field>
          <Field label={t("layout.content.caption")}>
            <Input value={inlineToString(c.caption)} onChange={(e) => setContent({ caption: e.target.value || undefined })} />
          </Field>
          <Switch checked={p.figure === true} onChange={(on) => setProps({ figure: on || undefined })} label={t("layout.content.figure")} />
          <Field label={t("layout.content.href")} hint={t("layout.content.hrefHint")}>
            <Input value={String(p.href ?? "")} onChange={(e) => setProps({ href: e.target.value })} />
          </Field>
        </>
      );
      break;
    case "divider":
      form = (
        <Field label={t("layout.content.dividerKind")}>
          <Select value={String(p.kind ?? "line")} onChange={(kind) => setProps({ kind })} options={["line", "space"].map((k) => ({ value: k, label: t(`layout.content.dividerKind.${k}`) }))} />
        </Field>
      );
      break;
  }

  return (
    // While a draft is being typed, Ctrl+Z belongs to the field; once applied, it undoes the document.
    <div onBlur={onBlur} data-undo={dirty ? "native" : "document"} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
        {json === null ? (
          form
        ) : (
          <Field label={t("layout.content.json")} hint={t("layout.content.jsonHint")}>
            <TextArea mono rows={14} value={json} onChange={(e) => setJson(e.target.value)} />
          </Field>
        )}
      </fieldset>
      {error && <span style={{ ...textStyle.caption, color: "var(--color-error)" }}>{error}</span>}
      {!readOnly && (
        <Row style={{ justifyContent: "space-between" }}>
          <Button
            variant="ghost"
            icon={json === null ? "data_object" : "edit_note"}
            iconPosition="start"
            onClick={() => {
              if (json === null) {
                setJson(JSON.stringify(draft, null, 2));
                return;
              }
              try {
                const parsed = JSON.parse(json) as Draft;
                const next = { content: parsed.content ?? {}, props: parsed.props ?? {} };
                setDraft(next);
                setJson(null);
                apply(next);
              } catch {
                setError(t("layout.content.jsonInvalid"));
              }
            }}
          >
            {json === null ? t("layout.content.editJson") : t("layout.content.backToForm")}
          </Button>
          {json !== null ? (
            <Button variant="secondary" disabled={!dirty} onClick={() => apply()}>
              {t("layout.content.apply")}
            </Button>
          ) : (
            // The form applies itself when focus leaves it: say so instead of asking for a click.
            <span style={{ ...textStyle.caption, color: dirty ? "var(--color-warn)" : "var(--color-faint)" }} aria-live="polite">
              {dirty ? t("layout.content.pending") : t("layout.status.saved")}
            </span>
          )}
        </Row>
      )}
    </div>
  );
}
