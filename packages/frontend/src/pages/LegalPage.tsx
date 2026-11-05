import { NavLink, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppFooter, SiteHeader, usePageScroll } from "@/components/shared";
import { Panel, leadStyle } from "@/components/marketing/parts";
import { Eyebrow } from "@/components/ui";
import { useI18n, type Locale } from "@/i18n";
import { parseHeadings } from "@/utils/documentStructure";
// One source for each text: the English files are the ones the repository README links to.
import TERMS_EN from "@/legal/terms.md?raw";
import PRIVACY_EN from "@/legal/privacy.md?raw";
import TERMS_PT from "@/legal/terms.pt-BR.md?raw";
import PRIVACY_PT from "@/legal/privacy.pt-BR.md?raw";

type LegalDoc = "privacy" | "terms" | "contact";

const TEXTS: Record<"privacy" | "terms", Record<Locale, string>> = {
  privacy: { en: PRIVACY_EN, "pt-BR": PRIVACY_PT },
  terms: { en: TERMS_EN, "pt-BR": TERMS_PT },
};

const EMAIL = "maxjneto@gmail.com";

/**
 * The file's `# Title` and `*Last updated: …*` lines become the page header;
 * the rest is the body.
 */
function splitLegal(markdown: string) {
  const lines = markdown.split("\n");
  const titleAt = lines.findIndex((line) => line.startsWith("# "));
  const updatedAt = lines.findIndex((line) => /^\*[^*:]+:\s*.+\*$/.test(line.trim()));
  const title = titleAt >= 0 ? lines[titleAt].slice(2).trim() : "";
  const updated = updatedAt >= 0 ? lines[updatedAt].trim().replace(/^\*[^*:]+:\s*/, "").replace(/\*$/, "") : null;
  const body = lines.filter((_, i) => i !== titleAt && i !== updatedAt).join("\n").trim();
  return { title, updated, body };
}

/** `/legal/privacy`, `/legal/terms` and `/contact`: one shell, three tabs. */
export function LegalPage({ doc: fixedDoc }: { doc?: LegalDoc }) {
  const { doc: param } = useParams<{ doc: string }>();
  const doc: LegalDoc = fixedDoc ?? (param === "privacy" ? "privacy" : "terms");
  const { locale, t } = useI18n();
  usePageScroll();

  const legal = doc === "contact" ? null : splitLegal(TEXTS[doc][locale]);
  const title = legal ? legal.title : t("legal.contact.title");

  return (
    <div className="df-mk" style={{ display: "flex", flexDirection: "column" }}>
      <SiteHeader />
      <main style={{ flex: 1 }}>
        <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--color-outline)" }}>
          <div className="df-mk-gridbg" aria-hidden />
          <div className="df-mk-wrap" style={{ position: "relative", paddingTop: 72, paddingBottom: 40, display: "flex", flexDirection: "column", gap: 18 }}>
            <Eyebrow tone="heat">{t("footer.legal")}</Eyebrow>
            <h1 style={{ margin: 0, fontSize: "clamp(36px, 5vw, 52px)", lineHeight: 1.05, letterSpacing: "-.045em", fontWeight: 600 }}>{title}</h1>
            {legal?.updated && <p className="df-mono" style={{ margin: 0, fontSize: "var(--text-caption)", letterSpacing: "var(--tracking-data)", color: "var(--color-faint)" }}>{t("legal.updated", { date: legal.updated })}</p>}
            {!legal && <p style={{ ...leadStyle, maxWidth: 640 }}>{t("legal.contact.lead")}</p>}
            <nav className="df-legal-tabs" aria-label={t("footer.legal")}>
              <NavLink to="/legal/privacy">{t("footer.privacy")}</NavLink>
              <NavLink to="/legal/terms">{t("footer.terms")}</NavLink>
              <NavLink to="/contact">{t("footer.contact")}</NavLink>
            </nav>
          </div>
        </section>

        {legal ? <LegalBody markdown={legal.body} contentsLabel={t("legal.contents")} /> : <ContactBody />}
      </main>
      <AppFooter />
    </div>
  );
}

function LegalBody({ markdown, contentsLabel }: { markdown: string; contentsLabel: string }) {
  const sections = parseHeadings(markdown).filter((heading) => heading.level === 2);
  let next = 0;
  return (
    <div className="df-mk-wrap df-legal">
      <aside className="df-legal__toc">
        <Eyebrow style={{ marginBottom: 14 }}>{contentsLabel}</Eyebrow>
        {sections.map((section) => (
          <a key={section.slug} href={`#${section.slug}`}>{section.text}</a>
        ))}
      </aside>
      <article className="df-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => <h2 id={sections[next++]?.slug}>{children}</h2>,
            table: ({ children }) => (
              <div className="df-prose__table">
                <table>{children}</table>
              </div>
            ),
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}

function ContactBody() {
  const { t } = useI18n();
  const topics: { icon: string; title: string; body: string; subject: string }[] = [
    { icon: "support_agent", title: t("legal.contact.support"), body: t("legal.contact.supportBody"), subject: "DocForge — help" },
    { icon: "shield_person", title: t("legal.contact.privacy"), body: t("legal.contact.privacyBody"), subject: "DocForge — privacy request" },
    { icon: "credit_card", title: t("legal.contact.billing"), body: t("legal.contact.billingBody"), subject: "DocForge — billing" },
  ];
  return (
    <div className="df-mk-wrap" style={{ paddingTop: 56, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 32 }}>
      <div className="df-mk-grid-3">
        {topics.map((topic) => (
          <ContactCard key={topic.icon} {...topic} write={t("legal.contact.write")} />
        ))}
      </div>
      <a href={`mailto:${EMAIL}`} className="df-mono" style={{ alignSelf: "flex-start", fontSize: "var(--text-title)", color: "var(--color-heat-soft)", textDecoration: "none" }}>
        {EMAIL}
      </a>
    </div>
  );
}

function ContactCard({ icon, title, body, subject, write }: { icon: string; title: string; body: string; subject: string; write: string }) {
  return (
    <Panel style={{ padding: 28, display: "flex", flexDirection: "column", gap: 12 }}>
      <span className="material-symbols-outlined" aria-hidden style={{ fontSize: 22, color: "var(--color-heat-hi)" }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: "var(--text-title)", fontWeight: 600, letterSpacing: "-0.02em" }}>{title}</h2>
      <p style={{ margin: 0, fontSize: "var(--text-body)", lineHeight: 1.6, color: "var(--color-dim)" }}>{body}</p>
      <a
        href={`mailto:${EMAIL}?subject=${encodeURIComponent(subject)}`}
        style={{ marginTop: "auto", paddingTop: 8, fontSize: "var(--text-body)", fontWeight: 600, color: "var(--color-heat-soft)", textDecoration: "none" }}
      >
        {write} →
      </a>
    </Panel>
  );
}
