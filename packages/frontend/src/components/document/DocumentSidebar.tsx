import type { ReactNode } from "react";
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

/**
 * The right side of every document: an icon rail and the panel it opens. Picking
 * the open tab again closes the panel, so the page can have the room.
 */
export function DocumentSidebar<T extends string>({ tabs, active, open, onSelect, onClose, body = "padded", children }: DocumentSidebarProps<T>) {
  const { t } = useI18n();
  const current = tabs.find((tab) => tab.id === active);
  return (
    <>
      {open && (
        <aside aria-label={current?.label} className="df-side-panel">
          <header className="df-side-panel__head">
            <span style={{ ...textStyle.group, color: "var(--color-text)" }}>{current?.label}</span>
            <IconButton icon="right_panel_close" label={t("layout.side.hide")} onClick={onClose} />
          </header>
          <div className={body === "flush" ? "df-side-panel__body df-side-panel__body--flush" : "df-side-panel__body"}>{children}</div>
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
