import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { Section, GuidedSectionType as SectionType, AuditFinding } from "@/types";
import { apiFetchAuditFindings, apiDismissAuditFinding, apiExportDocument, type ExportFormat } from "@/utils/api";
import { MarkdownRenderer } from "@/components/shared";

const SECTION_ORDER: SectionType[] = [
  "context",
  "proposal",
  "implementation",
  "risks",
];

const SECTION_HEADINGS: Record<SectionType, string> = {
  context:        "Context",
  proposal:       "Proposal",
  implementation: "Implementation",
  risks:          "Risks & Alternatives",
};

// ─── Export menu ────────────────────────────────────────────

interface ExportMenuProps {
  documentId: string;
  onExportMarkdown: () => void;
  onClose: () => void;
}

function ExportMenu({ documentId, onExportMarkdown, onClose }: ExportMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { getToken } = useAuth();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function handleBackendExport(format: ExportFormat) {
    setBusy(format);
    setError(null);
    try {
      await apiExportDocument(documentId, format, getToken);
      posthog.capture("document_exported", { document_id: documentId, export_format: format });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const items = [
    {
      icon: "code",
      label: "Markdown",
      sub: ".MD FILE",
      onClick: () => { onExportMarkdown(); onClose(); },
      primary: true,
      enabled: true,
    },
    { icon: "picture_as_pdf", label: "PDF",   sub: busy === "pdf"  ? "EXPORTING…" : ".PDF FILE · PRO",  onClick: () => handleBackendExport("pdf"),  enabled: busy === null, primary: false },
    { icon: "description",    label: "Word",  sub: busy === "docx" ? "EXPORTING…" : ".DOCX FILE · PRO", onClick: () => handleBackendExport("docx"), enabled: busy === null, primary: false },
    { icon: "forum",          label: "Copy as Linear comment",  sub: "NOT AVAILABLE",  onClick: () => {}, enabled: false, primary: false },
    { icon: "description",    label: "Confluence wiki",         sub: "NOT AVAILABLE",  onClick: () => {}, enabled: false, primary: false },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 42,
        right: 0,
        border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        background: "rgba(18,20,20,0.98)",
        backdropFilter: "blur(8px)",
        borderRadius: 8,
        padding: 6,
        boxShadow: "0 12px 28px rgba(0,0,0,0.4)",
        width: 230,
        zIndex: 20,
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => { if (item.enabled) item.onClick(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 4,
            fontSize: 12.5,
            color: item.primary
              ? "var(--df-amber-200, #ffb59e)"
              : "var(--df-on-surface-soft, #c6c5c4)",
            background: item.primary
              ? "rgba(255,77,0,0.04)"
              : "transparent",
            border: "none",
            cursor: item.enabled ? "pointer" : "not-allowed",
            width: "100%",
            textAlign: "left",
            opacity: item.enabled ? 1 : 0.45,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              color: item.primary
                ? "var(--df-amber-300, #ff8d4a)"
                : "var(--df-faint, rgba(227,226,226,0.38))",
            }}
          >
            {item.icon}
          </span>
          <div style={{ flex: 1 }}>
            {item.label}
            <div
              className="df-mono"
              style={{ fontSize: 10, color: "var(--df-faint, rgba(227,226,226,0.38))" }}
            >
              {item.sub}
            </div>
          </div>
        </button>
      ))}
      {error && (
        <div style={{ padding: "8px 10px", fontSize: 11, color: "#ff8a8a", lineHeight: 1.4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Section Nav ─────────────────────────────────────────────

interface SectionNavProps {
  activeAnchor: SectionType | null;
  onNavigate: (type: SectionType) => void;
  findings: AuditFinding[];
}

function SectionNav({ activeAnchor, onNavigate, findings }: SectionNavProps) {
  return (
    <nav
      style={{
        padding: "32px 22px",
        borderRight: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        overflow: "hidden",
        background: "rgba(0,0,0,0.20)",
        width: 220,
        flexShrink: 0,
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "var(--df-faint, rgba(227,226,226,0.38))",
          marginBottom: 14,
          textTransform: "uppercase",
        }}
      >
        › Sections
      </div>

      {SECTION_ORDER.map((type, i) => {
        const isActive = activeAnchor === type;
        return (
          <button
            key={type}
            onClick={() => onNavigate(type)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "8px 12px",
              margin: "2px 0",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive
                ? "var(--df-amber-200, #ffb59e)"
                : "var(--df-dim, rgba(227,226,226,0.62))",
              background: isActive ? "rgba(255,77,0,0.05)" : "transparent",
              border: "none",
              borderLeft: `2px solid ${isActive ? "var(--df-amber-500, #ff4d00)" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                color: "var(--df-faint, rgba(227,226,226,0.38))",
                marginRight: 8,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {SECTION_HEADINGS[type]}
          </button>
        );
      })}

      {/* Audit status */}
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.16em",
          color: "var(--df-faint, rgba(227,226,226,0.38))",
          marginBottom: 10,
          marginTop: 28,
          textTransform: "uppercase",
        }}
      >
        › Audit
      </div>
      <div style={{ padding: "4px 12px" }}>
        {findings.length === 0 ? (
          <span className="df-pill df-pill-steel" style={{ fontSize: 10, padding: "2px 7px" }}>
            All passed
          </span>
        ) : (
          <span className="df-pill df-pill-warn" style={{ fontSize: 10, padding: "2px 7px" }}>
            {findings.length} finding{findings.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </nav>
  );
}

// ─── Section Block ───────────────────────────────────────────

interface SectionBlockProps {
  sectionType: SectionType;
  content: string;
  onEdit: (content: string) => void;
}

function SectionBlock({ sectionType, content, onEdit }: SectionBlockProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div id={`section-${sectionType}`} style={{ marginBottom: 48, scrollMarginTop: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          paddingBottom: 8,
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", margin: 0, color: "#e3e2e2" }}>
          {SECTION_HEADINGS[sectionType]}
        </h2>
        {isEditing ? (
          <button
            onClick={() => setIsEditing(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600,
              color: "var(--df-amber-200, #ffb59e)",
              background: "rgba(255,77,0,0.10)",
              border: "1px solid rgba(255,77,0,0.20)",
              padding: "4px 10px", borderRadius: 4, cursor: "pointer",
            }}
          >
            Done
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11, fontWeight: 600,
              color: "var(--df-faint, rgba(227,226,226,0.38))",
              background: "transparent",
              border: "1px solid transparent",
              padding: "4px 10px", borderRadius: 4, cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <textarea
          data-ph-mask
          value={content}
          onChange={(e) => onEdit(e.target.value)}
          style={{
            width: "100%",
            minHeight: 320,
            background: "rgba(18,20,20,0.5)",
            border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
            color: "#e3e2e2",
            fontFamily: "var(--df-font-mono, 'JetBrains Mono', monospace)",
            fontSize: 13,
            lineHeight: 1.65,
            resize: "vertical",
            borderRadius: 8,
            padding: 16,
            outline: "none",
          }}
        />
      ) : (
        <MarkdownRenderer content={content} variant="editor" />
      )}
    </div>
  );
}

// ─── Completed Layout ─────────────────────────────────────────

interface CompletedLayoutProps {
  documentId: string;
  sections: Section[];
  onSaved?: () => void;
}

export function CompletedLayout({ documentId, sections }: CompletedLayoutProps) {
  const { getToken } = useAuth();
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      apiFetchAuditFindings(documentId, () => Promise.resolve(token))
        .then((data) => { if (!cancelled) setFindings(data); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [documentId, getToken]);

  // ── Active anchor tracking ──
  const [activeAnchor, setActiveAnchor] = useState<SectionType | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("section-", "") as SectionType;
            setActiveAnchor(id);
            break;
          }
        }
      },
      { root: contentRef.current, rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );
    SECTION_ORDER.forEach((type) => {
      const el = document.getElementById(`section-${type}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  const handleNavigate = (type: SectionType) => {
    const el = document.getElementById(`section-${type}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveAnchor(type);
  };

  // ── Editable content ──
  const initialContent = Object.fromEntries(
    SECTION_ORDER.map((type) => {
      const section = sections.find((s) => s.sectionType === type);
      return [type, (section?.activeVersionContent ?? "").trim()];
    })
  ) as Record<SectionType, string>;

  const [editedContent, setEditedContent] = useState<Record<SectionType, string>>(initialContent);

  useEffect(() => {
    setEditedContent(
      Object.fromEntries(
        SECTION_ORDER.map((type) => {
          const section = sections.find((s) => s.sectionType === type);
          return [type, (section?.activeVersionContent ?? "").trim()];
        })
      ) as Record<SectionType, string>
    );
  }, [sections]);

  const handleContentChange = (type: SectionType, content: string) => {
    setEditedContent((prev) => ({ ...prev, [type]: content }));
  };

  const handleExportMarkdown = () => {
    const markdown = SECTION_ORDER
      .map((type) => `## ${SECTION_HEADINGS[type]}\n\n${editedContent[type]}`)
      .join("\n\n");
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `document-${documentId}.md`;
    a.click();
    URL.revokeObjectURL(url);
    posthog.capture("document_exported", { document_id: documentId, export_format: "markdown" });
  };

  return (
    <div
      style={{
        height: "100%",
        paddingTop: 56,
        display: "flex",
        flexDirection: "column",
        background: "var(--df-bg, #0a0b0c)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar nav */}
        <SectionNav
          activeAnchor={activeAnchor}
          onNavigate={handleNavigate}
          findings={findings}
        />

        {/* Main doc area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Stamp banner */}
          <div
            style={{
              margin: "32px 56px 0",
              border: "1px solid rgba(138,160,184,0.30)",
              background: "linear-gradient(90deg, rgba(138,160,184,0.10), rgba(255,77,0,0.04) 60%, rgba(138,160,184,0.10))",
              borderRadius: 12,
              padding: "22px 28px",
              display: "flex",
              alignItems: "center",
              gap: 20,
              flexShrink: 0,
            }}
          >
            {/* Seal */}
            <div
              style={{
                width: 64,
                height: 64,
                border: "2px solid var(--df-steel-200, #8aa0b8)",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                position: "relative",
                color: "var(--df-steel-100, #b9c6d4)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 4,
                  border: "1px dashed currentColor",
                  borderRadius: "50%",
                  opacity: 0.5,
                }}
              />
              <span
                className="df-mono"
                style={{ fontSize: 13, fontWeight: 700, position: "relative" }}
              >
                DOC
              </span>
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div
                className="df-mono"
                style={{
                  fontSize: 18,
                  letterSpacing: "0.20em",
                  fontWeight: 600,
                  color: "var(--df-steel-100, #b9c6d4)",
                }}
              >
                DOCUMENT FORGED · v1.0
              </div>
              <div
                className="df-mono"
                style={{
                  fontSize: 11,
                  color: "var(--df-dim, rgba(227,226,226,0.62))",
                  letterSpacing: "0.08em",
                  marginTop: 4,
                }}
              >
                Audit passed · document ready
              </div>
            </div>

            {/* Export button */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: "1px solid var(--df-amber-500, #ff4d00)",
                    background: "var(--df-amber-500, #ff4d00)",
                    color: "#fff",
                    cursor: "pointer",
                    boxShadow: "0 0 0 1px rgba(255,77,0,0.20), 0 4px 14px rgba(255,77,0,0.18)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    file_download
                  </span>
                  Export
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    expand_more
                  </span>
                </button>

                {showExportMenu && (
                  <ExportMenu
                    documentId={documentId}
                    onExportMarkdown={handleExportMarkdown}
                    onClose={() => setShowExportMenu(false)}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Document content */}
          <div
            ref={contentRef}
            style={{ flex: 1, overflowY: "auto" }}
            className="hide-scrollbar"
          >
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 56px 64px" }}>
              {/* Audit findings */}
              {findings.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <div
                    className="df-mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "var(--df-faint, rgba(227,226,226,0.38))",
                      marginBottom: 10,
                    }}
                  >
                    › Audit findings
                  </div>
                  {findings.map((finding) => (
                    <div
                      key={finding.id}
                      style={{
                        border: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
                        borderLeft: `2px solid ${finding.severity === "high" ? "var(--df-error, #e86464)" : "var(--df-amber-300, #ff8d4a)"}`,
                        borderRadius: 8,
                        padding: "10px 14px",
                        marginBottom: 8,
                        background: "rgba(18,20,20,0.5)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <span
                        className="df-mono"
                        style={{
                          fontSize: 9.5,
                          letterSpacing: "0.14em",
                          padding: "3px 7px",
                          borderRadius: 4,
                          border: `1px solid ${finding.severity === "high" ? "rgba(232,100,100,0.40)" : "rgba(255,77,0,0.30)"}`,
                          color: finding.severity === "high" ? "var(--df-error, #e86464)" : "var(--df-amber-300, #ff8d4a)",
                          background: finding.severity === "high" ? "rgba(232,100,100,0.08)" : "rgba(255,77,0,0.06)",
                          flexShrink: 0,
                        }}
                      >
                        {finding.severity === "high" ? "BLOCKER" : "WARN"}
                      </span>
                      <span data-ph-mask style={{ fontSize: 12.5, color: "var(--df-on-surface-soft, #c6c5c4)", lineHeight: 1.55, flex: 1 }}>
                        {finding.description}
                      </span>
                      <button
                        onClick={async () => {
                          setFindings((prev) => prev.filter((f) => f.id !== finding.id));
                          try {
                            await apiDismissAuditFinding(documentId, finding.id, getToken);
                          } catch {}
                        }}
                        style={{
                          fontSize: 11, color: "var(--df-faint, rgba(227,226,226,0.38))",
                          background: "transparent", border: "none", cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Section blocks */}
              {SECTION_ORDER.map((type) => (
                <SectionBlock
                  key={type}
                  sectionType={type}
                  content={editedContent[type]}
                  onEdit={(content) => handleContentChange(type, content)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
