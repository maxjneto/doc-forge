import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { Section, GuidedSectionType as SectionType, AuditFinding } from "@/types";
import { apiFetchAuditFindings, apiDismissAuditFinding, apiExportDocument, type ExportFormat } from "@/utils/api";
import { MarkdownRenderer } from "@/components/shared";

import { Pill } from "@/components/ui";
import { useI18n } from "@/i18n";
const SECTION_ORDER: SectionType[] = [
  "context",
  "proposal",
  "implementation",
  "risks",
];


// ─── Export menu ────────────────────────────────────────────

interface ExportMenuProps {
  documentId: string;
  onClose: () => void;
}

function ExportMenu({ documentId, onClose }: ExportMenuProps) {
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t("g.done.exportFailed"));
    } finally {
      setBusy(null);
    }
  }

  const items = [
    {
      icon: "code",
      label: "Markdown",
      sub: t("g.done.mdFile"),
      onClick: () => handleBackendExport("md"),
      primary: true,
      enabled: true,
    },
    { icon: "picture_as_pdf", label: "PDF",   sub: busy === "pdf"  ? t("g.done.exporting") : t("g.done.pdfFile"),  onClick: () => handleBackendExport("pdf"),  enabled: busy === null, primary: false },
    { icon: "description",    label: "Word",  sub: busy === "docx" ? t("g.done.exporting") : t("g.done.docxFile"), onClick: () => handleBackendExport("docx"), enabled: busy === null, primary: false },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: 42,
        right: 0,
        border: "1px solid var(--color-outline)",
        background: "var(--color-surface)",
        backdropFilter: "blur(8px)",
        borderRadius: "var(--radius-md)",
        padding: 6,
        boxShadow: "var(--shadow-pop)",
        width: 230,
        zIndex: "var(--z-sticky)",
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
            borderRadius: "var(--radius-xs)",
            fontSize: 12.5,
            color: item.primary
              ? "var(--color-heat-soft)"
              : "var(--color-dim)",
            background: item.primary
              ? "var(--color-heat-tint)"
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
                ? "var(--color-heat-hi)"
                : "var(--color-faint)",
            }}
          >
            {item.icon}
          </span>
          <div style={{ flex: 1 }}>
            {item.label}
            <div
              className="df-mono"
              style={{ fontSize: 10, color: "var(--color-faint)" }}
            >
              {item.sub}
            </div>
          </div>
        </button>
      ))}
      {error && (
        <div style={{ padding: "8px 10px", fontSize: 11.5, color: "var(--color-error)", lineHeight: 1.4 }}>
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
  const { t } = useI18n();
  return (
    <nav
      style={{
        padding: "32px 22px",
        borderRight: "1px solid var(--color-outline)",
        overflow: "hidden",
        background: "var(--color-sink)",
        width: 220,
        flexShrink: 0,
      }}
    >
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "var(--tracking-eyebrow)",
          color: "var(--color-faint)",
          marginBottom: 14,
          textTransform: "uppercase",
        }}
      >
        › {t("g.done.sections")}
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
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive
                ? "var(--color-heat-soft)"
                : "var(--color-dim)",
              background: isActive ? "var(--color-heat-tint)" : "transparent",
              border: "none",
              borderLeft: `2px solid ${isActive ? "var(--color-heat)" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                color: "var(--color-faint)",
                marginRight: 8,
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            {t(`section.${type}`)}
          </button>
        );
      })}

      {/* Audit status */}
      <div
        className="df-mono"
        style={{
          fontSize: 10,
          letterSpacing: "var(--tracking-eyebrow)",
          color: "var(--color-faint)",
          marginBottom: 10,
          marginTop: 28,
          textTransform: "uppercase",
        }}
      >
        › {t("g.done.audit")}
      </div>
      <div style={{ padding: "4px 12px" }}>
        {findings.length === 0 ? (
          <Pill tone="steel" compact>
            {t("g.done.allPassed")}
          </Pill>
        ) : (
          <Pill tone="warn" compact>
            {findings.length === 1 ? t("g.au.finding") : t("g.au.findings", { count: findings.length })}
          </Pill>
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
  const { t } = useI18n();
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
          borderBottom: "1px solid var(--color-outline)",
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", margin: 0, color: "var(--color-text)" }}>
          {t(`section.${sectionType}`)}
        </h2>
        {isEditing ? (
          <button
            onClick={() => setIsEditing(false)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11.5, fontWeight: 600,
              color: "var(--color-heat-soft)",
              background: "var(--color-heat-wash)",
              border: "1px solid var(--color-heat-strong)",
              padding: "4px 10px", borderRadius: "var(--radius-xs)", cursor: "pointer",
            }}
          >
            {t("g.done.done")}
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 11.5, fontWeight: 600,
              color: "var(--color-faint)",
              background: "transparent",
              border: "1px solid transparent",
              padding: "4px 10px", borderRadius: "var(--radius-xs)", cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
            {t("g.done.edit")}
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
            background: "var(--color-veil)",
            border: "1px solid var(--color-outline-md)",
            color: "var(--color-text)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            lineHeight: 1.65,
            resize: "vertical",
            borderRadius: "var(--radius-md)",
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
  const { t } = useI18n();
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

  return (
    <div
      style={{
        height: "100%",
        paddingTop: 56,
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
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
              border: "1px solid var(--color-steel-line)",
              background: "linear-gradient(90deg, var(--color-steel-wash), var(--color-heat-tint) 60%, var(--color-steel-wash))",
              borderRadius: "var(--radius-md)",
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
                border: "2px solid var(--color-steel)",
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                position: "relative",
                color: "var(--color-steel-hi)",
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
                  fontSize: 17,
                  letterSpacing: "var(--tracking-eyebrow)",
                  fontWeight: 600,
                  color: "var(--color-steel-hi)",
                }}
              >
                {t("g.done.stamp").toUpperCase()}
              </div>
              <div
                className="df-mono"
                style={{
                  fontSize: 11.5,
                  color: "var(--color-dim)",
                  letterSpacing: "var(--tracking-label)",
                  marginTop: 4,
                }}
              >
                {findings.length === 0 ? t("g.done.passed") : findings.length === 1 ? t("g.done.withFinding") : t("g.done.withFindings", { count: findings.length })}
              </div>
            </div>

            {/* Export button */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowExportMenu((v) => !v)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "6px 14px", borderRadius: "var(--radius-sm)", fontSize: 12.5, fontWeight: 600,
                    border: "1px solid var(--color-heat)",
                    background: "var(--color-heat)",
                    color: "var(--color-on-heat)",
                    cursor: "pointer",
                    boxShadow: "0 0 0 1px var(--color-heat-strong), 0 4px 14px var(--color-heat-strong)",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    file_download
                  </span>
                  {t("g.done.export")}
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    expand_more
                  </span>
                </button>

                {showExportMenu && (
                  <ExportMenu
                    documentId={documentId}
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
                      letterSpacing: "var(--tracking-eyebrow)",
                      textTransform: "uppercase",
                      color: "var(--color-faint)",
                      marginBottom: 10,
                    }}
                  >
                    › {t("g.done.findingsTitle")}
                  </div>
                  {findings.map((finding) => (
                    <div
                      key={finding.id}
                      style={{
                        border: "1px solid var(--color-outline)",
                        borderLeft: `2px solid ${finding.severity === "high" ? "var(--color-error)" : "var(--color-warn)"}`,
                        borderRadius: "var(--radius-md)",
                        padding: "10px 14px",
                        marginBottom: 8,
                        background: "var(--color-veil)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <span
                        className="df-mono"
                        style={{
                          fontSize: 10,
                          letterSpacing: "var(--tracking-eyebrow)",
                          padding: "3px 7px",
                          borderRadius: "var(--radius-xs)",
                          border: `1px solid ${finding.severity === "high" ? "var(--color-error-line)" : "var(--color-warn-line)"}`,
                          color: finding.severity === "high" ? "var(--color-error)" : "var(--color-warn)",
                          background: finding.severity === "high" ? "var(--color-error-wash)" : "var(--color-warn-wash)",
                          flexShrink: 0,
                        }}
                      >
                        {t(finding.severity === "high" ? "g.sev.blocker" : "g.sev.warn").toUpperCase()}
                      </span>
                      <span data-ph-mask style={{ fontSize: 12.5, color: "var(--color-dim)", lineHeight: 1.55, flex: 1 }}>
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
                          fontSize: 11.5, color: "var(--color-faint)",
                          background: "transparent", border: "none", cursor: "pointer", flexShrink: 0,
                        }}
                      >
                        {t("g.done.dismiss")}
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
