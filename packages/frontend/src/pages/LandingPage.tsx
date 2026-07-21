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
          <span className="df-pill df-pill-heat">The trust layer for agent-written docs</span>
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
            Where agent work becomes a document you{" "}
            <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>can trust</em>.
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
            Your agent proposes changes; you review them as a diff and accept or reject by section; the system audits for contradictions — every edit attributed and versioned. Connect your own IDE agent over MCP, or let the hosted pipeline drive.
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
              Path B · hosted route · no agent required
            </span>
            <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.03em", margin: "14px 0 12px" }}>
              Six phases.{" "}
              <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>One coherent document.</em>
            </h2>
            <p style={{ fontSize: 15, color: "var(--df-dim)", maxWidth: 560, margin: "0 auto", lineHeight: 1.55 }}>
              No agent in your IDE yet? The hosted pipeline walks you through the same phases — and the same review, audit and history apply to what it writes.
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

        <AgentBadgesStrip />
        <AppFooter />
      </div>
    </div>
  );
}

const TRUST_FEATURES: { icon: string; title: string; body: string; tag?: string }[] = [
  { icon: "difference", title: "Suggestion review", body: "Agent writes land as pending diffs. Approve or reject by section — like reviewing a pull request." },
  { icon: "forum", title: "Feedback loop", body: "Comment on what's wrong; your agent reads it back over MCP and revises. The loop closes both ways." },
  { icon: "fact_check", title: "Quality gates", body: "Automatic audits flag contradictions and terminology drift between sections before you accept.", tag: "CI for docs" },
  { icon: "account_tree", title: "Bring your own agent", body: "Your IDE agent runs the document pipeline step by step over MCP — you keep the human checkpoints." },
  { icon: "description", title: "Structured document types", body: "Guided workflows for RFC, ADR, postmortem and runbook — the structure is enforced as you write." },
  { icon: "tune", title: "Your own pipelines & prompts", body: "Clone the baseline and encode how your team writes. Served to every connected agent.", tag: "Pro" },
  { icon: "download", title: "Export anywhere", body: "Download any document as Markdown, PDF or Word." },
  { icon: "history", title: "Versioned & attributed", body: "Every version is kept and labelled with who wrote it — you, or which agent." },
];

function TrustLayerFeatures() {
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
          The trust layer
        </span>
        <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em", margin: "12px 0 10px" }}>
          Not just watching your agent write.{" "}
          <em style={{ fontStyle: "normal", color: "var(--df-amber-300)" }}>Reviewing it.</em>
        </h2>
        <p style={{ fontSize: 15, color: "var(--df-dim)", maxWidth: 600, margin: "0 auto", lineHeight: 1.55 }}>
          Rendering an agent's output is easy. The hard, valuable part is trusting it — the review, audit and history that turn agent work into a document you'd sign your name to.
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
            key={f.title}
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
              <span style={{ fontSize: 15, fontWeight: 600, color: "#e3e2e2" }}>{f.title}</span>
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
            <p style={{ fontSize: 13, color: "var(--df-dim)", lineHeight: 1.5, margin: 0 }}>{f.body}</p>
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
