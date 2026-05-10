import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AppFooter } from "@/components/shared";

const TIERS = [
  {
    name: "Free",
    credits: "2 credits / week",
    desc: "Explore the forge. Limited to two documents per week, all phases included.",
    features: ["All six phases", "Markdown export", "Version history (3 versions per section)"],
    cta: "Get started",
    highlight: false,
  },
  {
    name: "Builder",
    credits: "10 credits / week",
    desc: "For engineers and technical writers who ship documentation regularly.",
    features: ["Everything in Free", "PDF export", "Unlimited version history", "Priority generation"],
    cta: "Coming soon",
    highlight: true,
  },
  {
    name: "Team",
    credits: "Unlimited",
    desc: "For teams that need shared workspaces, integrations, and audit trails.",
    features: ["Everything in Builder", "Confluence & Linear export", "Shared workspace", "SSO"],
    cta: "Coming soon",
    highlight: false,
  },
];

export function PricingPage() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

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
      }}
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 800px 600px at 50% 20%, rgba(255,77,0,0.08), transparent 60%)",
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
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
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
        </Link>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 22 }}>
          <Link
            to="/how-it-works"
            style={{
              fontSize: 12,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              textDecoration: "none",
              letterSpacing: "0.04em",
            }}
          >
            How it works
          </Link>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--df-amber-200, #ffb59e)",
              textDecoration: "none",
              letterSpacing: "0.04em",
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid rgba(255,77,0,0.30)",
              background: "rgba(255,77,0,0.06)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
            Back home
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main
        style={{
          flex: 1,
          position: "relative",
          zIndex: 10,
          padding: "80px 56px 96px",
          maxWidth: 1020,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ marginBottom: 56, textAlign: "center" }}>
          <span className="df-pill df-pill-ghost" style={{ marginBottom: 20, display: "inline-block" }}>
            Pricing
          </span>
          <h1
            style={{
              fontSize: "clamp(28px, 3.5vw, 44px)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              margin: "0 0 16px",
              color: "#e3e2e2",
            }}
          >
            Simple, credit-based pricing.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--df-dim, rgba(227,226,226,0.62))",
              maxWidth: 480,
              lineHeight: 1.6,
              margin: "0 auto",
            }}
          >
            Each document consumes one credit. Credits reset weekly. No seats, no overage surprises.
          </p>
        </div>

        {/* Tier cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              style={{
                padding: "28px 24px",
                background: tier.highlight ? "rgba(255,77,0,0.04)" : "rgba(13,14,15,0.6)",
                border: `1px solid ${tier.highlight ? "rgba(255,77,0,0.25)" : "var(--df-outline, rgba(255,255,255,0.06))"}`,
                borderRadius: 10,
                display: "flex",
                flexDirection: "column",
                gap: 20,
                position: "relative",
              }}
            >
              {tier.highlight && (
                <span
                  className="df-pill df-pill-heat"
                  style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)" }}
                >
                  Best option
                </span>
              )}

              <div>
                <span
                  className="df-mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: tier.highlight ? "var(--df-amber-300, #ff8d4a)" : "var(--df-faint, rgba(227,226,226,0.38))",
                    marginBottom: 6,
                  }}
                >
                  {tier.name}
                </span>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: "#e3e2e2",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {tier.credits}
                </span>
              </div>

              <p style={{ fontSize: 13, color: "var(--df-dim, rgba(227,226,226,0.62))", lineHeight: 1.55, margin: 0 }}>
                {tier.desc}
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, color: "var(--df-amber-300, #ff8d4a)", flexShrink: 0, fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span style={{ color: "var(--df-dim, rgba(227,226,226,0.62))" }}>{f}</span>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: "auto" }}>
                <Link
                  to="/"
                  className={tier.highlight ? "forge-btn" : ""}
                  style={
                    tier.highlight
                      ? {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "9px 18px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          letterSpacing: "0.02em",
                        }
                      : {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "9px 18px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: "none",
                          letterSpacing: "0.02em",
                          border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
                          color: "var(--df-dim, rgba(227,226,226,0.62))",
                          background: "transparent",
                        }
                  }
                >
                  {tier.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p
          className="df-mono"
          style={{
            textAlign: "center",
            marginTop: 40,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--df-mute, rgba(227,226,226,0.18))",
          }}
        >
          Pricing details subject to change during beta. All credits reset on Sunday at midnight UTC.
        </p>
      </main>

      <AppFooter />
    </div>
  );
}
