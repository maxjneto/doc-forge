import { useEffect } from "react";
import { Link } from "react-router-dom";
import { AppFooter } from "@/components/shared";

const PHASES = [
  {
    num: "01",
    label: "Discovery",
    desc: "Describe your system. DocForge asks targeted follow-up questions to fill context gaps and build a rich understanding of the problem space.",
  },
  {
    num: "02",
    label: "Alignment",
    desc: "Review and refine the proposed document structure. Agree on sections, scope, and depth before any generation begins.",
  },
  {
    num: "03",
    label: "Generation",
    desc: "All sections are generated in parallel with section-level context, producing a coherent first draft at machine speed.",
  },
  {
    num: "04",
    label: "Refinement",
    desc: "Chat with the forge to revise individual sections. Each conversation is section-scoped. Full version history is tracked.",
  },
  {
    num: "05",
    label: "Audit",
    desc: "Automated cross-section consistency checks surface contradictions, missing links, and coverage gaps before you ship.",
  },
  {
    num: "06",
    label: "Completed",
    desc: "Export to Markdown, PDF, or push directly to Confluence or Linear. Your document is sealed with a forge stamp.",
  },
];

export function HowItWorksPage() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

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

      {/* Nav */}
      <nav
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          position: "relative",
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: "linear-gradient(135deg, #ff4d00, #6e1d00)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 0 14px rgba(255,77,0,0.45)",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                background: "#fff",
                clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
              }}
            />
          </div>
          <span
            className="df-mono"
            style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "#e3e2e2" }}
          >
            DOCFORGE
          </span>
        </Link>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 22 }}>
          <Link
            to="/pricing"
            style={{
              fontSize: 12,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              textDecoration: "none",
              letterSpacing: "0.04em",
            }}
          >
            Pricing
          </Link>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--df-amber-200, #ffb59e)",
              textDecoration: "none",
              letterSpacing: "0.04em",
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid rgba(255,77,0,0.30)",
              background: "rgba(255,77,0,0.06)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>arrow_back</span>
            Back home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main
        style={{
          flex: 1,
          position: "relative",
          zIndex: 10,
          padding: "80px 56px 96px",
          maxWidth: 900,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div style={{ marginBottom: 48, textAlign: "center" }}>
          <span className="df-pill df-pill-ghost" style={{ marginBottom: 20, display: "inline-block" }}>
            How it works
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
            Six phases. One coherent document.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--df-dim, rgba(227,226,226,0.62))",
              maxWidth: 520,
              lineHeight: 1.6,
              margin: "0 auto",
            }}
          >
            DocForge guides your document from raw context to a polished, audited artifact - in a structured pipeline that mirrors how a senior engineer would approach it.
          </p>
        </div>

        {/* Phase cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {PHASES.map((phase, i) => (
            <div
              key={phase.num}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                gap: 24,
                alignItems: "flex-start",
                padding: "24px 28px",
                background: "rgba(13,14,15,0.6)",
                border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
                borderRadius: 10,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Subtle left glow on first two phases */}
              {i < 2 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "var(--df-amber-trail, rgba(255,77,0,0.42))",
                    borderRadius: "10px 0 0 10px",
                  }}
                />
              )}
              <div>
                <span
                  className="df-mono"
                  style={{
                    display: "block",
                    fontSize: 20,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    color: i < 2
                      ? "var(--df-amber-trail, rgba(255,77,0,0.42))"
                      : "var(--df-mute, rgba(227,226,226,0.18))",
                  }}
                >
                  {phase.num}
                </span>
              </div>
              <div>
                <span
                  className="df-mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--df-amber-300, #ff8d4a)",
                    marginBottom: 6,
                  }}
                >
                  {phase.label}
                </span>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--df-dim, rgba(227,226,226,0.62))",
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {phase.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
