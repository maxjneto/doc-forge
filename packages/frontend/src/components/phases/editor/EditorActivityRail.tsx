import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiFetchActivity } from "@/utils/api";
import { HARNESS_META, isHarness } from "@/utils/harness";
import type { DocumentActivity } from "@/types";
import { Eyebrow } from "@/components/ui";
import { useI18n } from "@/i18n";
import { fullDate, relativeTime } from "@/utils/time";

interface EditorActivityRailProps {
  documentId: string;
  refreshTick: number;
}

const ICON_BY_ACTION: Record<string, string> = {
  write: "edit_note",
  snapshot: "bookmark",
  version_selected: "history",
  document_created: "add_circle",
  suggestion_created: "difference",
  suggestion_accepted: "check",
  suggestion_rejected: "close",
  feedback_created: "rate_review",
  feedback_resolved: "task_alt",
};

const ENTRY_LIMIT = 8;

/** Who did what, newest first. Agents read steel (R2), people read as text. */
export function EditorActivityRail({ documentId, refreshTick }: EditorActivityRailProps) {
  const { getToken } = useAuth();
  const { t, dateLocale } = useI18n();
  const [entries, setEntries] = useState<DocumentActivity[] | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetchActivity(documentId, getToken, ENTRY_LIMIT);
      setEntries(data);
    } catch {
      setEntries([]);
    }
  }, [documentId, getToken]);

  useEffect(() => { load(); }, [load, refreshTick]);

  const describe = (actionType: string) => {
    const key = `activity.${actionType}`;
    const text = t(key);
    return text === key ? actionType.replace(/_/g, " ") : text;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Eyebrow chevron>{t("editor.activity")}</Eyebrow>

      {entries === null ? (
        <div style={{ fontSize: 11.5, color: "var(--color-faint)", lineHeight: 1.5 }}>{t("editor.loading")}</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--color-faint)", lineHeight: 1.5 }}>{t("editor.noActivity")}</div>
      ) : (
        <div className="df-scroll-thin" style={{ display: "flex", flexDirection: "column", maxHeight: 220, overflowY: "auto" }}>
          {entries.map((e, i) => {
            const harness = e.isAgent && isHarness(e.harness) ? HARNESS_META[e.harness] : null;
            return (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "18px 1fr",
                  gap: 8,
                  padding: "8px 0",
                  borderTop: i === 0 ? "none" : "1px solid var(--color-outline)",
                  alignItems: "start",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "var(--radius-xs)",
                    display: "grid",
                    placeItems: "center",
                    background: e.isAgent ? "var(--color-steel-wash)" : "var(--color-hover)",
                    color: e.isAgent ? "var(--color-steel)" : "var(--color-faint)",
                  }}
                >
                  {harness ? (
                    <img src={harness.logo} width={11} height={11} alt="" />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{ICON_BY_ACTION[e.actionType] ?? "circle"}</span>
                  )}
                </span>
                <div style={{ fontSize: 11.5, color: "var(--color-faint)", lineHeight: 1.45, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: e.isAgent ? "var(--color-steel-hi)" : "var(--color-text)" }}>
                    {e.actorName}
                  </span>{" "}
                  {describe(e.actionType)}
                  <span
                    title={fullDate(e.createdAt, dateLocale)}
                    style={{ display: "block", marginTop: 1, color: "var(--color-mute)", fontVariantNumeric: "tabular-nums" }}
                  >
                    {relativeTime(e.createdAt, dateLocale)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
