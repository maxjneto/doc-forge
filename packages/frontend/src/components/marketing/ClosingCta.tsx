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
        style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--df-amber-300)", fontWeight: 600 }}
      >
        Stop pasting markdown between tools
      </span>
      <h2 style={{ fontSize: 42, fontWeight: 600, letterSpacing: "-0.035em", margin: "16px 0 16px", lineHeight: 1.05 }}>
        Forge your next RFC
        <br />
        where <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>you and your agent</em> can both work.
      </h2>
      <p style={{ fontSize: 15, color: "var(--df-dim)", lineHeight: 1.55, margin: "0 0 32px" }}>
        Free while in beta. Five forges per week. Bring any agent that speaks MCP.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={start}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--df-amber-500)",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0.02em",
            border: "1px solid var(--df-amber-500)",
            cursor: "pointer",
            boxShadow: "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)",
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
            color: "var(--df-steel-100)",
            padding: "10px 18px",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--df-steel-border)",
            background: "var(--df-steel-bg)",
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
