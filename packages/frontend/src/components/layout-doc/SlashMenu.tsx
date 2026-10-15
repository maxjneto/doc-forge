import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "@/i18n";
import { INSERT_ICON, INSERT_KEYS, type InsertKey } from "./defaults";

export interface SlashMenuHandle {
  move: (dir: 1 | -1) => void;
  /** Pick the highlighted item; false when nothing matches. */
  pick: () => boolean;
}

interface SlashMenuProps {
  /** What was typed after "/" (filters by name, accents and case ignored). */
  query: string;
  /** Given when the menu owns its own search field (opened from the page, not from a text). */
  onQuery?: (query: string) => void;
  onPick: (key: InsertKey) => void;
  onClose: () => void;
  style: CSSProperties;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * "/" to insert a block below: every type, plus a row of indicators and a text with
 * a chart. Typing filters; arrows and Enter pick. Mouse-down never steals focus, so
 * a text being edited stays open until a choice is made.
 */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu({ query, onQuery, onPick, onClose, style }, ref) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const items = useMemo(() => {
    const q = fold(query.trim());
    return INSERT_KEYS.filter((key) => !q || fold(t(`layout.insert.${key}`)).includes(q) || fold(t(`layout.insert.${key}.hint`)).includes(q) || key.includes(q));
  }, [query, t]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (onQuery) input.current?.focus();
  }, [onQuery]);

  const move = (dir: 1 | -1) => setActive((i) => (items.length ? (i + dir + items.length) % items.length : 0));
  const pick = () => {
    const key = items[active];
    if (!key) return false;
    onPick(key);
    return true;
  };
  useImperativeHandle(ref, () => ({ move, pick }));

  return (
    <div className="df-slash" role="listbox" aria-label={t("layout.insert.title")} style={style} onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => e.stopPropagation()}>
      {onQuery ? (
        <input
          ref={input}
          className="df-slash__search"
          aria-label={t("layout.insert.search")}
          placeholder={t("layout.insert.search")}
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          onBlur={onClose}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              move(e.key === "ArrowDown" ? 1 : -1);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
      ) : (
        <span className="df-slash__title">{t("layout.insert.title")}</span>
      )}
      {items.length === 0 && <span className="df-slash__empty">{t("layout.insert.none")}</span>}
      {items.map((key, i) => (
        <button key={key} type="button" role="option" aria-selected={i === active} className="df-slash__item" onMouseEnter={() => setActive(i)} onClick={() => onPick(key)}>
          <span className="material-symbols-outlined" aria-hidden>
            {INSERT_ICON[key]}
          </span>
          <span className="df-slash__name">{t(`layout.insert.${key}`)}</span>
          <span className="df-slash__hint">{t(`layout.insert.${key}.hint`)}</span>
        </button>
      ))}
    </div>
  );
});
