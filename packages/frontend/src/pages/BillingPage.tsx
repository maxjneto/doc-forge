import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { TopBar } from "@/components/shared";
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
import { Button, Card, Eyebrow, Meter, Page, PageHeader, textStyle } from "@/components/ui";

interface UsageState {
  user: CurrentUser;
  documents: number;
  agents: number;
}

export function BillingPage() {
  const { getToken } = useAuth();
  const { t, dateLocale } = useI18n();
  const navigate = useNavigate();
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

  const nextReset = usage?.user.next_document_creations_reset_at
    ? new Date(usage.user.next_document_creations_reset_at).toLocaleString(dateLocale, {
        weekday: "long",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
      <TopBar dashboardNav />

      <Page>
        {checkoutStatus === "success" && <Banner tone="ok">{t("billing.checkoutSuccess")}</Banner>}
        {checkoutStatus === "cancel" && <Banner tone="warn">{t("billing.checkoutCancel")}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}

        <PageHeader
          eyebrow={t("billing.account")}
          title={usage ? t("billing.currentPlan", { plan: currentTier?.name ?? usage.user.plan }) : t("common.loading")}
          lead={t("billing.description")}
        />

        <section style={{ marginBottom: 32 }}>
          <Eyebrow style={{ marginBottom: 12 }}>{t("billing.usage")}</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <UsageCard
              icon="bolt"
              label={t("dashboard.creationsLabel")}
              value={usage ? t("dashboard.creationsValue", { left: usage.user.document_creations_remaining, total: usage.user.weekly_document_creations }) : t("common.loading")}
              detail={nextReset ? t("billing.nextReset", { date: nextReset }) : undefined}
              current={usage ? usage.user.weekly_document_creations - usage.user.document_creations_remaining : undefined}
              limit={usage?.user.weekly_document_creations}
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

        <Card tone="heat" padded={false} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, padding: 22, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ ...textStyle.title, margin: "0 0 4px" }}>{t("billing.upgradeTitle")}</h2>
            <p style={{ margin: 0, color: "var(--color-dim)", fontSize: 13, lineHeight: 1.55 }}>{t("billing.upgradeBody")}</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {usage?.user.plan !== "free" && (
              <Button onClick={handleManageBilling} disabled={busy}>
                {busy ? t("common.loading") : t("billing.manage")}
              </Button>
            )}
            <Button variant="primary" icon="arrow_forward" onClick={() => navigate("/pricing")}>
              {t("billing.compare")}
            </Button>
          </div>
        </Card>
      </Page>
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
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18, minHeight: 140 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--color-faint)", fontSize: 12.5 }}>
        <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 17, color: "var(--color-faint)" }}>{icon}</span>
        {label}
      </div>
      <strong style={{ ...textStyle.title, fontVariantNumeric: "tabular-nums" }}>{value}</strong>
      {limit != null && current !== undefined && <Meter value={current} max={limit} />}
      {detail && <span style={{ fontSize: 11.5, color: "var(--color-faint)", lineHeight: 1.45 }}>{detail}</span>}
    </Card>
  );
}

function Banner({ children, tone }: { children: ReactNode; tone: "ok" | "warn" | "error" }) {
  const colors = {
    ok: ["var(--color-ok)", "var(--color-ok-wash)", "var(--color-ok-line)"],
    warn: ["var(--color-warn)", "var(--color-warn-wash)", "var(--color-warn-line)"],
    error: ["var(--color-error)", "var(--color-error-wash)", "var(--color-error-line)"],
  }[tone];
  return <div role="status" style={{ marginBottom: 24, padding: "12px 18px", borderRadius: "var(--radius-md)", color: colors[0], background: colors[1], border: `1px solid ${colors[2]}`, fontSize: 13 }}>{children}</div>;
}
