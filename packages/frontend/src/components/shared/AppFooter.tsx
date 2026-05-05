import { Link } from "react-router-dom";

export function AppFooter() {
  return (
    <footer style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "#0A0A0A", padding: "24px 32px", marginTop: "auto" }}>
      <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF4D00", display: "inline-block", boxShadow: "0 0 8px rgba(255,77,0,0.5)" }} />
            <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#FF4D00", textTransform: "uppercase" }}>
              Forge System Ready
            </span>
          </div>
          <div style={{ display: "flex", gap: "24px" }}>
            <Link to="/legal/privacy" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c6c5", textDecoration: "none", textTransform: "uppercase" }}>Privacy</Link>
            <Link to="/legal/terms" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c6c5", textDecoration: "none", textTransform: "uppercase" }}>Terms</Link>
            <a href="mailto:maxjneto@gmail.com" style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c6c5", textDecoration: "none", textTransform: "uppercase" }}>Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
