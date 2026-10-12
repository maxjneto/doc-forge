import { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { MarketingNav } from "@/components/marketing";
import { AppFooter } from "@/components/shared";
import { useI18n } from "@/i18n";

import { Button, Eyebrow, Pill } from "@/components/ui";
const COPY = {
  en: {
    badge: "The document workspace for agents", title: "Turn agent work into documents", accent: "you can stand behind.",
    body: "DocForge keeps writing, review, version history, and publishing in one shared workspace. Start in the editor or connect the agent you already use through MCP.",
    primary: "Open your workspace", secondary: "How it works", trust: "Designed for the real document loop",
    stats: [["Markdown editor", "Write and structure"], ["MCP workspace", "Connect your agent"], ["Published versions", "Share intentionally"]],
    canvas: "One shared source of truth", canvasTitle: "Your agent works in the document — not around it.", canvasBody: "Every edit lands in the same folder-based library. Make agent changes reviewable, leave feedback, and publish only the version you mean to share.",
    featuresLabel: "More than a document editor", featuresTitle: "Keep the context, decisions, and control close together.",
    features: [["account_tree", "A familiar document library", "Organize folders and documents like a file manager. Work stays visible at the right level."], ["terminal", "MCP-native collaboration", "Claude Code, Codex, Cursor, and compatible clients use the same documents through your API key."], ["difference", "Review instead of hoping", "Choose whether agent changes apply directly or arrive as reviewable suggestions."], ["history", "Publish with a stable history", "Draft freely, then choose a version for collaborators and your public read-only link."]],
    capacity: "Simple capacity, no credit anxiety.", capacityBody: "Plans limit document creations per week and active documents — never edits, reviews, or publications.", capacityCta: "See plans",
  },
  "pt-BR": {
    badge: "O workspace de documentos para agentes", title: "Transforme o trabalho do agente em documentos", accent: "que você pode defender.",
    body: "O DocForge reúne escrita, revisão, histórico de versões e publicação em um workspace compartilhado. Comece no editor ou conecte o agente que você já usa via MCP.",
    primary: "Abrir seu workspace", secondary: "Como funciona", trust: "Feito para o ciclo real de documentos",
    stats: [["Editor Markdown", "Escreva e estruture"], ["Workspace MCP", "Conecte seu agente"], ["Versões publicadas", "Compartilhe com intenção"]],
    canvas: "Uma única fonte de verdade", canvasTitle: "Seu agente trabalha no documento — não ao redor dele.", canvasBody: "Toda edição chega à mesma biblioteca de pastas. Torne alterações do agente revisáveis, deixe feedback e publique somente a versão que quer compartilhar.",
    featuresLabel: "Mais do que um editor de documentos", featuresTitle: "Mantenha contexto, decisões e controle próximos.",
    features: [["account_tree", "Uma biblioteca de documentos familiar", "Organize pastas e documentos como em um gerenciador de arquivos. O trabalho fica visível no nível certo."], ["terminal", "Colaboração nativa em MCP", "Claude Code, Codex, Cursor e clientes compatíveis usam os mesmos documentos com sua chave de API."], ["difference", "Revise em vez de torcer", "Escolha se alterações do agente aplicam direto ou chegam como sugestões revisáveis."], ["history", "Publique com histórico estável", "Edite livremente e depois escolha uma versão para colaboradores e seu link público somente leitura."]],
    capacity: "Capacidade simples, sem ansiedade com créditos.", capacityBody: "Os planos limitam documentos criados por semana e documentos ativos — nunca edições, revisões ou publicações.", capacityCta: "Ver planos",
  },
} as const;

export function LandingPage() {
  const { locale } = useI18n();
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const copy = COPY[locale];
  const openWorkspace = () => isSignedIn ? navigate("/home") : openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });

  useEffect(() => { document.body.style.overflow = "auto"; return () => { document.body.style.overflow = ""; }; }, []);

  return <div className="hide-scrollbar" style={{ background: "var(--color-bg)", color: "var(--color-text)", minHeight: "100vh", fontFamily: "var(--font-sans)", position: "relative", overflow: "hidden" }}>
    <Ambient />
    <div style={{ position: "relative", zIndex: 1 }}>
      <MarketingNav />
      <main>
        <section style={{ maxWidth: 1120, margin: "0 auto", padding: "82px 28px 48px", textAlign: "center" }}>
          <Pill tone="heat">{copy.badge}</Pill>
          <h1 style={{ fontSize: "clamp(42px, 6.4vw, 74px)", maxWidth: 940, margin: "20px auto", lineHeight: .96, letterSpacing: "-.06em", fontWeight: 600 }}>{copy.title}<br /><span style={{ color: "var(--color-heat-hi)" }}>{copy.accent}</span></h1>
          <p style={{ color: "var(--color-dim)", maxWidth: 650, margin: "0 auto", lineHeight: 1.63, fontSize: 17 }}>{copy.body}</p>
          <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Button size="lg" variant="primary" icon="folder_open" onClick={openWorkspace}>{copy.primary}</Button>
            <Button size="lg" icon="arrow_forward" onClick={() => navigate("/how-it-works")}>{copy.secondary}</Button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", maxWidth: 690, margin: "44px auto 0", borderTop: "1px solid var(--color-outline)", borderBottom: "1px solid var(--color-outline)" }}>
            {copy.stats.map(([title, body]) => <div key={title} style={{ padding: "15px 18px" }}><div style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 600 }}>{title}</div><div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-label)", marginTop: 5, textTransform: "uppercase" }}>{body}</div></div>)}
          </div>
        </section>

        <section style={{ maxWidth: 1120, padding: "25px 28px 108px", margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, .85fr) minmax(350px, 1.15fr)", gap: 50, alignItems: "center" }}>
          <div><Eyebrow tone="heat">{copy.canvas}</Eyebrow><h2 style={{ fontSize: "clamp(28px, 4vw, 43px)", letterSpacing: "-.045em", lineHeight: 1.06, margin: "12px 0 16px" }}>{copy.canvasTitle}</h2><p style={{ color: "var(--color-dim)", fontSize: 14, lineHeight: 1.65, maxWidth: 440, margin: 0 }}>{copy.canvasBody}</p><button onClick={() => navigate("/how-it-works#mcp")} style={{ marginTop: 24, border: 0, background: "transparent", color: "var(--color-heat-soft)", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, fontWeight: 600, fontFamily: "inherit" }}><span className="material-symbols-outlined" style={{ fontSize: 17 }}>terminal</span>{locale === "pt-BR" ? "Conectar via MCP" : "Connect through MCP"}</button></div>
          <DocumentLoopMock />
        </section>

        <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 28px 100px" }}>
          <div style={{ maxWidth: 670, marginBottom: 34 }}><Eyebrow tone="heat">{copy.featuresLabel}</Eyebrow><h2 style={{ fontSize: "clamp(28px, 4vw, 42px)", lineHeight: 1.08, letterSpacing: "-.04em", margin: "12px 0 0" }}>{copy.featuresTitle}</h2></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>{copy.features.map(([icon, title, body]) => <Feature key={title} icon={icon} title={title} body={body} />)}</div>
        </section>

        <section style={{ maxWidth: 1064, margin: "0 auto 90px", padding: "0 28px" }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, flexWrap: "wrap", padding: "28px 30px", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-heat-strong)", background: "var(--gradient-band)" }}><div><h2 style={{ margin: "0 0 7px", fontSize: 21, letterSpacing: "-.025em" }}>{copy.capacity}</h2><p style={{ margin: 0, color: "var(--color-dim)", fontSize: 13, lineHeight: 1.55, maxWidth: 650 }}>{copy.capacityBody}</p></div><Button size="lg" icon="arrow_forward" onClick={() => navigate("/pricing")}>{copy.capacityCta}</Button></div></section>
      </main>
      <AppFooter />
    </div>
  </div>;
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) { return <article style={{ minHeight: 190, border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", padding: 21, background: "var(--color-hover)" }}><span className="material-symbols-outlined" style={{ color: "var(--color-heat-hi)", fontSize: 22 }}>{icon}</span><h3 style={{ fontSize: 17, margin: "28px 0 8px" }}>{title}</h3><p style={{ color: "var(--color-dim)", fontSize: 13, lineHeight: 1.55, margin: 0 }}>{body}</p></article>; }
function DocumentLoopMock() { return <div style={{ border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-bg)", boxShadow: "var(--shadow-modal)" }}><div style={{ height: 40, borderBottom: "1px solid var(--color-outline)", padding: "0 14px", display: "flex", alignItems: "center", gap: 8 }}><span className="material-symbols-outlined" style={{ color: "var(--color-heat-hi)", fontSize: 17 }}>description</span><span className="df-mono" style={{ fontSize: 11.5, color: "var(--color-dim)" }}>payments-rfc.md</span><span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--color-heat-soft)", border: "1px solid var(--color-heat-line)", background: "var(--color-heat-wash)", borderRadius: "var(--radius-pill)", padding: "4px 7px" }}><span className="animate-df-pulse" style={{ width: 5, height: 5, borderRadius: "var(--radius-pill)", background: "var(--color-heat)" }} />MCP connected</span></div><div style={{ display: "grid", gridTemplateColumns: "125px 1fr 124px", minHeight: 300 }}><aside style={{ padding: "12px 9px", borderRight: "1px solid var(--color-outline)" }}><div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-label)", margin: "0 6px 9px" }}>OUTLINE</div>{["Context", "Proposal", "Implementation", "Rollback"].map((s, i) => <div key={s} style={{ padding: "6px", borderLeft: i === 2 ? "2px solid var(--color-heat)" : "2px solid transparent", color: i === 2 ? "var(--color-heat-soft)" : "var(--color-dim)", background: i === 2 ? "var(--color-heat-tint)" : "transparent", fontSize: 10 }}>{s}</div>)}</aside><div style={{ padding: "20px 19px" }}><div className="df-mono" style={{ fontSize: 11.5, color: "var(--color-heat-hi)" }}>## Implementation</div><p style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--color-dim)", margin: "10px 0" }}>Roll the async buffer behind a feature flag for one merchant cohort.</p><div style={{ borderLeft: "2px solid var(--color-heat)", background: "var(--color-heat-tint)", padding: "8px 9px", color: "var(--color-steel-hi)", fontSize: 11.5, lineHeight: 1.45 }}>Agent suggestion: add an explicit rollback owner and 30-second revert SLO.</div><div style={{ marginTop: 13, display: "flex", gap: 7 }}><span style={{ color: "var(--color-heat-soft)", fontSize: 10, border: "1px solid var(--color-heat-line)", borderRadius: "var(--radius-xs)", padding: "4px 6px" }}>Accept</span><span style={{ color: "var(--color-dim)", fontSize: 10, border: "1px solid var(--color-outline)", borderRadius: "var(--radius-xs)", padding: "4px 6px" }}>Request fix</span></div></div><aside style={{ borderLeft: "1px solid var(--color-outline)", padding: "12px 10px" }}><div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-label)", marginBottom: 9 }}>ACTIVITY</div>{[["Agent write", "now"], ["You reviewed", "2m"], ["Draft saved", "7m"]].map(([label, time], i) => <div key={label} style={{ borderTop: i ? "1px solid var(--color-outline)" : "none", padding: "8px 0" }}><div style={{ fontSize: 10, color: i === 0 ? "var(--color-heat-soft)" : "var(--color-dim)" }}>{label}</div><div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", marginTop: 3 }}>{time}</div></div>)}</aside></div></div>; }
function Ambient() { return <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 900px 620px at 25% 0%, var(--color-heat-wash), transparent 62%), radial-gradient(ellipse 750px 560px at 95% 35%, var(--color-steel-tint), transparent 65%)" }} />; }
