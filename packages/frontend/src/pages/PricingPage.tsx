import { useEffect, useState } from "react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { AppFooter } from "@/components/shared";
import { MarketingNav } from "@/components/marketing";
import { apiCreateCheckoutSession, apiFetchTiers, type Tier } from "@/utils/api";
import { useI18n } from "@/i18n";
import { Button, Eyebrow, Pill, textStyle } from "@/components/ui";

const CONTACT = "mailto:maxjneto@gmail.com?subject=DocForge%20for%20a%20team";

const COPY = {
  en: {
    badge: "Pricing",
    title: "Free to use. Cheap to grow.",
    lead: "Everything DocForge does is in the free plan. Pro lifts the limits for people who write with agents every day.",
    perMonth: "/ month",
    free: "Free",
    freeWhat: "Everything DocForge does, for one person and their agents.",
    proWhat: "For people who write with agents every day.",
    start: "Start for free",
    upgrade: "Upgrade to Pro",
    current: "Your plan",
    soon: "Coming soon",
    popular: "For daily use",
    weekly: (n: string) => `${n} new documents a week`,
    active: (n: string) => `Up to ${n} active documents`,
    agents: (n: string) => `${n} connected agents`,
    versions: (n: string) => `${n} versions per document`,
    fullHistory: "Full version history",
    exportAs: (formats: string) => `Export to ${formats}`,
    everything: "Everything in Free",
    both: ["Markdown documents, pages and slides", "Review agent changes as suggestions", "Comments, sharing and public links"],
    compareTitle: "Compare plans",
    rows: {
      weekly: "New documents per week",
      active: "Active documents",
      agents: "Connected agents (MCP)",
      versions: "Versions kept per document",
      export: "Export",
      kinds: "Markdown documents, pages and slides",
      review: "Suggestions, comments and quality gate",
      publish: "Publishing and public links",
      themes: "Saved themes",
    },
    all: "All",
    and: "and",
    faqTitle: "Questions",
    faq: [
      ["What counts as a new document?", "Creating one, in the editor or by an agent. Editing, reviewing, commenting, versioning and publishing never count. The allowance renews every Monday at 00:00 UTC."],
      ["What happens at the limit?", "Nothing is lost or locked. You keep editing; creating waits for Monday, or for an archived document to free an active slot."],
      ["Does DocForge charge for AI?", "No. Your agent runs on your side with your own model; DocForge never calls a model, so there are no tokens to pay for."],
      ["Can I cancel Pro?", "Any time, from the billing page. Your documents stay; the free limits apply again."],
    ],
    team: "Need it for a team?",
    teamCta: "Talk to us",
    checkoutError: "Could not start the checkout. Try again in a moment.",
  },
  "pt-BR": {
    badge: "Planos",
    title: "Grátis para usar. Barato para crescer.",
    lead: "Tudo o que o DocForge faz está no plano gratuito. O Pro tira os limites de quem escreve com agentes todo dia.",
    perMonth: "/ mês",
    free: "Grátis",
    freeWhat: "Tudo o que o DocForge faz, para uma pessoa e seus agentes.",
    proWhat: "Para quem escreve com agentes todo dia.",
    start: "Começar grátis",
    upgrade: "Assinar o Pro",
    current: "Seu plano",
    soon: "Em breve",
    popular: "Para uso diário",
    weekly: (n: string) => `${n} documentos novos por semana`,
    active: (n: string) => `Até ${n} documentos ativos`,
    agents: (n: string) => `${n} agentes conectados`,
    versions: (n: string) => `${n} versões por documento`,
    fullHistory: "Histórico de versões completo",
    exportAs: (formats: string) => `Exportar em ${formats}`,
    everything: "Tudo do Grátis",
    both: ["Documentos Markdown, páginas e slides", "Revise as mudanças do agente como sugestões", "Comentários, compartilhamento e links públicos"],
    compareTitle: "Compare os planos",
    rows: {
      weekly: "Documentos novos por semana",
      active: "Documentos ativos",
      agents: "Agentes conectados (MCP)",
      versions: "Versões guardadas por documento",
      export: "Exportar",
      kinds: "Documentos Markdown, páginas e slides",
      review: "Sugestões, comentários e gate de qualidade",
      publish: "Publicação e links públicos",
      themes: "Temas salvos",
    },
    all: "Todas",
    and: "e",
    faqTitle: "Perguntas",
    faq: [
      ["O que conta como documento novo?", "Criar um, no editor ou por um agente. Editar, revisar, comentar, versionar e publicar nunca contam. A cota renova toda segunda-feira, 00:00 UTC."],
      ["O que acontece no limite?", "Nada se perde nem trava. Você continua editando; criar espera a segunda-feira, ou um documento arquivado liberar espaço."],
      ["O DocForge cobra pela IA?", "Não. Seu agente roda do seu lado, com o seu modelo; o DocForge nunca chama um modelo, então não há tokens para pagar."],
      ["Posso cancelar o Pro?", "Quando quiser, pela página de assinatura. Seus documentos ficam; os limites do plano gratuito voltam a valer."],
    ],
    team: "Precisa para um time?",
    teamCta: "Fale com a gente",
    checkoutError: "Não foi possível abrir o pagamento. Tente de novo em instantes.",
  },
} as const;

