import { useEffect } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";

import { MarketingNav } from "@/components/marketing";
import { AppFooter, TopBar } from "@/components/shared";
import { useI18n } from "@/i18n";

import { Button, Card, Eyebrow, Pill } from "@/components/ui";
const COPY = {
  en: {
    badge: "How it works", title: "A document workspace for", accent: "you and your agent.",
    intro: "Create a document, connect the agent you already use, and keep every change reviewable, attributed, and ready to publish — whether it is text or a page laid out on a grid.",
    primary: "Start for free", secondary: "Connect an agent", flowLabel: "One document, one shared workflow",
    flowTitle: "From a blank page to a version you can share.",
    flow: [["01", "Create", "A Markdown document, or a page or slide deck — empty or from a template. Folders keep the library in order."], ["02", "Connect", "Give Claude Code, Codex, Cursor, or another MCP client an API key. It reads the guides and starts writing."], ["03", "Review", "Agent writes arrive as suggestions you accept, reject or keep in part. On pages, comment on a block and the agent answers."], ["04", "Publish", "Pick the version people should read: a read-only link, or a page other sites load."]],
    workspaceLabel: "The workspace", workspaceTitle: "Your library stays the source of truth.", workspaceBody: "Documents live beside folders like a familiar file manager. Your agent and your browser work on the same document, so there is no copying context between tools.",
    entryLabel: "Two ways in", entryTitle: "Write it yourself, or let the agent build it.",
    editorTitle: "Write in the editor", editorBody: "Write Markdown with a live outline, or arrange a page in the visual editor. Invite collaborators and publish when it is ready.", editorCta: "Create a document",
    agentTitle: "Connect through MCP", agentBody: "Generate an API key, add DocForge to your MCP client, and ask for a report, a spec or a deck. The agent drafts, measures, fixes and hands it back for review.", agentCta: "See MCP setup",
    controlsLabel: "Control never leaves the document", controlsTitle: "Built for judgment, not token meters.",
    controls: [["difference", "Reviewable changes", "Set a policy per document: agent edits apply immediately or wait for your approval."], ["history", "Versions and attribution", "Every write records who made it — you or which agent — and any version comes back in one click."], ["forum", "Comments the agent reads", "Pin a request to a block or an area; the agent sees it first, does it, and replies in the thread."], ["public", "Stable public sharing", "A public link serves the version you published. New edits stay drafts until you publish again."]],
    capacityTitle: "Make space without losing work.", capacityBody: "Archive documents you are done with to free active-document capacity; their history remains available to restore later.",
  },
  "pt-BR": {
    badge: "Como funciona", title: "Um workspace de documentos para", accent: "você e seu agente.",
    intro: "Crie um documento, conecte o agente que você já usa e mantenha cada mudança revisável, atribuída e pronta para publicar — seja texto, seja uma página diagramada numa grade.",
    primary: "Começar grátis", secondary: "Conectar um agente", flowLabel: "Um documento, um fluxo compartilhado",
    flowTitle: "Da página em branco até uma versão que você pode compartilhar.",
    flow: [["01", "Criar", "Um documento Markdown, ou uma página ou apresentação — vazia ou a partir de um modelo. Pastas mantêm a biblioteca organizada."], ["02", "Conectar", "Dê uma chave de API ao Claude Code, Codex, Cursor ou outro cliente MCP. Ele lê os guias e começa a escrever."], ["03", "Revisar", "As escritas do agente chegam como sugestões que você aceita, rejeita ou aproveita em parte. Nas páginas, comente um bloco e o agente responde."], ["04", "Publicar", "Escolha a versão que as pessoas devem ler: um link somente leitura, ou uma página que outros sites carregam."]],
    workspaceLabel: "O workspace", workspaceTitle: "Sua biblioteca continua sendo a fonte da verdade.", workspaceBody: "Documentos ficam ao lado das pastas, como em um gerenciador de arquivos. Seu agente e o navegador trabalham no mesmo documento, sem copiar contexto entre ferramentas.",
    entryLabel: "Duas portas de entrada", entryTitle: "Escreva você mesmo ou deixe o agente montar.",
    editorTitle: "Escreva no editor", editorBody: "Escreva Markdown com a estrutura ao lado, ou arrume uma página no editor visual. Convide colaboradores e publique quando estiver pronto.", editorCta: "Criar um documento",
    agentTitle: "Conecte via MCP", agentBody: "Gere uma chave de API, adicione o DocForge ao seu cliente MCP e peça um relatório, uma especificação ou uma apresentação. O agente rascunha, mede, corrige e devolve para você revisar.", agentCta: "Ver configuração MCP",
    controlsLabel: "O controle nunca sai do documento", controlsTitle: "Feito para julgamento, não para medidores de tokens.",
    controls: [["difference", "Alterações revisáveis", "Defina uma política por documento: edições do agente entram na hora ou aguardam sua aprovação."], ["history", "Versões e atribuição", "Cada escrita registra quem fez — você ou qual agente — e qualquer versão volta com um clique."], ["forum", "Comentários que o agente lê", "Fixe um pedido num bloco ou numa área; o agente vê primeiro, faz e responde na conversa."], ["public", "Compartilhamento público estável", "O link público mostra a versão publicada. Novas edições continuam rascunho até a próxima publicação."]],
    capacityTitle: "Abra espaço sem perder trabalho.", capacityBody: "Arquive os documentos concluídos para liberar sua capacidade de documentos ativos; o histórico fica disponível para restaurar quando quiser.",
  },
} as const;

