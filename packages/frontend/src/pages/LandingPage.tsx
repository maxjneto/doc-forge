import { useEffect, useState, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { MarketingNav } from "@/components/marketing";
import { AppFooter } from "@/components/shared";
import { useI18n } from "@/i18n";
import { MCP_URL } from "@/utils/mcpUrl";
import { Button, Card, Eyebrow, Pill, textStyle } from "@/components/ui";

const LIB_URL = "https://github.com/maxjneto/docforge-layout";
const NPM_URL = "https://www.npmjs.com/package/@docforge-lib/layout";

const COPY = {
  en: {
    badge: "For people who write with AI agents",
    title: "Your agent writes.",
    accent: "You sign off.",
    body: "DocForge is where the agent you already use writes your documents — reports, specs, one-pagers, slide decks — and where you review every change before it counts.",
    primary: "Start for free",
    secondary: "How it works",
    note: "Free plan · no card · Claude Code, Codex, Cursor and any MCP client",
    seeLabel: "How the agent sees the page",
    seeTitle: "It never looks at the page. It still gets it right.",
    seeBody: "Agents are blind to layout: they cannot tell a paragraph will push the chart onto the next page. DocForge measures every line itself and hands the agent a map of each page in text. After every write it says what moved, what grew and what no longer fits — so the agent fixes it before you ever see it.",
    seeMap: "What the agent reads",
    seePage: "What you see",
    kindsLabel: "Two kinds of document",
    kindsTitle: "Text you review, and pages that hold their layout.",
    markdownTitle: "Markdown, with review",
    markdownBody: "The agent's writes arrive as suggestions. You see the diff, keep the changes you want, and send the rest back with a note it reads next time.",
    markdownPoints: ["Accept, reject or keep part of a change", "Versions, comments and a quality gate", "Export to Markdown, PDF and Word"],
    layoutTitle: "Pages and slides",
    layoutBody: "Reports, one-pagers, proposals and decks made of KPIs, charts, tables and text on a grid. The agent builds them; you refine them in a visual editor.",
    layoutPoints: ["Prints to PDF exactly as it looks", "Comments the agent answers", "Publish a link other sites load"],
    connectLabel: "Connect in one command",
    connectTitle: "Bring the agent you already use.",
    connectBody: "Create an API key, add DocForge to your client, and ask for a document. Every change is attributed to the agent that made it.",
    copy: "Copy",
    copied: "Copied",
    trustLabel: "Control stays with you",
    trust: [
      ["difference", "Nothing lands unreviewed", "Choose per document: agent writes wait for your approval, or apply directly."],
      ["history", "Every version kept", "See who changed what, compare, and restore any earlier version in one click."],
      ["forum", "Talk to the agent in the page", "Pin a comment to a block and ask for a change; the agent does it and answers in the thread."],
      ["public", "Publish on purpose", "A public link serves the version you published. Drafts stay drafts until you publish again."],
    ],
    openLabel: "Open source",
    openTitle: "The layout engine is a library you can use too.",
    openBody: "@docforge-lib/layout measures, paginates and renders documents in Node and in the browser, without a headless browser. MIT licensed.",
    openGithub: "View on GitHub",
    priceTitle: "Everything DocForge does is in the free plan.",
    priceBody: "Pro lifts the limits for people who write with agents every day — for R$ 19 a month.",
    priceCta: "See plans",
  },
  "pt-BR": {
    badge: "Para quem escreve com agentes de IA",
    title: "Seu agente escreve.",
    accent: "Você aprova.",
    body: "O DocForge é onde o agente que você já usa escreve seus documentos — relatórios, especificações, one-pagers, apresentações — e onde você revisa cada mudança antes que ela valha.",
    primary: "Começar grátis",
    secondary: "Como funciona",
    note: "Plano gratuito · sem cartão · Claude Code, Codex, Cursor e qualquer cliente MCP",
    seeLabel: "Como o agente vê a página",
    seeTitle: "Ele nunca olha a página. E acerta mesmo assim.",
    seeBody: "Agentes não enxergam diagramação: não sabem que um parágrafo vai empurrar o gráfico para a próxima página. O DocForge mede cada linha sozinho e entrega ao agente um mapa de cada página em texto. A cada escrita, ele conta o que mudou de lugar, o que cresceu e o que não cabe mais — e o agente corrige antes de você ver.",
    seeMap: "O que o agente lê",
    seePage: "O que você vê",
    kindsLabel: "Dois tipos de documento",
    kindsTitle: "Texto que você revisa, e páginas que mantêm a diagramação.",
    markdownTitle: "Markdown, com revisão",
    markdownBody: "As escritas do agente chegam como sugestões. Você vê o diff, fica com as mudanças que quer e devolve o resto com uma nota que ele lê na próxima vez.",
    markdownPoints: ["Aceite, rejeite ou fique com parte de uma mudança", "Versões, comentários e um gate de qualidade", "Exporte em Markdown, PDF e Word"],
    layoutTitle: "Páginas e slides",
    layoutBody: "Relatórios, one-pagers, propostas e apresentações feitos de indicadores, gráficos, tabelas e texto numa grade. O agente monta; você ajusta num editor visual.",
    layoutPoints: ["Imprime em PDF exatamente como aparece", "Comentários que o agente responde", "Publique um link que outros sites carregam"],
    connectLabel: "Conecte com um comando",
    connectTitle: "Traga o agente que você já usa.",
    connectBody: "Crie uma chave de API, adicione o DocForge ao seu cliente e peça um documento. Cada mudança fica atribuída ao agente que a fez.",
    copy: "Copiar",
    copied: "Copiado",
    trustLabel: "O controle fica com você",
    trust: [
      ["difference", "Nada entra sem revisão", "Escolha por documento: as escritas do agente esperam sua aprovação ou entram direto."],
      ["history", "Toda versão guardada", "Veja quem mudou o quê, compare e volte para qualquer versão com um clique."],
      ["forum", "Fale com o agente na página", "Fixe um comentário num bloco e peça uma mudança; o agente faz e responde na conversa."],
      ["public", "Publique quando quiser", "O link público mostra a versão que você publicou. Rascunhos continuam rascunhos até a próxima publicação."],
    ],
    openLabel: "Código aberto",
    openTitle: "O motor de diagramação é uma biblioteca que você também pode usar.",
    openBody: "@docforge-lib/layout mede, pagina e desenha documentos no Node e no navegador, sem navegador headless. Licença MIT.",
    openGithub: "Ver no GitHub",
    priceTitle: "Tudo o que o DocForge faz está no plano gratuito.",
    priceBody: "O Pro tira os limites de quem escreve com agentes todo dia — por R$ 19 por mês.",
    priceCta: "Ver planos",
  },
} as const;

const CONNECT_COMMAND = `claude mcp add --transport http docforge ${MCP_URL} \\\n  --header "Authorization: Bearer <your key>"`;

export function LandingPage() {
  const { locale } = useI18n();
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const copy = COPY[locale];
  const openWorkspace = () => (isSignedIn ? navigate("/home") : openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" }));

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="hide-scrollbar" style={{ background: "var(--color-bg)", color: "var(--color-text)", minHeight: "100vh", fontFamily: "var(--font-sans)", position: "relative", overflow: "hidden" }}>
      <Ambient />
      <div style={{ position: "relative", zIndex: 1 }}>
        <MarketingNav />
        <main>
          {/* Hero */}
          <section style={{ maxWidth: 1120, margin: "0 auto", padding: "84px 24px 56px", textAlign: "center" }}>
            <Pill tone="heat">{copy.badge}</Pill>
            <h1 style={{ fontSize: "clamp(44px, 7vw, 82px)", maxWidth: 900, margin: "22px auto 20px", lineHeight: 0.96, letterSpacing: "-.06em", fontWeight: 600 }}>
              {copy.title}
              <br />
              <span style={{ color: "var(--color-heat-hi)" }}>{copy.accent}</span>
            </h1>
            <p style={{ color: "var(--color-dim)", maxWidth: 640, margin: "0 auto", lineHeight: 1.63, fontSize: 17 }}>{copy.body}</p>
            <div style={{ marginTop: 30, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              <Button size="lg" variant="primary" icon="arrow_forward" onClick={openWorkspace}>{copy.primary}</Button>
              <Button size="lg" onClick={() => navigate("/how-it-works")}>{copy.secondary}</Button>
            </div>
            <p className="df-mono" style={{ ...textStyle.label, color: "var(--color-faint)", marginTop: 22, lineHeight: 1.6 }}>{copy.note}</p>
          </section>

          {/* How the agent sees the page */}
          <Section>
            <SectionHead label={copy.seeLabel} title={copy.seeTitle} body={copy.seeBody} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 16, alignItems: "stretch" }}>
              <Panel label={copy.seeMap} icon="terminal" tone="steel"><MapMock /></Panel>
              <Panel label={copy.seePage} icon="visibility" tone="heat"><PageMock /></Panel>
            </div>
          </Section>

          {/* Two kinds of document */}
          <Section>
            <SectionHead label={copy.kindsLabel} title={copy.kindsTitle} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 16 }}>
              <KindCard tone="warm" icon="description" title={copy.markdownTitle} body={copy.markdownBody} points={copy.markdownPoints}><ReviewMock /></KindCard>
              <KindCard tone="steel" icon="dashboard" title={copy.layoutTitle} body={copy.layoutBody} points={copy.layoutPoints}><SlidesMock /></KindCard>
            </div>
          </Section>

          {/* Connect */}
          <Section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 40, alignItems: "center" }}>
              <SectionHead label={copy.connectLabel} title={copy.connectTitle} body={copy.connectBody} align="start" />
              <CommandBlock command={CONNECT_COMMAND} copyLabel={copy.copy} copiedLabel={copy.copied} />
            </div>
          </Section>

          {/* Control */}
          <Section>
            <SectionHead label={copy.trustLabel} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 14 }}>
              {copy.trust.map(([icon, title, body]) => <Feature key={title} icon={icon} title={title} body={body} />)}
            </div>
          </Section>

          {/* Open source */}
          <Section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 40, alignItems: "center", border: "1px solid var(--color-steel-line)", borderRadius: "var(--radius-lg)", background: "var(--gradient-steel)", padding: "34px 32px" }}>
              <div>
                <Eyebrow style={{ color: "var(--color-steel-hi)" }}>{copy.openLabel}</Eyebrow>
                <h2 style={{ ...h2, fontSize: "clamp(24px, 3vw, 32px)", margin: "12px 0 12px" }}>{copy.openTitle}</h2>
                <p style={lead}>{copy.openBody}</p>
                <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
                  <Button icon="arrow_outward" onClick={() => window.open(LIB_URL, "_blank", "noopener")}>{copy.openGithub}</Button>
                  <Button variant="ghost" icon="arrow_outward" onClick={() => window.open(NPM_URL, "_blank", "noopener")}>npm</Button>
                </div>
              </div>
              <CommandBlock command={"npm install @docforge-lib/layout"} copyLabel={copy.copy} copiedLabel={copy.copied} />
            </div>
          </Section>

          {/* Pricing band */}
          <section style={{ maxWidth: 1064, margin: "0 auto 96px", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 22, flexWrap: "wrap", padding: "28px 30px", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-heat-strong)", background: "var(--gradient-band)" }}>
              <div>
                <h2 style={{ margin: "0 0 7px", fontSize: "var(--text-heading)", letterSpacing: "-.025em" }}>{copy.priceTitle}</h2>
                <p style={{ margin: 0, color: "var(--color-dim)", fontSize: "var(--text-body)", lineHeight: 1.55, maxWidth: 640 }}>{copy.priceBody}</p>
              </div>
              <Button size="lg" variant="primary" icon="arrow_forward" onClick={() => navigate("/pricing")}>{copy.priceCta}</Button>
            </div>
          </section>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

// ─── Layout pieces ────────────────────────────────────────────

const h2 = { fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600, letterSpacing: "-.04em", lineHeight: 1.08 } as const;
const lead = { color: "var(--color-dim)", fontSize: "var(--text-body)", lineHeight: 1.65, margin: 0 } as const;

function Section({ children }: { children: ReactNode }) {
  return <section style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 24px 72px" }}>{children}</section>;
}

function SectionHead({ label, title, body, align = "center" }: { label: string; title?: string; body?: string; align?: "center" | "start" }) {
  const centered = align === "center";
  return (
    <div style={{ maxWidth: centered ? 720 : 520, margin: centered ? "0 auto 34px" : 0, textAlign: centered ? "center" : "left" }}>
      <Eyebrow tone="heat" align={centered ? "center" : "start"}>{label}</Eyebrow>
      {title && <h2 style={{ ...h2, margin: "12px 0 14px" }}>{title}</h2>}
      {body && <p style={lead}>{body}</p>}
    </div>
  );
}

function Panel({ label, icon, tone, children }: { label: string; icon: string; tone: "steel" | "heat"; children: ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--color-chrome)", boxShadow: "var(--shadow-modal)", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 40, padding: "0 14px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid var(--color-outline)" }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: tone === "steel" ? "var(--color-steel-hi)" : "var(--color-heat-hi)" }}>{icon}</span>
        <span style={{ ...textStyle.label, color: "var(--color-dim)" }}>{label}</span>
      </div>
      <div style={{ flex: 1, padding: 18 }}>{children}</div>
    </div>
  );
}

