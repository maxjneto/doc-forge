import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import type { Component, ComponentGeometry, Inline, LayoutDocument, Tokens } from "@docforge-lib/layout";
import { useI18n } from "@/i18n";
import { InlineField, type InlineFieldHandle } from "./InlineField";
import { canEditInline } from "./InlineTextEditor";
import { componentStyle, textCss } from "./inlineStyle";
import { plainText, sameInline } from "./richText";

type Json = Record<string, unknown>;

export type InlineKind = "text" | "kpi" | "table" | "card" | "list" | "steps" | "timeline" | "code";

/** Which in-place editor a component gets, if any (charts and images stay in the panel). */
export function inlineKind(component: Component): InlineKind | null {
  const c = ((component as { content?: Json }).content ?? {}) as Json;
  switch (component.type) {
    case "text":
      return canEditInline(component) ? "text" : null;
    case "kpi":
      return ["value", "label"].every((k) => typeof c[k] === "string") && (c.delta === undefined || typeof c.delta === "string") ? "kpi" : null;
    case "table": {
      const columns = (c.columns as unknown[]) ?? [];
      const rows = (c.rows as unknown[][]) ?? [];
      const plainHeader = (col: unknown) => typeof col === "string" || (col !== null && typeof col === "object" && typeof (col as Json).header === "string");
      const plainCell = (cell: unknown) => cell === undefined || typeof cell === "string" || typeof cell === "number";
      return columns.every(plainHeader) && rows.every((row) => Array.isArray(row) && row.every(plainCell)) ? "table" : null;
    }
    case "card":
    case "list":
    case "steps":
    case "timeline":
    case "code":
      return component.type;
    default:
      return null;
  }
}

interface BlockEditorProps {
  component: Component;
  geometry: ComponentGeometry;
  doc: LayoutDocument;
  tokens: Tokens;
  style: CSSProperties;
  /** `edit` paths to set and remove, or null when nothing changed / cancelled. */
  onDone: (change: { set: Json; remove: string[] } | null) => void;
}

/** Save when focus leaves the editor (to the page, a panel or another block); Esc cancels. */
function useFinish(onDone: BlockEditorProps["onDone"], collect: () => { set: Json; remove: string[] } | null) {
  const done = useRef(false);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    onDone(save ? collect() : null);
  };
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    const to = e.relatedTarget as HTMLElement | null;
    if (!e.currentTarget.contains(to) && !to?.closest?.("[data-run-bar]")) finish(true);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      finish(true);
    }
  };
  return { finish, onBlur, onKeyDown };
}

/** The box look a decorated block has on the page (background, radius, padding). */
function boxCss(component: Component, doc: LayoutDocument, tokens: Tokens): CSSProperties {
  const s = componentStyle(component, doc, tokens);
  return { background: s.background && s.background !== "transparent" ? s.background : tokens.color.surface, borderRadius: s.radius, padding: s.padding };
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

/** Focus the n-th focusable field of an editor (inputs and contentEditables, in DOM order). */
function fields(root: HTMLElement | null): HTMLElement[] {
  return [...(root?.querySelectorAll<HTMLElement>("input, textarea, [contenteditable]") ?? [])];
}
function focusField(el: HTMLElement | undefined, where: "start" | "end" = "end") {
  if (!el) return;
  el.focus();
  if (el.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(where === "start");
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  } else if (el instanceof HTMLInputElement) el.select();
}

/**
 * A KPI edited where it is drawn: value, label and change, each in the style it has
 * on the page. Enter in a field goes to the next one; leaving saves.
 */
export function InlineKpiEditor({ component, geometry, doc, tokens, style, onDone }: BlockEditorProps) {
  const { t } = useI18n();
  const c = ((component as { content?: Json }).content ?? {}) as { value: string; label: string; delta?: string; trend?: string };
  const [value, setValue] = useState(c.value);
  const [label, setLabel] = useState(c.label);
  const [delta, setDelta] = useState(c.delta ?? "");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    first.current?.select();
  }, []);

  const base = componentStyle(component, doc, tokens);
  const labelStyle = componentStyle(component, doc, tokens, "label");
  const deltaStyle = componentStyle(component, doc, tokens, "delta");
  const trendColor = c.trend === "up" ? tokens.color.success : c.trend === "down" ? tokens.color.danger : deltaStyle.muted;
  const valueSize = typeof geometry.facts.valueSize === "number" ? geometry.facts.valueSize : base.fontSize;

  const { onBlur, onKeyDown } = useFinish(onDone, () => {
    const set: Json = {};
    const remove: string[] = [];
    if (value.trim() && value !== c.value) set.value = value.trim();
    if (label !== c.label) set.label = label.trim();
    if (delta.trim() !== (c.delta ?? "")) {
      if (delta.trim()) set.delta = delta.trim();
      else if (c.delta !== undefined) remove.push("delta");
    }
    return Object.keys(set).length || remove.length ? { set, remove } : null;
  });
  const next = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const inputs = [...(e.currentTarget.closest(".df-inline-block")?.querySelectorAll("input") ?? [])];
    const i = inputs.indexOf(e.currentTarget);
    (inputs[i + 1] ?? inputs[0])?.focus();
  };

  return (
    <div
      className="df-inline-editor df-inline-block"
      role="group"
      aria-label={t("layout.inline.kpi")}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      style={{ ...style, ...boxCss(component, doc, tokens), display: "flex", flexDirection: "column", justifyContent: "center", gap: 2 }}
    >
      <input ref={first} aria-label={t("layout.content.value")} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={next} style={textCss(base, { fontSize: valueSize })} />
      <input aria-label={t("layout.content.label")} value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={next} style={textCss(labelStyle)} />
      <input
        aria-label={t("layout.content.delta")}
        placeholder={t("layout.inline.deltaPlaceholder")}
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
        onKeyDown={next}
        style={textCss(deltaStyle, { color: trendColor })}
      />
    </div>
  );
}

