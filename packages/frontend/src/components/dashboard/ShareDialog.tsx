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
import { Button, Card, Input, Pill } from "@/components/ui";

const ROLE_LABEL: Record<MemberRole, string> = {
  viewer: "Leitor",
  commenter: "Comentarista",
  editor: "Editor",
};

const ROLE_HINT: Record<MemberRole, string> = {
  viewer: "Lê o documento e os artefatos.",
  commenter: "Lê e deixa comentários — que viram feedback para o seu agente.",
  editor: "Lê, comenta e edita o texto.",
};

interface ShareDialogProps {
  documentId: string;
  documentTitle: string;
  onClose: () => void;
  publishedAt?: string | null;
}

/**
 * Invite someone to a document.
 *
 * Worth knowing while reading this: an invitee has no agent session of their
 * own. Their comments land as feedback the *owner's* agent picks up later —
 * which is why the reasoning panel matters so much for them, since they never
 * watched the agent work.
 */
export function ShareDialog({ documentId, documentTitle, onClose, publishedAt = null }: ShareDialogProps) {
  const { getToken } = useAuth();
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
      setError(e instanceof Error ? e.message : "Falha ao atualizar o link");
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function invite() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiShareDocument(documentId, email.trim(), role, getToken);
      setEmail("");
      refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao compartilhar");
    } finally {
      setBusy(false);
    }
  }

  async function remove(memberId: string) {
    await apiUnshareDocument(documentId, memberId, getToken);
    refetch();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--color-scrim)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
      }}
    >
      <Card
        onClick={() => {}}
        padded={false}
        style={{ width: 460, maxWidth: "92vw", padding: 22 }}
      >
        <div onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>
            Compartilhar
          </div>
          <div style={{ fontSize: 12.5, color: "var(--df-faint)", marginBottom: 18 }}>
            {documentTitle}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Input
              value={email}
              placeholder="email@exemplo.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void invite();
              }}
              style={{ flex: 1 }}
            />
            <Button variant="primary" disabled={busy || !email.trim()} onClick={() => void invite()}>
              {busy ? "Convidando…" : "Convidar"}
            </Button>
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            {(Object.keys(ROLE_LABEL) as MemberRole[]).map((r) => (
              <button
                key={r}
                onClick={() => setRole(r)}
                style={{
                  padding: "5px 11px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 11.5,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  border: `1px solid ${r === role ? "var(--color-heat-border)" : "var(--df-outline-md)"}`,
                  background: r === role ? "var(--color-heat-bg)" : "transparent",
                  color: r === role ? "var(--df-amber-300)" : "var(--df-faint)",
                }}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--df-faint)", marginBottom: 18, lineHeight: 1.5 }}>
            {ROLE_HINT[role]}
          </div>

          {error && (
            <div style={{ fontSize: 11.5, color: "var(--df-error)", marginBottom: 12 }}>{error}</div>
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
                      color: "var(--df-on-surface)",
                    }}
                  >
                    {m.email}
                  </span>
                  {!m.accepted && <Pill tone="ghost">convite pendente</Pill>}
                  <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
                    {ROLE_LABEL[m.role].toUpperCase()}
                  </span>
                  <Button variant="ghost" onClick={() => void remove(m.id)} style={{ padding: "4px 8px" }}>
                    remover
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              borderTop: "1px solid var(--df-outline)",
              paddingTop: 16,
              marginBottom: 18,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, fontSize: 12.5, color: "var(--df-on-surface)" }}>
                Link público somente-leitura
              </div>
              <Button
                variant={publicToken ? "secondary" : "primary"}
                disabled={!publicToken && !publishedAt}
                onClick={() => void togglePublic()}
                title={!publicToken && !publishedAt ? "Publique uma versão antes de criar o link" : undefined}
              >
                {publicToken ? "Desativar" : "Ativar"}
              </Button>
            </div>
            {publicUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code
                  className="df-mono"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 11,
                    padding: "7px 9px",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--df-surface-mid)",
                    border: "1px solid var(--df-outline)",
                    color: "var(--df-dim)",
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
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: "var(--df-faint)", lineHeight: 1.5 }}>
                {publishedAt
                  ? "Qualquer pessoa com o link lê a última versão publicada, sem precisar de conta. Desativar invalida os links já enviados."
                  : "Publique uma versão do documento antes de ativar o link público."}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
