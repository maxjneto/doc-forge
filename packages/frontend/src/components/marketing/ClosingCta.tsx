import { useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";

export function ClosingCta() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  function start() {
    if (isSignedIn) navigate("/home");
    else openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
  }

  return (
    <section style={{ maxWidth: 900, margin: "0 auto 80px", padding: "0 56px", textAlign: "center" }}>
      <span
        className="df-mono"
        style={{ fontSize: 11.5, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-heat-hi)", fontWeight: 600 }}
      >
        Stop pasting markdown between tools
      </span>
      <h2 style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.035em", margin: "16px 0 16px", lineHeight: 1.05 }}>
        Forge your next RFC
        <br />
        where <em style={{ fontStyle: "normal", color: "var(--color-heat-hi)" }}>you and your agent</em> can both work.
      </h2>
      <p style={{ fontSize: 14, color: "var(--color-dim)", lineHeight: 1.55, margin: "0 0 32px" }}>
        Free while in beta. Five forges per week. Bring any agent that speaks MCP.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={start}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--color-heat)",
            color: "var(--color-on-heat)",
            padding: "10px 18px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            border: "1px solid var(--color-heat)",
            cursor: "pointer",
            boxShadow: "0 0 0 1px var(--color-heat-strong), 0 4px 14px var(--color-heat-strong)",
            fontFamily: "inherit",
          }}
        >
          Start with the Forger
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
        </button>
        <button
          onClick={() => navigate("/how-it-works#mcp")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "var(--color-steel-hi)",
            padding: "10px 18px",
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--color-steel-line)",
            background: "var(--color-steel-wash)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Or connect your agent
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
        </button>
      </div>
    </section>
  );
}
