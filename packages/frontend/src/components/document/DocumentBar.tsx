import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { IconButton } from "@/components/ui";
import { useI18n } from "@/i18n";

interface DocumentBarProps {
  title: string;
  /** When given, the title is renamable in place. */
  onRenameTitle?: (title: string) => Promise<void>;
  /** The document's state, as pills: draft, in review, published… */
  status?: ReactNode;
  /** Who else is here (a PresenceStack). */
  presence?: ReactNode;
  /** The document's actions; the last one is the view's single primary. */
  actions?: ReactNode;
  error?: string | null;
}

/**
 * The bar every document opens with, whatever its kind: where it is (Documents /
 * title), what state it is in, who is on it, and what can be done with it. The
 * editing tools live below, in the toolbar of each editor.
 */
export function DocumentBar({ title, onRenameTitle, status, presence, actions, error }: DocumentBarProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);

  async function commitRename() {
    setRenaming(false);
    const next = draft.trim();
    if (!next || next === title || !onRenameTitle) return;
    await onRenameTitle(next);
  }

  return (
    <div className="df-doc-bar">
      <nav aria-label={t("doc.breadcrumb")} className="df-doc-bar__crumbs">
        <button type="button" className="df-doc-bar__home" onClick={() => navigate("/home")}>
          {t("editor.documents")}
        </button>
        <span aria-hidden className="df-doc-bar__sep">
          /
        </span>
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void commitRename();
              if (e.key === "Escape") setRenaming(false);
            }}
            maxLength={200}
            aria-label={t("common.rename")}
            className="df-doc-bar__rename"
          />
        ) : (
          <span className={onRenameTitle ? "df-row df-doc-bar__title" : "df-doc-bar__title"}>
            <h1 title={title}>{title}</h1>
            {onRenameTitle && (
              <span className="df-row-actions">
                <IconButton
                  icon="edit"
                  label={t("common.rename")}
                  onClick={() => {
                    setDraft(title);
                    setRenaming(true);
                  }}
                  style={{ width: 24, height: 24 }}
                />
              </span>
            )}
          </span>
        )}
      </nav>

      {status}

      <span style={{ flex: 1 }} />

      {error && <span className="df-doc-bar__error">{error}</span>}
      {presence}
      {actions && <div className="df-doc-bar__actions">{actions}</div>}
    </div>
  );
}