function KindCard({ tone, icon, title, body, points, children }: { tone: "warm" | "steel"; icon: string; title: string; body: string; points: readonly string[]; children: ReactNode }) {
  const accent = tone === "warm" ? "var(--color-heat-hi)" : "var(--color-steel-hi)";
  return (
    <Card tone={tone} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <span className="material-symbols-outlined" style={{ color: accent, fontSize: 24 }}>{icon}</span>
        <h3 style={{ margin: "18px 0 8px", fontSize: "var(--text-heading)", letterSpacing: "-.025em" }}>{title}</h3>
        <p style={{ color: "var(--color-dim)", fontSize: "var(--text-body)", lineHeight: 1.6, margin: 0 }}>{body}</p>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {points.map((p) => (
          <li key={p} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "var(--text-body-sm)", color: "var(--color-dim)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15, color: accent }}>check</span>{p}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "auto" }}>{children}</div>
    </Card>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <article style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", padding: 20, background: "var(--color-hover)" }}>
      <span className="material-symbols-outlined" style={{ color: "var(--color-heat-hi)", fontSize: 22 }}>{icon}</span>
      <h3 style={{ fontSize: "var(--text-title)", margin: "20px 0 8px" }}>{title}</h3>
      <p style={{ color: "var(--color-dim)", fontSize: "var(--text-body-sm)", lineHeight: 1.55, margin: 0 }}>{body}</p>
    </article>
  );
}

function CommandBlock({ command, copyLabel, copiedLabel }: { command: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(command.replace(/\\\n\s*/g, "")).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  };
  return (
    <div style={{ position: "relative", border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-md)", background: "var(--color-sink)", padding: "18px 18px 18px 18px", minWidth: 0 }}>
      <pre className="df-mono" style={{ margin: 0, fontSize: "var(--text-body-sm)", lineHeight: 1.7, color: "var(--color-text)", whiteSpace: "pre-wrap", wordBreak: "break-all", paddingRight: 70 }}>
        <span style={{ color: "var(--color-heat-hi)" }}>$ </span>{command}
      </pre>
      <button onClick={copy} className="df-mono" style={{ position: "absolute", top: 12, right: 12, ...textStyle.label, background: "transparent", border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-xs)", color: copied ? "var(--color-ok)" : "var(--color-dim)", padding: "6px 8px", cursor: "pointer" }}>
        {copied ? copiedLabel : copyLabel}
      </button>
    </div>
  );
}

// ─── Product mocks (drawn with tokens, no screenshots) ────────

/** Boxes of exact widths, so the drawing lines up like the real map (one character per unit). */
const top = (label: string, w: number) => `┌${label}${"─".repeat(w - 2 - label.length)}┐`;
const bottom = (w: number) => `└${"─".repeat(w - 2)}┘`;
const MAP_ROWS = [
  ` 0 ${top("title", 36)}`,
  ` 4 ${bottom(36)}`,
  ` 6 ${top("k1", 12)}${top("k2", 12)}${top("k3", 12)}`,
  `13 ${bottom(12)}${bottom(12)}${bottom(12)}`,
  `15 ${top("analysis", 22)}${top("chart", 14)}`,
  `36 ${bottom(22)}${bottom(14)}`,
  `38 ${top("table", 36)}`,
  `53 ${bottom(36)}`,
];

/** The text map and the write summary, in the shape the layout tools return them. */
function MapMock() {
  const line = (text: string, color = "var(--color-dim)") => <div key={text} style={{ color, whiteSpace: "pre" }}>{text}</div>;
  return (
    <div className="df-mono" style={{ fontSize: 11.5, lineHeight: 1.55, overflowX: "auto" }}>
      {line("page 1 · A4 · 89 × 130 units", "var(--color-faint)")}
      {MAP_ROWS.map((row) => line(row))}
      <div style={{ height: 12 }} />
      {line("you changed", "var(--color-text)")}
      {line("  analysis  h17 → h21 (2 paragraphs)", "var(--color-heat-soft)")}
      {line("it moved on its own", "var(--color-text)")}
      {line("  table     pushed down 4 rows by analysis", "var(--color-steel-hi)")}
      {line("problems: none · p1 77 free rows", "var(--color-ok)")}
    </div>
  );
}

/** The same page, drawn. */
function PageMock() {
  const bar = (w: string, c = "var(--color-outline-md)") => <div style={{ height: 6, width: w, borderRadius: "var(--radius-xs)", background: c }} />;
  return (
    <div style={{ background: "var(--color-surface-high)", border: "1px solid var(--color-outline)", borderRadius: "var(--radius-sm)", padding: 18, display: "flex", flexDirection: "column", gap: 12, aspectRatio: "0.78", maxHeight: 360, margin: "0 auto" }}>
      <div style={{ fontSize: "var(--text-title)", fontWeight: 600, letterSpacing: "-.02em" }}>Q3 report</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[["28", "+27%"], ["1.4k", "+9%"], ["99.8%", "SLO"]].map(([v, d]) => (
          <div key={v} style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-xs)", padding: "8px 9px" }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{v}</div>
            <div style={{ fontSize: 10, color: "var(--color-ok)" }}>{d}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderLeft: "2px solid var(--color-heat)", paddingLeft: 8, background: "var(--color-heat-tint)" }}>
          {bar("92%")}{bar("85%")}{bar("90%")}{bar("70%")}{bar("88%")}{bar("60%")}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 72 }}>
          {[40, 55, 48, 70, 82].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: "var(--radius-xs) var(--radius-xs) 0 0", background: i === 4 ? "var(--color-heat)" : "var(--color-steel-line)" }} />)}
        </div>
      </div>
      <div style={{ border: "1px solid var(--color-steel-line)", borderRadius: "var(--radius-xs)", padding: 8, display: "flex", flexDirection: "column", gap: 6, background: "var(--color-steel-tint)" }}>
        {bar("100%", "var(--color-outline)")}{bar("100%", "var(--color-outline)")}{bar("100%", "var(--color-outline)")}
      </div>
    </div>
  );
}

