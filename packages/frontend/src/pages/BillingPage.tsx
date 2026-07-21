import { useEffect, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { TopBar, AppFooter } from "@/components/shared";
import {
  apiFetchTiers,
  apiFetchMe,
  apiCreateCheckoutSession,
  apiCreatePortalSession,
  type Tier,
} from "@/utils/api";

export function BillingPage() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  // Tiers come from GET /api/tiers — the same source the backend enforces.
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkoutStatus = searchParams.get("checkout");

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetchTiers()
      .then((t) => { if (!cancelled) setTiers(t); })
      .catch(() => {});
    apiFetchMe(getToken)
      .then((me) => { if (!cancelled) setCurrentPlan(me.plan); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [getToken]);

  // Clear the ?checkout= param once shown so a refresh doesn't re-show the banner.
  useEffect(() => {
    if (!checkoutStatus) return;
    const t = setTimeout(() => {
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }, 6000);
    return () => clearTimeout(t);
  }, [checkoutStatus, searchParams, setSearchParams]);

  async function handleUpgrade(planSlug: string) {
    if (busyPlan) return;
    setError(null);
    setBusyPlan(planSlug);
    try {
      const url = await apiCreateCheckoutSession(planSlug as "pro" | "team", getToken);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start checkout");
      setBusyPlan(null);
    }
  }

  async function handleManageBilling() {
    if (busyPlan) return;
    setError(null);
    setBusyPlan("manage");
    try {
      const url = await apiCreatePortalSession(getToken);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open billing portal");
      setBusyPlan(null);
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
      }}
    >
      <TopBar dashboardNav />

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

      <main
        style={{
          flex: 1,
          position: "relative",
          zIndex: 10,
          paddingTop: 136,
          paddingBottom: 96,
          paddingLeft: 56,
          paddingRight: 56,
          maxWidth: 1020,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {checkoutStatus === "success" && (
          <div
            style={{
              marginBottom: 24, padding: "12px 18px", borderRadius: 8,
              background: "rgba(80,200,120,0.08)", border: "1px solid rgba(80,200,120,0.25)",
              color: "#7fd99a", fontSize: 13, textAlign: "center",
            }}
          >
            Subscription active — thanks! It may take a few seconds to reflect below.
          </div>
        )}
        {checkoutStatus === "cancel" && (
          <div
            style={{
              marginBottom: 24, padding: "12px 18px", borderRadius: 8,
              background: "rgba(255,196,0,0.08)", border: "1px solid rgba(255,196,0,0.25)",
              color: "#ffd25e", fontSize: 13, textAlign: "center",
            }}
          >
            Checkout canceled — no changes were made.
          </div>
        )}
        {error && (
          <div
            style={{
              marginBottom: 24, padding: "12px 18px", borderRadius: 8,
              background: "rgba(232,100,100,0.08)", border: "1px solid rgba(232,100,100,0.25)",
              color: "#e88", fontSize: 13, textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

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
                {tier.description}
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
                <TierCta
                  tier={tier}
                  isCurrentPlan={currentPlan === tier.slug}
                  busy={busyPlan === tier.slug || (tier.slug !== "free" && currentPlan === tier.slug && busyPlan === "manage")}
                  onUpgrade={() => handleUpgrade(tier.slug)}
                  onManage={handleManageBilling}
                />
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

// ─── Tier CTA button ──────────────────────────────────────────

const baseCtaStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 18px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: "none",
  letterSpacing: "0.02em",
  width: "100%",
  fontFamily: "inherit",
  cursor: "pointer",
};

interface TierCtaProps {
  tier: Tier;
  isCurrentPlan: boolean;
  busy: boolean;
  onUpgrade: () => void;
  onManage: () => void;
}

function TierCta({ tier, isCurrentPlan, busy, onUpgrade, onManage }: TierCtaProps) {
  // Free tier (or no billing yet): the pre-existing "get started" link.
  if (tier.slug === "free") {
    return (
      <Link
        to="/home"
        style={{
          ...baseCtaStyle,
          border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
          color: "var(--df-dim, rgba(227,226,226,0.62))",
          background: "transparent",
        }}
      >
        {tier.cta}
      </Link>
    );
  }

  if (isCurrentPlan) {
    return (
      <button
        onClick={onManage}
        disabled={busy}
        style={{
          ...baseCtaStyle,
          border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
          color: "var(--df-dim, rgba(227,226,226,0.62))",
          background: "transparent",
          opacity: busy ? 0.6 : 1,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
    );
  }

  if (!tier.available) {
    return (
      <span
        style={{
          ...baseCtaStyle,
          border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
          color: "var(--df-mute, rgba(227,226,226,0.38))",
          background: "transparent",
          opacity: 0.6,
          cursor: "not-allowed",
        }}
      >
        {tier.cta}
      </span>
    );
  }

  return (
    <button
      onClick={onUpgrade}
      disabled={busy}
      className={tier.highlight ? "forge-btn" : ""}
      style={
        tier.highlight
          ? { ...baseCtaStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }
          : {
              ...baseCtaStyle,
              border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
              color: "var(--df-dim, rgba(227,226,226,0.62))",
              background: "transparent",
              opacity: busy ? 0.6 : 1,
              cursor: busy ? "wait" : "pointer",
            }
      }
    >
      {busy ? "Redirecting…" : tier.cta}
    </button>
  );
}
