import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { IconButton, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";

export interface SideTab<T extends string> {
  id: T;
  icon: string;
  /** The panel's title. */
  label: string;
  /** Under the icon in the rail. */
  short: string;
  /** Something waiting there (heat badge). */
  badge?: number;
  /** A softer mark: a draft or an unsaved state, named for screen readers. */
  dot?: string;
}

interface DocumentSidebarProps<T extends string> {
  tabs: SideTab<T>[];
  active: T;
  open: boolean;
  onSelect: (tab: T) => void;
  onClose: () => void;
  /**
   * The panel's own layout: `padded` (a column of sections, scrolled here) or
   * `flush` (the panel owns its padding and scrolling, e.g. a list with a footer).
   */
  body?: "padded" | "flush";
  children: ReactNode;
}

const WIDTH_KEY = "docforge.sidePanelWidth";
export const PANEL_WIDTH = { min: 340, max: 560, initial: 340 };

function storedWidth(): number {
  try {
    const n = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(n) && n >= PANEL_WIDTH.min && n <= PANEL_WIDTH.max ? n : PANEL_WIDTH.initial;
  } catch {
    return PANEL_WIDTH.initial;
  }
}

/**
 * The right side of every document: an icon rail and the panel it opens. Picking
 * the open tab again closes the panel, so the page can have the room. The panel's
 * left edge drags to make it wider (kept per browser).
 */
export function DocumentSidebar<T extends string>({ tabs, active, open, onSelect, onClose, body = "padded", children }: DocumentSidebarProps<T>) {
  const { t } = useI18n();
  const current = tabs.find((tab) => tab.id === active);
  const [width, setWidth] = useState(storedWidth);
  const drag = useRef<{ x: number; width: number } | null>(null);

  const onGripDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      drag.current = { x: e.clientX, width };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );
  const onGripMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setWidth(Math.round(Math.max(PANEL_WIDTH.min, Math.min(PANEL_WIDTH.max, drag.current.width + (drag.current.x - e.clientX)))));
  };
  const onGripUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    try {
      localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      // Not remembered: the panel still resizes for this session.
    }
  };

  return (
    <>
      {open && (
        <aside aria-label={current?.label} className="df-side-panel" style={{ width }}>
          <div
            className="df-side-panel__grip"
            role="separator"
            aria-orientation="vertical"
            aria-label={t("layout.side.resize")}
            aria-valuenow={width}
            aria-valuemin={PANEL_WIDTH.min}
            aria-valuemax={PANEL_WIDTH.max}
            tabIndex={0}
            onPointerDown={onGripDown}
            onPointerMove={onGripMove}
            onPointerUp={onGripUp}
            onPointerCancel={onGripUp}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const next = Math.max(PANEL_WIDTH.min, Math.min(PANEL_WIDTH.max, width + (e.key === "ArrowLeft" ? 20 : -20)));
              setWidth(next);
              try {
                localStorage.setItem(WIDTH_KEY, String(next));
              } catch {
                // see above
              }
            }}
          />
          <header className="df-side-panel__head">
            <span style={{ ...textStyle.group, color: "var(--color-text)" }}>{current?.label}</span>
            <IconButton icon="right_panel_close" label={t("layout.side.hide")} onClick={onClose} />
          </header>
          <div className={body === "flush" ? "df-side-panel__body df-side-panel__body--flush ph-sensitive" : "df-side-panel__body ph-sensitive"}>{children}</div>
        </aside>
      )}
      <nav className="df-side-rail" aria-label={t("doc.panels")}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="df-side-rail__item"
            aria-pressed={active === tab.id && open}
            title={tab.label}
            onClick={() => (active === tab.id && open ? onClose() : onSelect(tab.id))}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {tab.icon}
            </span>
            <span className="df-side-rail__label">{tab.short}</span>
            {(tab.badge ?? 0) > 0 && <span className="df-side-rail__badge">{tab.badge}</span>}
            {tab.dot && <span className="df-side-rail__dot" aria-label={tab.dot} />}
          </button>
        ))}
      </nav>
    </>
  );
}
