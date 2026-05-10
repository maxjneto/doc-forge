import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { AppFooter } from "@/components/shared";

const PHASES = [
  { num: "01", label: "Discovery" },
  { num: "02", label: "Alignment" },
  { num: "03", label: "Generation" },
  { num: "04", label: "Refinement" },
  { num: "05", label: "Audit" },
  { num: "06", label: "Completed" },
];

export function LandingPage() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleGetStarted() {
    if (isSignedIn) {
      navigate("/home");
    } else {
      openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
    }
  }

  return (
    <div
      className="hide-scrollbar"
      style={{
        background: "#050608",
        color: "var(--df-on-surface, #e3e2e2)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background gradients */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 800px 600px at 50% 20%, rgba(255,77,0,0.10), transparent 60%), radial-gradient(ellipse 1200px 400px at 50% 100%, rgba(110,29,0,0.18), transparent 70%)",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 4px)",
          zIndex: 0,
        }}
      />

      {/* Nav */}
      <nav
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          position: "relative",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: "linear-gradient(135deg, #ff4d00, #6e1d00)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 0 14px rgba(255,77,0,0.45)",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                background: "#fff",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              }}
            />
          </div>
          <span
            className="df-mono"
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "#e3e2e2" }}
          >
            DOCFORGE
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 22 }}>
          <Link
            to="/how-it-works"
            style={{
              fontSize: 12,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              textDecoration: "none",
              letterSpacing: "0.04em",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-dim, rgba(227,226,226,0.62))"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-faint, rgba(227,226,226,0.38))"; }}
          >
            How it works
          </Link>
          <Link
            to="/pricing"
            style={{
              fontSize: 12,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              textDecoration: "none",
              letterSpacing: "0.04em",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-dim, rgba(227,226,226,0.62))"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-faint, rgba(227,226,226,0.38))"; }}
          >
            Pricing
          </Link>
          <button
            onClick={handleGetStarted}
            style={{
              fontSize: 12,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            Sign in
          </button>
          <button
            onClick={handleGetStarted}
            className="forge-btn"
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.04em",
              border: "none",
              cursor: "pointer",
            }}
          >
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 56px",
          textAlign: "center",
          position: "relative",
          zIndex: 10,
          minHeight: 500,
        }}
      >
        {/* Pill badge */}
        <span
          className="df-pill df-pill-heat"
          style={{ marginBottom: 24 }}
        >
          Foundry online
        </span>

        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(36px, 4.5vw, 56px)",
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1.04,
            margin: "0 0 18px",
            maxWidth: 900,
          }}
        >
          Forge documents the way your{" "}
          <em style={{ fontStyle: "normal", color: "var(--df-amber-300, #ff8d4a)" }}>
            senior engineers
          </em>{" "}
          would.
        </h1>

        {/* Sub */}
        <p
          style={{
            fontSize: 16,
            color: "var(--df-dim, rgba(227,226,226,0.62))",
            lineHeight: 1.55,
            maxWidth: 600,
            margin: "0 0 32px",
          }}
        >
          Describe the system, align the structure, and pour clean documentation
          in parallel sections. No blank-page paralysis, no LLM slop.
        </p>

        {/* CTA */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={handleGetStarted}
            className="forge-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 22px",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              letterSpacing: "0.02em",
            }}
          >
            <span>Start forging</span>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              arrow_forward
            </span>
          </button>
        </div>

        {/* Phase stepper visualization */}
        <LandingStepper />
      </main>

      <AppFooter />
    </div>
  );
}

function LandingStepper() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "12px 18px",
        border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(13,14,15,0.6)",
        borderRadius: 999,
        backdropFilter: "blur(8px)",
        marginTop: 40,
      }}
    >
      {PHASES.map((phase, i) => {
        const isDone = i < 2;
        const isNow = i === 2;
        return (
          <div key={phase.num} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && (
              <div
                style={{
                  width: 16,
                  height: 1,
                  background: i <= 2
                    ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                    : "var(--df-mute, rgba(227,226,226,0.18))",
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "6px 14px",
                gap: 6,
              }}
            >
              {isNow && (
                <div
                  className="animate-df-pulse"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "var(--df-amber-500, #ff4d00)",
                    boxShadow: "0 0 8px var(--df-amber-500), 0 0 18px var(--df-amber-glow)",
                  }}
                />
              )}
              <span
                className="df-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: isDone
                    ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                    : isNow
                    ? "var(--df-amber-500, #ff4d00)"
                    : "var(--df-mute, rgba(227,226,226,0.18))",
                }}
              >
                <span style={{ marginRight: 4 }}>{phase.num}</span>
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
