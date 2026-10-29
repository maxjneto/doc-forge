import { useRef, useState } from "react";
import {
  PROP_TOKEN_GROUP,
  type ApplyResult,
  type Component,
  type ComponentGeometry,
  type LayoutDocument,
  type StyleProp,
  type StyleProps,
  type Tokens,
} from "@docforge-lib/layout";
import { Button, IconButton, Input, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { NumberField, Row, SectionTitle, Select } from "./fields";
import { tokenName } from "../names";
import { ColorPicker } from "../ColorPicker";

/** The properties people reach for first; the rest wait behind "All properties". */
const GROUPS: { key: string; props: StyleProp[] }[] = [
  { key: "text", props: ["fontSize", "fontWeight", "color", "align"] },
  { key: "box", props: ["background", "borderColor", "borderWidth", "radius", "padding"] },
];
const MORE: StyleProp[] = ["fontFamily", "italic", "lineHeight", "gap", "accent", "muted"];

/** Colors offered as swatches; chart colors stay in the custom picker. */
const SWATCHES = ["text", "muted", "primary", "surface", "subtle", "border", "success", "danger", "warning", "highlight"];

/** Ready-made looks for boxed blocks, applied at the chosen scope. `null` = back to the document's look. */
const PRESETS: { key: string; style: StyleProps | null; swatch: { background: string; border: string } }[] = [
  { key: "default", style: null, swatch: { background: "$color.subtle", border: "$color.subtle" } },
  { key: "outline", style: { background: "$color.surface", borderColor: "$color.border", borderWidth: 1 }, swatch: { background: "$color.surface", border: "$color.border" } },
  { key: "highlight", style: { background: "$color.highlight", borderColor: "$color.warning", borderWidth: 1 }, swatch: { background: "$color.highlight", border: "$color.warning" } },
  { key: "dark", style: { background: "$color.text", color: "$color.surface", muted: "$color.border", borderWidth: 0 }, swatch: { background: "$color.text", border: "$color.text" } },
];
const BOXED = new Set(["kpi", "card", "table", "code", "steps", "timeline", "list", "text"]);

/** "preset" / "document[text.title-1]" / "region:capa" / "label:destaque" / "component" → words. */
export function originLabel(origin: string, t: (key: string, vars?: Record<string, string | number>) => string): { text: string; own: boolean } {
  if (origin === "component") return { text: t("layout.style.origin.component"), own: true };
  if (origin === "preset") return { text: t("layout.style.origin.preset"), own: false };
  if (origin.startsWith("document")) return { text: t("layout.style.origin.document"), own: false };
  if (origin.startsWith("region:")) return { text: t("layout.style.origin.region", { name: origin.slice(7) }), own: false };
  if (origin.startsWith("label:")) return { text: t("layout.style.origin.label", { name: origin.slice(6) }), own: false };
  return { text: origin, own: false };
}

interface ValueControlProps {
  prop: StyleProp;
  written: unknown;
  value: unknown;
  tokens: Tokens;
  families: string[];
  onChange: (value: string | number | boolean) => void;
}

const resolveColor = (tokens: Tokens, v: string) => (v.startsWith("$color.") ? (tokens.color[v.slice(7)] ?? v) : v);

/**
 * One control per kind of value. Named steps come first (so a theme change reaches the
 * block): sizes as a scale, colors as swatches. A free value is always last.
 */
export function ValueControl({ prop, written, value, tokens, families, onChange }: ValueControlProps) {
  const { t, locale } = useI18n();
  const [picking, setPicking] = useState(false);
  const custom = useRef<HTMLButtonElement>(null);
  const group = PROP_TOKEN_GROUP[prop];
  const current = typeof written === "string" || typeof written === "number" || typeof written === "boolean" ? written : value;

  if (prop === "italic") return <Switch checked={Boolean(value)} onChange={onChange} label={t("layout.style.prop.italic")} />;
  if (prop === "align") {
    return (
      <div role="group" aria-label={t("layout.style.prop.align")} style={{ display: "flex", gap: 2 }}>
        {(["left", "center", "right"] as const).map((a) => (
          <IconButton key={a} icon={`format_align_${a}`} label={t(`layout.style.align.${a}`)} active={value === a} onClick={() => onChange(a)} />
        ))}
      </div>
    );
  }
  if (prop === "fontWeight") {
    return (
      <div role="group" aria-label={t("layout.style.prop.fontWeight")} className="df-seg">
        {[400, 500, 600, 700].map((w) => (
          <button key={w} type="button" aria-pressed={Number(value) === w} onClick={() => onChange(w)} style={{ fontWeight: w }}>
            {t(`layout.style.weight.${w}`)}
          </button>
        ))}
      </div>
    );
  }
  if (prop === "fontFamily") {
    const options = [...Object.keys(tokens.font).map((k) => ({ value: `$font.${k}`, label: `${tokens.font[k]} · ${tokenName("font", k, t)}` })), ...families.map((f) => ({ value: f, label: f }))];
    return <Select label={t("layout.style.prop.fontFamily")} value={String(current)} onChange={onChange} options={options.some((o) => o.value === current) ? options : [{ value: String(current), label: String(current) }, ...options]} />;
  }
  if (prop === "borderWidth") {
    return (
      <div role="group" aria-label={t("layout.style.prop.borderWidth")} className="df-seg">
        {[0, 1, 2, 3].map((w) => (
          <button key={w} type="button" aria-pressed={Number(value) === w} onClick={() => onChange(w)} title={w === 0 ? t("layout.style.none") : `${w}px`}>
            {w === 0 ? t("layout.style.none") : <span className="df-border-sample" style={{ borderTopWidth: w }} aria-hidden />}
          </button>
        ))}
      </div>
    );
  }
  if (prop === "radius") {
    const isToken = typeof current === "string" && current.startsWith("$radius.");
    return (
      <Row gap={6} style={{ alignItems: "center" }}>
        <div role="group" aria-label={t("layout.style.prop.radius")} className="df-seg" style={{ flex: 1 }}>
          {Object.entries(tokens.radius).map(([k, v]) => (
            <button key={k} type="button" aria-pressed={current === `$radius.${k}`} title={`${tokenName("radius", k, t)} · ${v}px`} onClick={() => onChange(`$radius.${k}`)}>
              <span className="df-radius-sample" style={{ borderTopLeftRadius: Math.min(Number(v), 10) }} aria-hidden />
            </button>
          ))}
        </div>
        <NumberField label={t("layout.style.customValue")} min={0} value={Number(value)} onCommit={(n) => onChange(n)} style={{ width: 60, opacity: isToken ? 0.6 : 1 }} />
      </Row>
    );
  }
  if (group === "color") {
    const keys = SWATCHES.filter((k) => k in tokens.color);
    const hex = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : tokens.color.text;
    return (
      <div role="group" aria-label={t(`layout.style.prop.${prop}`)} style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {keys.map((k) => {
          const on = current === `$color.${k}`;
          return (
            <button
              key={k}
              type="button"
              className="df-swatch"
              aria-pressed={on}
              title={tokenName("color", k, t)}
              aria-label={tokenName("color", k, t)}
              onClick={() => onChange(`$color.${k}`)}
              style={{ background: tokens.color[k] }}
            />
          );
        })}
        <button
          ref={custom}
          type="button"
          className="df-swatch df-swatch--custom"
          title={t("layout.style.pickColor")}
          aria-label={t("layout.style.pickColor")}
          aria-haspopup="dialog"
          aria-pressed={typeof current === "string" && !current.startsWith("$")}
          style={typeof current === "string" && !current.startsWith("$") ? { background: hex } : undefined}
          onClick={() => setPicking(!picking)}
        >
          <span className="material-symbols-outlined" aria-hidden>
            colorize
          </span>
        </button>
        {picking && (
          <ColorPicker
            anchor={custom.current}
            value={hex}
            title={t(`layout.style.prop.${prop}`)}
            onApply={(c) => onChange(c)}
            onClose={() => setPicking(false)}
          />
        )}
      </div>
    );
  }
  if (group) {
    const scale = tokens[group] as Record<string, number | string>;
    const isToken = typeof current === "string" && current.startsWith(`$${group}.`);
    // Sizes read as a scale people know (PP … XG); the rest keep their value as the label.
    if (prop === "fontSize") {
      return (
        <Row gap={6} style={{ alignItems: "center" }}>
          <div role="group" aria-label={t("layout.style.prop.fontSize")} className="df-seg" style={{ flex: 1 }}>
            {Object.entries(scale).map(([k, v]) => (
              <button key={k} type="button" aria-pressed={current === `$size.${k}`} title={`${v}px`} onClick={() => onChange(`$size.${k}`)}>
                {tokenName("size", k, t)}
              </button>
            ))}
          </div>
          <NumberField label={t("layout.style.customValue")} min={6} value={Number(value)} onCommit={(n) => onChange(n)} style={{ width: 60 }} />
        </Row>
      );
    }
    const scaleLabel = (g: string, k: string, v: number | string) => {
      const shown = g === "lineHeight" ? Number(v).toLocaleString(locale) : `${v}px`;
      const name = tokenName(g, k, t);
      return g === "space" || name === k ? shown : `${name} · ${shown}`;
    };
    return (
      <Row gap={6} style={{ alignItems: "center" }}>
        <Select
          label={t(`layout.style.prop.${prop}`)}
          value={isToken ? String(current) : "custom"}
          onChange={(v) => v !== "custom" && onChange(v)}
          options={[...Object.entries(scale).map(([k, v]) => ({ value: `$${group}.${k}`, label: scaleLabel(group, k, v) })), { value: "custom", label: t("layout.style.custom") }]}
          style={{ flex: 1 }}
        />
        <NumberField label={t("layout.style.customValue")} min={0} step={group === "lineHeight" ? 0.1 : 1} value={Number(value)} onCommit={(n) => onChange(n)} style={{ width: 64 }} />
      </Row>
    );
  }
  return <Input aria-label={prop} defaultValue={String(current ?? "")} onBlur={(e) => e.target.value !== String(current ?? "") && onChange(e.target.value)} />;
}

type Scope = { kind: "own" } | { kind: "type" } | { kind: "label"; name: string };

/**
 * A block's look. The scope comes first (only this block, every block of its type, or
 * one of its classes) and every change below goes there. Inherited values stay quiet;
 * what was changed on this block says so and can go back.
 */
export function StyleEditor({
  doc,
  component,
  geometry,
  tokens,
  families,
  commit,
  readOnly,
}: {
  doc: LayoutDocument;
  component: Component;
  geometry: ComponentGeometry;
  tokens: Tokens;
  families: string[];
  commit: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const [scope, setScope] = useState<Scope>({ kind: "own" });
  const [showAll, setShowAll] = useState(false);
  const own: StyleProps = component.style ?? {};
  const classes = component.labels ?? [];
  const typeName = t(`layout.type.${component.type}`);
  const sameType = doc.components.filter((c) => c.type === component.type).length;
  const activeScope = scope.kind === "label" && !classes.includes(scope.name) ? ({ kind: "own" } as Scope) : scope;

  const write = (style: StyleProps | null): unknown[] => {
    if (activeScope.kind === "own") return [{ op: "update", component: component.id, style }];
    if (activeScope.kind === "type") return [{ op: "setStyle", layer: "document", selector: component.type, style }];
    return [{ op: "setStyle", layer: "label", label: activeScope.name, style }];
  };
  const set = (prop: StyleProp, value: string | number | boolean) => commit(write({ [prop]: value }));
  const applyPreset = (style: StyleProps | null) => commit([...write(null), ...(style ? write(style) : [])]);
  const reset = (prop: StyleProp) => {
    const rest = { ...own };
    delete rest[prop];
    commit([{ op: "update", component: component.id, style: null }, ...(Object.keys(rest).length ? [{ op: "update", component: component.id, style: rest }] : [])]);
  };

  const row = (prop: StyleProp) => {
    const entry = geometry.style[prop];
    const origin = originLabel(entry.origin, t);
    const shadowed = origin.own && activeScope.kind !== "own";
    return (
      <div key={prop} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t(`layout.style.prop.${prop}`)}</span>
          {origin.own ? (
            <button type="button" className="df-row" onClick={() => reset(prop)} disabled={readOnly} title={t("layout.style.reset")} style={{ ...textStyle.caption, color: "var(--color-heat-hi)", background: "transparent", border: 0, padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
              {t("layout.style.changedHere")}
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 14 }}>
                undo
              </span>
            </button>
          ) : (
            (entry.origin.startsWith("label:") || entry.origin.startsWith("region:")) && (
              <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{origin.text}</span>
            )
          )}
        </Row>
        {readOnly ? (
          <span className="df-mono" style={{ ...textStyle.caption, color: "var(--color-dim)" }}>
            {String(entry.written ?? entry.value)}
          </span>
        ) : (
          <ValueControl prop={prop} written={entry.written} value={entry.value} tokens={tokens} families={families} onChange={(v) => set(prop, v)} />
        )}
        {shadowed && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.style.shadowed")}</span>}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!readOnly && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t("layout.style.scope")}</span>
          <div role="radiogroup" aria-label={t("layout.style.scope")} className="df-seg">
            <button type="button" role="radio" aria-checked={activeScope.kind === "own"} aria-pressed={activeScope.kind === "own"} onClick={() => setScope({ kind: "own" })}>
              {t("layout.style.scope.own")}
            </button>
            <button type="button" role="radio" aria-checked={activeScope.kind === "type"} aria-pressed={activeScope.kind === "type"} onClick={() => setScope({ kind: "type" })}>
              {t("layout.style.scope.type", { type: typeName, count: sameType })}
            </button>
            {classes.map((name) => {
              const on = activeScope.kind === "label" && activeScope.name === name;
              return (
                <button key={name} type="button" role="radio" aria-checked={on} aria-pressed={on} onClick={() => setScope({ kind: "label", name })}>
                  {name}
                </button>
              );
            })}
          </div>
          {activeScope.kind !== "own" && (
            <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>
              {activeScope.kind === "type" ? t("layout.style.scope.typeHint", { type: typeName, count: sameType }) : t("layout.style.scope.labelHint", { name: activeScope.name })}
            </span>
          )}
        </div>
      )}

      {!readOnly && BOXED.has(component.type) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t("layout.style.presets")}</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className="df-chip" onClick={() => applyPreset(p.style)}>
                <span aria-hidden style={{ width: 14, height: 14, borderRadius: "var(--radius-xs)", background: resolveColor(tokens, p.swatch.background), border: `1px solid ${resolveColor(tokens, p.swatch.border)}` }} />
                {t(`layout.style.preset.${p.key}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {GROUPS.map((group) => (
        <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionTitle>{t(`layout.style.group.${group.key}`)}</SectionTitle>
          {group.props.map(row)}
        </div>
      ))}

      {showAll ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionTitle>{t("layout.style.group.more")}</SectionTitle>
          {MORE.map(row)}
        </div>
      ) : (
        <Button variant="ghost" icon="tune" iconPosition="start" onClick={() => setShowAll(true)}>
          {t("layout.style.allProps")}
        </Button>
      )}
    </div>
  );
}
