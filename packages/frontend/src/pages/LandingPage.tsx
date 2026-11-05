import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { ClosingCta, CodeBlock, Panel, SectionHead, Shot, h2Style, leadStyle, useMarketingPage, useProCheckout } from "@/components/marketing/parts";
import { AppFooter, SiteHeader } from "@/components/shared";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n";
import { apiFetchTiers, type Tier } from "@/utils/api";
import { MCP_CGD_URL } from "@/utils/mcpUrl";

const GcdDemo = lazy(() => import("@/components/marketing/GcdDemo"));

const COPY = {
  en: {
    pill: "Component Grid Document",
    title: "From request to PDF,",
    accent: "no formatting.",
    body: "Reports, proposals, one-pagers and slide decks your AI builds on a grid. It measures every block, fixes what overflows and hands it over ready. You change whatever you want.",
    primary: "Get started",
    secondary: "Watch a GCD being built",
    note: "Free to start · no card · works with Claude Code, Codex, Cursor and other MCP clients",
    askedLabel: "You asked",
    asked: "“Make 5 slides of the 2027 plan for Monday's meeting.”",
    done: "Ready for review. Nothing overflowed.",
    deckAlt: "A five-slide deck open in the DocForge editor",
    demoLabel: "Watch it happen",
    demoTitle: "A GCD being built, for real.",
    demoLead: "This is DocForge's layout engine running right here on the page, with the same operations the AI uses. Switch the theme and watch the document rebuild.",
    whyLabel: "Why it's different",
    whyTitle: "AI writes well. The document is what falls apart.",
    whyLead: "With a GCD the document is laid out from the start, and the AI knows what is happening on the page.",
    today: "Today",
    withGcd: "With a GCD",
    pairs: [
      ["Text that overflows, a page that spills", "The AI measures before it writes, because it knows the size of every component, and a review flags what didn't fit before you see it."],
      ["The AI only produces HTML, which you can't adjust by hand", "An editor built for you to change documents freely, with interactive components."],
      ["Asking for a tweak means starting over", "You point at exactly which block changes and comment what you want; the AI edits only there."],
    ],
    secretLabel: "The secret",
    secretTitle: "The AI reads the page as a map.",
    secretBody: "No screenshot needed: every GCD becomes a text map with each block, where it sits and what overflowed. Drag the bar to see both sides of the same page.",
    youSee: "What you see",
    aiReads: "What the AI reads",
    xrayLabel: "Compare the page with the map the AI reads",
    finalLabel: "You have the final say",
    finalTitle: "The AI builds. You review and change whatever you want.",
    finalLead: "A GCD opens in a visual editor. Nothing is locked to what the AI did.",
    reviewTitle: "Review",
    reviewBody: "The review points out what a reader would notice and brings the fix. Comment on a block and the AI changes just that.",
    reviewAlt: "The review panel suggesting to fit a box to its content",
    changeTitle: "Change",
    changeBody: "Drag blocks, edit text on the page, switch the whole theme and restore any version.",
    changeAlt: "The theme panel with six looks for a slide deck",
    evalsLabel: "Built with evals",
    evalsTitle: "Agents were made to write HTML. The GCD was made to be written by agents.",
    evalsBody: "We asked real agents for the same documents in HTML, Word, PowerPoint and GCD, and watched where they got lost. Every new DocForge tool came from something the agents needed mid-task.",
    evals: [
      ["The AI couldn't see what had overflowed", "the page map and the automatic review"],
      ["Fitting squeezed everything, with no way back", "a gentler fit and undo: 10% cheaper, same quality"],
      ["Moving a section rebuilt the whole page", "move blocks and whole sections in one operation"],
    ],
    devsLabel: "For devs",
    devsTitle: "In the cloud, in your terminal or in your app.",
    devs: [
      ["Connect over MCP", "One key and one command in Claude Code, Codex or Cursor."],
      ["Run it locally", "GCDs as files in your repository. No account, no network."],
      ["Show it in your app", "The open library (MIT) fetches the published GCD and renders the HTML."],
    ],
    devsGuide: "Read the technical guide",
    copy: "Copy",
    copied: "Copied",
    priceTitle: "That simple.",
    free: "Free",
    perMonth: "/ month",
    freeLine: (weekly: string, agents: string) => `${weekly} new documents a week, ${agents} agents, public link and PDF.`,
    proLine: (weekly: string, agents: string) => `For people who make documents every week: ${weekly} a week, ${agents} agents and the full version history.`,
    startFree: "Start for free",
    upgrade: "Get Pro",
    compare: "Compare plans",
    checkoutError: "Could not start the checkout. Try again in a moment.",
    closing: "Your next document comes out ready.",
  },
  "pt-BR": {
    pill: "Component Grid Document",
    title: "Do pedido ao PDF,",
    accent: "sem formatar nada.",
    body: "Relatórios, propostas, one-pagers e apresentações que a IA monta numa grade. Ela mede cada bloco, corrige o que estoura e te entrega pronto. Você ajusta o que quiser.",
    primary: "Começar agora",
    secondary: "Ver um GCD sendo montado",
    note: "Grátis para começar · sem cartão · funciona com Claude Code, Codex, Cursor e outros clientes MCP",
    askedLabel: "Você pediu",
    asked: "“Monta 5 slides do plano de 2027 para a reunião de segunda.”",
    done: "Pronto para revisar. Nada estourou.",
    deckAlt: "Apresentação de cinco slides aberta no editor do DocForge",
    demoLabel: "Veja acontecer",
    demoTitle: "Um GCD sendo montado, de verdade.",
    demoLead: "É o motor de layout do DocForge rodando aqui na página, com as mesmas operações que a IA usa. Troque o tema e veja o documento se refazer.",
    whyLabel: "Por que é diferente",
    whyTitle: "A IA escreve bem. O documento é que desanda.",
    whyLead: "Com um GCD, o documento já nasce diagramado, e a IA sabe o que está acontecendo na página.",
    today: "Hoje",
    withGcd: "Com GCD",
    pairs: [
      ["Texto que estoura, página que sobra", "A IA mede antes de escrever, porque conhece o tamanho de cada componente, e uma revisão aponta o que não coube antes de você ver."],
      ["A IA só gera HTML, que não dá para ajustar à mão", "Um editor feito para você mexer nos documentos livremente, com componentes interativos."],
      ["Pedir um ajuste é recomeçar", "Você aponta exatamente qual bloco muda e comenta o que quer; a IA altera só ali."],
    ],
    secretLabel: "O segredo",
    secretTitle: "A IA lê a página como um mapa.",
    secretBody: "Ela não precisa de screenshot: cada GCD vira um mapa em texto, com cada bloco, seu lugar e o que estourou. Arraste a barra para ver os dois lados da mesma página.",
    youSee: "O que você vê",
    aiReads: "O que a IA lê",
    xrayLabel: "Comparar a página com o mapa que a IA lê",
    finalLabel: "Você tem a palavra final",
    finalTitle: "A IA monta. Você avalia e muda o que quiser.",
    finalLead: "O GCD abre num editor visual. Nada fica preso ao que a IA fez.",
    reviewTitle: "Avalie",
    reviewBody: "A revisão aponta o que um leitor notaria e já traz a correção. Comente num bloco e a IA ajusta só aquilo.",
    reviewAlt: "Painel de revisão sugerindo ajustar uma caixa ao conteúdo",
    changeTitle: "Mude",
    changeBody: "Arraste blocos, edite o texto na página, troque o tema inteiro e volte qualquer versão.",
    changeAlt: "Painel de temas com seis visuais para a apresentação",
    evalsLabel: "Feito com evals",
    evalsTitle: "Agentes foram feitos para escrever HTML. O GCD foi feito para ser escrito por agentes.",
    evalsBody: "Pedimos os mesmos documentos em HTML, Word, PowerPoint e GCD, com agentes de verdade, e olhamos onde eles se perdiam. Cada ferramenta nova do DocForge nasceu de uma necessidade dos agentes no meio do processo.",
    evals: [
      ["A IA não via o que tinha estourado", "o mapa da página e a revisão automática"],
      ["Ajustar para caber espremia tudo, sem volta", "um ajuste mais gentil e o desfazer: 10% mais barato, mesma qualidade"],
      ["Mudar uma seção de lugar refazia a página inteira", "mover blocos e seções inteiras com uma operação"],
    ],
    devsLabel: "Para devs",
    devsTitle: "Na nuvem, no seu terminal ou no seu app.",
    devs: [
      ["Conecte por MCP", "Uma chave e um comando no Claude Code, Codex ou Cursor."],
      ["Rode local", "GCDs como arquivos no seu repositório. Sem conta, sem rede."],
      ["Mostre no seu app", "A lib aberta (MIT) busca o GCD publicado e gera o HTML."],
    ],
    devsGuide: "Ver o guia técnico",
    copy: "Copiar",
    copied: "Copiado",
    priceTitle: "Simples assim.",
    free: "Grátis",
    perMonth: "/ mês",
    freeLine: (weekly: string, agents: string) => `${weekly} documentos novos por semana, ${agents} agentes, link público e PDF.`,
    proLine: (weekly: string, agents: string) => `Para quem faz documento toda semana: ${weekly} por semana, ${agents} agentes e o histórico completo de versões.`,
    startFree: "Começar grátis",
    upgrade: "Assinar o Pro",
    compare: "Comparar os planos",
    checkoutError: "Não foi possível abrir o pagamento. Tente de novo em instantes.",
    closing: "Seu próximo documento já sai pronto.",
  },
} as const;

