/**
 * The primitives that repeat across every screen: Pill, Button, IconButton,
 * Card, Input, Switch, Tab, Eyebrow, Kbd, Dialog, Meter, Page, PageHeader — plus the
 * type roles in `textStyle`.
 *
 * They exist because each component used to decide its own radius and type
 * scale — `DocTableRow` alone used radius 3, 4, 6 and 999 on a single row,
 * which is the real source of the "it doesn't quite line up" feeling.
 * Everything here draws from the ramp in index.css; nothing hardcodes colour.
 * Interactive states (hover, focus, disabled) live in index.css under
 * `.df-btn`, `.df-input`, `.df-icon-btn`, so they work with the keyboard too.
 * The rules for using them are in packages/frontend/CLAUDE.md.
 */
import { useEffect } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, CSSProperties } from "react";

export { textStyle } from "./type";

const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

// ─── Pill ─────────────────────────────────────────────────────────

export type PillTone = "heat" | "steel" | "ghost" | "warn" | "error" | "ok";

interface PillProps {
  tone?: PillTone;
  /** Leading status dot. On by default for heat/steel (something alive), off elsewhere. */
  dot?: boolean;
  /** Tighter padding for pills inside dense rows. */
  compact?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  title?: string;
}

const PILL_TONE: Record<PillTone, { color: string; border: string; background: string; dot: string }> = {
  heat: {
    color: "var(--color-heat-soft)",
    border: "var(--color-heat-line)",
    background: "var(--color-heat-wash)",
    dot: "var(--color-heat)",
  },
  steel: {
    color: "var(--color-steel-hi)",
    border: "var(--color-steel-line)",
    background: "var(--color-steel-wash)",
    dot: "var(--color-steel)",
  },
  ghost: {
    color: "var(--color-faint)",
    border: "var(--color-outline-md)",
    background: "transparent",
    dot: "var(--color-faint)",
  },
  warn: {
    color: "var(--color-warn)",
    border: "var(--color-warn-line)",
    background: "var(--color-warn-wash)",
    dot: "var(--color-warn)",
  },
  error: {
    color: "var(--color-error)",
    border: "var(--color-error-line)",
    background: "var(--color-error-wash)",
    dot: "var(--color-error)",
  },
  ok: {
    color: "var(--color-ok)",
    border: "var(--color-ok-line)",
    background: "var(--color-ok-wash)",
    dot: "var(--color-ok)",
  },
};

/** Status chip — `label` type, pill radius. The mock's `IN REVIEW · V5 DRAFT`. */
export function Pill({ tone = "ghost", dot, compact, children, style, title }: PillProps) {
  const t = PILL_TONE[tone];
  const showDot = dot ?? (tone === "heat" || tone === "steel");
  return (
    <span
      title={title}
      className="df-mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: "var(--text-label)",
        fontWeight: 600,
        letterSpacing: "var(--tracking-label)",
        textTransform: "uppercase",
        lineHeight: 1,
        padding: compact ? "3px 7px" : "4px 9px",
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
            boxShadow: tone === "heat" ? "var(--shadow-ember)" : undefined,
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
  /** `lg` is for marketing calls to action; everything in the app is `md`. */
  size?: "md" | "lg";
  /** Material Symbols name, drawn after the label (`arrow_forward`) or before it. */
  icon?: string;
  iconPosition?: "start" | "end";
  /** Stretch to fill the row — the mock's `Aceitar` next to `Recusar`. */
  grow?: boolean;
}

/**
 * `primary` is heat-filled with white text. That is the product's action
 * language throughout the v4 mock (`Aceitar`, `Inserir em §7.1`,
 * `Pedir correção`), so hover brightens rather than inverting. One primary
 * per view: if a screen has two, one of them is `secondary`.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  iconPosition = "end",
  grow,
  className,
  style,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const glyph = icon ? (
    <span className="material-symbols-outlined" aria-hidden style={{ fontSize: size === "lg" ? 16 : 14 }}>
      {icon}
    </span>
  ) : null;
  return (
    <button
      {...rest}
      type={type}
      className={cx("df-btn", `df-btn--${variant}`, size === "lg" && "df-btn--lg", className)}
      style={{ flex: grow ? 1 : undefined, ...style }}
    >
      {iconPosition === "start" && glyph}
      {children}
      {iconPosition === "end" && glyph}
    </button>
  );
}

// ─── IconButton ───────────────────────────────────────────────────

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Material Symbols name. */
  icon: string;
  /** Required: an icon alone says nothing to a screen reader. */
  label: string;
  active?: boolean;
}

