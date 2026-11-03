import { useState, type ReactNode } from "react";
import { MarketingNav } from "@/components/marketing";
import { GCD_COMPONENT_TYPES } from "@/components/marketing/componentTypes";
import { ClosingCta, CodeBlock, Panel, SectionHead, Shot, leadStyle, useMarketingPage } from "@/components/marketing/parts";
import { AppFooter, TopBar } from "@/components/shared";
import { useI18n } from "@/i18n";
import { MCP_URL } from "@/utils/mcpUrl";

/** The technical, hands-on page: connect, what a GCD is inside, the agent's loop, your side, where it runs. */

const CLIENTS = [
  { name: "Claude Code", code: `claude mcp add --transport http docforge ${MCP_URL} \\\n  --header "Authorization: Bearer $DOCFORGE_API_KEY"` },
  { name: "Codex", code: `codex mcp add docforge --url ${MCP_URL} \\\n  --bearer-token-env-var DOCFORGE_API_KEY` },
  { name: "Cursor", code: `// .cursor/mcp.json\n{\n  "mcpServers": {\n    "docforge": {\n      "url": "${MCP_URL}",\n      "headers": { "Authorization": "Bearer \${env:DOCFORGE_API_KEY}" }\n    }\n  }\n}` },
  { name: "Local", code: "claude mcp add docforge-layout -- \\\n  npx docforge-layout mcp --root ." },
] as const;

const RENDER_CODE = `import { createEngine, fetchPublished } from "@docforge-lib/layout";
import { createNodeRegistry } from "@docforge-lib/layout/node";

const engine = createEngine({ registry: createNodeRegistry() });
const { doc } = await fetchPublished("https://doc-forge.dev/public/<token>");
const { page } = engine.render(doc, { surfaceId: "a4" }); // HTML, ready to print`;

