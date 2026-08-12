import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppFooter } from "@/components/shared";
import { MarketingNav } from "@/components/marketing";
import { apiFetchTiers, type Tier } from "@/utils/api";

// Rendered until the API answers — tiers are served by GET /api/tiers so the
// backend limits and this page can never drift apart.
const FALLBACK_TIERS: Tier[] = [];

export function PricingPage() {
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetchTiers()
      .then((t) => { if (!cancelled) setTiers(t); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="hide-scrollbar"
      style={{
        background: "#050608",
        color: "var(--df-on-surface)",
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

      <MarketingNav active="pricing" />

      {/* Content */}
      <main
        style={{
          flex: 1,
          position: "relative",
          zIndex: 10,
          paddingTop: 80,
          paddingBottom: 96,
          paddingLeft: 56,
          paddingRight: 56,
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
            Capacity for durable document workflows.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--df-dim)",
              maxWidth: 480,
              lineHeight: 1.6,
              margin: "0 auto",
            }}
          >
            Each plan includes weekly document creations and active-document capacity. Edit, review, and publish existing documents without metering.
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
          {tiers.map((tier) => (
            <div
              key={tier.name}
              style={{
                padding: "28px 24px",
                background: tier.highlight ? "rgba(255,77,0,0.04)" : "rgba(13,14,15,0.6)",
                border: `1px solid ${tier.highlight ? "rgba(255,77,0,0.25)" : "var(--df-outline)"}`,
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
                    color: tier.highlight ? "var(--df-amber-300)" : "var(--df-faint)",
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

              <p style={{ fontSize: 13, color: "var(--df-dim)", lineHeight: 1.55, margin: 0 }}>
                {tier.description}
              </p>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {tier.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 14, color: "var(--df-amber-300)", flexShrink: 0, fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                    <span style={{ color: "var(--df-dim)" }}>{f}</span>
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
                          border: "1px solid var(--df-outline-md)",
                          color: "var(--df-dim)",
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
            color: "var(--df-mute)",
          }}
        >
          Pricing details are subject to change during beta. Weekly document creations renew every Monday at 00:00 UTC.
        </p>
      </main>

      <AppFooter />
    </div>
  );
}
