import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppFooter, TierCard, TierCtaInert, TierGrid, tierCtaStyle } from "@/components/shared";
import { MarketingNav } from "@/components/marketing";
import { apiFetchTiers, type Tier } from "@/utils/api";
import { useBodyScroll } from "@/hooks/useBodyScroll";

// Rendered until the API answers — tiers are served by GET /api/tiers so the
// backend limits and this page can never drift apart.
const FALLBACK_TIERS: Tier[] = [];

export function PricingPage() {
  const [tiers, setTiers] = useState<Tier[]>(FALLBACK_TIERS);

  useBodyScroll();

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
        background: "var(--df-bg)",
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

        <TierGrid>
          {tiers.map((tier) => (
            <TierCard
              key={tier.name}
              tier={tier}
              cta={
                tier.available ? (
                  <Link
                    to="/"
                    className={tier.highlight ? "forge-btn" : ""}
                    style={tier.highlight ? { ...tierCtaStyle, border: "none", color: undefined, background: undefined } : tierCtaStyle}
                  >
                    {tier.cta}
                  </Link>
                ) : (
                  <TierCtaInert>{tier.cta}</TierCtaInert>
                )
              }
            />
          ))}
        </TierGrid>

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