/** 28×28, radius xs — close, previous/next, row actions. */
export function IconButton({ icon, label, active, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      aria-pressed={active}
      className={cx("df-icon-btn", active && "df-icon-btn--active", className)}
    >
      <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 17 }}>
        {icon}
      </span>
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────

interface CardProps {
  /**
   * `heat` marks the item under review — the active change card.
   * `warm` / `steel` are the marketing entry cards (named gradients).
   */
  tone?: "default" | "heat" | "sunken" | "warm" | "steel";
  padded?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  id?: string;
}

export function Card({ tone = "default", padded = true, children, style, onClick, id }: CardProps) {
  const byTone: Record<NonNullable<CardProps["tone"]>, CSSProperties> = {
    default: { background: "var(--color-surface)", border: "1px solid var(--color-outline)" },
    heat: {
      background: "linear-gradient(180deg, var(--color-heat-tint), var(--color-surface))",
      border: "1px solid var(--color-heat-line)",
    },
    sunken: { background: "var(--color-surface-mid)", border: "1px solid var(--color-outline)" },
    warm: { background: "var(--gradient-warm)", border: "1px solid var(--color-heat-line)" },
    steel: { background: "var(--gradient-steel)", border: "1px solid var(--color-steel-line)" },
  };
  const large = tone === "warm" || tone === "steel";

  return (
    <div
      id={id}
      onClick={onClick}
      style={{
        borderRadius: large ? "var(--radius-lg)" : "var(--radius-md)",
        padding: padded ? (large ? 26 : "13px 14px") : 0,
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

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx("df-input", className)} />;
}

// ─── Switch ───────────────────────────────────────────────────────

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

/** An on/off setting. Heat when on — it is a setting that acts now. */
export function Switch({ checked, onChange, label, disabled, title }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => onChange(!checked)}
      className="df-switch"
    >
      <span className="df-switch-track" aria-hidden>
        <span className="df-switch-knob" />
      </span>
      {label}
    </button>
  );
}

// ─── Tab ──────────────────────────────────────────────────────────

interface TabProps {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  /** Sentence-case sans label, sized to its text: for dense editors where mono caps get hard to read. */
  plain?: boolean;
}

