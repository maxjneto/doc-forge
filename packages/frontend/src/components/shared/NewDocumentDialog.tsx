import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { apiListDocumentTypes, apiCreateDocument } from "@/utils/api";
import type { DocumentType } from "@/types";

const ICON_MAP: Record<string, string> = {
  rfc: "rate_review",
  prd: "list_alt",
  "tech-spec": "schema",
  adr: "account_tree",
};

const GUIDED_COST = 3;
const EDITOR_COST = 1;

type DialogTab = "guided" | "editor";

interface NewDocumentDialogProps {
  onClose: () => void;
  credits?: number;
}

export function NewDocumentDialog({ onClose, credits }: NewDocumentDialogProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [tab, setTab] = useState<DialogTab>("guided");
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const canAffordGuided = credits === undefined || credits >= GUIDED_COST;
  const canAffordEditor = credits === undefined || credits >= EDITOR_COST;

  useEffect(() => {
    apiListDocumentTypes()
      .then((types) => {
        setDocTypes(types);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  function handleSelectGuided(doc: DocumentType) {
    if (!canAffordGuided) return;
    onClose();
    navigate("/document/new", { state: { documentTypeSlug: doc.slug, documentTitle: documentTitle.trim() || null } });
  }

  async function handleCreateEditor() {
    if (creating || !canAffordEditor) return;
    setCreating(true);
    setCreateError(null);
    try {
      const doc = await apiCreateDocument(
        documentTitle.trim(),
        "",
        getToken,
        undefined,
        undefined,
        "editor",
      );
      onClose();
      navigate(`/document/${doc.id}`);
    } catch (err) {
      setCreating(false);
      if (err instanceof Error && err.message === "INSUFFICIENT_CREDITS") {
        setCreateError("Not enough credits. Your weekly credits may have been used up.");
      } else {
        setCreateError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#121414",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "0.5rem",
          padding: "32px",
          width: "min(1040px, 100%)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, letterSpacing: "-0.03em", color: "#e3e2e2" }}>
              New Document
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(200,198,197,0.4)", padding: "4px", lineHeight: 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
        </div>

        {/* Tab toggle */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", padding: "4px", width: "fit-content" }}>
          {(["guided", "editor"] as DialogTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: tab === t ? "rgba(255,77,0,0.12)" : "transparent",
                color: tab === t ? "#FF4D00" : "rgba(200,198,197,0.45)",
                transition: "all 0.15s",
              }}
            >
              {t === "guided" ? "AI Guided" : "Editor"}
            </button>
          ))}
        </div>

        {/* Title input */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(200,198,197,0.45)", marginBottom: "8px" }}
          >
            Document title
          </label>
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && tab === "editor") handleCreateEditor(); }}
            placeholder={tab === "guided" ? "Auto-generated from context" : "Untitled Document"}
            maxLength={200}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "6px",
              padding: "10px 14px",
              fontSize: "13px",
              color: "#e3e2e2",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,77,0,0.45)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          />
        </div>

        {/* Body — guided */}
        {tab === "guided" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(200,198,197,0.5)" }}>
                Choose a document type. The AI will guide you through structured discovery and generation.
              </p>
              {!canAffordGuided && credits !== undefined && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#e86464", background: "rgba(232,100,100,0.08)", border: "1px solid rgba(232,100,100,0.2)", borderRadius: "6px", padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "16px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>warning</span>
                  Needs {GUIDED_COST} credits — you have {credits}
                </span>
              )}
            </div>
            {loading && (
              <div style={{ color: "rgba(200,198,197,0.4)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
                Loading document types…
              </div>
            )}
            {error && (
              <div style={{ color: "rgba(200,198,197,0.4)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
                Could not load document types. Please try again.
              </div>
            )}
            {!loading && !error && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {docTypes.map((doc) => (
                  <DocTypeCard key={doc.id} doc={doc} onSelect={handleSelectGuided} disabled={!canAffordGuided} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Body — editor */}
        {tab === "editor" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "16px", paddingBottom: "8px" }}>
            <p style={{ margin: "0 0 28px", fontSize: "13px", color: "rgba(200,198,197,0.5)", lineHeight: 1.6, textAlign: "center", maxWidth: 400 }}>
              Start with a blank canvas. Write freely in Markdown — headings become your document structure.
            </p>
            {!canAffordEditor && credits !== undefined && (
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#e86464", display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>warning</span>
                You need {EDITOR_COST} credit to create an editor document — you have {credits}.
              </p>
            )}
            {createError && (
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#e86464", display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>error</span>
                {createError}
              </p>
            )}
            <button
              onClick={handleCreateEditor}
              disabled={creating || !canAffordEditor}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "10px 24px", borderRadius: "6px", fontSize: "13px", fontWeight: 600,
                border: "1px solid rgba(255,77,0,0.5)",
                background: (creating || !canAffordEditor) ? "rgba(255,77,0,0.06)" : "rgba(255,77,0,0.10)",
                color: (creating || !canAffordEditor) ? "rgba(255,77,0,0.5)" : "#FF4D00",
                cursor: (creating || !canAffordEditor) ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                {creating ? "hourglass_empty" : "edit_note"}
              </span>
              {creating ? "Creating…" : "Create Editor Document"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DocTypeCard({ doc, onSelect, disabled }: { doc: DocumentType; onSelect: (d: DocumentType) => void; disabled?: boolean }) {
  const icon = ICON_MAP[doc.slug] ?? "description";

  return (
    <div
      onClick={() => !disabled && onSelect(doc)}
      style={{
        position: "relative",
        background: "linear-gradient(to bottom, #1a1b1b, #111212)",
        border: "1px solid rgba(255,77,0,0.25)",
        borderRadius: "0.375rem",
        padding: "20px",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "border-color 0.2s, box-shadow 0.2s, opacity 0.2s",
        opacity: disabled ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,77,0,0.6)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 16px rgba(255,77,0,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,77,0,0.25)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "22px", color: "#FF4D00" }}
        >
          {icon}
        </span>
        <span style={{
          fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase", color: "#e3e2e2",
        }}>
          {doc.name}
        </span>
      </div>

      {/* Description */}
      <p style={{ margin: 0, fontSize: "12px", lineHeight: 1.5, color: "rgba(200,198,197,0.5)" }}>
        {doc.description}
      </p>

      {/* Section pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "auto" }}>
        {doc.sections.map((s) => (
          <span
            key={s.id}
            style={{
              fontSize: "10px", fontWeight: 500, letterSpacing: "0.01em",
              color: "rgba(200,198,197,0.38)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "3px", padding: "2px 6px",
            }}
          >
            {s.displayName}
          </span>
        ))}
      </div>
    </div>
  );
}
