import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";

export function DashboardTipCard() {
  const { t } = useI18n();
  return (
    <section
      style={{
        border: "1px solid rgba(255,77,0,0.20)",
        borderRadius: 12,
        background: "linear-gradient(180deg, rgba(255,77,0,0.05), rgba(18,20,20,0.5))",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "18px 20px" }}>
        <span
          className="df-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--df-amber-300)",
            fontWeight: 600,
          }}
        >
          {t("dashboard.tip")}
        </span>
        <div style={{ fontSize: 13, color: "var(--df-on-surface)", lineHeight: 1.55, marginTop: 8 }}>
          {t("dashboard.tipBody")}
        </div>
        <Link
          to="/how-it-works#mcp"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            marginTop: 12,
            color: "var(--df-amber-200)",
            fontSize: 12,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          {t("dashboard.setupMcp")}
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_forward</span>
        </Link>
      </div>
    </section>
  );
}
