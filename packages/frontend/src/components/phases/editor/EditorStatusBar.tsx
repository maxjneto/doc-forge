import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";

export type SaveState =
  | { status: "idle"; savedAt: number | null }
  | { status: "dirty" }
  | { status: "saving" }
  | { status: "error"; message: string };

function ago(ts: number, locale: string): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  if (s < 60) return formatter.format(-s, "second");
  const minutes = Math.round(s / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  return formatter.format(-Math.round(minutes / 60), "hour");
}

interface EditorStatusBarProps {
  saveState: SaveState;
  /** Name of the agent holding an API key on this document, if any. */
  agentLabel?: string | null;
}

/**
 * The `salvo há 12s` line from the v4 mock. It is not decoration: until this
 * existed, the only way to persist typing was a button buried in the Versions
 * tab, so on the Gate or Review tab there was no save control on screen at all.
 */
export function EditorStatusBar({ saveState, agentLabel }: EditorStatusBarProps) {
  const { t, dateLocale } = useI18n();
  const [, tick] = useState(0);

  // Re-render on a slow timer so "há 12s" keeps counting up.
  useEffect(() => {
    if (saveState.status !== "idle" || !saveState.savedAt) return;
    const id = window.setInterval(() => tick((n) => n + 1), 10_000);
    return () => window.clearInterval(id);
  }, [saveState]);

  const save = (() => {
    switch (saveState.status) {
      case "saving":
        return { text: t("editor.saveState.saving"), color: "var(--df-faint)" };
      case "dirty":
        return { text: t("editor.saveState.unsaved"), color: "var(--df-warn)" };
      case "error":
        return { text: t("editor.saveFailure", { message: saveState.message }), color: "var(--df-error)" };
      case "idle":
        return saveState.savedAt
          ? { text: t("editor.savedAt", { time: ago(saveState.savedAt, dateLocale) }), color: "var(--df-faint)" }
          : { text: "", color: "var(--df-faint)" };
    }
  })();

  return (
    <div
      style={{
        height: 34,
        flexShrink: 0,
        borderTop: "1px solid var(--df-outline)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 20px",
        background: "rgba(29,31,33,0.35)",
      }}
    >
      {agentLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "var(--radius-pill)",
              background: "var(--df-amber-500)",
            }}
          />
          <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
            {t("editor.connectedViaMcp", { name: agentLabel })}
          </span>
        </div>
      )}
      {save.text && (
        <span className="df-mono" style={{ fontSize: 9.5, color: save.color }}>
          {save.text}
        </span>
      )}
    </div>
  );
}
