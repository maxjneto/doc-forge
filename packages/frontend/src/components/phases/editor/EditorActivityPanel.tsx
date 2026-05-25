import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiFetchActivity } from "@/utils/api";
import type { DocumentActivity } from "@/types";

interface EditorActivityPanelProps {
  documentId: string;
  refreshTick: number;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const ACTION_ICON: Record<string, string> = {
  write: "edit",
  snapshot: "save",
  version_selected: "history",
  document_created: "add_circle",
};

export function EditorActivityPanel({ documentId, refreshTick }: EditorActivityPanelProps) {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<DocumentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetchActivity(documentId, getToken);
      setEntries(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [documentId, getToken]);

  useEffect(() => { load(); }, [load, refreshTick]);

  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        borderLeft: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "rgba(10,11,12,0.8)",
      }}
    >
      {/* Header */}
      <div style={{
        padding: "14px 16px 10px",
        borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        flexShrink: 0,
      }}>
        <span className="df-mono" style={{
          fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase",
          color: "var(--df-faint, rgba(227,226,226,0.38))",
        }}>
          Activity
        </span>
      </div>

      {/* Entries */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }} className="hide-scrollbar">
        {loading ? (
          <div style={{ fontSize: "12px", color: "rgba(200,198,197,0.35)", padding: "12px 16px" }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ fontSize: "12px", color: "rgba(200,198,197,0.3)", padding: "12px 16px" }}>No activity yet.</div>
        ) : entries.map((entry) => (
          <div key={entry.id} style={{
            padding: "8px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}>
            {/* Actor + icon */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "12px",
                  color: entry.isAgent
                    ? "var(--df-amber-500, #ff4d00)"
                    : "rgba(200,198,197,0.4)",
                  flexShrink: 0,
                }}
              >
                {ACTION_ICON[entry.actionType] ?? "circle"}
              </span>
              <span style={{
                fontSize: "11px", fontWeight: 600,
                color: entry.isAgent ? "var(--df-amber-300, #ff8d4a)" : "rgba(200,198,197,0.7)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {entry.actorName}
              </span>
            </div>

            {/* Description */}
            {entry.description && (
              <span style={{
                fontSize: "11px",
                color: "rgba(200,198,197,0.5)",
                lineHeight: 1.4,
                paddingLeft: "18px",
              }}>
                {entry.description}
              </span>
            )}

            {/* Timestamp */}
            <span style={{
              fontSize: "10px",
              color: "rgba(200,198,197,0.28)",
              paddingLeft: "18px",
            }}>
              {timeAgo(entry.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
