import { Link } from "react-router-dom";

export function BrandMark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <img
        src="/assets/docforge-logo.png"
        alt="DocForge"
        style={{ height: 28, width: "auto" }}
      />
      <span
        className="df-mono"
        style={{ fontSize: 13, fontWeight: 600, letterSpacing: "var(--tracking-label)", color: "var(--color-text)" }}
      >
        DOCFORGE
      </span>
    </Link>
  );
}