/** One cell of a tab bar — heat underline when active, as in the v4 panel. */
export function Tab({ label, count, active, onClick, plain }: TabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={plain ? undefined : "df-mono"}
      style={{
        flex: plain ? "none" : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 5,
        padding: plain ? "10px 10px" : "12px 8px",
        fontSize: plain ? "var(--text-body-sm)" : "var(--text-label)",
        letterSpacing: plain ? "normal" : "var(--tracking-eyebrow)",
        textTransform: plain ? "none" : "uppercase",
        fontWeight: active ? 600 : 500,
        color: active ? (plain ? "var(--color-text)" : "var(--color-heat-hi)") : plain ? "var(--color-dim)" : "var(--color-faint)",
        background: active && !plain ? "linear-gradient(180deg, transparent, var(--color-heat-tint))" : "transparent",
        border: "none",
        boxShadow: active ? "inset 0 -2px 0 var(--color-heat)" : "none",
        cursor: "pointer",
        transition: "color var(--duration-fast) var(--ease-forge)",
      }}
    >
      {label}
      {Boolean(count) && (
        <span style={{ fontWeight: 500, letterSpacing: "var(--tracking-data)", color: active ? "var(--color-heat-hi)" : "var(--color-faint)" }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Eyebrow ──────────────────────────────────────────────────────

interface EyebrowProps {
  children: ReactNode;
  /** The mock's `›` marker. */
  chevron?: boolean;
  /** `heat` for marketing section labels; `faint` (default) inside the app. */
  tone?: "faint" | "heat";
  /** Hairline running to the end of the row. */
  rule?: boolean;
  align?: "start" | "center";
  style?: CSSProperties;
}

/** Section label in mono caps — `› STRUCTURE`, `› ACTIVITY`, marketing kickers. */
export function Eyebrow({ children, chevron, tone = "faint", rule, align = "start", style }: EyebrowProps) {
  return (
    <div
      className="df-mono"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: align === "center" ? "center" : "flex-start",
        gap: 12,
        fontSize: "var(--text-label)",
        fontWeight: 600,
        letterSpacing: "var(--tracking-eyebrow)",
        textTransform: "uppercase",
        lineHeight: 1,
        color: tone === "heat" ? "var(--color-heat-hi)" : "var(--color-faint)",
        ...style,
      }}
    >
      <span>
        {chevron && "› "}
        {children}
      </span>
      {rule && <span aria-hidden style={{ flex: 1, height: 1, background: "var(--color-outline)" }} />}
    </div>
  );
}

// ─── Kbd ──────────────────────────────────────────────────────────

/** A key in a shortcut hint — `↑↓ NAVEGAR · A ACEITAR`. */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="df-kbd">{children}</kbd>;
}

// ─── Dialog ───────────────────────────────────────────────────────

interface DialogProps {
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Panel width in px; never wider than the viewport. */
  width?: number;
  /** Show a close button in the header. */
  closable?: boolean;
  children: ReactNode;
}

const TITLE: CSSProperties = {
  fontSize: "var(--text-title)",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  lineHeight: 1.3,
  color: "var(--color-text)",
};

/**
 * Modal shell: scrim, `lg` radius, `shadow-modal`, `modal` layer, Escape to
 * close, click outside to close. Content decides its own body.
 */
export function Dialog({ onClose, title, subtitle, width = 460, closable, children }: DialogProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal)",
        background: "var(--color-scrim)",
        backdropFilter: "blur(4px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(${width}px, 100%)`,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          background: "var(--color-surface)",
          border: "1px solid var(--color-outline-md)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-modal)",
          padding: 22,
        }}
      >
        {(title || closable) && (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              {title && <h2 style={{ margin: 0, ...TITLE }}>{title}</h2>}
              {subtitle && (
                <p
                  style={{
                    margin: "5px 0 0",
                    fontSize: "var(--text-body-sm)",
                    color: "var(--color-faint)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            {closable && <IconButton icon="close" label="Close" onClick={onClose} />}
          </div>
        )}
        <div style={{ marginTop: title || closable ? 18 : 0 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── RichText ─────────────────────────────────────────────────────

/**
 * Renders a translated sentence that carries `inline code` and **bold**
 * markers, so a sentence with a path in the middle stays one dictionary
 * entry instead of being cut into fragments around the markup.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return <InlineCode key={i}>{part.slice(1, -1)}</InlineCode>;
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ color: "var(--color-text)", fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Inline code — steel, like inline code in a rendered document. */
export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code
      className="df-mono"
      style={{
        fontSize: "0.92em",
        color: "var(--color-steel-hi)",
        background: "var(--color-steel-wash)",
        border: "1px solid var(--color-steel-line)",
        padding: "0 5px",
        borderRadius: "var(--radius-xs)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </code>
  );
}

// ─── Meter ────────────────────────────────────────────────────────

/** A thin usage bar. Heat while there is room, error once it is spent. */
export function Meter({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const full = ratio >= 1;
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      style={{ height: 3, borderRadius: "var(--radius-pill)", background: "var(--color-outline-md)", overflow: "hidden" }}
    >
      <div style={{ width: `${ratio * 100}%`, height: "100%", borderRadius: "var(--radius-pill)", background: full ? "var(--color-error)" : "var(--color-heat-line)" }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

/**
 * The body of every signed-in screen: same top clearance under the TopBar,
 * same side gutters, one of two widths. `wide` is for tables (the library);
 * `default` for settings and reading pages.
 */
export function Page({ width = "default", children }: { width?: "default" | "wide"; children: ReactNode }) {
  return (
    <main
      style={{
        flex: 1,
        width: "100%",
        maxWidth: width === "wide" ? 1440 : 1040,
        margin: "0 auto",
        padding: "88px 40px 80px",
      }}
    >
      {children}
    </main>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  lead?: ReactNode;
  eyebrow?: ReactNode;
  /** Right-aligned: a meter, the page's one primary action. */
  actions?: ReactNode;
}

/** Page title block — display type, one lead line, actions on the right. */
export function PageHeader({ title, lead, eyebrow, actions }: PageHeaderProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
        marginBottom: 32,
      }}
    >
      <div style={{ minWidth: 0, maxWidth: 720 }}>
        {eyebrow && <Eyebrow style={{ marginBottom: 12 }}>{eyebrow}</Eyebrow>}
        <h1
          style={{
            margin: 0,
            fontSize: "var(--text-display)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            color: "var(--color-text)",
            textWrap: "balance",
          }}
        >
          {title}
        </h1>
        {lead && (
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-body)", lineHeight: 1.55, color: "var(--color-dim)" }}>{lead}</p>
        )}
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>{actions}</div>}
    </header>
  );
}
