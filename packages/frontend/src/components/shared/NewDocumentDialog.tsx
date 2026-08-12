import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import { apiListDocumentTypes, apiCreateDocument } from "@/utils/api";
import type { DocumentType } from "@/types";
import { useI18n } from "@/i18n";

const ICON_MAP: Record<string, string> = {
  rfc: "rate_review",
  prd: "list_alt",
  "tech-spec": "schema",
  adr: "account_tree",
  postmortem: "monitor_heart",
  runbook: "menu_book",
};

type DialogTab = "guided" | "editor";

interface NewDocumentDialogProps {
  onClose: () => void;
  credits?: number;
  guidedCost?: number;
}

export function NewDocumentDialog({ onClose, credits, guidedCost = 3 }: NewDocumentDialogProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<DialogTab>("guided");
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const canAffordGuided = credits === undefined || credits >= guidedCost;

  useEffect(() => {
    apiListDocumentTypes(getToken)
      .then((types) => {
        setDocTypes(types);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [getToken]);

  function handleSelectGuided(doc: DocumentType) {
    if (!canAffordGuided) return;
    posthog.capture("document_created", { mode: "guided", document_type_slug: doc.slug });
    onClose();
    navigate("/document/new", { state: { documentTypeSlug: doc.slug, documentTitle: documentTitle.trim() || null } });
  }

  async function handleCreateEditor() {
    if (creating) return;
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
      posthog.capture("document_created", { mode: "editor" });
      onClose();
      navigate(`/document/${doc.id}`);
    } catch (err) {
      setCreating(false);
      if (err instanceof Error && err.message === "INSUFFICIENT_CREDITS") {
        setCreateError(t("newDocument.notEnoughCredits"));
      } else {
        setCreateError(t("newDocument.genericError"));
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
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--df-on-surface)" }}>
              {t("newDocument.title")}
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
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px", background: "var(--color-white-03)", borderRadius: "8px", padding: "4px", width: "fit-content" }}>
          {(["guided", "editor"] as DialogTab[]).map((tabId) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                background: tab === tabId ? "rgba(255,77,0,0.12)" : "transparent",
                color: tab === tabId ? "var(--df-amber-500)" : "rgba(200,198,197,0.45)",
                transition: "all 0.15s",
              }}
            >
              {t(tabId === "guided" ? "newDocument.guided" : "newDocument.editor")}
            </button>
          ))}
        </div>

        {/* Title input */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{ display: "block", fontSize: "11px", fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(200,198,197,0.45)", marginBottom: "8px" }}
          >
            {t("newDocument.documentTitle")}
          </label>
          <input
            type="text"
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && tab === "editor") handleCreateEditor(); }}
            placeholder={t(tab === "guided" ? "newDocument.autoTitle" : "newDocument.untitled")}
            maxLength={200}
            style={{
              width: "100%",
              background: "var(--color-white-03)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "6px",
              padding: "10px 14px",
              fontSize: "13px",
              color: "var(--df-on-surface)",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--color-heat-border)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "var(--color-white-08)"; }}
          />
        </div>

        {/* Body — guided */}
        {tab === "guided" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "rgba(200,198,197,0.5)" }}>
                {t("newDocument.guidedDescription")}
              </p>
              {!canAffordGuided && credits !== undefined && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#e86464", background: "rgba(232,100,100,0.08)", border: "1px solid rgba(232,100,100,0.2)", borderRadius: "6px", padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0, marginLeft: "16px" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "13px" }}>warning</span>
                  {t("newDocument.needsCredits", { cost: guidedCost, credits })}
                </span>
              )}
            </div>
            {loading && (
              <div style={{ color: "rgba(200,198,197,0.4)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
                {t("newDocument.loadingTypes")}
              </div>
            )}
            {error && (
              <div style={{ color: "rgba(200,198,197,0.4)", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>
                {t("newDocument.typesError")}
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
              {t("newDocument.editorDescription")}
            </p>
            <span className="df-pill df-pill-steel" style={{ marginBottom: 18 }}>
              {t("newDocument.noCredits")}
            </span>
            {createError && (
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#e86464", display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>error</span>
                {createError}
              </p>
            )}
            <button
              onClick={handleCreateEditor}
              disabled={creating}
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "10px 24px", borderRadius: "6px", fontSize: "13px", fontWeight: 600,
                border: "1px solid rgba(255,77,0,0.5)",
                background: creating ? "var(--color-heat-bg-soft)" : "var(--color-heat-bg)",
                color: creating ? "rgba(255,77,0,0.5)" : "var(--df-amber-500)",
                cursor: creating ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                {creating ? "hourglass_empty" : "edit_note"}
              </span>
              {creating ? t("common.creating") : t("newDocument.createEditor")}
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
        (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-heat-25)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
      }}
    >
      {/* Icon + label */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "22px", color: "var(--df-amber-500)" }}
        >
          {icon}
        </span>
        <span style={{
          fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em",
          textTransform: "uppercase", color: "var(--df-on-surface)",
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
              background: "var(--color-white-03)",
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
