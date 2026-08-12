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
import { Button, Card, Pill } from "@/components/ui";

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
          borderBottom: "1px solid var(--df-outline)",
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--df-on-surface)" }}>
            Gate de qualidade
          </div>
          <span style={{ flex: 1 }} />
          <button
            onClick={handleToggleRequireGate}
            disabled={togglePending}
            title="Quando ligado, sugestões não podem ser aceitas com bloqueantes em aberto."
            className="df-mono"
            style={{
              fontSize: 9,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: "var(--radius-xs)",
              border: `1px solid ${gate.requireGateOnAccept ? "var(--color-warn-border)" : "var(--df-outline-md)"}`,
              background: gate.requireGateOnAccept ? "var(--color-warn-bg)" : "transparent",
              color: gate.requireGateOnAccept ? "var(--df-warn)" : "var(--df-faint)",
              cursor: togglePending ? "wait" : "pointer",
            }}
          >
            bloquear aceite
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--df-dim)" }}>
          {open.length} {open.length === 1 ? "problema" : "problemas"}
          {gate.openHighFindings > 0 && (
            <>
              {" · "}
              <b style={{ color: "var(--df-amber-300)", fontWeight: 600 }}>
                {gate.openHighFindings} {gate.openHighFindings === 1 ? "bloqueante" : "bloqueantes"}
              </b>
            </>
          )}
        </div>
      </div>

      <ScrollFadeContainer fadeColor="rgba(9,10,12,0.97)">
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          {open.length === 0 && (
            <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--df-faint)", margin: 0 }}>
              Nenhum problema em aberto. O gate roda a partir do agente ou do servidor.
            </p>
          )}

          {open.map((f, i) => {
            const blocking = f.severity === "high";
            return (
              <Card key={f.id} tone={i === 0 ? "heat" : "sunken"} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
                    G-{i + 1}
                  </span>
                  <Pill tone={blocking ? "heat" : "ghost"} dot={false}>
                    {blocking ? "BLOQUEANTE" : "AVISO"}
                  </Pill>
                  <span className="df-mono" style={{ fontSize: 9.5, color: "var(--df-faint)" }}>
                    {f.sectionType}
                    {f.category ? ` · ${f.category}` : ""}
                  </span>
                </div>

                <div style={{ fontSize: 13.5, lineHeight: 1.45, fontWeight: 600, color: "var(--df-on-surface)" }}>
                  {f.description}
                </div>

                {f.quote && (
                  <div
                    className="df-mono"
                    style={{
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--df-surface-mid)",
                      border: "1px solid var(--df-outline)",
                      fontSize: 11.5,
                      lineHeight: 1.65,
                      color: "var(--df-faint)",
                    }}
                  >
                    “{f.quote}”
                  </div>
                )}

                <div style={{ display: "flex", gap: 7 }}>
                  <Button variant="primary" grow onClick={() => void requestFix(f)}>
                    Pedir correção
                  </Button>
                  {onGoToFinding && (
                    <Button variant="secondary" onClick={() => onGoToFinding(f)}>
                      Ir para
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => void handleDismiss(f.id)}>
                    Descartar
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
