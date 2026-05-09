import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Section, SectionType, AuditFinding } from "@/types";
import { apiFetchAuditFindings, apiDismissAuditFinding, apiUpdateCompletedDocument } from "@/utils/api";
import { MarkdownRenderer } from "@/components/shared";
import { AuditWarningCard } from "./AuditWarningCard";

const SECTION_ORDER: SectionType[] = [
  "context",
  "proposal",
  "implementation",
  "risks",
];

const SECTION_HEADINGS: Record<SectionType, string> = {
  context: "Context",
  proposal: "Proposal",
  implementation: "Implementation",
  risks: "Risks & Alternatives",
};

// ─── Section Nav Sidebar ─────────────────────────────────────

interface SectionNavProps {
  activeAnchor: SectionType | null;
  onNavigate: (sectionType: SectionType) => void;
}

function SectionNav({ activeAnchor, onNavigate }: SectionNavProps) {
  return (
    <nav className="w-44 shrink-0 sticky top-0 self-start pt-2">
      <p className="text-[10px] font-semibold text-on-surface-variant/40 uppercase tracking-widest mb-4 px-1">
        Sections
      </p>
      <ul className="flex flex-col gap-1">
        {SECTION_ORDER.map((type) => {
          const isActive = activeAnchor === type;
          return (
            <li key={type}>
              <button
                onClick={() => onNavigate(type)}
                className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                  isActive
                    ? "text-primary bg-primary/10 font-medium"
                    : "text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high/40"
                }`}
              >
                {SECTION_HEADINGS[type]}
              </button>
            </li>
          );
        })}
      </ul>
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
    <div id={`section-${sectionType}`} className="scroll-mt-8 mb-12 group/section">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/15">
        <h2 className="text-base font-semibold text-on-surface">
          {SECTION_HEADINGS[sectionType]}
        </h2>
        {isEditing ? (
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded transition-all hover:bg-primary/15"
          >
            Done
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-[11px] font-medium text-on-surface-variant/50 hover:text-on-surface bg-transparent hover:bg-surface-container-high/40 border border-transparent hover:border-outline-variant/20 px-2 py-1 rounded transition-all opacity-0 group-hover/section:opacity-100"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 13 }}>edit</span>
            Edit
          </button>
        )}
      </div>
      {isEditing ? (
        <textarea
          value={content}
          onChange={(e) => onEdit(e.target.value)}
          className="w-full min-h-[320px] bg-surface-container-high/30 border border-outline-variant/20 text-on-surface-variant/90 font-mono text-sm leading-relaxed resize-y rounded-lg p-4 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/40 transition-all"
        />
      ) : (
        <MarkdownRenderer content={content} variant="editor" />
      )}
    </div>
  );
}

// ─── Completed Layout ────────────────────────────────────────

interface CompletedLayoutProps {
  documentId: string;
  sections: Section[];
  onSaved?: () => void;
}

export function CompletedLayout({ documentId, sections, onSaved }: CompletedLayoutProps) {
  const { getToken } = useAuth();

  // ── Audit findings ──────────────────────────────────────
  const [findings, setFindings] = useState<AuditFinding[]>([]);

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

  const handleDismiss = async (findingId: string) => {
    setFindings((prev) => prev.filter((f) => f.id !== findingId));
    try {
      await apiDismissAuditFinding(documentId, findingId, getToken);
    } catch {
      // finding already dismissed or network error — optimistic removal is fine
    }
  };

  const handleCardClick = (sectionType: SectionType) => {
    const el = document.getElementById(`section-${sectionType}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── Section nav active tracking ─────────────────────────
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
      { root: contentRef.current, rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );

    SECTION_ORDER.forEach((type) => {
      const el = document.getElementById(`section-${type}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleNavigate = (sectionType: SectionType) => {
    const el = document.getElementById(`section-${sectionType}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveAnchor(sectionType);
  };

  // ── Completed-phase editor (save back to sections) ──────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Build editable content map from sections
  const initialContent = Object.fromEntries(
    SECTION_ORDER.map((type) => {
      const section = sections.find((s) => s.sectionType === type);
      return [type, (section?.activeVersionContent ?? "").trim()];
    })
  ) as Record<SectionType, string>;

  const [editedContent, setEditedContent] = useState<Record<SectionType, string>>(initialContent);
  const [dirty, setDirty] = useState(false);

  // Keep editedContent in sync with polling unless user has made local edits
  useEffect(() => {
    if (!dirty) {
      setEditedContent(
        Object.fromEntries(
          SECTION_ORDER.map((type) => {
            const section = sections.find((s) => s.sectionType === type);
            return [type, (section?.activeVersionContent ?? "").trim()];
          })
        ) as Record<SectionType, string>
      );
    }
  }, [sections, dirty]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await apiUpdateCompletedDocument(
        documentId,
        SECTION_ORDER.map((type) => ({ section_type: type, content: editedContent[type] })),
        getToken,
      );
      setDirty(false);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = (type: SectionType, content: string) => {
    setEditedContent((prev) => ({ ...prev, [type]: content }));
    setDirty(true);
  };

  const handleExport = () => {
    const markdown = SECTION_ORDER
      .map((type) => `## ${SECTION_HEADINGS[type]}\n\n${editedContent[type]}`)
      .join("\n\n");
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfc-${documentId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full pt-[64px] flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 px-6 py-3 border-b border-outline-variant/15 bg-surface/40 backdrop-blur-md flex items-center justify-between gap-4">
        <p className="text-xs text-on-surface-variant/60">
          Document completed — view your RFC below.
        </p>
        <div className="flex items-center gap-3">
          <div className="text-xs text-on-surface-variant/60 min-h-[1rem]">
            {saveError ? <span className="text-error">{saveError}</span> : null}
            {!saveError && saved ? <span className="text-green-400">Saved.</span> : null}
            {!saveError && !saved && dirty ? <span>Unsaved changes.</span> : null}
          </div>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-surface-container-high text-on-surface rounded-lg text-xs hover:brightness-110 transition-all border border-outline-variant/20"
          >
            Export Markdown
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-3 py-1.5 bg-primary-container text-on-primary-container rounded-lg text-xs hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 shrink-0 border-r border-outline-variant/15 bg-surface/20 overflow-y-auto hide-scrollbar px-4 py-6">
          <SectionNav activeAnchor={activeAnchor} onNavigate={handleNavigate} />
        </aside>

        {/* Main content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="max-w-[800px] mx-auto px-8 py-8">
            {/* Audit warning cards */}
            {findings.length > 0 && (
              <div className="mb-8 flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-on-surface-variant/50 uppercase tracking-widest mb-1">
                  Audit Findings
                </p>
                {findings.map((finding) => (
                  <AuditWarningCard
                    key={finding.id}
                    finding={finding}
                    onDismiss={handleDismiss}
                    onClick={handleCardClick}
                  />
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
  );
}