function ReviewMock() {
  const row = (sign: string, text: string, kind: "add" | "del" | "ctx") => (
    <div style={{ display: "flex", gap: 8, padding: "2px 8px", background: kind === "add" ? "var(--color-diff-add-bg)" : kind === "del" ? "var(--color-diff-del-bg)" : "transparent", color: kind === "add" ? "var(--color-diff-add-fg)" : kind === "del" ? "var(--color-diff-del-fg)" : "var(--color-dim)" }}>
      <span style={{ width: 8 }}>{sign}</span>
      <span style={{ textDecoration: kind === "del" ? "line-through" : "none" }}>{text}</span>
    </div>
  );
  return (
    <div className="df-mono" style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-sm)", background: "var(--color-bg)", fontSize: 11.5, lineHeight: 1.6, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderBottom: "1px solid var(--color-outline)" }}>
        <Pill tone="steel" compact>Claude Code</Pill>
        <span style={{ color: "var(--color-faint)" }}>change 1 of 3</span>
      </div>
      {row(" ", "## Rollout", "ctx")}
      {row("−", "Ship to everyone on Monday.", "del")}
      {row("+", "Ship to 5% behind a flag; widen daily.", "add")}
      {row("+", "Owner of the rollback: payments on-call.", "add")}
      <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderTop: "1px solid var(--color-outline)" }}>
        <span style={{ color: "var(--color-on-heat)", background: "var(--color-heat)", borderRadius: "var(--radius-xs)", padding: "3px 8px" }}>Accept</span>
        <span style={{ color: "var(--color-dim)", border: "1px solid var(--color-outline)", borderRadius: "var(--radius-xs)", padding: "3px 8px" }}>Keep some</span>
      </div>
    </div>
  );
}

