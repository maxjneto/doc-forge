import { useRef, useState } from "react";
import type { Document, Phase } from "@/types";
import { consumeDocumentDragClick, startDocumentPointerDrag } from "./documentPointerDrag";

const PHASE_ORDER: Phase[] = ["discovery", "alignment", "generation", "refinement", "audit", "completed"];

const PHASE_LABEL: Record<Phase, string> = {
  discovery: "Discovery",
  alignment: "Alignment",
  generation: "Generation",
  refinement: "Refinement",
  audit: "Audit",
  completed: "Forged",
  editing: "Editor",
};

function PhaseTrail({ currentPhase }: { currentPhase: Phase }) {
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      {PHASE_ORDER.map((phase, i) => {
        const isDone = i < currentIdx;
        const isNow = i === currentIdx;
        const isSteel = phase === "completed" && currentPhase === "completed";
        let bg = "transparent";
        let border = "1px solid var(--df-mute)";
        let shadow = "none";
        if (isSteel) {
          bg = "var(--df-steel-200)";
          border = "none";
        } else if (isDone) {
          bg = "var(--df-amber-trail)";
          border = "none";
        } else if (isNow) {
          bg = "var(--df-amber-500)";
          border = "none";
          shadow = "0 0 0 2.5px rgba(255,77,0,0.15), 0 0 8px rgba(255,77,0,0.50)";
        }
        return (
          <span
            key={phase}
            style={{ width: 7, height: 7, borderRadius: 999, background: bg, border, boxShadow: shadow }}
          />
        );
      })}
    </div>
  );
}

