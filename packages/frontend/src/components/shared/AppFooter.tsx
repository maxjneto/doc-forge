import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";

export function AppFooter() {
  const { t } = useI18n();
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#0A0A0A", padding: "24px 32px", marginTop: "auto" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--df-amber-500)", display: "inline-block", boxShadow: "0 0 8px rgba(255,77,0,0.5)" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "var(--df-amber-500)", textTransform: "uppercase" }}>
              {t("footer.ready")}
            </span>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            <Link to="/legal/privacy" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c6c5", textDecoration: "none", textTransform: "uppercase" }}>{t("footer.privacy")}</Link>
            <Link to="/legal/terms" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c6c5", textDecoration: "none", textTransform: "uppercase" }}>{t("footer.terms")}</Link>
            <a href="mailto:maxjneto@gmail.com" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c6c5", textDecoration: "none", textTransform: "uppercase" }}>{t("footer.contact")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
