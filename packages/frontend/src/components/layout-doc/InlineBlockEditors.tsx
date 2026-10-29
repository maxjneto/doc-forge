import { useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent } from "react";
import type { Component, ComponentGeometry, LayoutDocument, Tokens } from "@docforge-lib/layout";
import { useI18n } from "@/i18n";
import { canEditInline } from "./InlineTextEditor";
import { componentStyle, textCss } from "./inlineStyle";

type Json = Record<string, unknown>;

/** Which in-place editor a component gets, if any (explicit runs and odd shapes stay in the panel). */
export function inlineKind(component: Component): "text" | "kpi" | "table" | null {
  const c = ((component as { content?: Json }).content ?? {}) as Json;
  if (component.type === "text") return canEditInline(component) ? "text" : null;
  if (component.type === "kpi") return ["value", "label"].every((k) => typeof c[k] === "string") && (c.delta === undefined || typeof c.delta === "string") ? "kpi" : null;
  if (component.type === "table") {
    const columns = (c.columns as unknown[]) ?? [];
    const rows = (c.rows as unknown[][]) ?? [];
    const plainHeader = (col: unknown) => typeof col === "string" || (col !== null && typeof col === "object" && typeof (col as Json).header === "string");
    const plainCell = (cell: unknown) => cell === undefined || typeof cell === "string" || typeof cell === "number";
    return columns.every(plainHeader) && rows.every((row) => Array.isArray(row) && row.every(plainCell)) ? "table" : null;
  }
  return null;
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
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) finish(true);
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
      onPointerDown={(e) => e.stopPropagation()}
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

/**
 * A table edited where it is drawn: header and cells as fields laid out with the
 * table's own column weights and cell padding. Tab moves along, Enter moves down,
 * "+ row" adds one; leaving saves only what changed.
 */
export function InlineTableEditor({ component, doc, tokens, style, onDone }: BlockEditorProps) {
  const { t } = useI18n();
  const c = ((component as { content?: Json }).content ?? {}) as { columns: (string | { header: string; width?: number; align?: string })[]; rows: (string | number)[][] };
  const props = ((component as { props?: Json }).props ?? {}) as { header?: boolean; zebra?: boolean };
  const headersOf = () => c.columns.map((col) => (typeof col === "string" ? col : col.header));
  const [headers, setHeaders] = useState(headersOf);
  const [rows, setRows] = useState(() => c.rows.map((row) => c.columns.map((_, i) => (row[i] === undefined ? "" : String(row[i])))));
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = root.current?.querySelector<HTMLInputElement>(props.header === false ? "tbody input" : "input");
    target?.focus();
    target?.select();
  }, [props.header]);

  const cell = componentStyle(component, doc, tokens);
  const head = componentStyle(component, doc, tokens, "header");
  const weights = c.columns.map((col) => (typeof col === "string" ? 1 : (col.width ?? 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  const pad = (s: typeof cell) => `${Math.round(s.gap * 0.75)}px ${s.gap}px`;
  const align = (i: number) => {
    const col = c.columns[i];
    return (typeof col === "string" ? "left" : (col?.align ?? "left")) as CSSProperties["textAlign"];
  };

  const { onBlur, onKeyDown } = useFinish(onDone, () => {
    const set: Json = {};
    headers.forEach((h, i) => {
      const col = c.columns[i];
      if (h !== headersOf()[i]) set[typeof col === "string" ? `columns.${i}` : `columns.${i}.header`] = h;
    });
    rows.forEach((row, r) => {
      const old = c.rows[r];
      if (!old) {
        if (row.some((v) => v.trim())) set[`rows.${r}`] = row;
        return;
      }
      row.forEach((v, i) => {
        if (v !== (old[i] === undefined ? "" : String(old[i]))) set[`rows.${r}.${i}`] = v;
      });
    });
    return Object.keys(set).length ? { set, remove: [] } : null;
  });

  const down = (e: KeyboardEvent<HTMLInputElement>, r: number, i: number) => {
    if (e.key !== "Enter" || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    root.current?.querySelector<HTMLInputElement>(`[data-cell="${r + 1}:${i}"]`)?.focus();
  };

  return (
    <div
      ref={root}
      className="df-inline-editor df-inline-block"
      role="group"
      aria-label={t("layout.inline.table")}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.stopPropagation()}
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
              {headers.map((h, i) => (
                <th key={i} style={{ padding: pad(head), borderBottom: `1px solid ${cell.borderColor}` }}>
                  <input
                    aria-label={t("layout.content.header", { n: i + 1 })}
                    value={h}
                    data-cell={`-1:${i}`}
                    onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => down(e, -1, i)}
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
                    onKeyDown={(e) => down(e, r, i)}
                    style={{ ...textCss(cell), textAlign: align(i) }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        className="df-inline-add"
        onClick={() => {
          setRows([...rows, headers.map(() => "")]);
          requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement>(`[data-cell="${rows.length}:0"]`)?.focus());
        }}
      >
        + {t("layout.content.addRow")}
      </button>
    </div>
  );
}
