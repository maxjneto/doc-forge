import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { Button, Dialog, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";
import { apiGetLayoutPublication, apiPublishLayout, apiUnpublishLayout, type LayoutPublication } from "@/utils/api";
import { relativeTime } from "@/utils/time";
import { track } from "./track";

const codeBox = {
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
} as const;

/**
 * Publishing a page document: the public link serves a snapshot, so the owner
 * decides when readers (and other sites, through @docforge-lib/layout) see the
 * edits. Unpublishing revokes the link.
 */
export function PublishDialog({ documentId, saving, onClose }: { documentId: string; saving: boolean; onClose: () => void }) {
  const { getToken } = useAuth();
  const { t, dateLocale } = useI18n();
  const [state, setState] = useState<LayoutPublication | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiGetLayoutPublication(documentId, getToken)
      .then(setState)
      .catch(() => setError(t("layout.publish.error")));
  }, [documentId, getToken, t]);

  async function run(action: () => Promise<LayoutPublication>) {
    setBusy(true);
    setError(null);
    try {
      setState(await action());
      setCopied(false);
    } catch {
      setError(t("layout.publish.error"));
    } finally {
      setBusy(false);
    }
  }

  const link = state?.token ? `${window.location.origin}/public/${state.token}` : null;
  const behind = state?.published && state.revision !== null && state.currentRevision > state.revision;

  return (
    <Dialog title={t("layout.publish.title")} subtitle={t("layout.publish.subtitle")} onClose={onClose} width={500} closable>
      {!state ? (
        <p style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{error ?? t("common.loading")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {state.published && link ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code className="df-mono" style={codeBox}>
                  {link}
                </code>
                <Button
                  onClick={() => {
                    void navigator.clipboard.writeText(link);
                    setCopied(true);
                    track("layout_public_link_copied");
                  }}
                >
                  {copied ? t("share.copied") : t("common.copy")}
                </Button>
              </div>
              <p style={{ ...textStyle.caption, color: "var(--color-text)", margin: 0 }}>
                {t("layout.publish.publishedAt", {
                  revision: state.revision ?? 0,
                  when: state.publishedAt ? relativeTime(state.publishedAt, dateLocale) : "",
                })}
                {" · "}
                <span style={{ color: behind ? "var(--color-warn)" : "var(--color-dim)" }}>
                  {behind ? t("layout.publish.behind", { current: state.currentRevision, revision: state.revision ?? 0 }) : t("layout.publish.upToDate")}
                </span>
              </p>
            </>
          ) : (
            <p style={{ ...textStyle.caption, color: "var(--color-dim)", margin: 0 }}>{t("layout.publish.notPublished")}</p>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(!state.published || behind) && (
              <Button variant="primary" icon="public" iconPosition="start" disabled={busy || saving} onClick={() => void run(() => apiPublishLayout(documentId, getToken))}>
                {t("layout.publish.publishRevision", { revision: state.currentRevision })}
              </Button>
            )}
            {state.published && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(t("layout.publish.unpublishConfirm"))) void run(() => apiUnpublishLayout(documentId, getToken));
                }}
              >
                {t("layout.publish.unpublish")}
              </Button>
            )}
          </div>

          {state.published && link && (
            <div style={{ borderTop: "1px solid var(--color-outline)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="df-mono" style={{ fontSize: 10, letterSpacing: "var(--tracking-label)", textTransform: "uppercase", color: "var(--color-faint)" }}>
                {t("layout.publish.forDevelopers")}
              </span>
              <code className="df-mono" style={{ ...codeBox, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {`import { fetchPublished } from "@docforge-lib/layout";\nconst { doc } = await fetchPublished("${link}");`}
              </code>
              <span style={{ ...textStyle.caption, color: "var(--color-faint)" }}>{t("layout.publish.devHint")}</span>
            </div>
          )}

          {error && <p style={{ ...textStyle.caption, color: "var(--color-error)", margin: 0 }}>{error}</p>}
        </div>
      )}
    </Dialog>
  );
}
