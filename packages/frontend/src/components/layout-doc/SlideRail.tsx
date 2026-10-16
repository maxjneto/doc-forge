import { useMemo, useState } from "react";
import { renderPageSvg, type ApplyResult, type Engine, type LayoutDocument, type LayoutResult } from "@docforge-lib/layout";
import { IconButton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { newComponentId } from "./defaults";
import { track } from "./track";

/** The ops that add a slide after `after` (0 = first) with a title on it, so the new slide exists and is ready to type in. */
export function newSlideOps(doc: LayoutDocument, layout: LayoutResult, after: number, title: string): { ops: unknown[]; id: string } {
  const id = newComponentId(doc, "text");
  return {
    id,
    ops: [
      { op: "page", action: "insert", page: after },
      { op: "add", component: { id, type: "text", content: { paragraphs: [{ role: "title-1", text: title }] } }, at: { page: after + 1, x: 0, y: 0, w: layout.units.cols } },
    ],
  };
}

/**
 * A deck's slides as thumbnails, like a presentation app: click to go to one, drag
 * to reorder, and add, duplicate or remove slides (each one `page` op, undoable).
 * Thumbnails are the library's own SVG of each page.
 */
export function SlideRail({
  engine,
  doc,
  layout,
  current,
  onGo,
  commit,
  editable,
  onAdded,
}: {
  engine: Engine;
  doc: LayoutDocument;
  layout: LayoutResult;
  current: number;
  onGo: (page: number) => void;
  commit: (ops: unknown[]) => ApplyResult;
  editable: boolean;
  onAdded: (id: string, page: number) => void;
}) {
  const { t } = useI18n();
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const thumbs = useMemo(
    () =>
      layout.pages.map((_, i) => {
        try {
          return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderPageSvg(layout, engine.registry, i + 1))}`;
        } catch {
          return "";
        }
      }),
    [layout, engine],
  );
  const page = layout.pages[0];
  const ratio = page ? page.width / page.height : 16 / 9;

  const act = (ops: unknown[], what: string) => {
    if (commit(ops).ok) track("layout_slide_changed", { action: what, slides: layout.pages.length });
  };
  const add = (after: number) => {
    const { ops, id } = newSlideOps(doc, layout, after, t("layout.slides.newTitle"));
    if (commit(ops).ok) {
      track("layout_slide_changed", { action: "insert", slides: layout.pages.length + 1 });
      onAdded(id, after + 1);
    }
  };

  return (
    <nav className="df-slide-rail" aria-label={t("layout.slides.rail")}>
      <ol>
        {thumbs.map((src, i) => {
          const n = i + 1;
          return (
            <li
              key={n}
              className="df-slide"
              data-current={current === n || undefined}
              data-drop={dropAt === n || undefined}
              draggable={editable}
              onDragStart={(e) => {
                setDragFrom(n);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDropAt(n);
              }}
              onDragLeave={() => setDropAt((d) => (d === n ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom !== null && dragFrom !== n) act([{ op: "page", action: "move", page: dragFrom, to: n }], "move");
                setDragFrom(null);
                setDropAt(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropAt(null);
              }}
            >
              <span className="df-slide__number">{n}</span>
              <button type="button" className="df-slide__thumb" aria-current={current === n ? "page" : undefined} aria-label={t("layout.slides.go", { n })} onClick={() => onGo(n)} style={{ aspectRatio: String(ratio) }}>
                {src && <img src={src} alt="" draggable={false} />}
              </button>
              {editable && (
                <span className="df-slide__actions">
                  <IconButton icon="content_copy" label={t("layout.slides.duplicate")} onClick={() => act([{ op: "page", action: "duplicate", page: n }], "duplicate")} />
                  <IconButton icon="delete" label={t("layout.slides.remove")} disabled={layout.pages.length <= 1} onClick={() => act([{ op: "page", action: "remove", page: n }], "remove")} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {editable && (
        <button type="button" className="df-slide-rail__add" onClick={() => add(Math.max(current, 0))}>
          <span className="material-symbols-outlined" aria-hidden>
            add
          </span>
          {t("layout.slides.add")}
        </button>
      )}
    </nav>
  );
}