const COPY = {
  en: {
    eyebrow: "How it works",
    title: "From the first command to a published GCD.",
    lead: "The hands-on guide: connect your agent, see what a Component Grid Document is made of, and what you and the AI do at each step.",
    toc: ["Quick start", "Anatomy of a GCD", "The agent's loop", "Your side", "Where it runs", "Markdown", "Questions"],
    quickLabel: "01 · Quick start",
    quickTitle: "Three steps, two minutes.",
    keyTitle: "Create an API key",
    keyBody: "In your workspace, under API keys. Each key is one agent: the history shows which one wrote what.",
    connectTitle: "Add DocForge to your client",
    hints: ["Check it with /mcp inside Claude Code.", "Check it with codex mcp list.", "Restart Cursor after saving.", "No key and no account: GCDs as *.docforge.json files in your repo."],
    askTitle: "Ask for something",
    askBody: "The agent reads DocForge's guide on its own and picks the tools.",
    ask: "“Make a one-pager of the launch from docs/annual.md, A4, on a single page.”",
    anatomyLabel: "02 · Anatomy of a GCD",
    anatomyTitle: "JSON that becomes a page, and a page that becomes text.",
    anatomyLead: "A GCD is JSON: components placed on a grid, in 8 px units. The library measures, paginates and draws it, and hands the AI a text map of the same page.",
    docCaption: "The document (from the report template)",
    mapCaption: "What the AI reads (get_layout_map)",
    rules: [
      ["Content decides the height", "A box's height is a minimum. Text that needs more room makes it grow."],
      ["Only what it invades moves", "A growing box pushes what it covers down, in a chain. Nothing else moves."],
      ["The library paginates", "Text, lists and tables split between lines; tables repeat their header."],
      ["Measured without a browser", "The library reads the fonts and decides every line break. Screen, PDF and measure agree."],
    ],
    componentsLabel: "Components today",
    componentsMore: "+ more on the way",
    loopLabel: "03 · The agent's loop",
    loopTitle: "Read, change, check, talk.",
    loopLead: "The tools the agent gets over MCP. It writes with small operations that can be undone, and checks before it calls you.",
    groups: [
      ["Read", "get_layout_map\nfind_layout\nrender_page", "The map, finding blocks, and the page as an image."],
      ["Change", "apply_layout_ops\npreview_layout\napply_layout_theme", "add, row, move, fit… and what would change, without saving."],
      ["Check", "review_layout\nmeasure_component\ncalibrate_style", "What a reader would notice, with the operation that fixes it."],
      ["Talk", "request_review\nget_layout_notes\nreply_layout_note", "Hand it over with questions and answer your comments."],
      ["Versions", "save_layout_version\nlist_layout_versions\nrestore_layout_version", "Name, list and restore, with the author of every write."],
    ],
    youLabel: "04 · Your side",
    youTitle: "The editor where you decide.",
    you: [
      ["Edit", "drag and resize components, edit text on the page, add blocks."],
      ["Review", "the document's warnings, with “fit to content” in one click."],
      ["Design", "built-in or saved themes; colours, fonts and corners."],
      ["Comments", "pinned to a block or an area; the AI reads them and replies."],
      ["History", "named versions, and every write with its author."],
      ["Together", "several people and agents, each with the role you gave them."],
      ["Publish", "a read-only link, a PDF, or your own site."],
    ],
    editorAlt: "The DocForge editor with a one-page report and its structure",
    runLabel: "05 · Where it runs",
    runTitle: "One engine, three places.",
    run: [
      ["doc-forge.dev", "Library, editor, review, collaboration and publishing. Connect over MCP with a key."],
      ["Local", "MCP over *.docforge.json files in your repo. The last 20 versions stay in .docforge-history/."],
      ["In your app", "Publish in DocForge and show it on your site. Keep the JSON in your database so your readers never depend on DocForge."],
    ],
    mdLabel: "06 · Markdown",
    mdTitle: "For long text, Markdown with review.",
    mdBody: "Specs, notes and READMEs. What the agent writes arrives as a suggestion: accept it, reject it or keep part. Same library, same history, same publishing.",
    faqLabel: "07 · Questions",
    faqTitle: "Technical questions.",
    faq: [
      ["Which agents work?", "Any MCP client that speaks HTTP: Claude Code, Codex and Cursor have step-by-step setup. Locally, any client that runs an MCP server over stdio."],
      ["Do I need an account to run it locally?", "No. npx docforge-layout mcp works on files in your repository, offline. The account is for the editor, review, collaboration and publishing."],
      ["Does the PDF look like the screen?", "Yes. The library decides every line break with the same fonts, and the browser never wraps the text again."],
      ["What if the agent and I edit at the same time?", "Every write checks the revision. If someone wrote first, yours comes back with what changed and the editor reapplies what you had pending."],
      ["Are my documents public?", "No. Only what you publish has a link, and unpublishing revokes it."],
    ],
    mdSample: ["## Invite rules", "- The link works once.", "+ The link works for up to 5 people."],
    sessionPrompt: "one-pager of the launch, A4, one page",
    sessionAsk: "“Discount in reais or in %?”",
    copy: "Copy",
    copied: "Copied",
    closing: "Try it with your agent.",
    cta: "Get started",
  },
  "pt-BR": {
    eyebrow: "Como funciona",
    title: "Do primeiro comando ao GCD publicado.",
    lead: "O guia prático: conectar o seu agente, entender do que um Component Grid Document é feito, e o que você e a IA fazem em cada etapa.",
    toc: ["Começo rápido", "Anatomia de um GCD", "O ciclo do agente", "O seu lado", "Onde rodar", "Markdown", "Perguntas"],
    quickLabel: "01 · Começo rápido",
    quickTitle: "Três passos, dois minutos.",
    keyTitle: "Crie uma chave de API",
    keyBody: "No seu workspace, em Chaves de API. Cada chave é um agente: o histórico mostra qual deles escreveu cada coisa.",
    connectTitle: "Adicione o DocForge ao seu cliente",
    hints: ["Confira com /mcp dentro do Claude Code.", "Confira com codex mcp list.", "Reinicie o Cursor depois de salvar.", "Sem chave e sem conta: GCDs como arquivos *.docforge.json no seu repositório."],
    askTitle: "Faça o primeiro pedido",
    askBody: "O agente lê o guia do DocForge sozinho e escolhe as ferramentas.",
    ask: "“Faz um one-pager do lançamento a partir do docs/anual.md, A4, cabendo em uma página.”",
    anatomyLabel: "02 · Anatomia de um GCD",
    anatomyTitle: "Um JSON que vira página, e uma página que vira texto.",
    anatomyLead: "Um GCD é um JSON: componentes posicionados numa grade, em unidades de 8 px. A lib mede, pagina e desenha, e entrega para a IA um mapa em texto da mesma página.",
    docCaption: "O documento (trecho do modelo de relatório)",
    mapCaption: "O que a IA lê (get_layout_map)",
    rules: [
      ["O conteúdo decide a altura", "A altura de uma caixa é um mínimo. Texto que precisa de mais espaço faz a caixa crescer."],
      ["Só o invadido desce", "Uma caixa que cresce empurra o que ela invadiu, em cadeia. O resto não se move."],
      ["A lib pagina", "Texto, listas e tabelas quebram entre linhas; tabelas repetem o cabeçalho."],
      ["Mede sem navegador", "A lib lê as fontes e decide cada quebra de linha. Tela, PDF e medida batem."],
    ],
    componentsLabel: "Componentes hoje",
    componentsMore: "+ novos a caminho",
    loopLabel: "03 · O ciclo do agente",
    loopTitle: "Ler, mudar, conferir, conversar.",
    loopLead: "As tools que o agente recebe pelo MCP. Ele escreve com operações pequenas, que dá para desfazer, e confere antes de te chamar.",
    groups: [
      ["Ler", "get_layout_map\nfind_layout\nrender_page", "O mapa, a busca por bloco e a página como imagem."],
      ["Mudar", "apply_layout_ops\npreview_layout\napply_layout_theme", "add, row, move, fit… e o que mudaria, sem salvar."],
      ["Conferir", "review_layout\nmeasure_component\ncalibrate_style", "O que um leitor notaria, com a operação que corrige."],
      ["Conversar", "request_review\nget_layout_notes\nreply_layout_note", "Entregar com perguntas e responder aos seus comentários."],
      ["Versões", "save_layout_version\nlist_layout_versions\nrestore_layout_version", "Marcar, listar e voltar, com o autor de cada escrita."],
    ],
    youLabel: "04 · O seu lado",
    youTitle: "O editor onde você decide.",
    you: [
      ["Editar", "arraste e redimensione componentes, edite o texto na página, adicione blocos."],
      ["Revisão", "os avisos do documento, com “ajustar ao conteúdo” em um clique."],
      ["Design", "temas prontos ou salvos por você; cores, fontes e cantos."],
      ["Comentários", "fixados num bloco ou numa área; a IA lê e responde."],
      ["Histórico", "versões com nome e cada escrita com o autor."],
      ["Junto", "várias pessoas e agentes, cada um com o papel que você deu."],
      ["Publicar", "link só de leitura, PDF ou no seu site."],
    ],
    editorAlt: "Editor do DocForge com um relatório de uma página e a estrutura ao lado",
    runLabel: "05 · Onde rodar",
    runTitle: "O mesmo motor em três lugares.",
    run: [
      ["doc-forge.dev", "Biblioteca, editor, revisão, colaboração e publicação. Conecte por MCP com uma chave."],
      ["Local", "MCP sobre arquivos *.docforge.json no seu repositório. As 20 últimas versões ficam em .docforge-history/."],
      ["No seu app", "Publique no DocForge e mostre no seu site. Guarde o JSON no seu banco: seus leitores não dependem do DocForge."],
    ],
    mdLabel: "06 · Markdown",
    mdTitle: "Para textos longos, o Markdown com revisão.",
    mdBody: "Specs, notas e READMEs. O que o agente escreve chega como sugestão: você aceita, rejeita ou fica com parte. Mesma biblioteca, mesmo histórico, mesma publicação.",
    faqLabel: "07 · Perguntas",
    faqTitle: "Perguntas técnicas.",
    faq: [
      ["Quais agentes funcionam?", "Qualquer cliente MCP com HTTP: Claude Code, Codex e Cursor têm passo a passo. Localmente, qualquer cliente que rode um servidor MCP por stdio."],
      ["Preciso de conta para rodar local?", "Não. O npx docforge-layout mcp roda sobre arquivos do seu repositório, sem rede. A conta é para o editor, a revisão, a colaboração e a publicação."],
      ["O PDF sai igual à tela?", "Sim. A lib decide cada quebra de linha com as mesmas fontes, e o navegador nunca quebra o texto de novo."],
      ["E se eu e o agente mexermos ao mesmo tempo?", "Cada escrita confere a revisão. Se alguém escreveu antes, a sua volta com o que mudou e o editor reaplica o que você tinha pendente."],
      ["Meus documentos ficam públicos?", "Não. Só o que você publica tem link, e despublicar revoga o link."],
    ],
    mdSample: ["## Regras do convite", "- O link é de uso único.", "+ O link vale para até 5 pessoas."],
    sessionPrompt: "one-pager do lançamento, A4, em uma página",
    sessionAsk: "“O desconto entra em reais ou em %?”",
    copy: "Copiar",
    copied: "Copiado",
    closing: "Experimente com o seu agente.",
    cta: "Começar agora",
  },
} as const;