function SlidesMock() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ aspectRatio: "16 / 9", border: `1px solid ${i === 1 ? "var(--color-steel-line)" : "var(--color-outline)"}`, borderRadius: "var(--radius-xs)", background: "var(--color-bg)", padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ height: 6, width: "60%", borderRadius: "var(--radius-xs)", background: "var(--color-text)", opacity: 0.7 }} />
          {i === 0 && <div style={{ height: 4, width: "40%", borderRadius: "var(--radius-xs)", background: "var(--color-outline-md)" }} />}
          {i === 1 && (
            <div style={{ display: "flex", gap: 4, marginTop: "auto" }}>
              {[0, 1, 2].map((k) => <div key={k} style={{ flex: 1, height: 16, borderRadius: "var(--radius-xs)", border: "1px solid var(--color-steel-line)" }} />)}
            </div>
          )}
          {i === 2 && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22, marginTop: "auto" }}>
              {[40, 70, 55, 90].map((h, k) => <div key={k} style={{ flex: 1, height: `${h}%`, background: k === 3 ? "var(--color-heat)" : "var(--color-steel-line)", borderRadius: "var(--radius-xs) var(--radius-xs) 0 0" }} />)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Ambient() {
  return <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 900px 620px at 25% 0%, var(--color-heat-wash), transparent 62%), radial-gradient(ellipse 750px 560px at 95% 35%, var(--color-steel-tint), transparent 65%)" }} />;
}
