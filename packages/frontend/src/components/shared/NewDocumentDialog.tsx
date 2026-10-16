import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";

import { apiCreateDocument, apiCreateLayoutDocument, type LayoutTemplateSlug } from "@/utils/api";
import { useI18n } from "@/i18n";
import { Button, Dialog, Input, textStyle } from "@/components/ui";

interface NewDocumentDialogProps {
  onClose: () => void;
  remaining?: number;
  weeklyLimit?: number;
}

type Kind = "editor" | "layout";
type Template = LayoutTemplateSlug | "blank" | "blank-slides";
const TEMPLATES: Template[] = ["relatorio", "proposta", "one-pager", "apresentacao", "blank", "blank-slides"];

/** A sketch of each template's composition, drawn with blocks (no screenshots to keep in sync). */
const SKETCH: Record<Template, ReactNode> = {
  relatorio: (
    <>
      <i style={{ height: 7, width: "60%" }} />
      <span className="df-tpl__row">
        <i />
        <i />
        <i />
      </span>
      <span className="df-tpl__row" style={{ flex: 1 }}>
        <i style={{ flex: 1.4 }} />
        <i className="df-tpl__accent" />
      </span>
    </>
  ),
  proposta: (
    <>
      <i style={{ height: 9, width: "70%" }} />
      <i style={{ height: 4, width: "45%" }} />
      <span className="df-tpl__row" style={{ flex: 1 }}>
        <i />
        <i />
      </span>
      <i className="df-tpl__accent" style={{ height: 12 }} />
    </>
  ),
  "one-pager": (
    <>
      <i className="df-tpl__dark" style={{ height: 20 }} />
      <span className="df-tpl__row" style={{ flex: 1 }}>
        <i />
        <i />
      </span>
      <i style={{ height: 6, width: "80%" }} />
    </>
  ),
  apresentacao: (
    <span className="df-tpl__slides">
      <span className="df-tpl__slide">
        <i className="df-tpl__accent" style={{ height: 6, width: "70%" }} />
        <i style={{ height: 3, width: "45%" }} />
      </span>
      <span className="df-tpl__slide">
        <i style={{ height: 4, width: "50%" }} />
        <span className="df-tpl__row" style={{ flex: 1 }}>
          <i />
          <i />
          <i />
        </span>
      </span>
    </span>
  ),
  blank: null,
  "blank-slides": null,
};

/**
 * New document: Markdown in the editor, or a page document (components on a grid)
 * from a curated template. Agents create both through MCP as well.
 */
export function NewDocumentDialog({ onClose, remaining, weeklyLimit }: NewDocumentDialogProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("editor");
  const [template, setTemplate] = useState<Template>("relatorio");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = remaining !== undefined && remaining <= 0;

  async function create() {
    if (creating || blocked) return;
    setCreating(true);
    setError(null);
    try {
      if (kind === "layout") {
        const blank = template === "blank" || template === "blank-slides";
        const id = await apiCreateLayoutDocument(title.trim(), blank ? null : template, getToken, template === "blank-slides" ? "slide" : null);
        posthog.capture("document_created", { mode: "layout", template });
        onClose();
        navigate(`/document/${id}`);
        return;
      }
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
    <Dialog onClose={onClose} title={t("newDocument.title")} subtitle={kind === "layout" ? t("newDocument.layoutSubtitle") : t("newDocument.editorSubtitle")} width={kind === "layout" ? 600 : 480} closable>
      {remaining !== undefined && (
        <p className="df-mono" style={{ margin: "0 0 14px", fontSize: 11.5, color: blocked ? "var(--color-error)" : "var(--color-heat-hi)" }}>
          {remaining} of {weeklyLimit ?? 0} document creations remaining this week
        </p>
      )}
      <div role="radiogroup" aria-label={t("newDocument.kind")} className="df-seg" style={{ marginBottom: 16 }}>
        {(["editor", "layout"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {t(`newDocument.kind.${k}`)}
          </button>
        ))}
      </div>
      <label htmlFor="new-document-title" style={{ ...textStyle.fieldLabel, display: "block", color: "var(--color-dim)", marginBottom: 8 }}>
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
      {kind === "layout" && (
        <>
          <span style={{ ...textStyle.fieldLabel, display: "block", color: "var(--color-dim)", margin: "16px 0 8px" }}>{t("newDocument.template")}</span>
          <div role="radiogroup" aria-label={t("newDocument.template")} style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {TEMPLATES.map((slug) => (
              <button key={slug} type="button" role="radio" aria-checked={template === slug} className="df-tpl" onClick={() => setTemplate(slug)}>
                <span className="df-tpl__sketch" aria-hidden>
                  {SKETCH[slug] ?? (
                    <span className="material-symbols-outlined" style={{ margin: "auto", fontSize: 22 }}>
                      {slug === "blank-slides" ? "slideshow" : "add"}
                    </span>
                  )}
                </span>
                <span className="df-tpl__name">{t(`newDocument.templates.${slug}`)}</span>
                <span className="df-tpl__hint">{t(`newDocument.templates.${slug}.hint`)}</span>
              </button>
            ))}
          </div>
          <p style={{ ...textStyle.caption, color: "var(--color-faint)", margin: "12px 0 0" }}>{t("newDocument.layoutAgentHint")}</p>
        </>
      )}
      {error && <p style={{ color: "var(--color-error)", fontSize: 12.5, margin: "14px 0 0" }}>{error}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22 }}>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={create} disabled={creating || blocked}>
          {creating ? t("common.creating") : kind === "layout" ? t("newDocument.createLayout") : t("newDocument.createEditor")}
        </Button>
      </div>
    </Dialog>
  );
}
