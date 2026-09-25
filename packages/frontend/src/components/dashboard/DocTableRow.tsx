import { useRef, useState } from "react";
import type { Document, Phase } from "@/types";
import { formatDateTime, timeAgo } from "@/utils/format";

const PHASE_ORDER: Phase[] = ["discovery", "alignment", "generation", "refinement", "audit", "completed"];

const PHASE_LABEL: Record<Phase, string> = {
  discovery: "Discovery",
  alignment: "Alignment",
  generation: "Generation",
  refinement: "Refinement",
  audit: "Audit",
  completed: "Forged",
  editing: "Editing",
};

export const DOC_ROW_COLUMNS = "22px minmax(0,1fr) 230px 96px 20px";

const MODE_LABEL: Record<Document["documentMode"], string> = {
  guided: "Guided",
  pipeline: "Agent pipeline",
  editor: "Editor",
};

export type DocGroup = "attention" | "active" | "done";

/** Phases where the workflow is parked until the user acts. */
const WAITING_ON_USER: Phase[] = ["discovery", "alignment", "audit"];

export function docGroup(doc: Document): DocGroup {
  if (doc.currentPhase === "completed") return "done";
  if (doc.errorMessage) return "attention";
  if (doc.documentMode !== "editor" && WAITING_ON_USER.includes(doc.currentPhase)) return "attention";
  return "active";
}

function PhaseTrail({ currentPhase, failed }: { currentPhase: Phase; failed: boolean }) {
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
        } else if (isNow && failed) {
          bg = "var(--df-error)";
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

function Stage({ doc }: { doc: Document }) {
  const phase = doc.currentPhase;
  const failed = Boolean(doc.errorMessage);

  if (doc.documentMode === "editor") {
    return (
      <span className="df-mono" style={{ fontSize: 10.5, letterSpacing: "0.08em", color: "var(--df-dim)" }}>
        Editing
      </span>
    );
  }

  const color = failed
    ? "var(--df-error)"
    : phase === "completed"
    ? "var(--df-steel-100)"
    : "var(--df-amber-300)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }} title={doc.errorMessage ?? undefined}>
      <PhaseTrail currentPhase={phase} failed={failed} />
      <span className="df-mono" style={{ fontSize: 10.5, letterSpacing: "0.08em", color, whiteSpace: "nowrap" }}>
        {failed ? `Failed · ${PHASE_LABEL[phase]}` : PHASE_LABEL[phase]}
      </span>
    </div>
  );
}

export function DocTableRow({
  doc,
  onClick,
  onRename,
}: {
  doc: Document;
  onClick: () => void;
  onRename: (docId: string, title: string) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [hover, setHover] = useState(false);
  const [titleDraft, setTitleDraft] = useState(doc.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCompleted = doc.currentPhase === "completed";
  const agent = doc.lastApiKeyName;

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

  const iconName = isCompleted
    ? "verified"
    : doc.documentMode === "pipeline"
    ? "terminal"
    : doc.documentMode === "editor"
    ? "edit_note"
    : "description";
  const iconColor = isCompleted || doc.documentMode !== "guided" ? "var(--df-steel-200)" : "var(--df-amber-300)";

  const meta = [doc.documentTypeName, MODE_LABEL[doc.documentMode]].filter(Boolean).join(" · ");

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={renaming ? undefined : onClick}
      onKeyDown={(e) => { if (!renaming && e.key === "Enter") onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: DOC_ROW_COLUMNS,
        alignItems: "center",
        gap: 16,
        padding: "12px 22px",
        borderTop: "1px solid var(--df-outline)",
        fontSize: 13.5,
        background: hover && !renaming ? "rgba(255,77,0,0.025)" : "transparent",
        cursor: renaming ? "default" : "pointer",
        transition: "background 0.12s",
        outline: "none",
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: iconColor }}>
        {iconName}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          {renaming ? (
            <input
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
                color: "var(--df-text)",
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
            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {doc.title}
            </span>
          )}
          {!renaming && (
            <button
              onClick={startRename}
              title="Rename"
              aria-label="Rename document"
              style={{
                display: "flex",
                alignItems: "center",
                padding: "2px 4px",
                flexShrink: 0,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--df-faint)",
                borderRadius: 3,
                opacity: hover ? 1 : 0,
                transition: "opacity 0.12s",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
            </button>
          )}
        </div>
        <div
          className="df-mono"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            color: "var(--df-faint)",
            letterSpacing: "0.06em",
            marginTop: 3,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <span>{meta}</span>
          {agent && (
            <span
              style={{ color: "var(--df-steel-100)", overflow: "hidden", textOverflow: "ellipsis" }}
              title={`Last touched by agent ${agent}`}
            >
              · via {agent}
            </span>
          )}
        </div>
      </div>

      <Stage doc={doc} />

      <span
        className="df-mono"
        style={{ fontSize: 10.5, color: "var(--df-faint)", letterSpacing: "0.04em" }}
        title={formatDateTime(doc.updatedAt)}
      >
        {timeAgo(doc.updatedAt)}
      </span>

      <span
        className="material-symbols-outlined"
        style={{
          fontSize: 16,
          color: hover ? "var(--df-amber-300)" : "var(--df-mute)",
          transition: "color 0.12s, transform 0.12s",
          transform: hover ? "translateX(2px)" : "none",
        }}
      >
        chevron_right
      </span>
    </div>
  );
}
