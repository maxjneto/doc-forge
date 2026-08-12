import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

import { MarketingNav } from "@/components/marketing";
import { AppFooter, TopBar } from "@/components/shared";

const STEPS = [
  ["01", "Create or connect", "Start a Markdown document in DocForge, or let any MCP-compatible agent create one from your workflow."],
  ["02", "Work with real context", "Your agent uses its own model and tools to read code, talk to you, and follow the document templates you choose."],
  ["03", "Review every change", "Keep agent writes as suggestions when you need approval. Compare changes, leave feedback, and save named checkpoints."],
  ["04", "Publish a stable version", "Publish intentionally. New edits become a draft, so your public link keeps serving the version you approved."],
];

export function HowItWorksPage() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="hide-scrollbar" style={{ background: "#050608", color: "var(--df-on-surface)", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>
      {isSignedIn ? <TopBar dashboardNav /> : <MarketingNav active="how-it-works" />}
      <main style={{ maxWidth: 1050, margin: "0 auto", padding: isSignedIn ? "130px 56px 90px" : "90px 56px" }}>
        <header style={{ maxWidth: 760, marginBottom: 70 }}>
          <span className="df-pill df-pill-ghost">HOW IT WORKS</span>
          <h1 style={{ fontSize: "clamp(38px, 6vw, 64px)", lineHeight: 1, letterSpacing: "-.05em", margin: "20px 0" }}>
            Your agents write.<br /><span style={{ color: "var(--df-amber-300)" }}>You stay in control.</span>
          </h1>
          <p style={{ color: "var(--df-dim)", fontSize: 17, lineHeight: 1.65, margin: 0 }}>
            DocForge is the durable workspace for documents made with people and agents: write, review, organize, and publish without giving up ownership of the workflow.
          </p>
        </header>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 76 }}>
          {STEPS.map(([number, title, body]) => <article key={number} style={{ border: "1px solid var(--df-outline)", borderRadius: 8, padding: 24, background: "rgba(255,255,255,.018)" }}>
            <span className="df-mono" style={{ color: "var(--df-amber-300)", fontSize: 11 }}>{number}</span>
            <h2 style={{ fontSize: 17, margin: "22px 0 10px" }}>{title}</h2>
            <p style={{ color: "var(--df-dim)", fontSize: 13, lineHeight: 1.65, margin: 0 }}>{body}</p>
          </article>)}
        </section>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <article style={{ padding: 28, borderRadius: 8, background: "var(--color-white-03)", border: "1px solid var(--df-outline)" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--df-steel-100)" }}>smart_toy</span>
            <h2 style={{ margin: "16px 0 8px", fontSize: 18 }}>Bring your own agent</h2>
            <p style={{ color: "var(--df-dim)", lineHeight: 1.6, fontSize: 13, margin: 0 }}>Pipelines coordinate durable steps and human checkpoints. Your agent does the model work; DocForge keeps the state.</p>
          </article>
          <article style={{ padding: 28, borderRadius: 8, background: "var(--color-white-03)", border: "1px solid var(--df-outline)" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--df-steel-100)" }}>inventory_2</span>
            <h2 style={{ margin: "16px 0 8px", fontSize: 18 }}>Capacity that stays simple</h2>
            <p style={{ color: "var(--df-dim)", lineHeight: 1.6, fontSize: 13, margin: 0 }}>Plans limit new documents each week and active documents in your library. Editing existing work is never metered.</p>
          </article>
          <article style={{ padding: 28, borderRadius: 8, background: "var(--color-white-03)", border: "1px solid var(--df-outline)" }}>
            <span className="material-symbols-outlined" style={{ color: "var(--df-steel-100)" }}>download</span>
            <h2 style={{ margin: "16px 0 8px", fontSize: 18 }}>Export when you need it</h2>
            <p style={{ color: "var(--df-dim)", lineHeight: 1.6, fontSize: 13, margin: 0 }}>Pro members can export authenticated documents as Markdown, PDF, or DOCX.</p>
          </article>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
