import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import {
  MarketingNav,
  TrackPickerCards,
  ScrollNarratedPhases,
  McpStepBlocks,
} from "@/components/marketing";
import { AppFooter, TopBar } from "@/components/shared";

export function HowItWorksPage() {
  const { hash } = useLocation();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    if (!hash) return;
    const id = hash.replace(/^#/, "");
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash]);

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
      {isSignedIn && <TopBar dashboardNav />}
      <Ambient />

      <div style={{ position: "relative", zIndex: 1, paddingTop: isSignedIn ? 56 : 0 }}>
        {!isSignedIn && <MarketingNav active="how-it-works" />}

        {/* Hero */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 56px 60px", textAlign: "center" }}>
          <span className="df-pill df-pill-ghost">How it works</span>
          <h1
            style={{
              fontSize: "clamp(34px, 4.5vw, 54px)",
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 1.05,
              margin: "18px auto 18px",
              maxWidth: 820,
            }}
          >
            Two ways to forge.
            <br />
            One <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>shared workspace</em>.
          </h1>
          <p style={{ fontSize: 16, color: "var(--df-dim)", lineHeight: 1.6, maxWidth: 580, margin: "0 auto" }}>
            DocForge is a structured document workspace. Use the Forger to walk through a guided pipeline, or connect
            your IDE's agent and let it drive — both work on the same docs, with version control built in.
          </p>
        </section>

        {/* Two-path picker */}
        <section style={{ maxWidth: 1100, margin: "0 auto 80px", padding: "0 56px" }}>
          <TrackPickerCards variant="picker" />
        </section>

        <ScrollNarratedPhases />
        <McpStepBlocks />
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
            "radial-gradient(ellipse 900px 600px at 20% 0%, rgba(255,77,0,0.10), transparent 60%), radial-gradient(ellipse 800px 600px at 80% 60%, rgba(138,160,184,0.05), transparent 70%)",
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
