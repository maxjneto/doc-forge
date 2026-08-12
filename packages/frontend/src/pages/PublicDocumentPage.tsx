import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DocumentOutline, LanguageSwitcher, MarkdownRenderer } from "@/components/shared";
import { API_BASE } from "@/utils/api";
import { parseHeadings } from "@/utils/documentStructure";
import { scrollToDocumentHeading, useDocumentScrollSpy } from "@/utils/useDocumentScrollSpy";
import { useI18n } from "@/i18n";

/**
 * A document read through its public link.
 *
 * No authentication and no chrome: the token is the capability, and whoever
 * holds it is a reader, not a collaborator. Deliberately shows only title and
 * text — never members, versions, suggestions or gate findings.
 */
export function PublicDocumentPage() {
  const { t, dateLocale } = useI18n();
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<{ title: string; content: string; updated_at: string | null } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headings = useMemo(() => parseHeadings(doc?.content ?? ""), [doc?.content]);

  useDocumentScrollSpy({
    scrollRef,
    contentRef,
    headings,
    enabled: Boolean(doc),
    onActiveSlugChange: setActiveSlug,
  });

  const navigateTo = useCallback((slug: string) => {
    if (scrollToDocumentHeading(scrollRef.current, contentRef.current, slug)) setActiveSlug(slug);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/public/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (notFound) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--df-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <p style={{ fontSize: 13.5, color: "var(--df-faint)", textAlign: "center", lineHeight: 1.6 }}>
          {t("public.invalid")}
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--df-bg)", overflow: "hidden" }}>
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 24px",
          borderBottom: "1px solid var(--df-outline)",
          flexShrink: 0,
        }}
      >
        <img src="/assets/docforge-logo.png" alt="DocForge" style={{ height: 28, width: "auto" }} />
        <div
          className="df-mono"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "var(--df-on-surface)",
          }}
        >
          DOCFORGE
        </div>
        <span style={{ flex: 1 }} />
        <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
          {t("public.badge").toUpperCase()}
        </span>
        <LanguageSwitcher compact />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {doc && headings.length > 0 && (
          <aside style={{ width: 220, flexShrink: 0, overflowY: "auto", padding: "28px 16px", borderRight: "1px solid var(--df-outline)", background: "var(--color-shade-20)" }} className="df-scroll-thin public-document-outline">
            <div className="df-mono" style={{ marginBottom: 14, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--df-faint)" }}>
              › {t("public.structure")}
            </div>
            <DocumentOutline headings={headings} activeSlug={activeSlug} onNavigate={navigateTo} />
          </aside>
        )}
        <main ref={scrollRef} style={{ flex: 1, minWidth: 0, overflowY: "auto" }} className="df-scroll-thin">
          <div ref={contentRef} style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 96px" }}>
        {doc ? (
          <>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--df-on-surface)",
                margin: "0 0 28px",
              }}
            >
              {doc.title}
            </h1>
            {doc.updated_at && (
              <div className="df-mono" style={{ marginTop: -18, marginBottom: 28, fontSize: 9.5, letterSpacing: "0.08em", color: "var(--df-faint)" }}>
                {t("public.publishedOn", { date: new Date(doc.updated_at).toLocaleDateString(dateLocale) }).toUpperCase()}
              </div>
            )}
            <MarkdownRenderer content={doc.content} variant="editor" headingIds />
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--df-faint)" }}>{t("common.loading")}</p>
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
