import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiFetchActivity } from "@/utils/api";
import { HARNESS_META, isHarness } from "@/utils/harness";
import type { DocumentActivity } from "@/types";

interface EditorActivityRailProps {
  documentId: string;
  refreshTick: number;
}

const ICON_BY_ACTION: Record<string, string> = {
  write: "edit_note",
  snapshot: "bookmark",
  version_selected: "history",
  document_created: "add_circle",
};

function humanizeAction(actionType: string): string {
  const map: Record<string, string> = {
    write: "edited",
    snapshot: "snapshotted",
    version_selected: "restored a version",
    document_created: "created the document",
  };
  return map[actionType] ?? actionType.replace(/_/g, " ");
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const ENTRY_LIMIT = 8;

export function EditorActivityRail({ documentId, refreshTick }: EditorActivityRailProps) {
  const { getToken } = useAuth();
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "var(--df-faint, rgba(227,226,226,0.38))",
          textTransform: "uppercase",
        }}
      >
        › Activity
      </div>

      {entries === null ? (
        <div style={{ fontSize: 11, color: "rgba(200,198,197,0.3)", lineHeight: 1.5 }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 11, color: "rgba(200,198,197,0.3)", lineHeight: 1.5 }}>No activity yet.</div>
      ) : (
        <div className="df-scroll-thin" style={{ display: "flex", flexDirection: "column", maxHeight: 220, overflowY: "auto" }}>
          {entries.map((e, i) => {
            const icon = ICON_BY_ACTION[e.actionType] ?? "circle";
            const harness = e.isAgent && isHarness(e.harness) ? HARNESS_META[e.harness] : null;
            const actorColor = harness
              ? harness.fg
              : e.isAgent
              ? "var(--df-steel-100, #dbe5f0)"
              : "#e3e2e2";
            const badgeBg = harness ? harness.bg : e.isAgent ? "var(--df-steel-bg, rgba(138,160,184,0.10))" : "rgba(255,77,0,0.08)";
            const badgeFg = harness ? harness.fg : e.isAgent ? "var(--df-steel-200, #c5d3e2)" : "var(--df-amber-300, #ff8d4a)";
            return (
              <div
                key={e.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "16px 1fr",
                  gap: 8,
                  padding: "8px 0",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.04)",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    display: "grid",
                    placeItems: "center",
                    background: badgeBg,
                    color: badgeFg,
                    alignSelf: "flex-start",
                  }}
                >
                  {harness ? (
                    <img src={harness.logo} width={10} height={10} alt="" />
                  ) : (
                    <span className="material-symbols-outlined" style={{ fontSize: 10 }}>{icon}</span>
                  )}
                </span>
                <div style={{ fontSize: 11, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.4, minWidth: 0 }}>
                  <span
                    className={e.isAgent ? "df-mono" : undefined}
                    style={{
                      fontWeight: 600,
                      color: actorColor,
                      fontSize: e.isAgent ? 10.5 : 11,
                      letterSpacing: e.isAgent ? "0.04em" : undefined,
                    }}
                  >
                    {e.actorName}
                  </span>{" "}
                  <span style={{ color: "var(--df-faint, rgba(227,226,226,0.45))" }}>
                    {humanizeAction(e.actionType)}
                  </span>
                  <span
                    className="df-mono"
                    style={{
                      display: "block",
                      fontSize: 9.5,
                      color: "var(--df-faint, rgba(227,226,226,0.32))",
                      letterSpacing: "0.04em",
                      marginTop: 2,
                    }}
                  >
                    {timeAgo(e.createdAt)}
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
