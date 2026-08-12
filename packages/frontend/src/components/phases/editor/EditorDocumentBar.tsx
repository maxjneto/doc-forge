import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { apiPublishDocument } from "@/utils/api";
import { Button, Pill } from "@/components/ui";

interface EditorDocumentBarProps {
  documentId: string;
  title: string;
  /** Pending changes awaiting review — drives the `IN REVIEW` state. */
  pendingChanges: number;
  /** Open blocking gate findings; publishing is refused while any remain. */
  blockingFindings: number;
  isMcpManaged: boolean;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
  savePending?: boolean;
  onPublished?: () => void;
}

/**
 * The document bar from the v4 mock: breadcrumb, state, and the publish
 * gesture.
 *
 * `Publicar` is not decoration — the active version is the working draft, and
 * publishing marks the one people are meant to read. The gate can refuse it,
 * which is what makes the gate a gate rather than a report.
 */
export function EditorDocumentBar({
  documentId,
  title,
  pendingChanges,
  blockingFindings,
  isMcpManaged,
  publishedAt = null,
  hasUnpublishedChanges = false,
  savePending = false,
  onPublished,
}: EditorDocumentBarProps) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);

  const blocked = blockingFindings > 0;

  async function publish() {
    if (busy || blocked || savePending) return;
    setBusy(true);
    setError(null);
    try {
      const result = await apiPublishDocument(documentId, getToken);
      setPublished(result.label);
      onPublished?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao publicar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        height: 52,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 20px",
        borderBottom: "1px solid var(--df-outline)",
        background: "var(--color-chrome)",
      }}
    >
      <button
        onClick={() => navigate("/")}
        style={{
          fontSize: 12.5,
          color: "var(--df-faint)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0,
        }}
      >
        Documents
      </button>
      <span style={{ fontSize: 12.5, color: "var(--df-mute)" }}>/</span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--df-on-surface)",
          maxWidth: 320,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </span>

      {blocked ? (
        <Pill tone="heat">
          {blockingFindings} {blockingFindings === 1 ? "bloqueante" : "bloqueantes"}
        </Pill>
      ) : savePending ? (
        <Pill tone="warn">salvando rascunho</Pill>
      ) : pendingChanges > 0 ? (
        <Pill tone="heat">
          in review · {pendingChanges} {pendingChanges === 1 ? "mudança" : "mudanças"}
        </Pill>
      ) : publishedAt && hasUnpublishedChanges ? (
        <Pill tone="heat" dot>
          alterações não publicadas
        </Pill>
      ) : published || publishedAt ? (
        <Pill tone="ok" dot>
          publicado{published ? ` · ${published}` : ""}
        </Pill>
      ) : (
        <Pill tone="ghost">rascunho</Pill>
      )}

      {isMcpManaged && <Pill tone="ghost">mcp-managed</Pill>}

      <span style={{ flex: 1 }} />

      {error && (
        <span style={{ fontSize: 11.5, color: "var(--df-error)", maxWidth: 380, lineHeight: 1.4 }}>
          {error}
        </span>
      )}

      <Button
        variant={blocked ? "secondary" : "primary"}
        disabled={busy || blocked || savePending}
        onClick={() => void publish()}
        title={
          blocked
            ? "Resolva ou descarte os bloqueantes do gate antes de publicar"
            : savePending
              ? "Aguarde o rascunho ser salvo antes de publicar"
            : "Marcar esta versão como a que as pessoas devem ler"
        }
      >
        {busy ? "Publicando…" : publishedAt ? "Publicar nova versão" : "Publicar"}
      </Button>
    </div>
  );
}
