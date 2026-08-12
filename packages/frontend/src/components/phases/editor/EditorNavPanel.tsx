import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { apiExportDocument, type ExportFormat } from "@/utils/api";
import type { Heading, SectionCounts } from "@/utils/documentStructure";
import { DocumentOutline } from "@/components/shared";

// ─── Tree structure ───────────────────────────────────────────

// ─── Tree node ────────────────────────────────────────────────

interface HeadingNode {
  heading: Heading;
  children: HeadingNode[];
}

interface TreeNodeProps {
  node: HeadingNode;
  activeSlug: string | null;
  counts: SectionCounts;
  onNavigate: (slug: string) => void;
  isLast: boolean;
}

export function TreeNode({ node, activeSlug, counts, onNavigate, isLast }: TreeNodeProps) {
  const { heading, children } = node;
  const isActive = activeSlug === heading.slug;
  const hasChildren = children.length > 0;
  // Pending items anchored in this section — `heat` when there is something to
  // look at, so the nav doubles as the document's control panel.
  const count = counts[heading.slug] ?? 0;

  const restColor = heading.level === 1 ? "var(--df-dim)" : "var(--df-faint)";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => onNavigate(heading.slug)}
        title={heading.text}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          textAlign: "left",
          padding: "5px 8px",
          margin: "1px 0",
          borderRadius: "var(--radius-sm)",
          fontSize: heading.level === 1 ? 12.5 : 11.5,
          fontWeight: isActive ? 600 : heading.level === 1 ? 500 : 400,
          color: isActive ? "var(--df-amber-200)" : restColor,
          background: isActive ? "var(--color-heat-05)" : "transparent",
          border: "none",
          borderLeft: `2px solid ${isActive ? "var(--df-amber-500)" : "transparent"}`,
          cursor: "pointer",
          transition: "color 0.12s, background 0.12s",
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = "var(--df-dim)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = restColor;
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {heading.text}
        </span>
        {count > 0 && (
          <span
            className="df-mono"
            style={{ fontSize: 9, fontWeight: 500, color: "var(--df-amber-300)", flexShrink: 0 }}
          >
            {count}
          </span>
        )}
      </button>

      {hasChildren && (
        <div style={{ position: "relative", paddingLeft: 16 }}>
          {/* Vertical trunk connecting to children */}
          <div
            style={{
              position: "absolute",
              left: 6,
              top: 0,
              bottom: isLast ? 12 : 0,
              width: 1,
              background: "var(--df-outline)",
            }}
          />
          {children.map((child, i) => (
            <div key={child.heading.slug} style={{ position: "relative" }}>
              {/* L-shaped connector */}
              <div
                style={{
                  position: "absolute",
                  left: -10,
                  top: 12,
                  width: 10,
                  height: 1,
                  background: "var(--df-outline)",
                }}
              />
              <TreeNode
                node={child}
                activeSlug={activeSlug}
                counts={counts}
                onNavigate={onNavigate}
                isLast={i === children.length - 1}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function handleBackendExport(format: ExportFormat) {
    setBusy(format);
    setError(null);
    try {
      // PDF/Word render server-side from the last SAVED version — unlike the
      // Markdown quick-export, they can't reflect unsaved edits in the textarea.
      await apiExportDocument(documentId, format, getToken);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  const items: { key: string; icon: string; label: string; sub: string; onClick: () => void; enabled: boolean }[] = [
    { key: "md", icon: "code", label: "Markdown", sub: ".MD FILE", onClick: () => { onExportMarkdown(); onClose(); }, enabled: true },
    { key: "pdf", icon: "picture_as_pdf", label: "PDF", sub: busy === "pdf" ? "EXPORTING…" : ".PDF FILE · PRO", onClick: () => handleBackendExport("pdf"), enabled: busy === null },
    { key: "docx", icon: "description", label: "Word", sub: busy === "docx" ? "EXPORTING…" : ".DOCX FILE · PRO", onClick: () => handleBackendExport("docx"), enabled: busy === null },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        bottom: "calc(100% + 6px)",
        left: 12,
        right: 12,
        border: "1px solid var(--df-outline)",
        background: "rgba(18,20,20,0.98)",
        backdropFilter: "blur(8px)",
        borderRadius: 8,
        padding: 6,
        boxShadow: "0 -12px 28px rgba(0,0,0,0.4)",
        zIndex: 20,
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => { if (item.enabled) item.onClick(); }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 4,
            fontSize: 12.5,
            color: "var(--df-dim)",
            background: "transparent",
            border: "none",
            cursor: item.enabled ? "pointer" : "not-allowed",
            width: "100%",
            textAlign: "left",
            opacity: item.enabled ? 1 : 0.45,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, color: "var(--df-faint)" }}
          >
            {item.icon}
          </span>
          <div style={{ flex: 1 }}>
            {item.label}
            <div className="df-mono" style={{ fontSize: 9, color: "var(--df-faint)" }}>
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

// ─── Nav Panel ────────────────────────────────────────────────

interface EditorNavPanelProps {
  documentId: string;
  headings: Heading[];
  activeSlug: string | null;
  /** Pending items per section slug — rendered as a heat-coloured tally. */
  counts?: SectionCounts;
  onNavigate: (slug: string) => void;
  onExport: () => void;
  activitySlot?: React.ReactNode;
}

export function EditorNavPanel({
  documentId,
  headings,
  activeSlug,
  counts = {},
  onNavigate,
  onExport,
  activitySlot,
}: EditorNavPanelProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <nav
      style={{
        width: 220,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--df-outline)",
        background: "var(--color-shade-20)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 16px 16px" }} className="hide-scrollbar">
        <div
          className="df-mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            color: "var(--df-faint)",
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          › Structure
        </div>

        <DocumentOutline
          headings={headings}
          activeSlug={activeSlug}
          counts={counts}
          onNavigate={onNavigate}
          emptyText="Start typing ## headings to navigate sections."
        />
      </div>

      {/* Activity */}
      {activitySlot && (
        <div style={{ padding: "14px 16px", borderTop: "1px solid var(--df-outline)", flexShrink: 0 }}>
          {activitySlot}
        </div>
      )}

      {/* Export */}
      <div style={{ position: "relative", padding: "12px 22px 24px", borderTop: "1px solid var(--df-outline)", flexShrink: 0 }}>
        <button
          onClick={() => setShowExportMenu((v) => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontSize: 11, fontWeight: 600,
            color: "var(--df-faint)",
            background: "transparent", border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>file_download</span>
          Export
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>expand_more</span>
        </button>
        {showExportMenu && (
          <ExportMenu
            documentId={documentId}
            onExportMarkdown={onExport}
            onClose={() => setShowExportMenu(false)}
          />
        )}
      </div>
    </nav>
  );
}
