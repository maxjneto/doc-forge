import type { CSSProperties, PointerEvent } from "react";
import type { ApplyResult, LayoutDocument, LayoutResult } from "@docforge/layout";
import { useI18n } from "@/i18n";
import { TYPE_ICON } from "./defaults";
import { guideSpan, isAlignedRow, rowRebuildOp, rowsOf } from "./names";
import { track } from "./track";

interface SelectionBarProps {
  id: string;
  doc: LayoutDocument;
  layout: LayoutResult;
  commit: (ops: unknown[]) => ApplyResult;
  onOpenContent: () => void;
  onRemoved: () => void;
  announce: (message: string) => void;
  style: CSSProperties;
}

/** Fractions of the guide columns offered as widths, by how many of 12 they take. */
const WIDTHS: { label: string; of12: number }[] = [
  { label: "¼", of12: 3 },
  { label: "⅓", of12: 4 },
  { label: "½", of12: 6 },
  { label: "⅔", of12: 8 },
  { label: "¾", of12: 9 },
];

/**
 * What people do most to a selected block, next to it: its width in fractions of the
 * page, its place in the row it belongs to, and the row's widths and heights. Every
 * button sends the same ops an agent would (`place` with `cols`, `row`).
 */
export function SelectionBar({ id, doc, layout, commit, onOpenContent, onRemoved, announce, style }: SelectionBarProps) {
  const { t } = useI18n();
  const g = layout.components[id];
  const component = doc.components.find((c) => c.id === id);
  if (!g || !component) return null;
  const total = layout.guides.length;
  const span = guideSpan(g.declared, layout);
  const current = span ? span.last - span.first + 1 : null;

  const setWidth = (cols: number) => {
    const startGuide = span?.first ?? [...layout.guides].reverse().find((gd) => gd.x <= g.declared.x)?.col ?? 1;
    let first = startGuide;
    let last = first + cols - 1;
    if (last > total) {
      first = total - cols + 1;
      last = total;
    }
    const result = commit([{ op: "place", component: id, at: { cols: [first, last] } }]);
    if (!result.ok) announce(t("layout.editor.refused"));
    else track("layout_width_set", { cols, type: component.type });
  };

  // The row this block sits in, and how to rebuild it with the `row` op.
  const row = rowsOf(layout).find((r) => r.ids.includes(id));
  const rowItems = row && isAlignedRow(layout, row.ids) ? row.ids : null;
  const rebuildRow = (order: string[], extra: Record<string, unknown> = {}) => {
    const op = rowRebuildOp(layout, order, extra);
    if (!op) return;
    const result = commit([op]);
    if (!result.ok) announce(t("layout.editor.refused"));
    else track("layout_row_rebuilt", { via: "bar", action: extra.align ? "same-height" : extra.widths ? "equal-widths" : "reorder" });
  };
  const move = (dir: -1 | 1) => {
    if (!rowItems) return;
    const i = rowItems.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= rowItems.length) return;
    const order = [...rowItems];
    [order[i], order[j]] = [order[j] as string, order[i] as string];
    rebuildRow(order);
  };

  const stop = (e: PointerEvent) => e.stopPropagation();
  const index = rowItems ? rowItems.indexOf(id) : -1;

  return (
    <div role="toolbar" aria-label={t("layout.bar.label")} className="df-layout-bar" style={style} onPointerDown={stop} onDoubleClick={(e) => e.stopPropagation()}>
      <span className="df-layout-bar__group">
        <span className="df-layout-bar__item df-layout-bar__item--static">
          <span className="material-symbols-outlined" aria-hidden>
            {TYPE_ICON[component.type]}
          </span>
          {t(`layout.type.${component.type}`)}
        </span>
      </span>
      {total === 12 && (
        <span className="df-layout-bar__group" role="group" aria-label={t("layout.bar.width")}>
          {WIDTHS.map((w) => (
            <button key={w.of12} type="button" className="df-layout-bar__item" aria-pressed={current === w.of12} title={t("layout.width.fraction", { f: w.label })} onClick={() => setWidth(w.of12)}>
              {w.label}
            </button>
          ))}
          <button type="button" className="df-layout-bar__item" aria-pressed={current === total} title={t("layout.width.full")} onClick={() => setWidth(total)}>
            <span className="material-symbols-outlined" aria-hidden>
              width_full
            </span>
          </button>
        </span>
      )}
      {rowItems && (
        <span className="df-layout-bar__group" role="group" aria-label={t("layout.structure.row", { count: rowItems.length })}>
          <button type="button" className="df-layout-bar__item" disabled={index <= 0} title={t("layout.bar.moveLeft")} aria-label={t("layout.bar.moveLeft")} onClick={() => move(-1)}>
            <span className="material-symbols-outlined" aria-hidden>
              arrow_back
            </span>
          </button>
          <button type="button" className="df-layout-bar__item" disabled={index >= rowItems.length - 1} title={t("layout.bar.moveRight")} aria-label={t("layout.bar.moveRight")} onClick={() => move(1)}>
            <span className="material-symbols-outlined" aria-hidden>
              arrow_forward
            </span>
          </button>
          <button type="button" className="df-layout-bar__item" title={t("layout.bar.distribute")} aria-label={t("layout.bar.distribute")} onClick={() => rebuildRow(rowItems, { widths: rowItems.map(() => 1) })}>
            <span className="material-symbols-outlined" aria-hidden>
              view_column
            </span>
          </button>
          <button type="button" className="df-layout-bar__item" title={t("layout.bar.equalHeights")} aria-label={t("layout.bar.equalHeights")} onClick={() => rebuildRow(rowItems, { align: "stretch" })}>
            <span className="material-symbols-outlined" aria-hidden>
              height
            </span>
          </button>
        </span>
      )}
      <span className="df-layout-bar__group">
        <button type="button" className="df-layout-bar__item" title={t("layout.bar.content")} aria-label={t("layout.bar.content")} onClick={onOpenContent}>
          <span className="material-symbols-outlined" aria-hidden>
            edit
          </span>
        </button>
        <button
          type="button"
          className="df-layout-bar__item"
          title={t("layout.bar.remove")}
          aria-label={t("layout.bar.remove")}
          onClick={() => {
            if (commit([{ op: "remove", component: id }]).ok) {
              announce(t("layout.editor.announceRemoved", { id: component.id }));
              onRemoved();
            }
          }}
        >
          <span className="material-symbols-outlined" aria-hidden>
            delete
          </span>
        </button>
      </span>
    </div>
  );
}
