import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { GateStatus } from "@/utils/api";
import { apiDismissAuditFinding, apiFetchGateStatus, apiSetRequireGateOnAccept } from "@/utils/api";
import { ScrollFadeContainer } from "./ScrollFadeContainer";

interface EditorGatePanelProps {
  documentId: string;
  refreshTick: number;
  /** Reports (openFindings, blocking) upward for the tab badge. */
  onStatusChange?: (openFindings: number, blocking: boolean) => void;
}

/** Quality gate tab content — full height, single scroll region. Own header/
 * border removed: the tab bar carries the "Quality Gate" label + badge. */
export function EditorGatePanel({ documentId, refreshTick, onStatusChange }: EditorGatePanelProps) {
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

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      {/* Toggle row — Gate-specific control, not tab-bar material */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {gate.blocking && (
          <span
            className="df-mono"
            title="Suggestions cannot be accepted while high-severity findings are open."
            style={{
              fontSize: 8.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "1px 5px",
              borderRadius: 3,
              background: "rgba(232,100,100,0.15)",
              color: "#e88",
            }}
          >
            Blocking
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          onClick={handleToggleRequireGate}
          disabled={togglePending}
          title="When on, suggestions can't be accepted while high-severity findings are open."
          className="df-mono"
          style={{
            fontSize: 9,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "2px 7px",
            borderRadius: 3,
            border: `1px solid ${gate.requireGateOnAccept ? "rgba(255,196,0,0.35)" : "rgba(255,255,255,0.1)"}`,
            background: gate.requireGateOnAccept ? "rgba(255,196,0,0.1)" : "transparent",
            color: gate.requireGateOnAccept ? "#ffd25e" : "rgba(227,226,226,0.38)",
            cursor: togglePending ? "wait" : "pointer",
            opacity: togglePending ? 0.6 : 1,
          }}
        >
          Require on accept: {gate.requireGateOnAccept ? "on" : "off"}
        </button>
      </div>

      {/* Findings — single scroll region for the whole tab */}
      <ScrollFadeContainer fadeColor="rgba(20,16,4,0.97)">
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {gate.findings.length === 0 && (
          <p style={{ margin: 0, padding: "8px 4px", fontSize: 12, lineHeight: 1.55, color: "rgba(227,226,226,0.38)" }}>
            No findings. Run the quality gate to check for cross-section contradictions.
          </p>
        )}
        {gate.findings.map((f) => (
          <div
            key={f.id}
            style={{
              padding: "8px 10px",
              borderRadius: 6,
              border: `1px solid ${f.severity === "high" ? "rgba(232,100,100,0.3)" : "rgba(255,196,0,0.2)"}`,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span
                className="df-mono"
                style={{
                  fontSize: 8.5,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: f.severity === "high" ? "#e88" : "#ffd25e",
                  fontWeight: 600,
                }}
              >
                {f.severity}
              </span>
              <span className="df-mono" style={{ fontSize: 9, color: "rgba(227,226,226,0.35)", flex: 1 }}>
                {f.sectionType}
              </span>
              <button
                onClick={() => handleDismiss(f.id)}
                title="Dismiss this finding"
                className="df-mono"
                style={{
                  fontSize: 8.5,
                  padding: "2px 6px",
                  borderRadius: 3,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent",
                  color: "rgba(227,226,226,0.38)",
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: "rgba(227,226,226,0.7)" }}>
              {f.description}
            </p>
          </div>
        ))}
      </div>
      </ScrollFadeContainer>
    </div>
  );
}
