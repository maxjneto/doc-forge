import { useEffect, useState, type CSSProperties, type ReactNode, type TextareaHTMLAttributes } from "react";
import { IconButton, textStyle } from "@/components/ui";

/** A label above its control, with an optional hint under it. */
export function Field({ label, hint, children, style }: { label: string; hint?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, ...style }}>
      <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{label}</span>
      {children}
      {hint && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{hint}</span>}
    </label>
  );
}

export function TextArea({ rows = 3, mono, style, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  return <textarea {...rest} rows={rows} className={`df-input${mono ? " df-mono" : ""}`} style={{ resize: "vertical", minHeight: 0, ...style }} />;
}

export function Select({
  value,
  onChange,
  options,
  label,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <select className="df-input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "4px 8px", ...style }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: CSSProperties }) {
  return <div style={{ display: "flex", gap, alignItems: "flex-end", minWidth: 0, ...style }}>{children}</div>;
}

/** Up / down / remove for one item of a repeated list. */
export function ItemActions({
  index,
  count,
  onMove,
  onRemove,
  labels,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  labels: { up: string; down: string; remove: string };
}) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      <IconButton icon="arrow_upward" label={labels.up} disabled={index === 0} onClick={() => onMove(index, index - 1)} />
      <IconButton icon="arrow_downward" label={labels.down} disabled={index === count - 1} onClick={() => onMove(index, index + 1)} />
      <IconButton icon="close" label={labels.remove} disabled={count <= 1} onClick={() => onRemove(index)} />
    </div>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 28, paddingTop: 4 }}>
      <span style={{ ...textStyle.group, color: "var(--color-text)" }}>{children}</span>
      {action}
    </div>
  );
}

/**
 * A number that is written when the person is done typing (Enter or leaving the
 * field), not on every keystroke: each write re-renders the page and saves.
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  step,
  label,
  style,
  disabled,
}: {
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text.replace(",", "."));
    if (!Number.isFinite(n) || text.trim() === "") return setText(String(value));
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <input
      className="df-input"
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") setText(String(value));
      }}
      style={{ padding: "4px 8px", ...style }}
    />
  );
}
