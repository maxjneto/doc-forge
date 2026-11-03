import { useEffect, useState, type ReactNode } from "react";
import { MarketingNav } from "@/components/marketing";
import { ClosingCta, Panel, h2Style, leadStyle, useMarketingPage, useProCheckout } from "@/components/marketing/parts";
import { AppFooter } from "@/components/shared";
import { Button, Eyebrow } from "@/components/ui";
import { useI18n } from "@/i18n";
import { apiFetchTiers, type Tier } from "@/utils/api";

const CONTACT = "mailto:maxjneto@gmail.com?subject=DocForge%20for%20a%20team";

const COPY = {
  en: {
    eyebrow: "Pricing",
    title: (price: ReactNode) => <>Free to start. <span style={{ color: "var(--color-heat)" }}>{price}</span> for no limits.</>,
    lead: "The free plan already has everything DocForge does. Pro only lifts the limits for people who make documents every week.",
    perMonth: "/ month",
    free: "Free",
    freeNote: "Forever. No card.",
    proNote: "Cancel any time.",
    badge: "For weekly use",
    startFree: "Start for free",
    upgrade: "Get Pro",
    soon: "Coming soon",
    kinds: "GCDs (pages and slide decks) and Markdown",
    weekly: (n: string) => `${n} new documents a week`,
    agents: (n: string) => `${n} connected agents`,
    versions: (n: string) => `${n} versions per document`,
    fullHistory: "Full version history",
    collab: "Review, comments, themes and collaboration",
    publish: "Public link and PDF",
    everything: "Everything in Free",
    word: "Markdown to Word",
    compareTitle: "Side by side",
    rows: { weekly: "New documents per week", active: "Active documents", agents: "Connected agents", versions: "Versions per document", kinds: "GCD and Markdown", collab: "Review, comments and collaboration", publish: "Public link and PDF", word: "Markdown to Word (.docx)" },
    all: "all",
    yes: "yes",
    no: "no",
    libLabel: "Open source",
    libTitle: "The library is free forever.",
    libBody: "The engine behind every GCD is MIT. Run it locally with your agent or show GCDs in your own app, with no account and no limits.",
    teamLabel: "Teams",
    teamTitle: "More people, more agents?",
    teamBody: "For teams we set up a plan with you: limits, a single bill and help bringing the team's agents into DocForge.",
    teamCta: "Talk to us",
    faqTitle: "Questions",
    faq: [
      ["What counts as a new document?", "Creating one, in the editor or by an agent. Editing, reviewing, commenting, versioning and publishing never count. The allowance renews every Monday at 00:00 UTC."],
      ["What happens at the limit?", "Nothing is lost or locked. You keep editing everything you have; creating waits for Monday, or for Pro."],
      ["And active documents?", "Archive what you are done with to free room. Its history stays, and you can restore it whenever you want."],
      ["Does DocForge charge for AI?", "No. Your agent runs on your side with your own model; DocForge never calls a model, so there are no tokens to pay for."],
      ["How do I pay and cancel?", "By card, through Stripe, in reais. Cancel any time from the billing page; your documents stay and the free limits apply again."],
      ["Does running the library locally cost anything?", "No. The library is open and runs on your computer without an account. The plans are for doc-forge.dev."],
    ],
    checkoutError: "Could not start the checkout. Try again in a moment.",
    closing: "Start free. Decide later.",
  },
  "pt-BR": {
    eyebrow: "Preços",
    title: (price: ReactNode) => <>Grátis para começar. <span style={{ color: "var(--color-heat)" }}>{price}</span> para não ter limite.</>,
    lead: "O plano grátis já tem tudo o que o DocForge faz. O Pro só tira os limites de quem faz documento toda semana.",
    perMonth: "/ mês",
    free: "Grátis",
    freeNote: "Para sempre. Sem cartão.",
    proNote: "Cancele quando quiser.",
    badge: "Para quem faz toda semana",
    startFree: "Começar grátis",
    upgrade: "Assinar o Pro",
    soon: "Em breve",
    kinds: "GCDs (páginas e apresentações) e Markdown",
    weekly: (n: string) => `${n} documentos novos por semana`,
    agents: (n: string) => `${n} agentes conectados`,
    versions: (n: string) => `${n} versões por documento`,
    fullHistory: "Histórico completo de versões",
    collab: "Revisão, comentários, temas e colaboração",
    publish: "Link público e PDF",
    everything: "Tudo do grátis",
    word: "Markdown em Word",
    compareTitle: "Lado a lado",
    rows: { weekly: "Documentos novos por semana", active: "Documentos ativos", agents: "Agentes conectados", versions: "Versões por documento", kinds: "GCD e Markdown", collab: "Revisão, comentários e colaboração", publish: "Link público e PDF", word: "Markdown em Word (.docx)" },
    all: "todas",
    yes: "sim",
    no: "não",
    libLabel: "Código aberto",
    libTitle: "A lib é grátis para sempre.",
    libBody: "O motor dos GCDs é MIT. Rode local com o seu agente ou mostre GCDs no seu app, sem conta e sem limite.",
    teamLabel: "Times",
    teamTitle: "Mais pessoas, mais agentes?",
    teamBody: "Para times, montamos um plano junto com você: limites, cobrança única e ajuda para colocar os agentes do time no DocForge.",
    teamCta: "Fale com a gente",
    faqTitle: "Perguntas",
    faq: [
      ["O que conta como documento novo?", "Criar um, no editor ou por um agente. Editar, revisar, comentar, versionar e publicar nunca contam. A cota renova toda segunda-feira, 00:00 UTC."],
      ["O que acontece quando chego no limite?", "Nada se perde nem trava. Você continua editando tudo o que já tem; criar espera a segunda-feira, ou o Pro."],
      ["E os documentos ativos?", "Arquive o que já terminou para liberar espaço. O histórico continua lá e dá para restaurar quando quiser."],
      ["O DocForge cobra pela IA?", "Não. Seu agente roda do seu lado, com o seu modelo; o DocForge nunca chama um modelo, então não há tokens para pagar."],
      ["Como pago e como cancelo?", "Com cartão, pelo Stripe, em reais. Cancele quando quiser pela página de assinatura; seus documentos ficam e os limites do grátis voltam a valer."],
      ["Usar a lib local tem custo?", "Não. A lib é aberta e roda no seu computador sem conta. Os planos valem para o doc-forge.dev."],
    ],
    checkoutError: "Não foi possível abrir o pagamento. Tente de novo em instantes.",
    closing: "Comece grátis. Decida depois.",
  },
} as const;

