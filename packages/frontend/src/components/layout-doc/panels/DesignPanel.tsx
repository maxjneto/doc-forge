import { useEffect, useState, type ReactNode } from "react";
import { mergeTokens, type ApplyResult, type LayoutDocument, type LayoutResult, type TokenOverrides } from "@docforge-lib/layout";
import { Button, IconButton, Input, Pill, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { LayoutTheme } from "@/utils/api";
import { ColorField } from "../ColorPicker";
import { docFont, loadAppFonts } from "../fonts";
import { tokenName } from "../names";
import { COLOR_GROUPS, completeTheme, currentTheme, draftSize, presetKey, RADIUS_PRESETS, readability, TYPE_SCALES } from "../themes";
import { track } from "../track";
import type { ThemeLibrary } from "../useThemes";
import { ClassesSection } from "./ClassesEditor";
import { NumberField, SectionTitle } from "./fields";
import { ThemePreview } from "./ThemePreview";

/** A draft of the document's look: token changes shown on the page, written only on "Apply". */
export interface DesignDraft {
  tokens: TokenOverrides;
  /** The theme the draft started from, while it has not been changed by hand. */
  theme: string | null;
}

interface DesignPanelProps {
  doc: LayoutDocument;
  layout: LayoutResult;
  families: string[];
  library: ThemeLibrary;
  draft: DesignDraft | null;
  setDraft: (draft: DesignDraft | null) => void;
  commit: (ops: unknown[]) => ApplyResult;
  readOnly: boolean;
  slide: boolean;
}

type Module = "colors" | "type" | "shapes";

/**
 * The document's look, in modules: a gallery of themes drawn as tiny pages, then
 * colors by role, type and corners. Every change is a draft the page shows at once
 * and nothing is written until "Apply" (one write, one undo step). A look can be
 * kept as a theme for other documents; agents see the same themes.
 */
export function DesignPanel({ doc, layout, families, library, draft, setDraft, commit, readOnly, slide }: DesignPanelProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Module | null>("colors");
  const [saving, setSaving] = useState<string | null>(null);
  const [savedName, setSavedName] = useState<string | null>(null);
  useEffect(() => {
    void loadAppFonts();
  }, []);

  const tokens = layout.tokens; // with the draft (the page renders the draft)
  const saved = mergeTokens(doc.tokens);
  const active = draft?.theme ?? currentTheme(doc, library.themes)?.name ?? null;
  const changes = draftSize(draft?.tokens ?? null);
  const builtin = library.themes.filter((th) => th.builtin);
  const mine = library.themes.filter((th) => !th.builtin);

  /** Change one token in the draft (the theme it came from no longer describes it). */
  const setToken = (group: keyof TokenOverrides, key: string, value: string | number) => {
    const base = draft?.tokens ?? {};
    setDraft({ tokens: { ...base, [group]: { ...(base[group] ?? {}), [key]: value } }, theme: null });
  };
  const setGroup = (group: keyof TokenOverrides, values: Record<string, string | number>) => {
    const base = draft?.tokens ?? {};
    setDraft({ tokens: { ...base, [group]: { ...(base[group] ?? {}), ...values } }, theme: null });
  };
  const pickTheme = (theme: LayoutTheme) => {
    track("layout_theme_previewed", { theme: theme.key ?? "saved" });
    setDraft({ tokens: completeTheme(theme.tokens as TokenOverrides), theme: theme.name });
  };
  const apply = () => {
    if (!draft) return;
    const result = commit([{ op: "setTokens", tokens: draft.tokens }, { op: "setMeta", meta: { theme: draft.theme ?? null } }]);
    if (result.ok) {
      track("layout_theme_applied", { theme: draft.theme ? (library.themes.find((th) => th.name === draft.theme)?.key ?? "saved") : "custom", changes });
      setDraft(null);
    }
  };
  const saveTheme = async (name: string) => {
    const merged = { ...(doc.tokens ?? {}) } as TokenOverrides;
    for (const [group, values] of Object.entries(draft?.tokens ?? {})) {
      const key = group as keyof TokenOverrides;
      merged[key] = { ...(merged[key] ?? {}), ...(values as object) } as never;
    }
    const theme = await library.save(name, merged);
    track("layout_theme_saved_ui", { colors: Object.keys(merged.color ?? {}).length });
    setSaving(null);
    setSavedName(theme.name);
    if (draft) setDraft({ ...draft, theme: theme.name });
  };

  const changedHere = (group: keyof TokenOverrides, key: string) => draft?.tokens[group]?.[key] !== undefined && draft.tokens[group]?.[key] !== (saved[group] as Record<string, unknown>)[key];
  const warnings = readability(tokens);
  const sizes = tokens.size;
  const scale = presetKey(TYPE_SCALES, sizes);
  const corners = presetKey(RADIUS_PRESETS, tokens.radius);
  const fontChoices = library.fonts.length ? library.fonts.filter((f) => f !== "JetBrains Mono") : families.filter((f) => f !== "JetBrains Mono");

  const themeCard = (theme: LayoutTheme) => {
    const on = active === theme.name;
    return (
      <div key={theme.id} className="df-theme-card" data-on={on || undefined}>
        <button type="button" role="radio" aria-checked={on} disabled={readOnly} onClick={() => pickTheme(theme)} title={theme.description ?? theme.name}>
          <ThemePreview tokens={mergeTokens(completeTheme(theme.tokens as TokenOverrides))} slide={slide} />
          <span className="df-theme-card__name">
            {theme.builtin && theme.key ? t(`layout.doc.themes.${theme.key}`) : theme.name}
            {theme.byAgent && (
              <Pill compact tone="steel" dot={false}>
                {t("layout.notes.byAgent")}
              </Pill>
            )}
          </span>
        </button>
        {!theme.builtin && !readOnly && (
          <IconButton
            icon="delete"
            label={t("layout.design.deleteTheme", { name: theme.name })}
            onClick={() => void library.remove(theme.id)}
            className="df-theme-card__delete"
          />
        )}
      </div>
    );
  };

  const module = (key: Module, icon: string, body: () => ReactNode) => (
    <section className="df-module" data-open={open === key || undefined}>
      <button type="button" className="df-module__head" aria-expanded={open === key} onClick={() => setOpen(open === key ? null : key)}>
        <span className="material-symbols-outlined" aria-hidden>
          {icon}
        </span>
        <span style={{ ...textStyle.group, flex: 1 }}>{t(`layout.design.module.${key}`)}</span>
        <span className="df-module__summary">{t(`layout.design.module.${key}.hint`)}</span>
      </button>
      {open === key && <div className="df-module__body">{body()}</div>}
    </section>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionTitle>{t("layout.design.themes")}</SectionTitle>
        {library.loading && <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("common.loading")}</span>}
        {library.error && <span style={{ ...textStyle.caption, color: "var(--color-warn)" }}>{t("layout.design.themesFailed")}</span>}
        <div role="radiogroup" aria-label={t("layout.design.themes")} className="df-theme-grid">
          {builtin.map(themeCard)}
        </div>
        {mine.length > 0 && (
          <>
            <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)", paddingTop: 4 }}>{t("layout.design.mine")}</span>
            <div role="radiogroup" aria-label={t("layout.design.mine")} className="df-theme-grid">
              {mine.map(themeCard)}
            </div>
          </>
        )}
        {!readOnly &&
          (saving === null ? (
            <Button variant="ghost" icon="bookmark_add" iconPosition="start" onClick={() => setSaving(active && !mine.some((m) => m.name === active) ? `${active} (cópia)` : "")}>
              {t("layout.design.saveTheme")}
            </Button>
          ) : (
            <form
              style={{ display: "flex", gap: 6 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (saving.trim()) void saveTheme(saving.trim());
              }}
            >
              <Input autoFocus aria-label={t("layout.design.themeName")} placeholder={t("layout.design.themeName")} value={saving} onChange={(e) => setSaving(e.target.value)} maxLength={120} />
              <Button type="submit" variant="secondary" disabled={!saving.trim()}>
                {t("common.save")}
              </Button>
              <IconButton icon="close" label={t("common.cancel")} onClick={() => setSaving(null)} />
            </form>
          ))}
        {savedName && saving === null && <span style={{ ...textStyle.caption, color: "var(--color-ok)" }}>{t("layout.design.savedTheme", { name: savedName })}</span>}
        <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.design.themesHint")}</span>
      </div>

      {module("colors", "palette", () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {COLOR_GROUPS.map((g) => (
            <div key={g.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t(`layout.design.colors.${g.key}`)}</span>
              <div className={g.key === "charts" ? "df-color-grid df-color-grid--compact" : "df-color-grid"}>
                {g.colors
                  .filter((k) => k in tokens.color)
                  .map((k) => (
                    <ColorField
                      key={k}
                      value={tokens.color[k] as string}
                      label={tokenName("color", k, t)}
                      changed={changedHere("color", k)}
                      disabled={readOnly}
                      onApply={(v) => setToken("color", k, v)}
                    />
                  ))}
              </div>
            </div>
          ))}
          {warnings.length > 0 && (
            <div role="status" className="df-callout df-callout--warn">
              {warnings.map((w) => (
                <span key={w.pair.join("-")}>
                  {t("layout.design.lowContrast", { a: tokenName("color", w.pair[0], t), b: tokenName("color", w.pair[1], t), ratio: w.ratio.toFixed(1) })}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      {module("type", "text_fields", () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(["heading", "sans"] as const).map((role) => (
            <div key={role} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t(`layout.design.font.${role}`)}</span>
              <div role="radiogroup" aria-label={t(`layout.design.font.${role}`)} className="df-font-grid">
                {fontChoices.map((family) => {
                  const on = (tokens.font[role] ?? tokens.font.sans) === family;
                  return (
                    <button key={family} type="button" role="radio" aria-checked={on} disabled={readOnly} className="df-font-card" onClick={() => setToken("font", role, family)}>
                      <span className="df-font-card__sample" style={{ fontFamily: docFont(family), fontWeight: role === "heading" ? 700 : 400 }}>
                        Aa
                      </span>
                      <span className="df-font-card__name">{family}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t("layout.design.scale")}</span>
            <div role="radiogroup" aria-label={t("layout.design.scale")} className="df-seg">
              {TYPE_SCALES.map((s) => (
                <button key={s.key} type="button" role="radio" aria-checked={scale === s.key} aria-pressed={scale === s.key} disabled={readOnly} onClick={() => setGroup("size", s.values)}>
                  {t(`layout.design.scale.${s.key}`)}
                </button>
              ))}
            </div>
            <div className="df-size-list">
              {Object.entries(sizes).map(([k, v]) => (
                <div key={k} className="df-size-row">
                  <span className="df-size-row__sample" style={{ fontFamily: docFont(String(k === "display" || k === "xxl" || k === "xl" ? tokens.font.heading : tokens.font.sans)) }}>
                    <span style={{ fontSize: `${Math.min(Number(v), 34)}px` }}>{tokenName("size", k, t)}</span>
                  </span>
                  <NumberField label={tokenName("size", k, t)} min={6} max={160} value={Number(v)} disabled={readOnly} onCommit={(n) => setToken("size", k, n)} style={{ width: 64 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {module("shapes", "rounded_corner", () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ ...textStyle.fieldLabel, color: "var(--color-dim)" }}>{t("layout.design.corners")}</span>
          <div role="radiogroup" aria-label={t("layout.design.corners")} className="df-corner-grid">
            {RADIUS_PRESETS.map((p) => (
              <button key={p.key} type="button" role="radio" aria-checked={corners === p.key} disabled={readOnly} className="df-corner-card" onClick={() => setGroup("radius", p.values)}>
                <span className="df-corner-card__sample" style={{ borderRadius: `${Math.min(p.values.m as number, 14)}px` }} aria-hidden />
                {t(`layout.design.corners.${p.key}`)}
              </button>
            ))}
          </div>
          <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.design.cornersHint")}</span>
        </div>
      ))}

      <details className="df-disclosure">
        <summary style={{ ...textStyle.group, color: "var(--color-text)" }}>{t("layout.doc.classes")}</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 12 }}>
          <ClassesSection doc={doc} layout={layout} families={families} commit={commit} readOnly={readOnly} />
        </div>
      </details>

      {draft && changes > 0 && !readOnly && (
        <div className="df-draft-bar" role="region" aria-label={t("layout.design.draft")}>
          <span style={{ ...textStyle.caption, color: "var(--color-text)", flex: 1 }}>
            {draft.theme ? t("layout.design.draftTheme", { name: draft.theme }) : t("layout.design.draftCount", { count: changes })}
          </span>
          <Button variant="ghost" onClick={() => setDraft(null)}>
            {t("layout.design.discard")}
          </Button>
          <Button variant="primary" onClick={apply}>
            {t("layout.design.apply")}
          </Button>
        </div>
      )}
    </div>
  );
}