const TOC_IDS = ["quick-start", "anatomy", "agent", "you", "run", "markdown", "faq"];

export function HowItWorksPage() {
  const { locale, t } = useI18n();
  const copy = COPY[locale];
  const { isSignedIn, start } = useMarketingPage();
  const [client, setClient] = useState(0);

  return (
    <div className="df-mk hide-scrollbar">
      {isSignedIn ? <TopBar dashboardNav /> : <MarketingNav active="how-it-works" />}
      <main style={{ paddingTop: isSignedIn ? 56 : 0 }}>
        <header className="df-mk-wrap" style={{ paddingTop: 80, paddingBottom: 56, display: "flex", flexDirection: "column", gap: 20 }}>
          <SectionHead eyebrow={copy.eyebrow} title={<span style={{ fontSize: "clamp(40px, 6vw, 58px)", letterSpacing: "-.045em" }}>{copy.title}</span>} lead={copy.lead} maxWidth={860} />
          <nav className="df-mk-toc" aria-label={copy.eyebrow}>
            {copy.toc.map((label, i) => <a key={label} href={`#${TOC_IDS[i]}`}>{label}</a>)}
          </nav>
        </header>

        {/* 01 Quick start */}
        <Band id="quick-start">
          <SectionHead eyebrow={copy.quickLabel} title={copy.quickTitle} />
          <div className="df-mk-steps">
            <Panel style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <StepNo n={1} />
              <h3 style={h3}>{copy.keyTitle}</h3>
              <p style={small}>{copy.keyBody}</p>
              <code className="df-mono" style={{ marginTop: "auto", fontSize: "var(--text-body-sm)", color: "var(--color-dim)" }}>export DOCFORGE_API_KEY=…</code>
            </Panel>
            <Panel style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "22px 24px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                <StepNo n={2} />
                <h3 style={h3}>{copy.connectTitle}</h3>
              </div>
              <div role="tablist" aria-label={copy.connectTitle} style={{ display: "flex", overflowX: "auto", borderBottom: "1px solid var(--color-outline-md)", margin: "12px 0 0", padding: "0 12px" }}>
                {CLIENTS.map((c, i) => (
                  <button
                    key={c.name}
                    type="button"
                    role="tab"
                    aria-selected={i === client}
                    onClick={() => setClient(i)}
                    style={{ minHeight: 44, padding: "0 14px", background: "transparent", border: 0, borderBottom: `2px solid ${i === client ? "var(--color-heat)" : "transparent"}`, color: i === client ? "var(--color-text)" : "var(--color-dim)", fontSize: "var(--text-body-sm)", fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div role="tabpanel" style={{ padding: "16px 16px 0" }}>
                <CodeBlock code={CLIENTS[client]!.code} copyLabel={copy.copy} copiedLabel={copy.copied} />
              </div>
              <p style={{ ...small, padding: "12px 24px 20px" }}>{copy.hints[client]}</p>
            </Panel>
            <Panel style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <StepNo n={3} />
              <h3 style={h3}>{copy.askTitle}</h3>
              <p style={small}>{copy.askBody}</p>
              <div style={{ marginTop: "auto", background: "var(--color-heat-wash)", border: "1px solid var(--color-heat-line)", borderRadius: "var(--radius-md) var(--radius-md) var(--radius-xs) var(--radius-md)", padding: "12px 14px", fontSize: "var(--text-body)", lineHeight: 1.5 }}>{copy.ask}</div>
            </Panel>
          </div>
        </Band>

        {/* 02 Anatomy */}
        <section id="anatomy" className="df-mk-wrap" style={{ paddingTop: 96, paddingBottom: 88, display: "flex", flexDirection: "column", gap: 36, scrollMarginTop: 72 }}>
          <SectionHead eyebrow={copy.anatomyLabel} tone="steel" title={copy.anatomyTitle} lead={copy.anatomyLead} />
          <div className="df-mk-grid-2" style={{ gap: 20 }}>
            <Figure caption={copy.docCaption}><DocJson /></Figure>
            <Figure caption={copy.mapCaption}><MapText /></Figure>
          </div>
          <div className="df-mk-grid-4">
            {copy.rules.map(([title, body]) => (
              <Panel key={title} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                <b style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{title}</b>
                <span style={small}>{body}</span>
              </Panel>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-body-sm)", color: "var(--color-dim)", marginRight: 6 }}>{copy.componentsLabel}:</span>
            {GCD_COMPONENT_TYPES.map((type) => <Chip key={type}>{type}</Chip>)}
            <Chip dashed>{copy.componentsMore}</Chip>
          </div>
        </section>

        {/* 03 The agent's loop */}
        <Band id="agent">
          <SectionHead eyebrow={copy.loopLabel} tone="steel" title={copy.loopTitle} lead={copy.loopLead} />
          <div className="df-mk-grid-5">
            {copy.groups.map(([name, tools, body]) => (
              <Panel key={name} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <b style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{name}</b>
                <span className="df-mono" style={{ fontSize: "var(--text-caption)", lineHeight: 1.7, color: "var(--color-steel-hi)", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{tools}</span>
                <span style={{ ...small, fontSize: "var(--text-body-sm)" }}>{body}</span>
              </Panel>
            ))}
          </div>
          <SessionLog prompt={copy.sessionPrompt} ask={copy.sessionAsk} />
        </Band>

        {/* 04 Your side */}
        <section id="you" className="df-mk-wrap" style={{ paddingTop: 96, paddingBottom: 88, scrollMarginTop: 72 }}>
          <div className="df-mk-split">
            <Shot src="/marketing/editor.png" alt={copy.editorAlt} />
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SectionHead eyebrow={copy.youLabel} title={copy.youTitle} />
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10, fontSize: "var(--text-body)", lineHeight: 1.55, color: "var(--color-dim)" }}>
                {copy.you.map(([name, body]) => <li key={name}><b style={{ color: "var(--color-text)", fontWeight: 600 }}>{name}:</b> {body}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* 05 Where it runs */}
        <Band id="run">
          <SectionHead eyebrow={copy.runLabel} tone="steel" title={copy.runTitle} />
          <div className="df-mk-grid-3">
            {copy.run.map(([name, body], i) => (
              <Panel key={name} accent={i === 0} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                <h3 style={h3}>{name}</h3>
                <p style={small}>{body}</p>
                {i === 1 && <code className="df-mono" style={{ marginTop: "auto", fontSize: "var(--text-body-sm)", color: "var(--color-text)", background: "var(--color-sink)", borderRadius: "var(--radius-sm)", padding: "10px 12px", overflowX: "auto", whiteSpace: "nowrap" }}>npx docforge-layout mcp --root .</code>}
              </Panel>
            ))}
          </div>
          <CodeBlock code={RENDER_CODE} copyLabel={copy.copy} copiedLabel={copy.copied} />
        </Band>

        {/* 06 Markdown */}
        <section id="markdown" className="df-mk-wrap" style={{ paddingTop: 80, paddingBottom: 56, scrollMarginTop: 72 }}>
          <Panel style={{ padding: 36 }}>
            <div className="df-mk-split">
              <SectionHead eyebrow={copy.mdLabel} tone="steel" title={copy.mdTitle} lead={copy.mdBody} />
              <div className="df-mono" style={{ background: "var(--color-sink)", border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-md)", padding: 16, fontSize: "var(--text-body-sm)", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 4 }}>
                <span>{copy.mdSample[0]}</span>
                <span style={{ background: "var(--color-diff-del-bg)", color: "var(--color-diff-del-fg)", padding: "2px 8px", borderRadius: "var(--radius-xs)" }}>{copy.mdSample[1]}</span>
                <span style={{ background: "var(--color-diff-add-bg)", color: "var(--color-diff-add-fg)", padding: "2px 8px", borderRadius: "var(--radius-xs)" }}>{copy.mdSample[2]}</span>
              </div>
            </div>
          </Panel>
        </section>

        {/* 07 FAQ */}
        <section id="faq" className="df-mk-wrap" style={{ paddingTop: 40, paddingBottom: 40, maxWidth: 880, scrollMarginTop: 72 }}>
          <SectionHead eyebrow={copy.faqLabel} title={copy.faqTitle} />
          <div style={{ marginTop: 16 }}>
            {copy.faq.map(([q, a], i) => (
              <details key={q} className="df-mk-faq" open={i === 0}>
                <summary>{q}</summary>
                <p style={{ ...leadStyle, fontSize: "var(--text-body)", paddingBottom: 20 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <ClosingCta title={copy.closing} cta={isSignedIn ? t("nav.openWorkspace") : copy.cta} onClick={start} />
      </main>
      <AppFooter />
    </div>
  );
}

const h3 = { margin: 0, fontSize: "var(--text-title)", fontWeight: 600 } as const;
const small = { margin: 0, fontSize: "var(--text-body)", lineHeight: 1.55, color: "var(--color-dim)" } as const;

function Band({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="df-mk-band" style={{ scrollMarginTop: 72 }}>
      <div className="df-mk-wrap" style={{ paddingTop: 80, paddingBottom: 80, display: "flex", flexDirection: "column", gap: 32 }}>{children}</div>
    </section>
  );
}

function StepNo({ n }: { n: number }) {
  return <span className="df-mono" style={{ fontSize: "var(--text-body-sm)", fontWeight: 600, color: "var(--color-heat)" }}>{n}</span>;
}

function Chip({ children, dashed = false }: { children: ReactNode; dashed?: boolean }) {
  return (
    <span className="df-mono" style={{ fontSize: "var(--text-body-sm)", padding: "7px 10px", borderRadius: "var(--radius-sm)", border: `1px ${dashed ? "dashed" : "solid"} ${dashed ? "var(--color-heat-line)" : "var(--color-outline-md)"}`, color: dashed ? "var(--color-heat-hi)" : "var(--color-dim)" }}>
      {children}
    </span>
  );
}

function Figure({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <figcaption style={{ fontSize: "var(--text-body-sm)", color: "var(--color-dim)" }}>{caption}</figcaption>
      {children}
    </figure>
  );
}

const pre = { margin: 0, background: "var(--color-sink)", border: "1px solid var(--color-outline-md)", borderRadius: "var(--radius-md)", padding: "16px 18px", fontSize: "var(--text-body-sm)", lineHeight: 1.7, color: "var(--color-text)", overflowX: "auto", flex: 1 } as const;
const K = ({ children }: { children: ReactNode }) => <span style={{ color: "var(--color-steel-hi)" }}>{children}</span>;
const S = ({ children }: { children: ReactNode }) => <span style={{ color: "var(--color-diff-add-fg)" }}>{children}</span>;

/** A trimmed excerpt of the report template, in the real format. */
function DocJson() {
  return (
    <pre className="df-mono" style={pre}>
      {"{\n  "}<K>"format"</K>: <S>"docforge/layout"</S>, <K>"version"</K>: 3,
      {"\n  "}<K>"grid"</K>: {"{ "}<K>"unit"</K>: 8, <K>"columns"</K>: 12, <K>"gutter"</K>: 16{" },"}
      {"\n  "}<K>"surfaces"</K>: {"[{ "}<K>"id"</K>: <S>"a4"</S>, <K>"kind"</K>: <S>"page"</S>, <K>"size"</K>: <S>"A4"</S>{" }],"}
      {"\n  "}<K>"components"</K>: {"["}
      {"\n    { "}<K>"id"</K>: <S>"titulo"</S>, <K>"type"</K>: <S>"text"</S>,
      {"\n      "}<K>"at"</K>: {"{ "}<K>"page"</K>: 1, <K>"x"</K>: 0, <K>"y"</K>: 0, <K>"w"</K>: 87{" } },"}
      {"\n    { "}<K>"id"</K>: <S>"kpi-receita"</S>, <K>"type"</K>: <S>"kpi"</S>,
      {"\n      "}<K>"content"</K>: {"{ "}<K>"value"</K>: <S>"R$ 4,2M"</S>, <K>"delta"</K>: <S>"+12% vs T2"</S>{" },"}
      {"\n      "}<K>"at"</K>: {"{ "}<K>"page"</K>: 1, <K>"x"</K>: 0, <K>"y"</K>: 12, <K>"w"</K>: 28, <K>"h"</K>: 16{" } }"}
      {"\n  ]\n}"}
    </pre>
  );
}

/** The level-1 map of the same document, as get_layout_map draws it. */
function MapText() {
  return (
    <pre className="df-mono" style={{ ...pre, borderColor: "var(--color-steel-line)" }}>
      {`Page 1/1 · A4 · 87 × 130 units
     0          29          58         87
  0  +----------------------------------+
     | text  titulo                     |
 12  +-----------+-----------+----------+
     | kpi       | kpi       | kpi      |
     | receita   | margem    | clientes |
 30  +-----------+-----------+----------+
     | chart  vendas                    |
 62  +-----------------+----------------+
     | text  analise   | list  proximos |
`}
      <span style={{ color: "var(--color-warn)" }}>{`130  +-----------------+------------ +2 +
     ! list proximos needs 2 more rows → fit`}</span>
    </pre>
  );
}

/** One real-shaped session, as the agent's client prints it. */
function SessionLog({ prompt, ask }: { prompt: string; ask: string }) {
  const row = (tool: string, detail: string, tone?: "warn" | "ok") => (
    <div key={tool + detail}>
      <span style={{ color: "var(--color-steel)" }}>● </span>
      <span style={{ color: "var(--color-text)" }}>{tool.padEnd(24, " ")}</span>
      <span style={{ color: tone === "warn" ? "var(--color-warn)" : tone === "ok" ? "var(--color-ok)" : "var(--color-faint)" }}>{detail}</span>
    </div>
  );
  return (
    <div className="df-mono" style={{ ...pre, whiteSpace: "pre" }}>
      <div><span style={{ color: "var(--color-heat-hi)" }}>&gt; </span>{prompt}</div>
      {row("create_layout_document", 'template: "one-pager"')}
      {row("apply_layout_ops", "12 ops · add, row, move")}
      {row("review_layout", '1 warning: list "faq" needs 2 more rows → { "op": "fit", "pages": 1 }', "warn")}
      {row("apply_layout_ops", "fit")}
      {row("review_layout", "0 warnings · 1 page", "ok")}
      {row("request_review", ask)}
    </div>
  );
}