type Column = string | { header: string; width?: number; align?: string };

/**
 * A table edited where it is drawn: header and cells as fields laid out with the
 * table's own column weights and cell padding. Tab moves along, Enter moves down
 * (and adds a row after the last one), Backspace in an empty row removes it, the
 * "+" buttons add a column or a row; leaving saves only what changed.
 */
export function InlineTableEditor({ component, doc, tokens, style, onDone }: BlockEditorProps) {
  const { t } = useI18n();
  const c = ((component as { content?: Json }).content ?? {}) as { columns: Column[]; rows: (string | number)[][] };
  const props = ((component as { props?: Json }).props ?? {}) as { header?: boolean; zebra?: boolean };
  const [columns, setColumns] = useState<Column[]>(c.columns);
  const headerOf = (col: Column) => (typeof col === "string" ? col : col.header);
  const [rows, setRows] = useState(() => c.rows.map((row) => c.columns.map((_, i) => (row[i] === undefined ? "" : String(row[i])))));
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  useEffect(() => {
    const target = root.current?.querySelector<HTMLInputElement>(props.header === false ? "tbody input" : "input");
    target?.focus();
    target?.select();
  }, [props.header]);
  useEffect(() => {
    if (!pending.current) return;
    const target = root.current?.querySelector<HTMLInputElement>(`[data-cell="${pending.current}"]`);
    pending.current = null;
    target?.focus();
  });

  const cell = componentStyle(component, doc, tokens);
  const head = componentStyle(component, doc, tokens, "header");
  const weights = columns.map((col) => (typeof col === "string" ? 1 : (col.width ?? 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  const pad = (s: typeof cell) => `${Math.round(s.gap * 0.75)}px ${s.gap}px`;
  const align = (i: number) => {
    const col = columns[i];
    return (typeof col === "string" ? "left" : (col?.align ?? "left")) as CSSProperties["textAlign"];
  };

  const { onBlur, onKeyDown } = useFinish(onDone, () => {
    const set: Json = {};
    const sameShape = columns.length === c.columns.length && rows.length === c.rows.length;
    if (!sameShape) {
      if (columns.length !== c.columns.length || columns.some((col, i) => headerOf(col) !== headerOf(c.columns[i] as Column))) set.columns = columns;
      set.rows = rows;
      return { set, remove: [] };
    }
    columns.forEach((col, i) => {
      const old = c.columns[i] as Column;
      if (headerOf(col) !== headerOf(old)) set[typeof old === "string" ? `columns.${i}` : `columns.${i}.header`] = headerOf(col);
    });
    rows.forEach((row, r) => {
      const old = c.rows[r] as (string | number)[];
      row.forEach((v, i) => {
        if (v !== (old[i] === undefined ? "" : String(old[i]))) set[`rows.${r}.${i}`] = v;
      });
    });
    return Object.keys(set).length ? { set, remove: [] } : null;
  });

  const addRow = (after = rows.length - 1) => {
    const next = [...rows];
    next.splice(after + 1, 0, columns.map(() => ""));
    setRows(next);
    pending.current = `${after + 1}:0`;
  };
  const addColumn = () => {
    setColumns([...columns, t("layout.content.newColumn")]);
    setRows(rows.map((row) => [...row, ""]));
    pending.current = `-1:${columns.length}`;
  };
  const removeRow = (r: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, k) => k !== r));
    pending.current = `${Math.max(0, r - 1)}:0`;
  };

  const keys = (e: KeyboardEvent<HTMLInputElement>, r: number, i: number) => {
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (r === rows.length - 1) addRow();
      else root.current?.querySelector<HTMLInputElement>(`[data-cell="${r + 1}:${i}"]`)?.focus();
    } else if (e.key === "Backspace" && r >= 0 && rows[r]?.every((v) => !v) && e.currentTarget.value === "") {
      e.preventDefault();
      removeRow(r);
    }
  };

  return (
    <div
      ref={root}
      className="df-inline-editor df-inline-block"
      role="group"
      aria-label={t("layout.inline.table")}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      style={{ ...style, background: tokens.color.surface }}
    >
      <table className="df-inline-table" style={{ width: "100%" }}>
        <colgroup>
          {weights.map((w, i) => (
            <col key={i} style={{ width: `${(w / total) * 100}%` }} />
          ))}
        </colgroup>
        {props.header !== false && (
          <thead>
            <tr style={{ background: head.background ?? undefined }}>
              {columns.map((col, i) => (
                <th key={i} style={{ padding: pad(head), borderBottom: `1px solid ${cell.borderColor}` }}>
                  <input
                    aria-label={t("layout.content.header", { n: i + 1 })}
                    value={headerOf(col)}
                    data-cell={`-1:${i}`}
                    onChange={(e) => setColumns(columns.map((x, j) => (j === i ? (typeof x === "string" ? e.target.value : { ...x, header: e.target.value }) : x)))}
                    onKeyDown={(e) => keys(e, -1, i)}
                    style={{ ...textCss(head), textAlign: align(i) }}
                  />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} style={{ background: props.zebra && r % 2 === 1 ? tokens.color.subtle : undefined }}>
              {row.map((v, i) => (
                <td key={i} style={{ padding: pad(cell), borderBottom: `1px solid ${cell.borderColor}` }}>
                  <input
                    aria-label={t("layout.content.cell", { row: r + 1, col: i + 1 })}
                    value={v}
                    data-cell={`${r}:${i}`}
                    onChange={(e) => setRows(rows.map((x, k) => (k === r ? x.map((y, j) => (j === i ? e.target.value : y)) : x)))}
                    onKeyDown={(e) => keys(e, r, i)}
                    style={{ ...textCss(cell), textAlign: align(i) }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="df-inline-plus df-inline-plus--col" title={t("layout.content.addColumn")} aria-label={t("layout.content.addColumn")} onClick={addColumn}>
        +
      </button>
      <button type="button" className="df-inline-plus df-inline-plus--row" title={t("layout.content.addRow")} aria-label={t("layout.content.addRow")} onClick={() => addRow()}>
        +
      </button>
      <span className="df-inline-hint">{t("layout.inline.tableHint")}</span>
    </div>
  );
}

/**
 * A card edited where it is drawn: eyebrow, title, value, text and footer, each in its
 * own style, with the floating bar for the inline parts. Enter moves to the next field.
 */
export function InlineCardEditor({ component, doc, tokens, style, onDone }: BlockEditorProps) {
  const { t } = useI18n();
  const c = ((component as { content?: Json }).content ?? {}) as { eyebrow?: string; title: Inline; value?: string; text?: Inline; footer?: Inline };
  const root = useRef<HTMLDivElement>(null);
  const [eyebrow, setEyebrow] = useState(c.eyebrow ?? "");
  const [value, setValue] = useState(c.value ?? "");
  const title = useRef<InlineFieldHandle>(null);
  const text = useRef<InlineFieldHandle>(null);
  const footer = useRef<InlineFieldHandle>(null);
  useEffect(() => {
    focusField(fields(root.current)[c.eyebrow ? 0 : 1]);
  }, [c.eyebrow]);

  const base = componentStyle(component, doc, tokens);
  const part = (variant: string) => textCss(componentStyle(component, doc, tokens, variant));

  const { onBlur, onKeyDown } = useFinish(onDone, () => {
    const set: Json = {};
    const remove: string[] = [];
    const optionalText = (key: "eyebrow" | "value", next: string, old: string | undefined) => {
      if (next.trim() === (old ?? "")) return;
      if (next.trim()) set[key] = next.trim();
      else if (old !== undefined) remove.push(key);
    };
    optionalText("eyebrow", eyebrow, c.eyebrow);
    optionalText("value", value, c.value);
    const optionalInline = (key: "text" | "footer", handle: InlineFieldHandle | null, old: Inline | undefined) => {
      const next = handle?.read() ?? old;
      if (sameInline(next, old)) return;
      if (next !== undefined && plainText(next).trim()) set[key] = next;
      else if (old !== undefined) remove.push(key);
    };
    const nextTitle = title.current?.read() ?? c.title;
    if (!sameInline(nextTitle, c.title) && plainText(nextTitle).trim()) set.title = nextTitle;
    optionalInline("text", text.current, c.text);
    optionalInline("footer", footer.current, c.footer);
    return Object.keys(set).length || remove.length ? { set, remove } : null;
  });

  const advance = (from: HTMLElement) => {
    const all = fields(root.current);
    focusField(all[all.indexOf(from) + 1] ?? all[0]);
  };
  const onEnterInput = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    advance(e.currentTarget);
  };
  const onEnterField = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return false;
    e.preventDefault();
    advance(e.currentTarget);
    return true;
  };

  return (
    <div
      ref={root}
      className="df-inline-editor df-inline-block df-inline-card"
      role="group"
      aria-label={t("layout.inline.card")}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      style={{ ...style, ...boxCss(component, doc, tokens), display: "flex", flexDirection: "column", gap: base.gap }}
    >
      <input aria-label={t("layout.content.eyebrow")} placeholder={t("layout.content.eyebrow")} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} onKeyDown={onEnterInput} style={part("eyebrow")} />
      <InlineField ref={title} aria-label={t("layout.content.title")} value={c.title} tokens={tokens} style={part("title")} onKey={onEnterField} />
      <input aria-label={t("layout.content.value")} placeholder={t("layout.content.value")} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onEnterInput} style={part("value")} />
      <InlineField ref={text} aria-label={t("layout.content.text")} placeholder={t("layout.content.text")} value={c.text ?? ""} tokens={tokens} style={textCss(base)} onKey={onEnterField} />
      <InlineField ref={footer} aria-label={t("layout.content.footer")} placeholder={t("layout.content.footer")} value={c.footer ?? ""} tokens={tokens} style={part("footer")} onKey={onEnterField} />
    </div>
  );
}

interface FlatItem {
  text: Inline;
  checked?: boolean;
  depth: number;
  key: number;
}
type ListItem = string | { text: Inline; checked?: boolean; items?: ListItem[] };

function flattenItems(items: ListItem[], depth: number, out: FlatItem[]): void {
  for (const item of items) {
    const node = typeof item === "string" ? { text: item } : item;
    out.push({ text: node.text, ...(node.checked !== undefined ? { checked: node.checked } : {}), depth, key: out.length });
    if (node.items?.length) flattenItems(node.items, depth + 1, out);
  }
}
/** Flat items (with depths) back to the nested shape, plain strings where nothing else is set. */
export function nestItems(flat: { text: Inline; checked?: boolean; depth: number }[]): ListItem[] {
  const root: { items: ListItem[] } = { items: [] };
  const stack: { depth: number; node: { items?: ListItem[] } }[] = [{ depth: -1, node: root }];
  for (const item of flat) {
    const depth = Math.min(item.depth, (stack[stack.length - 1]?.depth ?? -1) + 1);
    while ((stack[stack.length - 1]?.depth ?? -1) >= depth) stack.pop();
    const parent = (stack[stack.length - 1] as { node: { items?: ListItem[] } }).node;
    const node: { text: Inline; checked?: boolean; items?: ListItem[] } = { text: item.text, ...(item.checked !== undefined ? { checked: item.checked } : {}) };
    (parent.items ??= []).push(node);
    stack.push({ depth, node });
  }
  const simplify = (items: ListItem[]): ListItem[] =>
    items.map((item) => {
      if (typeof item === "string") return item;
      const children = item.items?.length ? simplify(item.items) : undefined;
      if (item.checked === undefined && !children && typeof item.text === "string") return item.text;
      return { text: item.text, ...(item.checked !== undefined ? { checked: item.checked } : {}), ...(children ? { items: children } : {}) };
    });
  return simplify(root.items);
}

const ROMAN: [number, string][] = [
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
];
function markerLabel(marker: string, depth: number, ordinal: number): string {
  if (marker === "number") {
    const level = depth % 3;
    if (level === 0) return `${ordinal}.`;
    if (level === 1) return `${String.fromCharCode(96 + ((ordinal - 1) % 26) + 1)}.`;
    let out = "";
    let rest = ordinal;
    for (const [v, s] of ROMAN) while (rest >= v) (out += s), (rest -= v);
    return `${out}.`;
  }
  return depth % 2 === 1 ? "–" : "•";
}

/**
 * A list edited where it is drawn: one field per item, markers as on the page.
 * Enter adds an item below, Backspace in an empty item removes it, Tab and
 * Shift+Tab nest and unnest, a checkbox toggles a check item.
 */
export function InlineListEditor({ component, doc, tokens, style, onDone }: BlockEditorProps) {
  const { t } = useI18n();
  const c = ((component as { content?: Json }).content ?? {}) as { items: ListItem[] };
  const marker = String(((component as { props?: Json }).props ?? {}).marker ?? "bullet");
  const [items, setItems] = useState<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    flattenItems(c.items, 0, out);
    return out;
  });
  const nextKey = useRef(items.length);
  const handles = useRef(new Map<number, InlineFieldHandle | null>());
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<{ key: number; where: "start" | "end" } | null>(null);
  useEffect(() => {
    handles.current.get(items[0]?.key ?? 0)?.focus("end");
  }, []);
  useEffect(() => {
    if (!pending.current) return;
    const { key, where } = pending.current;
    pending.current = null;
    handles.current.get(key)?.focus(where);
  });

  const base = componentStyle(component, doc, tokens);
  const read = (): FlatItem[] => items.map((item) => ({ ...item, text: handles.current.get(item.key)?.read() ?? item.text }));

  const { onBlur, onKeyDown } = useFinish(onDone, () => {
    const next = nestItems(read().filter((item) => plainText(item.text).trim()));
    return JSON.stringify(next) === JSON.stringify(c.items) ? null : { set: { items: next }, remove: [] };
  });

  const ordinals = (() => {
    const counters: number[] = [];
    return items.map((item) => {
      counters.length = item.depth + 1;
      counters[item.depth] = (counters[item.depth] ?? 0) + 1;
      return counters[item.depth] as number;
    });
  })();

  const update = (next: FlatItem[]) => setItems(next);
  const keys = (index: number) => (e: KeyboardEvent<HTMLDivElement>, state: { empty: boolean; atStart: boolean; atEnd: boolean }): boolean => {
    if (e.ctrlKey || e.metaKey) return false;
    const current = read();
    if (e.key === "Enter") {
      e.preventDefault();
      const item = current[index] as FlatItem;
      const key = nextKey.current++;
      const next = [...current];
      next.splice(index + 1, 0, { text: "", depth: item.depth, key, ...(item.checked !== undefined ? { checked: false } : {}) });
      update(next);
      pending.current = { key, where: "start" };
      return true;
    }
    if (e.key === "Backspace" && state.empty && current.length > 1) {
      e.preventDefault();
      const previous = current[index - 1] ?? current[index + 1];
      update(current.filter((_, i) => i !== index));
      if (previous) pending.current = { key: previous.key, where: "end" };
      return true;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const item = current[index] as FlatItem;
      const maxDepth = (current[index - 1]?.depth ?? -1) + 1;
      const depth = e.shiftKey ? Math.max(0, item.depth - 1) : Math.min(maxDepth, item.depth + 1);
      update(current.map((x, i) => (i === index ? { ...x, depth } : x)));
      return true;
    }
    return false;
  };

  return (
    <div
      ref={root}
      className="df-inline-editor df-inline-block df-inline-list"
      role="group"
      aria-label={t("layout.inline.list")}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      style={{ ...style, ...boxCss(component, doc, tokens), display: "flex", flexDirection: "column", gap: base.gap }}
    >
      {items.map((item, index) => (
        <div key={item.key} className="df-inline-list__item" style={{ paddingLeft: item.depth * 18, ...textCss(base) }}>
          {marker === "check" ? (
            <input
              type="checkbox"
              aria-label={t("layout.inline.checked")}
              checked={!!item.checked}
              onChange={(e) => update(read().map((x, i) => (i === index ? { ...x, checked: e.target.checked } : x)))}
              style={{ accentColor: base.accent }}
            />
          ) : (
            <span className="df-inline-list__marker" aria-hidden style={{ color: marker === "bullet" ? base.accent : base.color }}>
              {markerLabel(marker, item.depth, ordinals[index] as number)}
            </span>
          )}
          <InlineField
            ref={(h) => {
              handles.current.set(item.key, h);
            }}
            aria-label={t("layout.content.items")}
            value={item.text}
            tokens={tokens}
            style={{ flex: 1, minWidth: 0 }}
            onKey={keys(index)}
          />
        </div>
      ))}
      <span className="df-inline-hint">{t("layout.inline.listHint")}</span>
    </div>
  );
}

interface Entry {
  date?: string;
  title: string;
  text?: Inline;
  key: number;
}

/**
 * Steps and timelines edited where they are drawn: a date (timeline), a title and a
 * text per entry. Enter moves on (title → text → next entry, adding one at the end);
 * Backspace in an empty entry removes it.
 */
export function InlineEntriesEditor({ component, doc, tokens, style, onDone }: BlockEditorProps) {
  const { t } = useI18n();
  const timeline = component.type === "timeline";
  const field = timeline ? "events" : "steps";
  const c = ((component as { content?: Json }).content ?? {}) as Record<string, { date?: string; title: string; text?: Inline }[]>;
  const [entries, setEntries] = useState<Entry[]>(() => (c[field] ?? []).map((e, i) => ({ ...e, key: i })));
  const nextKey = useRef(entries.length);
  const texts = useRef(new Map<number, InlineFieldHandle | null>());
  const root = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  useEffect(() => {
    focusField(fields(root.current)[0]);
  }, []);
  useEffect(() => {
    if (!pending.current) return;
    const marked = root.current?.querySelector<HTMLElement>(`[data-field="${pending.current}"]`);
    pending.current = null;
    const target = marked?.matches("input, [contenteditable]") ? marked : marked?.querySelector<HTMLElement>("input, [contenteditable]");
    focusField(target ?? undefined, "end");
  });

  const base = componentStyle(component, doc, tokens);
  const titleStyle = textCss(componentStyle(component, doc, tokens, "title"));
  const dateStyle = timeline ? textCss(componentStyle(component, doc, tokens, "date")) : undefined;
  const read = (): Entry[] => entries.map((e) => ({ ...e, text: texts.current.get(e.key)?.read() ?? e.text }));

  const { onBlur, onKeyDown } = useFinish(onDone, () => {
    const next = read()
      .filter((e) => e.title.trim() || (e.text !== undefined && plainText(e.text).trim()))
      .map((e) => ({
        ...(timeline ? { date: (e.date ?? "").trim() } : {}),
        title: e.title.trim(),
        ...(e.text !== undefined && plainText(e.text).trim() ? { text: e.text } : {}),
      }));
    return JSON.stringify(next) === JSON.stringify(c[field]) ? null : { set: { [field]: next }, remove: [] };
  });

  const add = (after: number) => {
    const key = nextKey.current++;
    const next = [...read()];
    next.splice(after + 1, 0, { ...(timeline ? { date: "" } : {}), title: "", key });
    setEntries(next);
    pending.current = `${key}:${timeline ? "date" : "title"}`;
  };
  const remove = (index: number) => {
    const current = read();
    if (current.length <= 1) return;
    const previous = current[index - 1] ?? current[index + 1];
    setEntries(current.filter((_, i) => i !== index));
    if (previous) pending.current = `${previous.key}:text`;
  };
  const isEmpty = (e: Entry) => !e.title.trim() && !(e.date ?? "").trim() && !(e.text !== undefined && plainText(e.text).trim());

  const inputKeys = (index: number, next: string) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      pending.current = `${(entries[index] as Entry).key}:${next}`;
      setEntries(read());
    } else if (e.key === "Backspace" && e.currentTarget.value === "" && isEmpty(read()[index] as Entry)) {
      e.preventDefault();
      remove(index);
    }
  };
  const textKeys = (index: number) => (e: KeyboardEvent<HTMLDivElement>, state: { empty: boolean }): boolean => {
    if (e.ctrlKey || e.metaKey) return false;
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === entries.length - 1) add(index);
      else {
        pending.current = `${(entries[index + 1] as Entry).key}:${timeline ? "date" : "title"}`;
        setEntries(read());
      }
      return true;
    }
    if (e.key === "Backspace" && state.empty && isEmpty(read()[index] as Entry)) {
      e.preventDefault();
      remove(index);
      return true;
    }
    return false;
  };

  return (
    <div
      ref={root}
      className={`df-inline-editor df-inline-block df-inline-entries${timeline ? " df-inline-entries--timeline" : ""}`}
      role="group"
      aria-label={t(timeline ? "layout.inline.timeline" : "layout.inline.steps")}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      style={{ ...style, ...boxCss(component, doc, tokens), display: "flex", flexDirection: "column", gap: base.gap }}
    >
      {entries.map((entry, index) => (
        <div key={entry.key} className="df-inline-entry">
          {timeline ? (
            <input
              aria-label={t("layout.content.date")}
              placeholder={t("layout.content.date")}
              data-field={`${entry.key}:date`}
              value={entry.date ?? ""}
              onChange={(e) => setEntries(read().map((x, i) => (i === index ? { ...x, date: e.target.value } : x)))}
              onKeyDown={inputKeys(index, "title")}
              style={{ ...dateStyle, width: 80, flexShrink: 0 }}
            />
          ) : (
            <span className="df-inline-entry__badge" aria-hidden style={{ background: base.accent, width: Math.round(base.fontSize * 1.7), height: Math.round(base.fontSize * 1.7), fontSize: Math.round(base.fontSize * 0.85) }}>
              {index + 1}
            </span>
          )}
          <div className="df-inline-entry__body">
            <input
              aria-label={t("layout.content.title")}
              placeholder={t("layout.content.title")}
              data-field={`${entry.key}:title`}
              value={entry.title}
              onChange={(e) => setEntries(read().map((x, i) => (i === index ? { ...x, title: e.target.value } : x)))}
              onKeyDown={inputKeys(index, "text")}
              style={titleStyle}
            />
            <div data-field={`${entry.key}:text`}>
              <InlineField
                ref={(h) => {
                  texts.current.set(entry.key, h);
                }}
                aria-label={t("layout.content.text")}
                placeholder={t("layout.content.text")}
                value={entry.text ?? ""}
                tokens={tokens}
                style={textCss(base)}
                className="df-inline-entry__text"
                onKey={textKeys(index)}
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="df-inline-add" onClick={() => add(entries.length - 1)}>
        + {t(timeline ? "layout.content.addEvent" : "layout.content.addStep")}
      </button>
    </div>
  );
}

/** A code block edited where it is drawn: a monospaced area; Tab indents two spaces. */
export function InlineCodeEditor({ component, doc, tokens, style, onDone }: BlockEditorProps) {
  const { t } = useI18n();
  const c = ((component as { content?: Json }).content ?? {}) as { code: string; language?: string };
  const [code, setCode] = useState(c.code);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    area.current?.focus();
  }, []);
  const base = componentStyle(component, doc, tokens);
  const { onBlur, onKeyDown } = useFinish(onDone, () => (code === c.code ? null : { set: { code }, remove: [] }));
  return (
    <div
      className="df-inline-editor df-inline-block df-inline-code"
      role="group"
      aria-label={t("layout.inline.code")}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      style={{ ...style, ...boxCss(component, doc, tokens) }}
    >
      <textarea
        ref={area}
        aria-label={t("layout.content.code")}
        value={code}
        spellCheck={false}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const el = e.currentTarget;
            const { selectionStart, selectionEnd } = el;
            const next = `${code.slice(0, selectionStart)}  ${code.slice(selectionEnd)}`;
            setCode(next);
            requestAnimationFrame(() => el.setSelectionRange(selectionStart + 2, selectionStart + 2));
          }
        }}
        style={{ ...textCss(base), fontFamily: `${base.fontFamily}, monospace`, whiteSpace: "pre", minHeight: Number(style.minHeight ?? 0) - base.padding * 2 }}
      />
    </div>
  );
}
