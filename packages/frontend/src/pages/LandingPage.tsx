import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { AppFooter } from "@/components/shared";

export function LandingPage() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleGetStarted() {
    if (isSignedIn) {
      navigate("/home");
    } else {
      openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });
    }
  }

  return (
    <div className="hide-scrollbar" style={{ background: "#0d0e0f", color: "#e3e2e2", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "Inter, sans-serif" }}>
      <main style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>

        {/* Hero Section */}
        <section style={{ position: "relative", minHeight: "600px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", overflow: "hidden" }}>
          {/* Radial gradient background */}
          <div style={{ position: "absolute", inset: 0, zIndex: 0, background: "radial-gradient(ellipse at center, #1A100C 0%, #0d0e0f 60%, #0d0e0f 100%)" }} />

          {/* Background image */}
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.3, mixBlendMode: "screen", pointerEvents: "none" }}>
            <img
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYyFJNl0hwDTyFAWZdjBCb3EFk0c5ydWLrCKirMB_Wk0Y1Uhkthr6xFrn8xunfAKYmr0TAgPyWpCwRQd1Z_zUnQ1WR1pEhEDk29u4c9SQkOtOER43N3wfaeuO95JK7JuisfSQ695Q_G1lLwjSGInz_DwF_UpMyfQbshF_hFMgtVq3UQNhWFUcf7IL9IwSeFj6Ir8uS_oxN9mNDGVgAGPXu-zir2VmUcvKXCTsoGOIs3k7zjDKunX8E7sp4CDkLndKob3ETgwTLPtmL"
            />
          </div>

          {/* Hero content */}
          <div style={{ position: "relative", zIndex: 10, textAlign: "center", width: "min(896px, 100%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "4px 16px", borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(10,10,10,0.5)", backdropFilter: "blur(12px)" }}>
              <span className="animate-pulse" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF4D00", display: "inline-block" }} />
              <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.05em", color: "#c8c6c5", textTransform: "uppercase" }}>
                Live Demo
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: "clamp(40px, 5vw, 56px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.1, color: "white", textTransform: "uppercase", margin: 0 }}>
              Engineering Technical{" "}
              <span style={{ color: "#FF4D00", display: "block", marginTop: "8px" }}>Documentation</span>
            </h1>

            {/* Subtitle */}
            <p style={{ fontSize: "16px", lineHeight: 1.6, letterSpacing: "-0.01em", color: "#c8c6c5", maxWidth: "672px", margin: 0 }}>
              Describe your system, align the structure with AI, and generate clear documentation that matches exactly what you have in mind.
            </p>

            {/* CTA */}
            <div style={{ marginTop: "16px" }}>
              <button
                onClick={handleGetStarted}
                className="forge-btn"
                style={{ padding: "16px 40px", borderRadius: "0.125rem", fontSize: "12px", fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", border: "none", cursor: "pointer" }}
              >
                Get Started
              </button>
            </div>
          </div>
        </section>

        {/* Features Section – 5 Stages */}
        <section style={{ padding: "40px 32px 48px", maxWidth: "1280px", margin: "0 auto", width: "100%", position: "relative", zIndex: 10, boxSizing: "border-box" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
            <StageCard icon="explore"     num="01." title="Discovery"   desc="Analyze context given by the user and iteratively refine understanding." />
            <StageCard icon="sync_alt"    num="02." title="Alignment"   desc="Summarize each section of the document and align it with the overall structure." />
            <StageCard icon="memory"      num="03." title="Generation"  desc="Synthesize comprehensive documentation drafts using specialized LLM prompts." />
            <StageCard icon="tune"        num="04." title="Refinement"  desc="Iteratively polish content in an interactive session with a specialized AI Agent." />
            <StageCard icon="fact_check"  num="05." title="Editing"       desc="Review and refine the final documentation manually for accuracy, clarity, and completeness." />
          </div>
        </section>
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  );
}

function StageCard({ icon, num, title, desc }: { icon: string; num: string; title: string; desc: string }) {
  return (
    <div className="stage-card" style={{ background: "linear-gradient(to bottom, #141414, #0A0A0A)", borderRadius: "0.25rem", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <span className="material-symbols-outlined" style={{ color: "#FF4D00", fontSize: "32px", marginBottom: "16px", opacity: 0.8 }}>
        {icon}
      </span>
      <h3 style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.05em", color: "white", textTransform: "uppercase", margin: "0 0 8px 0", fontFamily: "monospace" }}>
        <span style={{ color: "rgba(255,77,0,0.5)" }}>{num}</span>{" "}{title}
      </h3>
      <p style={{ fontSize: "14px", lineHeight: 1.5, color: "rgba(200,198,197,0.7)", margin: 0 }}>
        {desc}
      </p>
    </div>
  );
}