const FORMAT_NAMES: Record<string, string> = { md: "Markdown", pdf: "PDF", docx: "Word" };

export function PricingPage() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const { isSignedIn, getToken } = useAuth();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetchTiers().then((t) => !cancelled && setTiers(t)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const number = (n: number | null) => (n === null ? "∞" : n.toLocaleString(locale));
  const money = (tier: Tier) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: tier.currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(tier.priceMonthly ?? 0);
  const formats = (list: string[]) => {
    const names = list.map((f) => FORMAT_NAMES[f] ?? f);
    return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} ${copy.and} ${names[names.length - 1]}`;
  };
  const free = tiers.find((t) => t.slug === "free");
  const pro = tiers.find((t) => t.slug === "pro");

  const startFree = () => (isSignedIn ? navigate("/home") : openSignIn({ afterSignInUrl: "/home", afterSignUpUrl: "/home" }));
  const upgrade = async () => {
    if (!isSignedIn) {
      openSignIn({ afterSignInUrl: "/pricing", afterSignUpUrl: "/pricing" });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      window.location.href = await apiCreateCheckoutSession("pro", getToken);
    } catch {
      setError(copy.checkoutError);
      setBusy(false);
    }
  };

  const limitsOf = (tier: Tier) => [
    copy.weekly(number(tier.limits.weeklyDocumentCreations)),
    copy.active(number(tier.limits.maxActiveDocuments)),
    copy.agents(number(tier.limits.maxApiKeys)),
    tier.limits.maxVersionsPerSection === null ? copy.fullHistory : copy.versions(number(tier.limits.maxVersionsPerSection)),
    copy.exportAs(formats(tier.limits.exportFormats)),
  ];

  return (
    <div className="hide-scrollbar" style={{ background: "var(--color-bg)", color: "var(--color-text)", minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-sans)", position: "relative" }}>
      <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 800px 600px at 50% 15%, var(--color-heat-wash), transparent 60%)" }} />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1 }}>
        <MarketingNav active="pricing" />
        <main style={{ flex: 1, padding: "76px 24px 96px", maxWidth: 980, margin: "0 auto", width: "100%" }}>
          <header style={{ textAlign: "center", marginBottom: 48 }}>
            <Pill tone="heat">{copy.badge}</Pill>
            <h1 style={{ fontSize: "clamp(36px, 5.5vw, 58px)", fontWeight: 600, letterSpacing: "-.05em", lineHeight: 1, margin: "20px 0 16px" }}>{copy.title}</h1>
            <p style={{ color: "var(--color-dim)", fontSize: 17, lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>{copy.lead}</p>
          </header>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 16, alignItems: "stretch" }}>
            {free && (
              <PlanCard
                name={copy.free}
                price={money(free)}
                perMonth={copy.perMonth}
                what={copy.freeWhat}
                lines={[...copy.both, ...limitsOf(free)]}
                cta={<Button size="lg" onClick={startFree} style={{ width: "100%" }}>{copy.start}</Button>}
              />
            )}
            {pro && (
              <PlanCard
                highlight
                badge={copy.popular}
                name="Pro"
                price={money(pro)}
                perMonth={copy.perMonth}
                what={copy.proWhat}
                lines={[copy.everything, ...limitsOf(pro)]}
                cta={
                  <Button size="lg" variant="primary" onClick={upgrade} disabled={!pro.available || busy} style={{ width: "100%" }}>
                    {pro.available ? copy.upgrade : copy.soon}
                  </Button>
                }
              />
            )}
          </div>
          {error && <p style={{ color: "var(--color-error)", textAlign: "center", fontSize: "var(--text-body-sm)", marginTop: 14 }}>{error}</p>}

          <p style={{ textAlign: "center", color: "var(--color-dim)", fontSize: "var(--text-body)", marginTop: 26 }}>
            {copy.team}{" "}
            <a href={CONTACT} style={{ color: "var(--color-heat-soft)", fontWeight: 600, textDecoration: "none" }}>{copy.teamCta} →</a>
          </p>

          {free && pro && (
            <section style={{ marginTop: 80 }}>
              <h2 style={sectionTitle}>{copy.compareTitle}</h2>
              <div style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <CompareRow head label="" free={copy.free} pro="Pro" />
                <CompareRow label={copy.rows.weekly} free={number(free.limits.weeklyDocumentCreations)} pro={number(pro.limits.weeklyDocumentCreations)} />
                <CompareRow label={copy.rows.active} free={number(free.limits.maxActiveDocuments)} pro={number(pro.limits.maxActiveDocuments)} />
                <CompareRow label={copy.rows.agents} free={number(free.limits.maxApiKeys)} pro={number(pro.limits.maxApiKeys)} />
                <CompareRow label={copy.rows.versions} free={number(free.limits.maxVersionsPerSection)} pro={pro.limits.maxVersionsPerSection === null ? copy.all : number(pro.limits.maxVersionsPerSection)} />
                <CompareRow label={copy.rows.export} free={formats(free.limits.exportFormats)} pro={formats(pro.limits.exportFormats)} />
                <CompareRow label={copy.rows.kinds} free pro check />
                <CompareRow label={copy.rows.review} free pro check />
                <CompareRow label={copy.rows.publish} free pro check />
                <CompareRow label={copy.rows.themes} free pro check />
              </div>
            </section>
          )}

          <section style={{ marginTop: 80 }}>
            <h2 style={sectionTitle}>{copy.faqTitle}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 14 }}>
              {copy.faq.map(([q, a]) => (
                <article key={q} style={{ border: "1px solid var(--color-outline)", borderRadius: "var(--radius-md)", padding: 20, background: "var(--color-hover)" }}>
                  <h3 style={{ fontSize: "var(--text-title)", margin: "0 0 8px" }}>{q}</h3>
                  <p style={{ color: "var(--color-dim)", fontSize: "var(--text-body-sm)", lineHeight: 1.6, margin: 0 }}>{a}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
        <AppFooter />
      </div>
    </div>
  );
}

const sectionTitle = { fontSize: "clamp(24px, 3vw, 32px)", fontWeight: 600, letterSpacing: "-.035em", textAlign: "center", margin: "0 0 24px" } as const;

function PlanCard({ name, price, perMonth, what, lines, cta, highlight = false, badge }: {
  name: string; price: string; perMonth: string; what: string; lines: readonly string[]; cta: React.ReactNode; highlight?: boolean; badge?: string;
}) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 20, padding: "30px 26px", borderRadius: "var(--radius-lg)", border: `1px solid ${highlight ? "var(--color-heat-strong)" : "var(--color-outline)"}`, background: highlight ? "var(--gradient-warm)" : "var(--color-chrome)", boxShadow: highlight ? "var(--shadow-glow)" : "none" }}>
      {badge && <Pill tone="heat" style={{ position: "absolute", top: -12, left: 26 }}>{badge}</Pill>}
      <div>
        <Eyebrow tone={highlight ? "heat" : "faint"}>{name}</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
          <span style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-.05em" }}>{price}</span>
          <span style={{ color: "var(--color-faint)", fontSize: "var(--text-body)" }}>{perMonth}</span>
        </div>
        <p style={{ color: "var(--color-dim)", fontSize: "var(--text-body)", lineHeight: 1.55, margin: "10px 0 0" }}>{what}</p>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {lines.map((line) => (
          <li key={line} style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: "var(--text-body-sm)", color: "var(--color-dim)", lineHeight: 1.45 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: highlight ? "var(--color-heat-hi)" : "var(--color-steel-hi)", flexShrink: 0 }}>check</span>
            {line}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "auto" }}>{cta}</div>
    </div>
  );
}

function CompareRow({ label, free, pro, head = false, check = false }: { label: string; free: string | boolean; pro: string | boolean; head?: boolean; check?: boolean }) {
  const cell = (value: string | boolean) =>
    check && value === true
      ? <span className="material-symbols-outlined" style={{ fontSize: 17, color: "var(--color-ok)" }}>check</span>
      : <span>{value}</span>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr)", alignItems: "center", gap: 12, padding: "12px 18px", borderTop: head ? "none" : "1px solid var(--color-outline)", background: head ? "var(--color-hover)" : "transparent", fontSize: "var(--text-body-sm)" }}>
      <span style={head ? { ...textStyle.label, color: "var(--color-faint)" } : { color: "var(--color-dim)" }}>{label}</span>
      <span style={{ textAlign: "center", ...(head ? { ...textStyle.label, color: "var(--color-faint)" } : {}) }}>{cell(free)}</span>
      <span style={{ textAlign: "center", ...(head ? { ...textStyle.label, color: "var(--color-heat-hi)" } : {}) }}>{cell(pro)}</span>
    </div>
  );
}
