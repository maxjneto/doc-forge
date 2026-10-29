import { useI18n, type Locale } from "@/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label
      title={t("language.label")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        color: "var(--color-faint)",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>language</span>
      <select
        aria-label={t("language.label")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="df-mono"
        style={{
          border: "1px solid var(--color-outline-md)",
          borderRadius: "var(--radius-sm)",
          background: "var(--color-surface-mid)",
          color: "var(--color-dim)",
          padding: compact ? "4px 6px" : "6px 8px",
          fontSize: compact ? 9.5 : 10.5,
          letterSpacing: "var(--tracking-data)",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <option value="pt-BR">PT</option>
        <option value="en">EN</option>
      </select>
    </label>
  );
}