export function HowItWorksPage() {
  const { isSignedIn } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const copy = COPY[locale];
  const openWorkspace = () => isSignedIn ? navigate("/home") : openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" });

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="hide-scrollbar" style={{ background: "var(--color-bg)", color: "var(--color-text)", minHeight: "100vh", fontFamily: "var(--font-sans)" }}>
      <Ambient />
      <div style={{ position: "relative", zIndex: 1 }}>
        {isSignedIn ? <TopBar dashboardNav /> : <MarketingNav active="how-it-works" />}
        <main style={{ maxWidth: 1120, margin: "0 auto", padding: isSignedIn ? "122px 28px 96px" : "82px 28px 96px" }}>
          <header style={{ textAlign: "center", maxWidth: 780, margin: "0 auto 70px" }}>
            <Pill tone="heat">{copy.badge}</Pill>
            <h1 style={{ fontSize: "clamp(40px, 6.3vw, 68px)", fontWeight: 600, letterSpacing: "-.055em", lineHeight: .98, margin: "20px 0" }}>
              {copy.title}<br /><span style={{ color: "var(--color-heat-hi)" }}>{copy.accent}</span>
            </h1>
            <p style={{ color: "var(--color-dim)", lineHeight: 1.65, fontSize: 17, margin: "0 auto", maxWidth: 650 }}>{copy.intro}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <Button size="lg" variant="primary" icon="folder_open" iconPosition="start" onClick={openWorkspace}>{copy.primary}</Button>
              <Button size="lg" icon="terminal" iconPosition="start" onClick={() => document.getElementById("mcp")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{copy.secondary}</Button>
            </div>
          </header>

          <section style={{ marginBottom: 100 }}>
            <Eyebrow tone="heat" align="center">{copy.flowLabel}</Eyebrow>
            <h2 style={sectionTitle}>{copy.flowTitle}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, position: "relative" }}>
              {copy.flow.map(([number, title, body], index) => <FlowCard key={number} number={number} title={title} body={body} last={index === copy.flow.length - 1} />)}
            </div>
          </section>

          <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, .86fr)", gap: 46, alignItems: "center", marginBottom: 110 }}>
            <div>
              <Eyebrow tone="heat">{copy.workspaceLabel}</Eyebrow>
              <h2 style={{ ...sectionTitle, textAlign: "left", maxWidth: 470 }}>{copy.workspaceTitle}</h2>
              <p style={{ color: "var(--color-dim)", lineHeight: 1.65, fontSize: 14, maxWidth: 475, margin: 0 }}>{copy.workspaceBody}</p>
            </div>
            <WorkspaceMock />
          </section>

          <section style={{ marginBottom: 110 }}>
            <div style={{ textAlign: "center", maxWidth: 690, margin: "0 auto 34px" }}>
              <Eyebrow tone="heat" align="center">{copy.entryLabel}</Eyebrow>
              <h2 style={sectionTitle}>{copy.entryTitle}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 16 }}>
              <EntryCard icon="edit_note" title={copy.editorTitle} body={copy.editorBody} cta={copy.editorCta} onClick={openWorkspace} warm />
              <EntryCard id="mcp" icon="terminal" title={copy.agentTitle} body={copy.agentBody} cta={copy.agentCta} onClick={() => navigate("/mcp")} />
            </div>
          </section>

          <section style={{ marginBottom: 76 }}>
            <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto 34px" }}>
              <Eyebrow tone="heat" align="center">{copy.controlsLabel}</Eyebrow>
              <h2 style={sectionTitle}>{copy.controlsTitle}</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
              {copy.controls.map(([icon, title, body]) => <ControlCard key={title} icon={icon} title={title} body={body} />)}
            </div>
          </section>

          <section style={{ border: "1px solid var(--color-heat-strong)", borderRadius: "var(--radius-lg)", padding: "26px 30px", background: "var(--gradient-band)", display: "flex", gap: 20, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", maxWidth: 700 }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-heat-hi)", fontSize: 23 }}>archive</span>
              <div><h2 style={{ margin: "0 0 6px", fontSize: 17, letterSpacing: "-.02em" }}>{copy.capacityTitle}</h2><p style={{ color: "var(--color-dim)", lineHeight: 1.55, fontSize: 13, margin: 0 }}>{copy.capacityBody}</p></div>
            </div>
            <Button size="lg" icon="arrow_forward" iconPosition="start" onClick={() => navigate("/pricing")}>{locale === "pt-BR" ? "Ver planos" : "View plans"}</Button>
          </section>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

