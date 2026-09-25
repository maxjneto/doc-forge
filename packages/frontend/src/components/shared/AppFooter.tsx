import { Link } from "react-router-dom";

const linkStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  color: "var(--df-dim)",
  textDecoration: "none",
  textTransform: "uppercase",
} as const;

export function AppFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--df-outline)", background: "var(--df-bg)", padding: "24px 0", marginTop: "auto" }}>
      <div
        style={{
          maxWidth: "var(--df-page-wide)",
          margin: "0 auto",
          padding: "0 var(--df-page-gutter)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--df-amber-500)", boxShadow: "0 0 8px var(--df-amber-glow)" }} />
          <span style={{ ...linkStyle, color: "var(--df-amber-500)" }}>Forge system ready</span>
        </div>
        <nav style={{ display: "flex", gap: 24 }}>
          <Link to="/legal/privacy" style={linkStyle}>Privacy</Link>
          <Link to="/legal/terms" style={linkStyle}>Terms</Link>
          <a href="mailto:maxjneto@gmail.com" style={linkStyle}>Contact</a>
        </nav>
      </div>
    </footer>
  );
}
