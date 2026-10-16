import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { DocumentOutline, LanguageSwitcher, MarkdownRenderer } from "@/components/shared";
import { API_BASE } from "@/utils/api";
import { parseHeadings } from "@/utils/documentStructure";
import { scrollToDocumentHeading, useDocumentScrollSpy } from "@/utils/useDocumentScrollSpy";
import { useI18n } from "@/i18n";

const PublicLayoutView = lazy(() => import("@/components/layout-doc/PublicLayoutView"));

type PublicDocument =
  | { mode?: "markdown"; title: string; content: string; updated_at: string | null }
  | { mode: "layout"; title: string; content: unknown; updated_at: string | null };

/**
 * A document read through its public link.
 *
 * No authentication and no chrome: the token is the capability, and whoever
 * holds it is a reader, not a collaborator. Deliberately shows only title and
 * text — never members, versions, suggestions or gate findings. A page document
 * shows what its owner published, drawn by @docforge-lib/layout.
 */
export function PublicDocumentPage() {
  const { t, dateLocale } = useI18n();
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<PublicDocument | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const scrollRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const markdown = doc && doc.mode !== "layout" ? doc.content : "";
  const headings = useMemo(() => parseHeadings(markdown), [markdown]);

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
          background: "var(--color-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <p style={{ fontSize: 13, color: "var(--color-faint)", textAlign: "center", lineHeight: 1.6 }}>
          {t("public.invalid")}
        </p>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)", overflow: "hidden" }}>
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 9,
          padding: "0 24px",
          borderBottom: "1px solid var(--color-outline)",
          flexShrink: 0,
        }}
      >
        <img src="/assets/docforge-logo.png" alt="DocForge" style={{ height: 28, width: "auto" }} />
        <div
          className="df-mono"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "var(--tracking-eyebrow)",
            color: "var(--color-text)",
          }}
        >
          DOCFORGE
        </div>
        <span style={{ flex: 1 }} />
        <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)" }}>
          {t("public.badge").toUpperCase()}
        </span>
        <LanguageSwitcher compact />
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {doc && headings.length > 0 && (
          <aside style={{ width: 220, flexShrink: 0, overflowY: "auto", padding: "28px 16px", borderRight: "1px solid var(--color-outline)", background: "var(--color-sink)" }} className="df-scroll-thin public-document-outline">
            <div className="df-mono" style={{ marginBottom: 14, fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-faint)" }}>
              › {t("public.structure")}
            </div>
            <DocumentOutline headings={headings} activeSlug={activeSlug} onNavigate={navigateTo} />
          </aside>
        )}
        <main ref={scrollRef} style={{ flex: 1, minWidth: 0, overflowY: "auto" }} className="df-scroll-thin">
          <div ref={contentRef} style={doc?.mode === "layout" ? { maxWidth: 1360, margin: "0 auto", padding: "40px 16px 80px" } : { maxWidth: 820, margin: "0 auto", padding: "48px 40px 96px" }}>
        {doc ? (
          <>
            {doc.mode !== "layout" && (
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--color-text)",
                margin: "0 0 28px",
              }}
            >
              {doc.title}
            </h1>
            )}
            {doc.updated_at && (
              <div className="df-mono" style={{ marginTop: -18, marginBottom: 28, fontSize: 10, letterSpacing: "var(--tracking-label)", color: "var(--color-faint)" }}>
                {t("public.publishedOn", { date: new Date(doc.updated_at).toLocaleDateString(dateLocale) }).toUpperCase()}
              </div>
            )}
            {doc.mode === "layout" ? (
              <Suspense fallback={<p style={{ fontSize: 13, color: "var(--color-faint)" }}>{t("common.loading")}</p>}>
                <PublicLayoutView content={doc.content} title={doc.title} />
              </Suspense>
            ) : (
              <MarkdownRenderer content={doc.content} variant="editor" headingIds />
            )}
          </>
        ) : (
          <p style={{ fontSize: 13, color: "var(--color-faint)" }}>{t("common.loading")}</p>
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