const DEV_CODE = [
  `claude mcp add --transport http docforge ${MCP_CGD_URL}`,
  "npx docforge-layout mcp --root .",
  "npm i @docforge-lib/layout",
];

export function LandingPage() {
  const { locale, t } = useI18n();
  const copy = COPY[locale];
  const { isSignedIn, start, navigate } = useMarketingPage();
  const checkout = useProCheckout(copy.checkoutError);
  const [tiers, setTiers] = useState<Tier[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetchTiers().then((list) => !cancelled && setTiers(list)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const number = (n: number | null) => (n === null ? "∞" : n.toLocaleString(locale));
  const money = (tier: Tier) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: tier.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(tier.priceMonthly ?? 0);
  const free = tiers.find((tier) => tier.slug === "free");
  const pro = tiers.find((tier) => tier.slug === "pro");

  return (
    <div className="df-mk hide-scrollbar">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section style={{ position: "relative", overflow: "hidden" }}>
          <div className="df-mk-gridbg" aria-hidden />
          <div className="df-mk-wrap" style={{ position: "relative", paddingTop: 88, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 24 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: "var(--radius-pill)", border: "1px solid var(--color-heat-line)", background: "var(--color-heat-wash)", fontSize: "var(--text-body-sm)", color: "var(--color-heat-soft)" }}>
              <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 16, color: "var(--color-heat-hi)" }}>dashboard</span>
              {copy.pill}
            </span>
            <h1 style={{ margin: 0, fontSize: "clamp(44px, 7.4vw, 80px)", lineHeight: 0.98, letterSpacing: "-.055em", fontWeight: 600, maxWidth: 980 }}>
              {copy.title} <span style={{ color: "var(--color-heat)" }}>{copy.accent}</span>
            </h1>
            <p style={{ ...leadStyle, fontSize: 17, maxWidth: 660 }}>{copy.body}</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <Button size="lg" variant="primary" icon="arrow_forward" onClick={start}>{isSignedIn ? t("nav.openWorkspace") : copy.primary}</Button>
              <Button size="lg" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{copy.secondary}</Button>
            </div>
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-faint)" }}>{copy.note}</span>
          </div>
          <div className="df-mk-wrap" style={{ position: "relative", paddingTop: 64, paddingBottom: 104 }}>
            <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto" }}>
              <Shot src="/marketing/deck.png" alt={copy.deckAlt} glow />
              <Panel accent className="df-mk-float" style={{ left: -40, top: 100, maxWidth: 300, padding: "16px 18px", boxShadow: "var(--shadow-modal)", textAlign: "left" }}>
                <div style={{ fontSize: "var(--text-caption)", color: "var(--color-heat-hi)", marginBottom: 6 }}>{copy.askedLabel}</div>
                <div style={{ fontSize: "var(--text-body)", lineHeight: 1.5 }}>{copy.asked}</div>
              </Panel>
              <Panel className="df-mk-float" style={{ right: -32, bottom: 80, maxWidth: 290, padding: "14px 16px", boxShadow: "var(--shadow-modal)", display: "flex", gap: 10, alignItems: "center", textAlign: "left", borderColor: "var(--color-ok-line)" }}>
                <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 18, color: "var(--color-ok)" }}>check_circle</span>
                <span style={{ fontSize: "var(--text-body)", lineHeight: 1.4 }}>{copy.done}</span>
              </Panel>
            </div>
          </div>
        </section>

        {/* Live demo */}
        <section id="demo" className="df-mk-band" style={{ scrollMarginTop: 72 }}>
          <div className="df-mk-wrap" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 40 }}>
            <SectionHead eyebrow={copy.demoLabel} title={copy.demoTitle} lead={copy.demoLead} />
            <DemoSlot />
          </div>
        </section>

        {/* Problem → how a GCD solves it */}
        <section className="df-mk-wrap" style={{ paddingTop: 104, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 44 }}>
          <SectionHead eyebrow={copy.whyLabel} title={copy.whyTitle} lead={copy.whyLead} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {copy.pairs.map(([today, gcd]) => (
              <Panel key={today} style={{ padding: "24px 28px" }}>
                <div className="df-mk-pair">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-error)" }}>{copy.today}</span>
                    <span style={{ fontSize: "var(--text-heading)", fontWeight: 600, lineHeight: 1.3, letterSpacing: "-.02em" }}>{today}</span>
                  </div>
                  <span className="material-symbols-outlined df-mk-pair__arrow" aria-hidden style={{ fontSize: 28, color: "var(--color-heat)" }}>arrow_forward</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "var(--text-caption)", fontWeight: 500, color: "var(--color-ok)" }}>{copy.withGcd}</span>
                    <span style={{ fontSize: 17, lineHeight: 1.55, color: "var(--color-dim)" }}>{gcd}</span>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
          <Panel style={{ padding: 40, marginTop: 12 }}>
            <div className="df-mk-split">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <span className="df-mono" style={{ fontSize: "var(--text-label)", fontWeight: 600, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-steel-hi)" }}>{copy.secretLabel}</span>
                <h3 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, letterSpacing: "-.03em", fontWeight: 600 }}>{copy.secretTitle}</h3>
                <p style={{ ...leadStyle, fontSize: "var(--text-body)" }}>{copy.secretBody}</p>
              </div>
              <XRay youSee={copy.youSee} aiReads={copy.aiReads} label={copy.xrayLabel} />
            </div>
          </Panel>
        </section>

        {/* The editor: review and change */}
        <section className="df-mk-band">
          <div className="df-mk-wrap" style={{ paddingTop: 104, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 40 }}>
            <SectionHead eyebrow={copy.finalLabel} title={copy.finalTitle} lead={copy.finalLead} />
            <div className="df-mk-grid-2">
              {[[copy.reviewTitle, copy.reviewBody, "/marketing/review.png", copy.reviewAlt], [copy.changeTitle, copy.changeBody, "/marketing/design.png", copy.changeAlt]].map(([title, body, src, alt]) => (
                <figure key={title} style={{ margin: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                  <Shot src={src!} alt={alt!} />
                  <figcaption style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <b style={{ fontSize: "var(--text-heading)", fontWeight: 600 }}>{title}</b>
                    <span style={{ fontSize: "var(--text-body)", lineHeight: 1.6, color: "var(--color-dim)" }}>{body}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Evals */}
        <section className="df-mk-wrap" style={{ paddingTop: 96, paddingBottom: 88 }}>
          <div className="df-mk-split" style={{ alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <SectionHead eyebrow={copy.evalsLabel} tone="steel" title={<span style={{ fontSize: "clamp(26px, 3vw, 34px)", letterSpacing: "-.03em" }}>{copy.evalsTitle}</span>} />
              <p style={{ ...leadStyle, fontSize: "var(--text-body)" }}>{copy.evalsBody}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {copy.evals.map(([problem, tool], i) => (
                <div key={problem} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "20px 0", borderBottom: i < copy.evals.length - 1 ? "1px solid var(--color-outline-md)" : "none" }}>
                  <span style={{ fontSize: 17, lineHeight: 1.45 }}>{problem}</span>
                  <span style={{ fontSize: "var(--text-body)", color: "var(--color-steel-hi)" }}>→ {tool}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For devs */}
        <section className="df-mk-band">
          <div className="df-mk-wrap" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 32 }}>
            <SectionHead eyebrow={copy.devsLabel} tone="steel" title={copy.devsTitle} />
            <div className="df-mk-grid-3">
              {copy.devs.map(([title, body], i) => (
                <Panel key={title} accent={i === 0} style={{ padding: 26, display: "flex", flexDirection: "column", gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "var(--text-heading)", fontWeight: 600 }}>{title}</h3>
                  <p style={{ margin: 0, fontSize: "var(--text-body)", lineHeight: 1.55, color: "var(--color-dim)" }}>{body}</p>
                  <CodeBlock code={DEV_CODE[i]!} copyLabel={copy.copy} copiedLabel={copy.copied} style={{ marginTop: "auto" }} />
                </Panel>
              ))}
            </div>
            <Button variant="ghost" icon="arrow_forward" style={{ alignSelf: "flex-start" }} onClick={() => navigate("/how-it-works")}>{copy.devsGuide}</Button>
          </div>
        </section>

        {/* Pricing */}
        {free && pro && (
          <section className="df-mk-wrap" style={{ paddingTop: 104, paddingBottom: 24, display: "flex", flexDirection: "column", gap: 32, alignItems: "center" }}>
            <h2 style={{ ...h2Style, textAlign: "center" }}>{copy.priceTitle}</h2>
            <div className="df-mk-grid-2" style={{ width: "100%", maxWidth: 880, gap: 16 }}>
              <PriceCard name={copy.free} price={money(free)} perMonth={copy.perMonth} line={copy.freeLine(number(free.limits.weeklyDocumentCreations), number(free.limits.maxApiKeys))}>
                <Button size="lg" style={{ width: "100%" }} onClick={start}>{copy.startFree}</Button>
              </PriceCard>
              <PriceCard highlight name="Pro" price={money(pro)} perMonth={copy.perMonth} line={copy.proLine(number(pro.limits.weeklyDocumentCreations), number(pro.limits.maxApiKeys))}>
                <Button size="lg" variant="primary" style={{ width: "100%" }} disabled={!pro.available || checkout.busy} onClick={checkout.upgrade}>{copy.upgrade}</Button>
              </PriceCard>
            </div>
            {checkout.error && <p style={{ margin: 0, color: "var(--color-error)", fontSize: "var(--text-body-sm)" }}>{checkout.error}</p>}
            <Button variant="ghost" icon="arrow_forward" onClick={() => navigate("/pricing")}>{copy.compare}</Button>
          </section>
        )}

        <ClosingCta title={copy.closing} cta={isSignedIn ? t("nav.openWorkspace") : copy.primary} onClick={start} />
      </main>
      <AppFooter />
    </div>
  );
}

/** Mounts the live demo (and downloads the layout engine) only once the section scrolls into view. */
function DemoSlot() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} style={{ minHeight: 520 }}>
      {visible && (
        <Suspense fallback={null}>
          <GcdDemo />
        </Suspense>
      )}
    </div>
  );
}

