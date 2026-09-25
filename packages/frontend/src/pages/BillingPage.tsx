import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { AppPage, PageHeader, TierCard, TierCtaInert, TierGrid, tierCtaStyle } from "@/components/shared";
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

  const planName = tiers.find((t) => t.slug === currentPlan)?.name ?? currentPlan;

  return (
    <AppPage>
      <PageHeader
        title="Billing"
        description={
          <>
            {planName ? <>You&apos;re on the <b style={{ color: "var(--df-text)" }}>{planName}</b> plan. </> : null}
            Each document consumes one credit; credits reset every Sunday at midnight UTC.
          </>
        }
      />

      {checkoutStatus === "success" && (
        <Banner tone="ok">Subscription active — thanks! It may take a few seconds to reflect below.</Banner>
      )}
      {checkoutStatus === "cancel" && <Banner tone="warn">Checkout canceled — no changes were made.</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <div style={{ paddingTop: 12 }}>
        <TierGrid>
          {tiers.map((tier) => (
            <TierCard
              key={tier.name}
              tier={tier}
              current={currentPlan === tier.slug}
              cta={
                <TierCta
                  tier={tier}
                  isCurrentPlan={currentPlan === tier.slug}
                  busy={busyPlan === tier.slug || (tier.slug !== "free" && currentPlan === tier.slug && busyPlan === "manage")}
                  onUpgrade={() => handleUpgrade(tier.slug)}
                  onManage={handleManageBilling}
                />
              }
            />
          ))}
        </TierGrid>
      </div>

      <p className="df-mono" style={{ textAlign: "center", marginTop: 32, fontSize: 10, letterSpacing: "0.12em", color: "var(--df-faint)" }}>
        Pricing details subject to change during beta.
      </p>
    </AppPage>
  );
}


function Banner({ tone, children }: { tone: "ok" | "warn" | "error"; children: ReactNode }) {
  const color = { ok: "#7fd99a", warn: "var(--df-warn)", error: "var(--df-error)" }[tone];
  return (
    <div
      style={{
        marginBottom: 24, padding: "12px 18px", borderRadius: 8, fontSize: 13,
        color, background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Tier CTA button ──────────────────────────────────────────

interface TierCtaProps {
  tier: Tier;
  isCurrentPlan: boolean;
  busy: boolean;
  onUpgrade: () => void;
  onManage: () => void;
}

function TierCta({ tier, isCurrentPlan, busy, onUpgrade, onManage }: TierCtaProps) {
  if (tier.slug === "free") {
    return <TierCtaInert>{isCurrentPlan ? "Current plan" : "Included"}</TierCtaInert>;
  }

  if (isCurrentPlan) {
    return (
      <button
        onClick={onManage}
        disabled={busy}
        style={{ ...tierCtaStyle, opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
    );
  }

  if (!tier.available) return <TierCtaInert>{tier.cta}</TierCtaInert>;

  return (
    <button
      onClick={onUpgrade}
      disabled={busy}
      className={tier.highlight ? "forge-btn" : ""}
      style={{
        ...tierCtaStyle,
        ...(tier.highlight ? { border: "none", color: undefined, background: undefined } : {}),
        opacity: busy ? 0.6 : 1,
        cursor: busy ? "wait" : "pointer",
      }}
    >
      {busy ? "Redirecting…" : tier.cta}
    </button>
  );
}
