import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";

import { apiCreateDocument } from "@/utils/api";
import { useI18n } from "@/i18n";
import { Button, Dialog, Input, textStyle } from "@/components/ui";

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
    <Dialog
      onClose={onClose}
      title={t("newDocument.title")}
      subtitle="Start in Markdown, then invite an agent through MCP whenever you need one."
      width={480}
      closable
    >
      {remaining !== undefined && (
        <p className="df-mono" style={{ margin: "0 0 14px", fontSize: 11.5, color: blocked ? "var(--color-error)" : "var(--color-heat-hi)" }}>
          {remaining} of {weeklyLimit ?? 0} document creations remaining this week
        </p>
      )}
      <label htmlFor="new-document-title" style={{ ...textStyle.label, display: "block", color: "var(--color-faint)", marginBottom: 8 }}>
        {t("newDocument.documentTitle")}
      </label>
      <Input
        id="new-document-title"
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") create();
        }}
        placeholder={t("newDocument.untitled")}
        maxLength={200}
      />
      {error && <p style={{ color: "var(--color-error)", fontSize: 12.5, margin: "14px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={create} disabled={creating || blocked}>
          {creating ? t("common.creating") : t("newDocument.createEditor")}
        </Button>
      </div>
    </Dialog>
  );
}