export function DocTableRow({
  doc,
  onClick,
  onRename,
  onShare,
  onMoveToFolder,
  onRequestMove,
}: {
  doc: Document;
  onClick: () => void;
  onRename: (docId: string, title: string) => Promise<void>;
  onShare?: () => void;
  /** Called when the row is dropped on a folder in the rail. */
  onMoveToFolder?: (folderId: string | null) => void;
  onRequestMove?: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const phase = doc.currentPhase;
  const isCompleted = phase === "completed";
  const isMcp = doc.documentMode === "editor" && Boolean(doc.hasApiKeyActivity);
  const publicationState = doc.publishedAt
    ? doc.hasUnpublishedChanges
      ? "CHANGES SINCE PUBLISH"
      : "PUBLISHED"
    : "DRAFT";

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTitleDraft(doc.title);
    setRenaming(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commitRename = async () => {
    setRenaming(false);
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === doc.title) return;
    await onRename(doc.id, trimmed);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setRenaming(false);
  };

  const iconName = "draft";
  const iconColor = isCompleted
    ? "var(--df-steel-200)"
    : isMcp
    ? "var(--df-steel-200)"
    : "var(--df-dim)";
  const phaseColor = isCompleted ? "var(--df-steel-100)" : "var(--df-amber-300)";

  const ctaLabel = isCompleted || isMcp ? "Open" : "Resume";
  const ctaIcon = "arrow_forward";
  const ctaStyle: React.CSSProperties = isCompleted
    ? {
        color: "var(--df-steel-100)",
        borderColor: "var(--df-steel-border)",
        background: "var(--df-steel-bg)",
      }
    : {
        color: "var(--df-amber-200)",
        borderColor: "var(--color-heat-30)",
        background: "var(--color-heat-bg-soft)",
      };

  const formattedDate = new Date(doc.updatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      onClick={renaming ? undefined : () => { if (!consumeDocumentDragClick(doc.id)) onClick(); }}
      onPointerDown={(event) => {
        if (!renaming && onMoveToFolder) startDocumentPointerDrag(event, doc, onMoveToFolder);
      }}
      style={{
        display: "grid",
        gridTemplateColumns: "22px minmax(0,1fr) 280px 130px 130px",
        alignItems: "center",
        gap: 16,
        padding: "14px 22px",
        borderTop: "1px solid var(--df-outline)",
        fontSize: 13.5,
        background: "transparent",
        cursor: renaming ? "default" : onMoveToFolder ? "grab" : "pointer",
        touchAction: onMoveToFolder ? "none" : "auto",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => {
        if (!renaming) (e.currentTarget as HTMLElement).style.background = "rgba(255,77,0,0.025)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 21, color: iconColor }}>
        {iconName}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {renaming ? (
            <input
              data-no-document-drag
              ref={inputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={onKey}
              onClick={(e) => e.stopPropagation()}
              maxLength={200}
              style={{
                fontSize: 13.5,
                fontWeight: 500,
                color: "var(--df-on-surface)",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid rgba(255,77,0,0.40)",
                outline: "none",
                fontFamily: "inherit",
                width: "100%",
                padding: "1px 0",
              }}
            />
          ) : (
            <span
              style={{
                fontWeight: 500,
                color: "var(--df-on-surface)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.title}
            </span>
          )}
          {isMcp && doc.lastApiKeyName && (
            <span
              className="df-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                flexShrink: 0,
                fontSize: 10,
                fontWeight: 600,
                padding: "2px 7px",
                borderRadius: 4,
                background: "var(--df-steel-bg)",
                border: "1px solid var(--df-steel-border)",
                color: "var(--df-steel-100)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={`Last edited by ${doc.lastApiKeyName}`}
            >
              {doc.lastApiKeyName}
            </span>
          )}
          {doc.documentMode !== "guided" && (
            <span
              className="df-mono"
              style={{
                flexShrink: 0,
                fontSize: 9,
                letterSpacing: "0.08em",
                color: doc.publishedAt
                  ? doc.hasUnpublishedChanges
                    ? "var(--df-amber-300)"
                    : "var(--df-ok)"
                  : "var(--df-faint)",
              }}
            >
              {publicationState}
            </span>
          )}
          <button
            data-no-document-drag
            onClick={startRename}
            title="Rename"
            style={{
              display: "flex",
              alignItems: "center",
              padding: "2px 4px",
              flexShrink: 0,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--df-mute)",
              borderRadius: 3,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-faint)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--df-mute)"; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
          </button>
        </div>
        <div
          className="df-mono"
          style={{ fontSize: 10, color: "var(--df-faint)", letterSpacing: "0.08em", marginTop: 3 }}
        >
          {doc.documentMode === "editor" ? (isMcp ? "EDITOR · MCP-MANAGED" : "EDITOR · MARKDOWN") : "GUIDED · RFC"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PhaseTrail currentPhase={phase} />
        <span
          className="df-mono"
          style={{ fontSize: 10.5, letterSpacing: "0.08em", color: phaseColor }}
        >
          {PHASE_LABEL[phase]}
        </span>
      </div>

      <span
        className="df-mono"
        style={{ fontSize: 10.5, color: "var(--df-faint)", letterSpacing: "0.04em" }}
      >
        {formattedDate}
      </span>

      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 6 }}>
        {onRequestMove && (
          <button
            data-no-document-drag
            onClick={(e) => {
              e.stopPropagation();
              onRequestMove();
            }}
            title="Mover para outra pasta"
            aria-label="Mover para outra pasta"
            style={{ display: "inline-flex", alignItems: "center", padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--df-outline-md)", background: "transparent", color: "var(--df-faint)", cursor: "pointer" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>drive_file_move</span>
          </button>
        )}
        {onShare && (
          <button
            data-no-document-drag
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            title="Compartilhar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--df-outline-md)",
              background: "transparent",
              color: "var(--df-faint)",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              person_add
            </span>
          </button>
        )}
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            fontWeight: 600,
            padding: "7px 12px",
            borderRadius: 6,
            border: "1px solid",
            cursor: "pointer",
            letterSpacing: "0.02em",
            ...ctaStyle,
          }}
        >
          {ctaLabel}
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{ctaIcon}</span>
        </span>
      </div>
    </div>
  );
}
