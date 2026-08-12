import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MarketingNav,
  TrackPickerCards,
  PhaseTimelineRow,
  McpTeaserCard,
  AgentBadgesStrip,
} from "@/components/marketing";
import { AppFooter } from "@/components/shared";
import { useI18n } from "@/i18n";

export function LandingPage() {
  const { t } = useI18n();
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="hide-scrollbar"
      style={{
        background: "#050608",
        color: "#e3e2e2",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
      }}
    >
      <Ambient />

      <div style={{ position: "relative", zIndex: 1 }}>
        <MarketingNav />

        {/* Hero */}
        <section
          style={{
            padding: "80px 56px 64px",
            maxWidth: 1320,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <span className="df-pill df-pill-heat">{t("landing.badge")}</span>
          <h1
            style={{
              fontSize: "clamp(36px, 5vw, 60px)",
              fontWeight: 600,
              letterSpacing: "-0.040em",
              lineHeight: 1.02,
              margin: "18px 0 22px",
              maxWidth: 920,
            }}
          >
            {t("landing.title")} {" "}
            <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>{t("landing.titleAccent")}</em>.
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "var(--df-dim)",
              lineHeight: 1.55,
              maxWidth: 640,
              margin: "0 0 12px",
            }}
          >
            {t("landing.description")}
          </p>

          <TrackPickerCards variant="hero" />
        </section>

        {/* Trust-layer capabilities */}
        <TrustLayerFeatures />

        {/* MCP — the primary route */}
        <McpTeaserCard />

        {/* Six phases preview — the secondary, no-agent route */}
        <section style={{ maxWidth: 1100, margin: "40px auto 80px", padding: "0 56px" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
            <span
              className="df-mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--df-steel-100)",
                fontWeight: 600,
              }}
            >
              {t("landing.hostedPath")}
            </span>
            <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", margin: "14px 0 12px" }}>
              {t("landing.sixPhases")} {" "}
              <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>{t("landing.oneDocument")}</em>
            </h2>
            <p style={{ fontSize: 15, color: "var(--df-dim)", maxWidth: 560, margin: "0 auto", lineHeight: 1.55 }}>
              {t("landing.phasesDescription")}
            </p>
          </div>

          <PhaseTimelineRow activeIndex={2} />

          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <Link
              to="/how-it-works"
              style={{
                fontSize: 13,
                color: "var(--df-amber-200)",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 6,
                border: "1px solid rgba(255,77,0,0.30)",
                background: "rgba(255,77,0,0.06)",
                textDecoration: "none",
              }}
            >
              {t("landing.walkthrough")}
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </Link>
          </div>
        </section>

        <AgentBadgesStrip />
        <AppFooter />
      </div>
    </div>
  );
}

const TRUST_FEATURES: { icon: string; titleKey: string; bodyKey: string; tag?: string }[] = [
  { icon: "difference", titleKey: "landing.feature.suggestions", bodyKey: "landing.feature.suggestionsBody" },
  { icon: "forum", titleKey: "landing.feature.feedback", bodyKey: "landing.feature.feedbackBody" },
  { icon: "fact_check", titleKey: "landing.feature.gates", bodyKey: "landing.feature.gatesBody", tag: "CI for docs" },
  { icon: "account_tree", titleKey: "landing.feature.agent", bodyKey: "landing.feature.agentBody" },
  { icon: "description", titleKey: "landing.feature.types", bodyKey: "landing.feature.typesBody" },
  { icon: "tune", titleKey: "landing.feature.pipelines", bodyKey: "landing.feature.pipelinesBody", tag: "Pro" },
  { icon: "download", titleKey: "landing.feature.export", bodyKey: "landing.feature.exportBody" },
  { icon: "history", titleKey: "landing.feature.history", bodyKey: "landing.feature.historyBody" },
];

function TrustLayerFeatures() {
  const { t } = useI18n();
  return (
    <section style={{ maxWidth: 1100, margin: "24px auto 0", padding: "0 56px" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <span
          className="df-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--df-amber-300)",
            fontWeight: 600,
          }}
        >
          {t("landing.trustLayer")}
        </span>
        <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", margin: "12px 0 10px" }}>
          {t("landing.reviewTitle")} {" "}
          <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>{t("landing.reviewAccent")}</em>
        </h2>
        <p style={{ fontSize: 15, color: "var(--df-dim)", maxWidth: 600, margin: "0 auto", lineHeight: 1.55 }}>
          {t("landing.reviewDescription")}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {TRUST_FEATURES.map((f) => (
          <div
            key={f.titleKey}
            style={{
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.015)",
              borderRadius: 12,
              padding: "18px 18px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color: "var(--df-amber-300)" }}
              >
                {f.icon}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#e3e2e2" }}>{t(f.titleKey)}</span>
              {f.tag && (
                <span
                  className="df-mono"
                  style={{
                    marginLeft: "auto",
                    fontSize: 9.5,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--df-amber-200)",
                    border: "1px solid rgba(255,77,0,0.30)",
                    borderRadius: 4,
                    padding: "2px 6px",
                  }}
                >
                  {f.tag}
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: "var(--df-dim)", lineHeight: 1.5, margin: 0 }}>{t(f.bodyKey)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Ambient() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 900px 600px at 20% 0%, rgba(255,77,0,0.10), transparent 60%), radial-gradient(ellipse 700px 500px at 90% 35%, rgba(110,29,0,0.18), transparent 65%), radial-gradient(ellipse 1200px 500px at 50% 100%, rgba(255,77,0,0.06), transparent 70%)",
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
    </>
  );
}