const sectionTitle = { fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 600, letterSpacing: "-.04em", lineHeight: 1.08, textAlign: "center", margin: "12px 0 30px" } as const;

function FlowCard({ number, title, body, last }: { number: string; title: string; body: string; last: boolean }) { return <article style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", padding: 20, minHeight: 185, background: "var(--color-hover)", position: "relative", overflow: "hidden" }}><span className="df-mono" style={{ color: "var(--color-heat-hi)", fontSize: 11.5, letterSpacing: "var(--tracking-label)" }}>{number}</span><h3 style={{ margin: "38px 0 9px", fontSize: 17, letterSpacing: "-.02em" }}>{title}</h3><p style={{ color: "var(--color-dim)", fontSize: 13, lineHeight: 1.55, margin: 0 }}>{body}</p>{!last && <span className="material-symbols-outlined" style={{ position: "absolute", right: 14, top: 16, color: "var(--color-faint)", fontSize: 18 }}>arrow_forward</span>}</article>; }
function EntryCard({ id, icon, title, body, cta, onClick, warm = false }: { id?: string; icon: string; title: string; body: string; cta: string; onClick: () => void; warm?: boolean }) { return <Card id={id} tone={warm ? "warm" : "steel"}><span className="material-symbols-outlined" style={{ color: warm ? "var(--color-heat-hi)" : "var(--color-steel-hi)", fontSize: 25 }}>{icon}</span><h3 style={{ margin: "32px 0 8px", fontSize: 21, letterSpacing: "-.025em" }}>{title}</h3><p style={{ color: "var(--color-dim)", fontSize: 13, lineHeight: 1.6, minHeight: 65, margin: "0 0 20px" }}>{body}</p><button onClick={onClick} style={{ background: "transparent", border: 0, color: warm ? "var(--color-heat-soft)" : "var(--color-steel-hi)", cursor: "pointer", padding: 0, fontWeight: 600, fontSize: 13, fontFamily: "inherit", display: "inline-flex", gap: 7, alignItems: "center" }}>{cta}<span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span></button></Card>; }
function ControlCard({ icon, title, body }: { icon: string; title: string; body: string }) { return <article style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", padding: 19, background: "var(--color-hover)" }}><span className="material-symbols-outlined" style={{ color: "var(--color-steel-hi)", fontSize: 21 }}>{icon}</span><h3 style={{ margin: "17px 0 7px", fontSize: 14 }}>{title}</h3><p style={{ color: "var(--color-dim)", fontSize: 12.5, lineHeight: 1.55, margin: 0 }}>{body}</p></article>; }
function WorkspaceMock() { return <div style={{ border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--color-bg)", boxShadow: "var(--shadow-modal)" }}><div style={{ height: 37, padding: "0 13px", display: "flex", alignItems: "center", borderBottom: "1px solid var(--color-outline)", gap: 6 }}><span className="material-symbols-outlined" style={{ fontSize: 15, color: "var(--color-heat-hi)" }}>folder_open</span><span className="df-mono" style={{ fontSize: 10, color: "var(--color-dim)" }}>product / payments</span><span style={{ marginLeft: "auto", fontSize: 10, color: "var(--color-steel-hi)", border: "1px solid var(--color-steel-line)", borderRadius: "var(--radius-pill)", padding: "3px 7px" }}>MCP connected</span></div><div style={{ display: "grid", gridTemplateColumns: "120px 1fr", minHeight: 270 }}><aside style={{ borderRight: "1px solid var(--color-outline)", padding: 10 }}><div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-label)", marginBottom: 9 }}>FOLDERS</div>{["Architecture", "Payments", "Runbooks"].map((x, i) => <div key={x} style={{ display: "flex", gap: 5, padding: "6px 4px", fontSize: 10, color: i === 1 ? "var(--color-heat-soft)" : "var(--color-dim)", background: i === 1 ? "var(--color-heat-tint)" : "transparent" }}><span className="material-symbols-outlined" style={{ fontSize: 13 }}>folder</span>{x}</div>)}</aside><div style={{ padding: "17px 18px" }}><div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--color-outline)", paddingBottom: 12 }}><div><div style={{ fontSize: 14, fontWeight: 600 }}>Payments RFC</div><div className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", marginTop: 4 }}>DRAFT · 4 SECTIONS</div></div><span style={{ fontSize: 10, color: "var(--color-heat-soft)", background: "var(--color-heat-wash)", padding: "4px 7px", borderRadius: "var(--radius-xs)" }}>2 changes to review</span></div><div style={{ marginTop: 18 }}><div className="df-mono" style={{ fontSize: 10, color: "var(--color-heat-hi)" }}>## Rollback path</div><div style={{ marginTop: 9, height: 6, width: "91%", borderRadius: "var(--radius-xs)", background: "var(--color-outline)" }} /><div style={{ marginTop: 7, height: 6, width: "78%", borderRadius: "var(--radius-xs)", background: "var(--color-outline)" }} /><div style={{ marginTop: 15, borderLeft: "2px solid var(--color-heat)", padding: "7px 9px", background: "var(--color-heat-tint)", color: "var(--color-steel-hi)", fontSize: 10 }}>Agent suggestion · review before publish</div></div></div></div></div>; }
function Ambient() { return <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 800px 550px at 18% 0%, var(--color-heat-wash), transparent 64%), radial-gradient(ellipse 650px 560px at 85% 38%, var(--color-steel-tint), transparent 65%)" }} />; }
