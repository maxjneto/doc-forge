import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { AuditFinding } from "@/types";
import type { GateStatus } from "@/utils/api";
import {
  apiCreateFeedback,
  apiDismissAuditFinding,
  apiFetchGateStatus,
  apiSetRequireGateOnAccept,
} from "@/utils/api";
import { ScrollFadeContainer } from "./ScrollFadeContainer";
import { Button, Card, Pill, Switch, textStyle } from "@/components/ui";
import { useI18n } from "@/i18n";

interface EditorGatePanelProps {
  documentId: string;
  refreshTick: number;
  /** Reports (openFindings, blocking) upward for the tab badge. */
  onStatusChange?: (openFindings: number, blocking: boolean) => void;
  /** Jump the document to where a finding lands. */
  onGoToFinding?: (finding: AuditFinding) => void;
  /** Reports open findings upward so they can be drawn inside the text. */
  onFindingsChange?: (findings: AuditFinding[]) => void;
}

/** Quality gate tab content — full height, single scroll region. Own header/
 * border removed: the tab bar carries the "Quality Gate" label + badge. */
export function EditorGatePanel({
  documentId,
  refreshTick,
  onStatusChange,
  onGoToFinding,
  onFindingsChange,
}: EditorGatePanelProps) {
  const { getToken } = useAuth();
  const { t } = useI18n();
  const [gate, setGate] = useState<GateStatus | null>(null);
  const [togglePending, setTogglePending] = useState(false);

  const refetch = useCallback(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      apiFetchGateStatus(documentId, () => Promise.resolve(token))
        .then((g) => { if (!cancelled) setGate(g); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [documentId, getToken]);

  useEffect(() => refetch(), [refetch, refreshTick]);
  useEffect(() => {
    if (gate) onStatusChange?.(gate.openFindings, gate.blocking);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate?.openFindings, gate?.blocking]);
  useEffect(() => {
    if (gate) onFindingsChange?.(gate.findings.filter((f) => !f.dismissed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate?.findings]);

  if (!gate) return null;

  async function handleDismiss(findingId: string) {
    await apiDismissAuditFinding(documentId, findingId, getToken);
    refetch();
  }

  async function handleToggleRequireGate() {
    if (!gate) return;
    setTogglePending(true);
    try {
      await apiSetRequireGateOnAccept(documentId, !gate.requireGateOnAccept, getToken);
      refetch();
    } finally {
      setTogglePending(false);
    }
  }

  const open = gate.findings.filter((f) => !f.dismissed);

  /** "Pedir correção" — the finding becomes feedback the agent reads. */
  async function requestFix(finding: AuditFinding) {
    const quote = finding.quote ? ` Trecho: “${finding.quote}”` : "";
    await apiCreateFeedback(
      documentId,
      `Gate (${finding.severity === "high" ? "bloqueante" : "aviso"}): ${finding.description}${quote}`,
      null,
      getToken,
    );
    await handleDismiss(finding.id);
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          flexShrink: 0,
          padding: 16,
          borderBottom: "1px solid var(--color-outline)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ ...textStyle.ui, fontWeight: 600, color: "var(--color-text)", flex: 1 }}>{t("gate.title")}</div>
          <Switch
            checked={gate.requireGateOnAccept}
            onChange={() => void handleToggleRequireGate()}
            disabled={togglePending}
            title={t("gate.requireHint")}
            label={t("gate.requireOnAccept")}
          />
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-dim)" }}>
          {open.length === 1 ? t("gate.problem") : t("gate.problems", { count: open.length })}
          {gate.openHighFindings > 0 && (
            <>
              {" · "}
              <b style={{ color: "var(--color-error)", fontWeight: 600 }}>
                {gate.openHighFindings} {t(gate.openHighFindings === 1 ? "editor.blocker" : "editor.blockers")}
              </b>
            </>
          )}
        </div>
      </div>

      <ScrollFadeContainer fadeColor="var(--color-bg)">
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {open.length === 0 && (
            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--color-faint)", margin: 0 }}>{t("gate.empty")}</p>
          )}

          {open.map((f, i) => {
            const blocking = f.severity === "high";
            // One filled action per view (R1): the first open finding is the
            // one to act on; the rest offer the same action, quieter.
            const lead = i === 0;
            return (
              <Card key={f.id} tone={lead ? "heat" : "sunken"} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)", letterSpacing: "var(--tracking-data)" }}>
                    G-{i + 1}
                  </span>
                  <Pill tone={blocking ? "error" : "warn"} compact>
                    {t(blocking ? "editor.blocking" : "editor.warning")}
                  </Pill>
                  {f.category && <span style={{ fontSize: 11.5, color: "var(--color-faint)" }}>{f.category}</span>}
                </div>

                <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 600, color: "var(--color-text)" }}>
                  {f.description}
                </div>

                {f.quote && (
                  <blockquote
                    style={{
                      margin: 0,
                      padding: "2px 0 2px 10px",
                      borderLeft: `2px solid ${blocking ? "var(--color-error-line)" : "var(--color-warn-line)"}`,
                      fontSize: 12.5,
                      lineHeight: 1.55,
                      fontStyle: "italic",
                      color: "var(--color-dim)",
                    }}
                  >
                    “{f.quote}”
                  </blockquote>
                )}

                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant={lead ? "primary" : "secondary"} grow onClick={() => void requestFix(f)}>
                    {t("editor.requestFix")}
                  </Button>
                  {onGoToFinding && (
                    <Button variant="secondary" onClick={() => onGoToFinding(f)}>
                      {t("gate.goTo")}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => void handleDismiss(f.id)}>
                    {t("gate.dismiss")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </ScrollFadeContainer>
    </div>
  );
}
