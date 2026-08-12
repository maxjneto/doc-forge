import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";

import { apiCreateDocument } from "@/utils/api";
import { useI18n } from "@/i18n";

interface NewDocumentDialogProps {
  onClose: () => void;
  remaining?: number;
  weeklyLimit?: number;
}

/** The product starts in the editor. Structured BYOA work begins from MCP. */
export function NewDocumentDialog({ onClose, remaining, weeklyLimit }: NewDocumentDialogProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = remaining !== undefined && remaining <= 0;

  async function create() {
    if (creating || blocked) return;
    setCreating(true);
    setError(null);
    try {
      const doc = await apiCreateDocument(title.trim(), "", getToken, undefined, undefined, "editor");
      posthog.capture("document_created", { mode: "editor" });
      onClose();
      navigate(`/document/${doc.id}`);
    } catch (reason) {
      setCreating(false);
      setError(
        reason instanceof Error && reason.message === "WEEKLY_DOCUMENT_LIMIT_REACHED"
          ? "You have used all document creations for this week."
          : t("newDocument.genericError"),
      );
    }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 24 }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(480px, 100%)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: 32, background: "#121414", boxShadow: "0 24px 48px rgba(0,0,0,.6)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--df-on-surface)", fontSize: 18 }}>{t("newDocument.title")}</h2>
            <p style={{ margin: "8px 0 0", color: "var(--df-faint)", fontSize: 13, lineHeight: 1.55 }}>
              Start in Markdown, then invite an agent through MCP whenever you need one.
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: 0, color: "var(--df-faint)", cursor: "pointer" }}><span className="material-symbols-outlined">close</span></button>
        </div>
        {remaining !== undefined && <p className="df-mono" style={{ margin: "24px 0 12px", fontSize: 11, color: blocked ? "#e86464" : "var(--df-amber-300)" }}>
          {remaining} of {weeklyLimit ?? 0} document creations remaining this week
        </p>}
        <label style={{ display: "block", fontSize: 11, color: "var(--df-faint)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>{t("newDocument.documentTitle")}</label>
        <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") create(); }} placeholder={t("newDocument.untitled")} maxLength={200} style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.03)", color: "var(--df-on-surface)", font: "inherit" }} />
        {error && <p style={{ color: "#e86464", fontSize: 12, margin: "14px 0 0" }}>{error}</p>}
        <button onClick={create} disabled={creating || blocked} style={{ marginTop: 24, padding: "10px 16px", border: 0, borderRadius: 6, fontWeight: 600, background: creating || blocked ? "var(--color-heat-bg-soft)" : "var(--df-amber-500)", color: "white", cursor: creating || blocked ? "not-allowed" : "pointer" }}>
          {creating ? t("common.creating") : t("newDocument.createEditor")}
        </button>
      </div>
    </div>
  );
}
