import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { apiFetchMyActivity } from "@/utils/api";
import { HARNESS_META, isHarness } from "@/utils/harness";
import type { MyActivityEvent } from "@/types";
import { useI18n } from "@/i18n";

const ICON_BY_ACTION: Record<string, string> = {
  write: "edit_note",
  snapshot: "bookmark",
  version_selected: "history",
  audit: "verified",
  phase_changed: "whatshot",
};

function humanizeAction(actionType: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    write: t("dashboard.action.write"),
    snapshot: t("dashboard.action.snapshot"),
    version_selected: t("dashboard.action.versionSelected"),
  };
  return map[actionType] ?? actionType.replace(/_/g, " ");
}

function timeAgo(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  if (s < 60) return formatter.format(-s, "second");
  const m = Math.floor(s / 60);
  if (m < 60) return formatter.format(-m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return formatter.format(-h, "hour");
  const d = Math.floor(h / 24);
  return formatter.format(-d, "day");
}

export function RecentActivityCard() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { t, dateLocale } = useI18n();
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
          setError(e instanceof Error ? e.message : t("dashboard.activityError"));
          setEvents([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [getToken, t]);

  return (
    <section style={cardStyle}>
      <header style={headStyle}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{t("dashboard.recentActivity")}</span>
      </header>
      <div className="df-scroll-thin" style={{ padding: "6px 0", maxHeight: 320, overflowY: "auto" }}>
        {events === null && <Empty>{t("common.loading")}</Empty>}
        {events && events.length === 0 && (
          <Empty>
            {error
              ? t("dashboard.activityError")
              : t("dashboard.noActivity")}
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
                borderTop: i === 0 ? "none" : "1px solid var(--color-outline)",
                alignItems: "flex-start",
                color: "inherit",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "var(--radius-xs)",
                  display: "grid",
                  placeItems: "center",
                  background: e.isAgent ? "var(--color-steel-wash)" : "var(--color-heat-wash)",
                  color: e.isAgent ? "var(--color-steel)" : "var(--color-heat-hi)",
                  alignSelf: "flex-start",
                }}
              >
                {harnessLogo
                  ? <img src={harnessLogo} width={11} height={11} alt="" />
                  : <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{icon}</span>}
              </span>
              <div style={{ fontSize: 12.5, color: "var(--color-dim)", lineHeight: 1.45 }}>
                <span
                  className={e.isAgent ? "df-mono" : undefined}
                  style={{
                    fontWeight: 600,
                    color: e.isAgent && e.harness && isHarness(e.harness) ? HARNESS_META[e.harness].fg : e.isAgent ? "var(--color-steel-hi)" : "var(--color-text)",
                    fontSize: e.isAgent ? 11 : undefined,
                    letterSpacing: e.isAgent ? "0.04em" : undefined,
                  }}
                >
                  {e.actorName}
                </span>{" "}
                {humanizeAction(e.actionType, t)}{" "}
                <span
                  className="df-mono"
                  style={{ color: "var(--color-heat-soft)", fontSize: 11.5, letterSpacing: "var(--tracking-data)" }}
                >
                  {e.docTitle}
                </span>
                <span
                  className="df-mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "var(--color-faint)",
                    letterSpacing: "var(--tracking-data)",
                    marginTop: 3,
                  }}
                >
                  {timeAgo(e.createdAt, dateLocale)}
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
  border: "1px solid var(--color-outline)",
  borderRadius: "var(--radius-md)",
  background: "var(--color-veil)",
  overflow: "hidden",
};

const headStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--color-outline)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, color: "var(--color-faint)", lineHeight: 1.5, padding: "14px 18px" }}>{children}</div>
  );
}
