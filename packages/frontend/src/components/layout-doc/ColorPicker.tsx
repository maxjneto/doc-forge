import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { SUGGESTED_COLORS } from "./themes";

const HEX = /^#[0-9a-f]{6}$/i;
const normal = (v: string) => (HEX.test(v) ? v.toLowerCase() : v);

/**
 * A popover anchored to an element, drawn in a portal so a scrolling panel never
 * clips it. Closes on Escape and on a click outside.
 */
export function Popover({ anchor, onClose, children, width = 260 }: { anchor: HTMLElement | null; onClose: () => void; children: ReactNode; width?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    const place = () => {
      if (!anchor || !box.current) return;
      const r = anchor.getBoundingClientRect();
      const h = box.current.offsetHeight;
      const below = r.bottom + 6 + h <= window.innerHeight;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.left));
      setPos({ left, top: below ? r.bottom + 6 : Math.max(8, r.top - 6 - h), visibility: "visible" });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, width]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (box.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div ref={box} role="dialog" className="df-popover" style={{ ...pos, width }}>
      {children}
    </div>,
    document.body,
  );
}

interface ColorPickerProps {
  /** The color now (#rrggbb). */
  value: string;
  /** Called once, with the chosen color, when the person confirms. */
  onApply: (color: string) => void;
  onClose: () => void;
  anchor: HTMLElement | null;
  /** Named colors to offer first (the document's own), as {label, color}. */
  named?: { key: string; label: string; color: string }[];
  /** Pick a named color as a reference instead of its value (style editor: `$color.primary`). */
  onApplyNamed?: (key: string) => void;
  title?: string;
}

/**
 * Choose a color without touching the document until "Apply": dragging in the
 * picker only changes the preview here, so the page never re-renders (or saves)
 * on every move of the mouse.
 */
export function ColorPicker({ value, onApply, onClose, anchor, named, onApplyNamed, title }: ColorPickerProps) {
  const { t } = useI18n();
  const start = HEX.test(value) ? value.toLowerCase() : (SUGGESTED_COLORS[0] as string);
  const [draft, setDraft] = useState(start);
  const [hex, setHex] = useState(start);
  const changed = normal(draft) !== start;
  const set = (v: string) => {
    setDraft(v);
    setHex(v);
  };
  const apply = () => {
    if (changed) onApply(normal(draft));
    onClose();
  };

  return (
    <Popover anchor={anchor} onClose={onClose}>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") {
            e.preventDefault();
            apply();
          }
        }}
      >
        {title && <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{title}</span>}
        <div className="df-color-compare" aria-hidden>
          <span style={{ background: start }}>{t("layout.color.before")}</span>
          <span style={{ background: draft }}>{t("layout.color.after")}</span>
        </div>
        <label className="df-color-native">
          <input type="color" aria-label={t("layout.style.pickColor")} value={draft} onChange={(e) => set(e.target.value)} />
          <span style={{ ...textStyle.caption, color: "var(--color-dim)" }}>{t("layout.color.drag")}</span>
        </label>
        {named && named.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.color.document")}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {named.map((n) => (
                <button
                  key={n.key}
                  type="button"
                  className="df-swatch"
                  title={n.label}
                  aria-label={n.label}
                  aria-pressed={normal(draft) === normal(n.color)}
                  style={{ background: n.color }}
                  onClick={() => {
                    if (onApplyNamed) {
                      onApplyNamed(n.key);
                      onClose();
                    } else set(normal(n.color));
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.color.suggested")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {SUGGESTED_COLORS.map((c) => (
              <button key={c} type="button" className="df-swatch" aria-label={c} title={c} aria-pressed={normal(draft) === c} style={{ background: c }} onClick={() => set(c)} />
            ))}
          </div>
        </div>
        <input
          className="df-input df-mono"
          aria-label={t("layout.color.hex")}
          value={hex}
          maxLength={7}
          onChange={(e) => {
            const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            setHex(v);
            if (HEX.test(v)) setDraft(v.toLowerCase());
          }}
          style={{ padding: "4px 8px" }}
        />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" disabled={!changed} onClick={apply}>
            {t("layout.color.apply")}
          </Button>
        </div>
      </div>
    </Popover>
  );
}

/** A swatch that opens the picker; the label beside it names the color's role. */
export function ColorField({
  value,
  label,
  onApply,
  named,
  changed,
  disabled,
}: {
  value: string;
  label: string;
  onApply: (color: string) => void;
  named?: ColorPickerProps["named"];
  /** Shown as modified (differs from the theme or the saved document). */
  changed?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={button} type="button" className="df-color-field" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)} title={value}>
        <span className="df-color-field__swatch" style={{ background: value }} aria-hidden />
        <span className="df-color-field__label" data-changed={changed || undefined}>
          {label}
        </span>
        <span className="df-color-field__hex df-mono">{value}</span>
      </button>
      {open && <ColorPicker anchor={button.current} value={value} title={label} named={named} onApply={onApply} onClose={() => setOpen(false)} />}
    </>
  );
}
