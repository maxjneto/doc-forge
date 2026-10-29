import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { DocumentMember, MemberRole } from "@/types";
import {
  apiFetchMembers,
  apiGetPublicLink,
  apiSetPublicLink,
  apiShareDocument,
  apiUnshareDocument,
} from "@/utils/api";
import { Button, Dialog, Input, Pill } from "@/components/ui";
import { useI18n } from "@/i18n";

const ROLE_LABEL_KEY: Record<MemberRole, string> = {
  viewer: "share.viewer",
  commenter: "share.commenter",
  editor: "share.editor",
};

const ROLE_HINT_KEY: Record<MemberRole, string> = {
  viewer: "share.viewerDescription",
  commenter: "share.commenterDescription",
  editor: "share.editorDescription",
};

interface ShareDialogProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  publishedAt?: string | null;
  /** A page document: its public link comes from "Publish" in the editor, not from here. */
  layout?: boolean;
}

/**
 * Invite someone to a document.
 *
 * Worth knowing while reading this: an invitee has no agent session of their
 * own. Their comments land as feedback the *owner's* agent picks up later —
 * which is why the reasoning panel matters so much for them, since they never
 * watched the agent work.
 */
export function ShareDialog({ documentId, documentTitle, onClose, publishedAt = null, layout = false }: ShareDialogProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [members, setMembers] = useState<DocumentMember[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("commenter");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl = publicToken ? `${window.location.origin}/public/${publicToken}` : null;

  async function togglePublic() {
    try {
      const r = await apiSetPublicLink(documentId, !publicToken, getToken);
      setPublicToken(r.token);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("share.updateLinkError"));
    }
  }

  const refetch = useCallback(() => {
    apiFetchMembers(documentId, getToken)
      .then((r) => setMembers(r.members))
      .catch(() => {});
  }, [documentId, getToken]);

  useEffect(() => refetch(), [refetch]);

  useEffect(() => {
    apiGetPublicLink(documentId, getToken)
      .then((r) => setPublicToken(r.token))
      .catch(() => {});
  }, [documentId, getToken]);

  async function invite() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiShareDocument(documentId, email.trim(), role, getToken);
      setEmail("");
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("share.inviteError"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(memberId: string) {
    await apiUnshareDocument(documentId, memberId, getToken);
    refetch();
  }

  return (
    <Dialog onClose={onClose} title={t("common.share")} subtitle={documentTitle}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Input
              value={email}
              placeholder={t("share.email")}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void invite();
              }}
              style={{ flex: 1 }}
            />
            <Button variant="primary" disabled={busy || !email.trim()} onClick={() => void invite()}>
              {busy ? t("share.inviting") : t("share.invite")}
            </Button>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {(Object.keys(ROLE_LABEL_KEY) as MemberRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  padding: "5px 11px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 11.5,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: `1px solid ${r === role ? "var(--color-heat-line)" : "var(--color-outline-md)"}`,
                  background: r === role ? "var(--color-heat-wash)" : "transparent",
                  color: r === role ? "var(--color-heat-hi)" : "var(--color-faint)",
                }}
              >
                {t(ROLE_LABEL_KEY[r])}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--color-faint)", marginBottom: 18, lineHeight: 1.5 }}>
            {t(ROLE_HINT_KEY[role])}
          </div>

          {error && (
            <div style={{ fontSize: 11.5, color: "var(--color-error)", marginBottom: 12 }}>{error}</div>
          )}

          {members.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
              {members.map((m) => (
                <div
                  key={m.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--color-text)",
                    }}
                  >
                    {m.email}
                  </span>
                  {!m.accepted && <Pill tone="ghost">{t("share.pendingInvite")}</Pill>}
                  <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)" }}>
                    {t(ROLE_LABEL_KEY[m.role]).toUpperCase()}
                  </span>
                  <Button variant="ghost" onClick={() => void remove(m.id)} style={{ padding: "4px 8px" }}>
                    {t("common.remove")}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {layout ? (
            <p style={{ borderTop: "1px solid var(--color-outline)", paddingTop: 16, marginBottom: 18, fontSize: 11.5, color: "var(--color-faint)", lineHeight: 1.5 }}>
              {t("share.layoutPublishInEditor")}
            </p>
          ) : (
            <div
              style={{
                borderTop: "1px solid var(--color-outline)",
                paddingTop: 16,
                marginBottom: 18,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, fontSize: 12.5, color: "var(--color-text)" }}>
                  {t("share.publicLink")}
                </div>
                <Button
                  variant={publicToken ? "secondary" : "primary"}
                  disabled={!publicToken && !publishedAt}
                  onClick={() => void togglePublic()}
                  title={!publicToken && !publishedAt ? t("share.publishFirst") : undefined}
                >
                  {publicToken ? t("common.deactivate") : t("common.activate")}
                </Button>
              </div>
              {publicUrl ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <code
                    className="df-mono"
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 11.5,
                      padding: "7px 9px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--color-surface-mid)",
                      border: "1px solid var(--color-outline)",
                      color: "var(--color-dim)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {publicUrl}
                  </code>
                  <Button
                    onClick={() => {
                      void navigator.clipboard.writeText(publicUrl);
                      setCopied(true);
                    }}
                  >
                    {copied ? t("share.copied") : t("common.copy")}
                  </Button>
                </div>
              ) : (
                <div style={{ fontSize: 11.5, color: "var(--color-faint)", lineHeight: 1.5 }}>
                  {publishedAt
                    ? t("share.publicEnabled")
                    : t("share.publicDisabled")}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={onClose}>{t("common.close")}</Button>
          </div>
    </Dialog>
  );
}
