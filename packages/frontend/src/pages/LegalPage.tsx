import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { MarkdownRenderer } from "@/components/shared";
// One source for each text: the same files the repository README links to.
import TERMS_CONTENT from "@/legal/terms.md?raw";
import PRIVACY_CONTENT from "@/legal/privacy.md?raw";

const CONTENT: Record<string, { title: string; body: string }> = {
  terms: { title: "Terms of Use", body: TERMS_CONTENT },
  privacy: { title: "Privacy Policy", body: PRIVACY_CONTENT },
};

export function LegalPage() {
  const { doc } = useParams<{ doc: string }>();
  const page = CONTENT[doc ?? ""] ?? CONTENT.terms;

  useEffect(() => {
    document.body.style.overflow = "auto";
  }, []);

  return (
    <div style={{ background: "var(--color-bg)", color: "var(--color-text)", minHeight: "100vh", fontFamily: "var(--font-sans)", overflowY: "auto" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--color-outline)", padding: "16px 32px", display: "flex", alignItems: "center", gap: "16px", maxWidth: "800px", margin: "0 auto" }}>
        <Link
          to="/"
          style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "var(--tracking-data)", textTransform: "uppercase", color: "var(--color-heat-hi)", textDecoration: "none" }}
        >
          ← Back
        </Link>
        <span style={{ color: "var(--color-mute)" }}>|</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "var(--tracking-data)", textTransform: "uppercase", color: "var(--color-dim)" }}>
          {page.title}
        </span>
      </header>

      {/* Content */}
      <main style={{ maxWidth: "800px", margin: "0 auto", padding: "48px 32px 80px" }}>
        <MarkdownRenderer content={page.body} variant="chat" />
      </main>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--color-outline)", padding: "24px 32px", maxWidth: "800px", margin: "0 auto" }}>
        <p style={{ fontSize: 11.5, color: "var(--color-faint)", margin: 0 }}>
          © 2026 Max José de Aragão Neto · DocForge ·{" "}
          <a href="mailto:maxjneto@gmail.com" style={{ color: "var(--color-heat-line)", textDecoration: "none" }}>
            maxjneto@gmail.com
          </a>
        </p>
      </footer>
    </div>
  );
}
