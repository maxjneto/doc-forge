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

export function LandingPage() {
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
          <span className="df-pill df-pill-heat">Foundry online · gpt-4o-mini</span>
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
            The workspace where you and your{" "}
            <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>AI agents</em>
            <br />
            forge technical docs.
          </h1>
          <p
            style={{
              fontSize: 17,
              color: "var(--df-dim)",
              lineHeight: 1.55,
              maxWidth: 600,
              margin: "0 0 12px",
            }}
          >
            DocForge is a structured document workspace — phased generation when you want guidance, MCP when your IDE agent is already in the driver's seat. Version-controlled, audited, and shared between you both.
          </p>

          <TrackPickerCards variant="hero" />
        </section>

        {/* Six phases preview */}
        <section style={{ maxWidth: 1100, margin: "80px auto", padding: "0 56px" }}>
          <div style={{ textAlign: "center", marginBottom: 44 }}>
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
              Path A · The Forger
            </span>
            <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", margin: "14px 0 12px" }}>
              Six phases.{" "}
              <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>One coherent document.</em>
            </h2>
            <p style={{ fontSize: 15, color: "var(--df-dim)", maxWidth: 560, margin: "0 auto", lineHeight: 1.55 }}>
              When you don't have an agent in your IDE yet — or you'd rather a structured pipeline drive — the Forger walks you through.
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
              See the full walkthrough
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
            </Link>
          </div>
        </section>

        <McpTeaserCard />
        <AgentBadgesStrip />
        <AppFooter />
      </div>
    </div>
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
