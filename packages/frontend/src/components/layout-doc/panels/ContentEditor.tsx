import { useEffect, useState, type FocusEvent, type ReactNode } from "react";
import { TEXT_ROLES, type ApplyResult, type Component } from "@docforge/layout";
import { Button, Input, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { Field, ItemActions, move, Row, Select, TextArea } from "./fields";

type Json = Record<string, unknown>;

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
export function ContentEditor({ component, commit, readOnly }: { component: Component; commit: (ops: unknown[]) => ApplyResult; readOnly: boolean }) {
  const { t } = useI18n();
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
      const paragraphs = (c.paragraphs as unknown[]) ?? [];
      const rows = paragraphs.map((para) =>
        typeof para === "string" ? { role: "body", text: para, runs: false } : { role: String((para as Json).role ?? "body"), text: inlineToString((para as Json).text), runs: hasRuns((para as Json).text) },
      );
      const write = (next: typeof rows) =>
        setContent({ paragraphs: next.map((r) => (r.role === "body" ? r.text : { role: r.role, text: r.text })) });
      form = (
        <>
          {rows.map((row, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 8, borderBottom: "1px solid var(--color-outline)" }}>
              <Row>
                <Select
                  label={t("layout.content.role")}
                  value={row.role}
                  onChange={(role) => write(rows.map((r, j) => (j === i ? { ...r, role } : r)))}
                  options={TEXT_ROLES.map((role) => ({ value: role, label: t(`layout.role.${role}`) }))}
                  style={{ flex: 1 }}
                />
                <ItemActions index={i} count={rows.length} labels={labels} onMove={(a, b) => write(move(rows, a, b))} onRemove={(j) => write(rows.filter((_, k) => k !== j))} />
              </Row>
              <TextArea
                aria-label={t("layout.content.paragraph", { n: i + 1 })}
                rows={row.role.startsWith("title") ? 1 : 3}
                value={row.text}
                onChange={(e) => write(rows.map((r, j) => (j === i ? { ...r, text: e.target.value, runs: false } : r)))}
              />
              {row.runs && runsWarning}
            </div>
          ))}
          <Button icon="add" iconPosition="start" variant="ghost" onClick={() => write([...rows, { role: "body", text: "", runs: false }])}>
            {t("layout.content.addParagraph")}
          </Button>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.content.inlineHint")}</span>
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
      const rows = ((c.rows as unknown[][]) ?? []).map((row) => columns.map((_, i) => inlineToString(row[i])));
      const write = (cols: typeof columns, body: string[][]) =>
        setContent({
          columns: cols.map((col) => (col.align === "left" && col.width === undefined ? col.header : { header: col.header, ...(col.align !== "left" ? { align: col.align } : {}), ...(col.width !== undefined ? { width: col.width } : {}) })),
          rows: body,
        });
      form = (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {columns.map((col, i) => (
                    <th key={i} style={{ padding: 2, verticalAlign: "top" }}>
                      <Input aria-label={t("layout.content.header", { n: i + 1 })} value={col.header} onChange={(e) => write(columns.map((x, j) => (j === i ? { ...x, header: e.target.value } : x)), rows)} style={{ minWidth: 90, fontWeight: 600 }} />
                      <Row gap={2} style={{ marginTop: 2 }}>
                        <Select
                          label={t("layout.content.align")}
                          value={col.align}
                          onChange={(align) => write(columns.map((x, j) => (j === i ? { ...x, align } : x)), rows)}
                          options={["left", "center", "right"].map((a) => ({ value: a, label: t(`layout.style.align.${a}`) }))}
                          style={{ flex: 1 }}
                        />
                        <Button variant="ghost" icon="close" aria-label={t("layout.content.removeColumn")} disabled={columns.length <= 1} onClick={() => write(columns.filter((_, j) => j !== i), rows.map((r) => r.filter((_, j) => j !== i)))} />
                      </Row>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td key={i} style={{ padding: 2 }}>
                        <Input aria-label={t("layout.content.cell", { row: r + 1, col: i + 1 })} value={cell} onChange={(e) => write(columns, rows.map((x, k) => (k === r ? x.map((v, j) => (j === i ? e.target.value : v)) : x)))} style={{ minWidth: 90 }} />
                      </td>
                    ))}
                    <td>
                      <Button variant="ghost" icon="close" aria-label={t("layout.content.removeRow", { n: r + 1 })} onClick={() => write(columns, rows.filter((_, k) => k !== r))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Row>
            <Button variant="ghost" icon="add" iconPosition="start" onClick={() => write(columns, [...rows, columns.map(() => "")])}>
              {t("layout.content.addRow")}
            </Button>
            <Button variant="ghost" icon="add" iconPosition="start" onClick={() => write([...columns, { header: t("layout.content.newColumn"), align: "left" }], rows.map((r) => [...r, ""]))}>
              {t("layout.content.addColumn")}
            </Button>
          </Row>
          <Switch checked={p.zebra === true} onChange={(on) => setProps({ zebra: on || undefined })} label={t("layout.content.zebra")} />
          <Switch checked={p.header !== false} onChange={(on) => setProps({ header: on ? undefined : false })} label={t("layout.content.headerRow")} />
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
      const series = ((c.series as { name: string; values: number[] }[]) ?? []).map((s) => ({ name: s.name, values: csv(s.values) }));
      const write = (next: { name: string; values: string }[]) =>
        setContent({ series: next.map((s) => ({ name: s.name, values: fromCsv(s.values).map(Number).filter((n) => Number.isFinite(n)) })) });
      form = (
        <>
          <Field label={t("layout.content.chartKind")}>
            <Select value={String(c.kind ?? "bar")} onChange={(kind) => setContent({ kind })} options={["bar", "line", "pie"].map((k) => ({ value: k, label: t(`layout.content.chartKind.${k}`) }))} />
          </Field>
          <Field label={t("layout.content.categories")} hint={t("layout.content.csvHint")}>
            <Input value={csv((c.categories as unknown[]) ?? [])} onChange={(e) => setContent({ categories: fromCsv(e.target.value) })} />
          </Field>
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
        </>
      );
      break;
    }
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
    <div onBlur={onBlur} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
