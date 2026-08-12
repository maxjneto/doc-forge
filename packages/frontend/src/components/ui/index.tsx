/**
 * The five primitives that repeat across every screen: Pill, Button, Card,
 * Input, Tab.
 *
 * They exist because each component used to decide its own radius and type
 * scale — `DocTableRow` alone used radius 3, 4, 6 and 999 on a single row,
 * which is the real source of the "it doesn't quite line up" feeling.
 * Everything here draws from the ramp in index.css; nothing hardcodes colour.
 *
 * See docs/product/design-system-consolidation.md §2.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, CSSProperties } from "react";

// ─── Pill ─────────────────────────────────────────────────────────

export type PillTone = "heat" | "steel" | "ghost" | "warn" | "error" | "ok";

interface PillProps {
  tone?: PillTone;
  /** Leading status dot. On by default for heat/steel, off elsewhere. */
  dot?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

const PILL_TONE: Record<PillTone, { color: string; border: string; background: string; dot: string }> = {
  heat: {
    color: "var(--df-amber-300)",
    border: "var(--color-heat-border)",
    background: "var(--color-heat-bg)",
    dot: "var(--df-amber-500)",
  },
  steel: {
    color: "var(--df-steel-100)",
    border: "var(--df-steel-border)",
    background: "var(--df-steel-bg)",
    dot: "var(--df-steel-200)",
  },
  ghost: {
    color: "var(--df-faint)",
    border: "var(--df-outline-md)",
    background: "transparent",
    dot: "var(--df-faint)",
  },
  warn: {
    color: "var(--df-warn)",
    border: "var(--color-warn-border)",
    background: "var(--color-warn-bg)",
    dot: "var(--df-warn)",
  },
  error: {
    color: "var(--df-error)",
    border: "var(--color-error-border)",
    background: "var(--df-error-bg)",
    dot: "var(--df-error)",
  },
  ok: {
    color: "var(--df-ok)",
    border: "var(--color-ok-border)",
    background: "var(--color-diff-add-bg)",
    dot: "var(--df-ok)",
  },
};

/** Status chip — `label` type, pill radius. The mock's `IN REVIEW · V5 DRAFT`. */
export function Pill({ tone = "ghost", dot, children, style }: PillProps) {
  const t = PILL_TONE[tone];
  const showDot = dot ?? (tone === "heat" || tone === "steel");
  return (
    <span
      className="df-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        lineHeight: 1,
        padding: "4px 10px",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${t.border}`,
        background: t.background,
        color: t.color,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {showDot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "var(--radius-pill)",
            background: t.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
}

// ─── Button ───────────────────────────────────────────────────────

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Stretch to fill the row — the mock's `Aceitar` next to `Recusar`. */
  grow?: boolean;
}

/**
 * `primary` is heat-filled with white text. That is the product's action
 * language throughout the v4 mock (`Aceitar`, `Inserir em §7.1`,
 * `Pedir correção`), so hover brightens rather than inverting.
 */
export function Button({ variant = "secondary", grow, style, disabled, ...rest }: ButtonProps) {
  const base: CSSProperties = {
    padding: "9px 15px",
    borderRadius: "var(--radius-sm)",
    fontSize: 12,
    fontWeight: variant === "primary" ? 600 : 500,
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
    flex: grow ? 1 : undefined,
    textAlign: "center",
    lineHeight: 1,
  };

  const byVariant: Record<ButtonVariant, CSSProperties> = {
    primary: { background: "var(--df-amber-500)", color: "#fff", border: "1px solid transparent" },
    secondary: {
      background: "transparent",
      color: "var(--df-on-surface)",
      border: "1px solid var(--df-outline-md)",
    },
    ghost: { background: "transparent", color: "var(--df-faint)", border: "1px solid transparent" },
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      style={{ ...base, ...byVariant[variant], ...style }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === "primary") el.style.background = "var(--df-amber-300)";
        else if (variant === "secondary") el.style.borderColor = "var(--color-heat-border)";
        else el.style.color = "var(--df-on-surface)";
        rest.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        const el = e.currentTarget;
        if (variant === "primary") el.style.background = "var(--df-amber-500)";
        else if (variant === "secondary") el.style.borderColor = "var(--df-outline-md)";
        else el.style.color = "var(--df-faint)";
        rest.onMouseLeave?.(e);
      }}
    />
  );
}

// ─── Card ─────────────────────────────────────────────────────────

interface CardProps {
  /** `heat` marks the item under review — the active change card. */
  tone?: "default" | "heat" | "sunken";
  padded?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}

export function Card({ tone = "default", padded = true, children, style, onClick }: CardProps) {
  const byTone: Record<NonNullable<CardProps["tone"]>, CSSProperties> = {
    default: { background: "var(--df-surface)", border: "1px solid var(--df-outline)" },
    heat: {
      background: "linear-gradient(180deg, var(--color-heat-bg-soft), var(--df-surface))",
      border: "1px solid var(--color-heat-border)",
    },
    sunken: { background: "var(--df-surface-mid)", border: "1px solid var(--df-outline)" },
  };

  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: "var(--radius-md)",
        padding: padded ? "13px 14px" : 0,
        cursor: onClick ? "pointer" : undefined,
        ...byTone[tone],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────

export function Input({ style, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      style={{
        width: "100%",
        padding: "8px 11px",
        borderRadius: "var(--radius-sm)",
        background: "var(--df-surface-mid)",
        border: "1px solid var(--df-outline-md)",
        color: "var(--df-on-surface)",
        fontFamily: "inherit",
        fontSize: 12.5,
        outline: "none",
        ...style,
      }}
    />
  );
}

// ─── Tab ──────────────────────────────────────────────────────────

interface TabProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}

/** One cell of a tab bar — heat underline when active, as in the v4 panel. */
export function Tab({ label, count, active, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      className="df-mono"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: "12px 8px",
        fontSize: 9.5,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: active ? 500 : 400,
        color: active ? "var(--df-amber-300)" : "var(--df-faint)",
        background: active
          ? "linear-gradient(180deg, transparent, var(--color-heat-bg-soft))"
          : "transparent",
        border: "none",
        boxShadow: active ? "inset 0 -2px 0 var(--df-amber-500)" : "none",
        cursor: "pointer",
      }}
    >
      {label}
      {Boolean(count) && (
        <span style={{ fontSize: 9, fontWeight: 500, color: active ? "var(--df-amber-300)" : "var(--df-faint)" }}>
          {count}
        </span>
      )}
    </button>
  );
}