export function PricingPage() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const { start } = useMarketingPage();
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
  const versions = (tier: Tier) => (tier.limits.maxVersionsPerSection === null ? copy.fullHistory : copy.versions(number(tier.limits.maxVersionsPerSection)));
  const word = (tier: Tier) => tier.limits.exportFormats.includes("docx");

  return (
    <div className="df-mk hide-scrollbar">
      <MarketingNav active="pricing" />
      <main>
        <section style={{ position: "relative", overflow: "hidden" }}>
          <div className="df-mk-gridbg" aria-hidden />
          <div className="df-mk-wrap" style={{ position: "relative", paddingTop: 88, paddingBottom: 56, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 18 }}>
            <Eyebrow tone="heat" align="center">{copy.eyebrow}</Eyebrow>
            <h1 style={{ margin: 0, fontSize: "clamp(40px, 6.4vw, 64px)", lineHeight: 1, letterSpacing: "-.05em", fontWeight: 600, maxWidth: 840 }}>
              {copy.title(pro ? money(pro) : "Pro")}
            </h1>
            <p style={{ ...leadStyle, maxWidth: 600 }}>{copy.lead}</p>
          </div>
          {free && pro && (
            <div className="df-mk-wrap" style={{ position: "relative", paddingBottom: 96 }}>
              <div className="df-mk-grid-2" style={{ maxWidth: 920, margin: "0 auto", gap: 20 }}>
                <PlanCard
                  name={copy.free}
                  price={money(free)}
                  perMonth={copy.perMonth}
                  note={copy.freeNote}
                  lines={[copy.kinds, copy.weekly(number(free.limits.weeklyDocumentCreations)), copy.agents(number(free.limits.maxApiKeys)), copy.collab, copy.publish]}
                  cta={<Button size="lg" style={{ width: "100%" }} onClick={start}>{copy.startFree}</Button>}
                />
                <PlanCard
                  highlight
                  badge={copy.badge}
                  name="Pro"
                  price={money(pro)}
                  perMonth={copy.perMonth}
                  note={copy.proNote}
                  lines={[copy.everything, copy.weekly(number(pro.limits.weeklyDocumentCreations)), copy.agents(number(pro.limits.maxApiKeys)), versions(pro), ...(word(pro) ? [copy.word] : [])]}
                  cta={
                    <Button size="lg" variant="primary" style={{ width: "100%" }} disabled={!pro.available || checkout.busy} onClick={checkout.upgrade}>
                      {pro.available ? copy.upgrade : copy.soon}
                    </Button>
                  }
                />
              </div>
              {checkout.error && <p style={{ textAlign: "center", color: "var(--color-error)", fontSize: "var(--text-body-sm)", margin: "14px 0 0" }}>{checkout.error}</p>}
            </div>
          )}
        </section>

        {free && pro && (
          <section className="df-mk-band">
            <div className="df-mk-wrap" style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 920, display: "flex", flexDirection: "column", gap: 28 }}>
              <h2 style={h2Style}>{copy.compareTitle}</h2>
              <Panel style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: "var(--text-body)" }}>
                  <thead>
                    <tr>
                      <th scope="col" style={cell} />
                      <th scope="col" style={{ ...cell, ...num, fontWeight: 600 }}>{copy.free}</th>
                      <th scope="col" style={{ ...cell, ...num, fontWeight: 600, color: "var(--color-heat-hi)" }}>Pro</th>
                    </tr>
                  </thead>
                  <tbody>
                    <Row label={copy.rows.weekly} free={number(free.limits.weeklyDocumentCreations)} pro={number(pro.limits.weeklyDocumentCreations)} />
                    <Row label={copy.rows.active} free={number(free.limits.maxActiveDocuments)} pro={number(pro.limits.maxActiveDocuments)} />
                    <Row label={copy.rows.agents} free={number(free.limits.maxApiKeys)} pro={number(pro.limits.maxApiKeys)} />
                    <Row label={copy.rows.versions} free={free.limits.maxVersionsPerSection === null ? copy.all : number(free.limits.maxVersionsPerSection)} pro={pro.limits.maxVersionsPerSection === null ? copy.all : number(pro.limits.maxVersionsPerSection)} />
                    <Row label={copy.rows.kinds} free pro yes={copy.yes} no={copy.no} />
                    <Row label={copy.rows.collab} free pro yes={copy.yes} no={copy.no} />
                    <Row label={copy.rows.publish} free pro yes={copy.yes} no={copy.no} />
                    <Row label={copy.rows.word} free={word(free)} pro={word(pro)} yes={copy.yes} no={copy.no} last />
                  </tbody>
                </table>
              </Panel>
            </div>
          </section>
        )}

        <section className="df-mk-wrap" style={{ paddingTop: 88, paddingBottom: 72 }}>
          <div className="df-mk-grid-2" style={{ gap: 20 }}>
            <Panel style={{ padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
              <Eyebrow style={{ color: "var(--color-steel-hi)" }}>{copy.libLabel}</Eyebrow>
              <h3 style={h3}>{copy.libTitle}</h3>
              <p style={body}>{copy.libBody}</p>
              <code className="df-mono" style={{ marginTop: "auto", fontSize: "var(--text-body-sm)", color: "var(--color-text)", background: "var(--color-sink)", borderRadius: "var(--radius-sm)", padding: "12px 14px", overflowX: "auto", whiteSpace: "nowrap" }}>npx docforge-layout mcp --root .</code>
            </Panel>
            <Panel style={{ padding: 32, display: "flex", flexDirection: "column", gap: 14 }}>
              <Eyebrow tone="heat">{copy.teamLabel}</Eyebrow>
              <h3 style={h3}>{copy.teamTitle}</h3>
              <p style={body}>{copy.teamBody}</p>
              <a href={CONTACT} style={{ marginTop: "auto", fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-heat-soft)", textDecoration: "none" }}>{copy.teamCta} →</a>
            </Panel>
          </div>
        </section>

        <section className="df-mk-wrap" style={{ paddingTop: 24, paddingBottom: 40, maxWidth: 880 }}>
          <h2 style={h2Style}>{copy.faqTitle}</h2>
          <div style={{ marginTop: 16 }}>
            {copy.faq.map(([q, a], i) => (
              <details key={q} className="df-mk-faq" open={i === 0}>
                <summary>{q}</summary>
                <p style={{ ...leadStyle, fontSize: "var(--text-body)", paddingBottom: 20 }}>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <ClosingCta title={copy.closing} cta={copy.startFree} onClick={start} />
      </main>
      <AppFooter />
    </div>
  );
}

const h3 = { margin: 0, fontSize: 28, letterSpacing: "-.02em", fontWeight: 600 } as const;
const body = { margin: 0, fontSize: "var(--text-body)", lineHeight: 1.6, color: "var(--color-dim)" } as const;
const cell = { padding: "16px 20px", borderBottom: "1px solid var(--color-outline)", textAlign: "left" } as const;
const num = { textAlign: "center", fontVariantNumeric: "tabular-nums" } as const;

function PlanCard({ name, price, perMonth, note, lines, cta, highlight = false, badge }: {
  name: string; price: string; perMonth: string; note: string; lines: readonly string[]; cta: ReactNode; highlight?: boolean; badge?: string;
}) {
  return (
    <Panel accent={highlight} style={{ position: "relative", padding: 36, display: "flex", flexDirection: "column", gap: 22, boxShadow: highlight ? "0 0 100px var(--color-heat-tint)" : "none" }}>
      {badge && (
        <span style={{ position: "absolute", top: -13, left: 36, background: "var(--color-heat)", color: "var(--color-on-heat)", fontSize: "var(--text-caption)", fontWeight: 600, padding: "7px 10px", borderRadius: "var(--radius-pill)" }}>{badge}</span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: "var(--text-body)", color: highlight ? "var(--color-heat-hi)" : "var(--color-dim)" }}>{name}</span>
        <span style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-.05em", lineHeight: 1 }}>
          {price}
          <span style={{ fontSize: 17, color: "var(--color-dim)", fontWeight: 400, letterSpacing: 0 }}> {perMonth}</span>
        </span>
        <span style={{ fontSize: "var(--text-body)", color: "var(--color-dim)" }}>{note}</span>
      </div>
      {cta}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12, fontSize: "var(--text-body)", lineHeight: 1.45, color: "var(--color-dim)" }}>
        {lines.map((line) => (
          <li key={line} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 18, color: highlight ? "var(--color-heat-hi)" : "var(--color-ok)", flexShrink: 0 }}>check</span>
            {line}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Row({ label, free, pro, yes = "", no = "", last = false }: { label: string; free: string | boolean; pro: string | boolean; yes?: string; no?: string; last?: boolean }) {
  const value = (v: string | boolean) => (typeof v === "boolean" ? <span style={{ color: v ? "var(--color-ok)" : "var(--color-faint)" }}>{v ? yes : no}</span> : v);
  const border = last ? { borderBottom: "none" } : {};
  return (
    <tr>
      <th scope="row" style={{ ...cell, ...border, fontWeight: 500, color: "var(--color-dim)" }}>{label}</th>
      <td style={{ ...cell, ...num, ...border }}>{value(free)}</td>
      <td style={{ ...cell, ...num, ...border, color: "var(--color-text)", fontWeight: typeof pro === "string" ? 600 : 400 }}>{value(pro)}</td>
    </tr>
  );
}
