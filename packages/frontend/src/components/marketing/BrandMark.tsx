import { Link } from "react-router-dom";

export function BrandMark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: 5,
          background: "linear-gradient(135deg, var(--df-amber-500), var(--df-amber-700))",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 0 16px rgba(255,77,0,0.45)",
        }}
      >
        <div
          style={{
            width: 9,
            height: 9,
            background: "#fff",
            clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
          }}
        />
      </div>
      <span
        className="df-mono"
        style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.10em", color: "#e3e2e2" }}
      >
        DOCFORGE
      </span>
    </Link>
  );
}
