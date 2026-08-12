import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { TopBar, AppFooter } from "@/components/shared";
import {
  apiCreatePortalSession,
  apiFetchMe,
  apiFetchTiers,
  apiListApiKeys,
  apiListDocuments,
  type CurrentUser,
  type Tier,
} from "@/utils/api";
import { useI18n } from "@/i18n";

interface UsageState {
  user: CurrentUser;
  documents: number;
  agents: number;
}

export function BillingPage() {
  const { getToken } = useAuth();
  const { t, dateLocale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutStatus = searchParams.get("checkout");

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetchTiers(),
      apiFetchMe(getToken),
      apiListDocuments(getToken),
      apiListApiKeys(getToken),
    ])
      .then(([tierList, user, documents, keys]) => {
        if (cancelled) return;
        setTiers(tierList);
        setUsage({
          user,
          documents: documents.length,
          agents: keys.filter((key) => !key.revokedAt).length,
        });
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Failed to load account usage");
      });
    return () => { cancelled = true; };
  }, [getToken]);

  useEffect(() => {
    if (!checkoutStatus) return;
    const timeout = setTimeout(() => {
      searchParams.delete("checkout");
      setSearchParams(searchParams, { replace: true });
    }, 6000);
    return () => clearTimeout(timeout);
  }, [checkoutStatus, searchParams, setSearchParams]);

  const currentTier = useMemo(
    () => tiers.find((tier) => tier.slug === usage?.user.plan) ?? null,
    [tiers, usage?.user.plan],
  );

  async function handleManageBilling() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      window.location.href = await apiCreatePortalSession(getToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to open billing portal");
      setBusy(false);
    }
  }

  const nextReset = usage?.user.next_credit_reset_at
    ? new Date(usage.user.next_credit_reset_at).toLocaleString(dateLocale, {
        weekday: "long",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return (
    <div className="hide-scrollbar" style={pageStyle}>
      <TopBar dashboardNav />
      <div aria-hidden="true" style={ambientStyle} />

      <main style={mainStyle}>
        {checkoutStatus === "success" && <Banner tone="ok">{t("billing.checkoutSuccess")}</Banner>}
        {checkoutStatus === "cancel" && <Banner tone="warn">{t("billing.checkoutCancel")}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}

        <header style={{ marginBottom: 36 }}>
          <span className="df-pill df-pill-ghost">{t("billing.account")}</span>
          <h1 style={{ margin: "16px 0 10px", fontSize: "clamp(28px, 3.5vw, 42px)", letterSpacing: "-0.035em", fontWeight: 650 }}>
            {usage ? t("billing.currentPlan", { plan: currentTier?.name ?? usage.user.plan }) : t("common.loading")}
          </h1>
          <p style={{ margin: 0, maxWidth: 680, color: "var(--df-dim)", lineHeight: 1.6, fontSize: 14 }}>
            {t("billing.description")}
          </p>
        </header>

        <section style={{ marginBottom: 34 }}>
          <div className="df-mono" style={sectionLabelStyle}>{t("billing.usage")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <UsageCard
              icon="bolt"
              label={t("billing.credits")}
              value={usage ? t("billing.creditsRemaining", { current: usage.user.credits, total: usage.user.weekly_credits }) : t("common.loading")}
              detail={nextReset ? t("billing.nextReset", { date: nextReset }) : undefined}
              current={usage?.user.credits}
              limit={usage?.user.weekly_credits}
            />
            <UsageCard
              icon="description"
              label={t("billing.documents")}
              value={usage ? formatLimit(usage.documents, currentTier?.limits.maxActiveDocuments, t("billing.unlimited")) : t("common.loading")}
              current={usage?.documents}
              limit={currentTier?.limits.maxActiveDocuments}
            />
            <UsageCard
              icon="smart_toy"
              label={t("billing.agents")}
              value={usage ? formatLimit(usage.agents, currentTier?.limits.maxApiKeys, t("billing.unlimited")) : t("common.loading")}
              current={usage?.agents}
              limit={currentTier?.limits.maxApiKeys}
            />
          </div>
        </section>

        <section style={upgradeStyle}>
          <div>
            <h2 style={{ margin: "0 0 6px", fontSize: 17 }}>{t("billing.upgradeTitle")}</h2>
            <p style={{ margin: 0, color: "var(--df-dim)", fontSize: 13, lineHeight: 1.55 }}>
              {t("billing.upgradeBody")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {usage?.user.plan !== "free" && (
              <button onClick={handleManageBilling} disabled={busy} style={secondaryButtonStyle}>
                {busy ? t("common.loading") : t("billing.manage")}
              </button>
            )}
            <Link to="/pricing" className="forge-btn" style={primaryLinkStyle}>
              {t("billing.compare")}
            </Link>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}

function formatLimit(current: number, limit: number | null | undefined, unlimited: string) {
  return limit == null ? `${current} · ${unlimited}` : `${current} / ${limit}`;
}

function UsageCard({
  icon,
  label,
  value,
  detail,
  current,
  limit,
}: {
  icon: string;
  label: string;
  value: string;
  detail?: string;
  current?: number;
  limit?: number | null;
}) {
  const ratio = limit && current !== undefined ? Math.min(1, current / limit) : null;
  return (
    <article style={usageCardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--df-faint)", fontSize: 11.5 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 17, color: "var(--df-steel-100)" }}>{icon}</span>
        {label}
      </div>
      <strong style={{ fontSize: 19, letterSpacing: "-0.02em" }}>{value}</strong>
      {ratio !== null && (
        <div style={{ height: 4, borderRadius: 999, background: "var(--df-outline-md)", overflow: "hidden" }}>
          <div style={{ width: `${ratio * 100}%`, height: "100%", background: "var(--df-steel-200)", borderRadius: 999 }} />
        </div>
      )}
      {detail && <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)", lineHeight: 1.45 }}>{detail}</span>}
    </article>
  );
}

function Banner({ children, tone }: { children: ReactNode; tone: "ok" | "warn" | "error" }) {
  const colors = {
    ok: ["var(--color-ok)", "rgba(95,179,131,0.08)", "var(--color-ok-border)"],
    warn: ["var(--df-warn)", "var(--color-warn-bg)", "var(--color-warn-border)"],
    error: ["var(--df-error)", "var(--df-error-bg)", "var(--color-error-border)"],
  }[tone];
  return <div style={{ marginBottom: 24, padding: "12px 18px", borderRadius: 8, color: colors[0], background: colors[1], border: `1px solid ${colors[2]}`, fontSize: 13 }}>{children}</div>;
}

const pageStyle: CSSProperties = {
  background: "#050608",
  color: "var(--df-on-surface)",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  fontFamily: "'Inter', sans-serif",
  position: "relative",
};

const ambientStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  background: "radial-gradient(ellipse 800px 600px at 50% 20%, rgba(255,77,0,0.08), transparent 60%)",
  zIndex: 0,
};

const mainStyle: CSSProperties = {
  flex: 1,
  position: "relative",
  zIndex: 10,
  padding: "136px 56px 96px",
  maxWidth: 1020,
  margin: "0 auto",
  width: "100%",
};

const sectionLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--df-faint)",
  marginBottom: 12,
};

const usageCardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: 20,
  minHeight: 150,
  border: "1px solid var(--df-outline)",
  borderRadius: 10,
  background: "rgba(18,20,20,0.72)",
};

const upgradeStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 24,
  padding: 24,
  border: "1px solid var(--color-heat-20)",
  borderRadius: 10,
  background: "linear-gradient(110deg, var(--color-heat-05), rgba(18,20,20,0.7))",
  flexWrap: "wrap",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 6,
  border: "1px solid var(--df-outline-md)",
  background: "transparent",
  color: "var(--df-dim)",
  cursor: "pointer",
  font: "inherit",
  fontSize: 12,
  fontWeight: 600,
};

const primaryLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 16px",
  borderRadius: 6,
  color: "white",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 600,
};
