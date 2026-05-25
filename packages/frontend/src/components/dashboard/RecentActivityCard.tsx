import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { apiFetchMyActivity } from "@/utils/api";
import { HARNESS_META, isHarness } from "@/utils/harness";
import type { MyActivityEvent } from "@/types";

const ICON_BY_ACTION: Record<string, string> = {
  write: "edit_note",
  snapshot: "bookmark",
  version_selected: "history",
  audit: "verified",
  phase_changed: "whatshot",
};

function humanizeAction(actionType: string): string {
  const map: Record<string, string> = {
    write: "edited",
    snapshot: "snapshotted",
    version_selected: "restored a version of",
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

export function RecentActivityCard() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<MyActivityEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetchMyActivity(getToken, 12)
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load activity");
          setEvents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <section style={cardStyle}>
      <header style={headStyle}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Recent activity</span>
      </header>
      <div className="df-scroll-thin" style={{ padding: "6px 0", maxHeight: 320, overflowY: "auto" }}>
        {events === null && <Empty>Loading…</Empty>}
        {events && events.length === 0 && (
          <Empty>
            {error
              ? "Couldn't load activity."
              : "No activity yet. Start a forge or connect an agent to see updates here."}
          </Empty>
        )}
        {events && events.map((e, i) => {
          const icon = ICON_BY_ACTION[e.actionType] ?? "circle";
          const harnessLogo = e.isAgent && e.harness && isHarness(e.harness) ? HARNESS_META[e.harness].logo : null;
          return (
            <button
              key={e.id}
              onClick={() => navigate(`/document/${e.docId}`)}
              style={{
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                padding: "11px 18px",
                display: "grid",
                gridTemplateColumns: "18px 1fr",
                gap: 10,
                borderTop: i === 0 ? "none" : "1px solid var(--df-outline)",
                alignItems: "flex-start",
                color: "inherit",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  display: "grid",
                  placeItems: "center",
                  background: e.isAgent ? "var(--df-steel-bg)" : "rgba(255,77,0,0.08)",
                  color: e.isAgent ? "var(--df-steel-200)" : "var(--df-amber-300)",
                  alignSelf: "flex-start",
                }}
              >
                {harnessLogo
                  ? <img src={harnessLogo} width={11} height={11} alt="" />
                  : <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{icon}</span>}
              </span>
              <div style={{ fontSize: 12, color: "var(--df-on-soft, #c6c5c4)", lineHeight: 1.45 }}>
                <span
                  className={e.isAgent ? "df-mono" : undefined}
                  style={{
                    fontWeight: 600,
                    color: e.isAgent && e.harness && isHarness(e.harness) ? HARNESS_META[e.harness].fg : e.isAgent ? "var(--df-steel-100)" : "#e3e2e2",
                    fontSize: e.isAgent ? 11 : undefined,
                    letterSpacing: e.isAgent ? "0.04em" : undefined,
                  }}
                >
                  {e.actorName}
                </span>{" "}
                {humanizeAction(e.actionType)}{" "}
                <span
                  className="df-mono"
                  style={{ color: "var(--df-amber-200)", fontSize: 11, letterSpacing: "0.04em" }}
                >
                  {e.docTitle}
                </span>
                <span
                  className="df-mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "var(--df-faint)",
                    letterSpacing: "0.04em",
                    marginTop: 3,
                  }}
                >
                  {timeAgo(e.createdAt)}
                  {e.description ? ` · ${e.description}` : ""}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid var(--df-outline)",
  borderRadius: 12,
  background: "rgba(18,20,20,0.5)",
  overflow: "hidden",
};

const headStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--df-outline)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: "var(--df-faint)", lineHeight: 1.5, padding: "14px 18px" }}>{children}</div>
  );
}
