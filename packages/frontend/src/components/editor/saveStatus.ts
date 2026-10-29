import type { SaveTone } from "@/components/document";

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

/**
 * The `salvo há 12s` line. It is not decoration: before it existed the only way
 * to persist typing was a button buried in the Versions tab.
 */
export function describeSave(
  state: SaveState,
  t: (key: string, vars?: Record<string, string | number>) => string,
  locale: string,
): { text: string; tone: SaveTone } | null {
  switch (state.status) {
    case "saving":
      return { text: t("editor.saveState.saving"), tone: "busy" };
    case "dirty":
      return { text: t("editor.saveState.unsaved"), tone: "warn" };
    case "error":
      return { text: t("editor.saveFailure", { message: state.message }), tone: "error" };
    case "idle":
      return state.savedAt ? { text: t("editor.savedAt", { time: ago(state.savedAt, locale) }), tone: "quiet" } : null;
  }
}