function PriceCard({ name, price, perMonth, line, highlight = false, children }: {
  name: string; price: string; perMonth: string; line: string; highlight?: boolean; children: React.ReactNode;
}) {
  return (
    <Panel accent={highlight} style={{ padding: 36, display: "flex", flexDirection: "column", gap: 12, boxShadow: highlight ? "0 0 80px var(--color-heat-tint)" : "none" }}>
      <span style={{ fontSize: "var(--text-body)", color: highlight ? "var(--color-heat-hi)" : "var(--color-dim)" }}>{name}</span>
      <span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-.045em", lineHeight: 1 }}>
        {price}
        <span style={{ fontSize: 17, color: "var(--color-dim)", fontWeight: 400, letterSpacing: 0 }}> {perMonth}</span>
      </span>
      <p style={{ margin: 0, fontSize: "var(--text-body)", lineHeight: 1.55, color: "var(--color-dim)", flex: 1 }}>{line}</p>
      <div style={{ marginTop: 8 }}>{children}</div>
    </Panel>
  );
}

/**
 * The same page twice: drawn, and as the boxes of the map the AI reads. The bar
 * clips the map layer, so both line up block for block. Drawn with tokens: the
 * page is light (text colour as paper), the map is the app's own dark.
 */
function XRay({ youSee, aiReads, label }: { youSee: string; aiReads: string; label: string }) {
  const [split, setSplit] = useState(50);
  const blocks: { id: string; type: string; left: string; top: string; width: string; height: string; warn?: boolean }[] = [
    { id: "titulo", type: "text", left: "7%", top: "6%", width: "86%", height: "8%" },
    { id: "receita", type: "kpi", left: "7%", top: "17%", width: "27%", height: "11%" },
    { id: "margem", type: "kpi", left: "36.5%", top: "17%", width: "27%", height: "11%" },
    { id: "clientes", type: "kpi", left: "66%", top: "17%", width: "27%", height: "11%" },
    { id: "receita_mes", type: "chart", left: "7%", top: "31%", width: "86%", height: "25%" },
    { id: "analise", type: "text", left: "7%", top: "59%", width: "42%", height: "30%" },
    { id: "proximos", type: "list", left: "51%", top: "59%", width: "42%", height: "30%", warn: true },
  ];
  const ink = "var(--color-bg)";
  const card = "color-mix(in srgb, var(--color-bg) 7%, transparent)";
  const line = (w: string) => <div style={{ height: 5, width: w, background: "color-mix(in srgb, var(--color-bg) 22%, transparent)", borderRadius: "var(--radius-xs)" }} />;

  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 380, justifySelf: "center" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1.3", borderRadius: "var(--radius-sm)", overflow: "hidden", boxShadow: "var(--shadow-modal)" }}>
        {/* The page */}
        <div style={{ position: "absolute", inset: 0, background: "var(--color-text)", color: ink }}>
          <div style={{ position: "absolute", left: "7%", top: "6%", width: "86%", height: "8%", display: "flex", alignItems: "center", fontSize: 21, fontWeight: 700, letterSpacing: "-.03em" }}>Q3</div>
          {[["7%", "+18%"], ["36.5%", "31,4%"], ["66%", "1.284"]].map(([left, value], i) => (
            <div key={left} style={{ position: "absolute", left, top: "17%", width: "27%", height: "11%", background: card, borderRadius: "var(--radius-xs)", padding: 9, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? "var(--color-heat)" : ink }}>{value}</span>
              {line("70%")}
            </div>
          ))}
          <div style={{ position: "absolute", left: "7%", top: "31%", width: "86%", height: "25%", background: card, borderRadius: "var(--radius-xs)", padding: 12, boxSizing: "border-box", display: "flex", alignItems: "flex-end", gap: 8 }}>
            {[40, 55, 70, 100].map((h, i) => <div key={h} style={{ flex: 1, height: `${h}%`, background: "var(--color-heat)", opacity: 0.4 + i * 0.2, borderRadius: "var(--radius-xs) var(--radius-xs) 0 0" }} />)}
          </div>
          <div style={{ position: "absolute", left: "7%", top: "59%", width: "42%", display: "flex", flexDirection: "column", gap: 7 }}>{line("100%")}{line("92%")}{line("96%")}{line("70%")}</div>
          <div style={{ position: "absolute", left: "51%", top: "59%", width: "42%", display: "flex", flexDirection: "column", gap: 9 }}>{line("80%")}{line("65%")}{line("75%")}{line("55%")}</div>
        </div>
        {/* The map */}
        <div
          aria-hidden
          className="df-mono"
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--color-bg)",
            backgroundImage: "linear-gradient(var(--color-steel-tint) 1px, transparent 1px), linear-gradient(90deg, var(--color-steel-tint) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
            clipPath: `inset(0 0 0 ${split}%)`,
            fontSize: 10,
            lineHeight: 1.3,
            color: "var(--color-steel-hi)",
          }}
        >
          {blocks.map((b) => (
            <div key={b.id} style={{ position: "absolute", left: b.left, top: b.top, width: b.width, height: b.height, boxSizing: "border-box", padding: "4px 6px", border: b.warn ? "1.5px solid var(--color-warn)" : "1px dashed var(--color-steel)", color: b.warn ? "var(--color-warn)" : undefined, background: b.warn ? "var(--color-warn-tint)" : undefined }}>
              {b.type} · {b.id}
              {b.warn && <><br />! +2 → fit</>}
            </div>
          ))}
          <div style={{ position: "absolute", left: "7%", top: "93%", color: "var(--color-faint)" }}>p1 · A4</div>
        </div>
        <div aria-hidden style={{ position: "absolute", top: 0, bottom: 0, width: 2, left: `${split}%`, background: "var(--color-heat)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-caption)", color: "var(--color-dim)" }}>
        <span>{youSee}</span>
        <span style={{ color: "var(--color-steel-hi)" }}>{aiReads}</span>
      </div>
      <input className="df-mk-range" type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} aria-label={label} />
    </figure>
  );
}
