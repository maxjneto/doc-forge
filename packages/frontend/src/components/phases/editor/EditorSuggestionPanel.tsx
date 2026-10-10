import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { Suggestion } from "@/types";
import {
  apiFetchSuggestions,
  apiAcceptSuggestion,
  apiRejectSuggestion,
} from "@/utils/api";
import { ScrollFadeContainer } from "./ScrollFadeContainer";
import { Card, Pill, Button } from "@/components/ui";
import type { TriageState } from "./EditorSidebarTabs";
import { diffHunks, CHANGE_LABEL } from "@/utils/diff";

// ─── Single suggestion card ───────────────────────────────────

interface SuggestionCardProps {
  suggestion: Suggestion;
  index: number;
  onResolved: () => void;
}

function SuggestionCard({ suggestion, index, onResolved }: SuggestionCardProps) {
  const { getToken } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiAcceptSuggestion(suggestion.id, getToken);
      posthog.capture("suggestion_reviewed", {
        document_id: suggestion.documentId,
        suggestion_id: suggestion.id,
        decision: "accepted",
      });
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to accept suggestion");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (busy) return;
    setBusy(true);
    try {
      await apiRejectSuggestion(suggestion.id, comment.trim() || null, getToken);
      posthog.capture("suggestion_reviewed", {
        document_id: suggestion.documentId,
        suggestion_id: suggestion.id,
        decision: "rejected",
        has_comment: Boolean(comment.trim()),
      });
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  const hunks = diffHunks(suggestion.currentContent ?? "", suggestion.proposedContent ?? "");
  const sections = Array.from(
    new Set(hunks.map((h) => h.heading?.text).filter(Boolean) as string[]),
  );
  // Dominant kind across the proposal. Per-change pills arrive with hunk-level
  // triage (revamp plan, Fase 2b) — until then one card covers one proposal.
  const kind = hunks.length > 0 ? hunks[0].kind : "rewrite";

  return (
    <Card tone="heat" style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {/* #n · TIPO · §seção */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)" }}>
          #{index}
        </span>
        <Pill tone="heat" dot={false}>
          {CHANGE_LABEL[kind]}
        </Pill>
        <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)" }}>
          {sections.length === 0
            ? "documento"
            : sections.length === 1
              ? sections[0]
              : `${sections.length} seções`}
        </span>
        {suggestion.isStale && (
          <Pill tone="warn" dot={false}>
            desatualizada
          </Pill>
        )}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 600, color: "var(--color-text)" }}>
        {suggestion.agentName ?? "Agente"} propôs {hunks.length}{" "}
        {hunks.length === 1 ? "mudança" : "mudanças"}
      </div>

      {/* › POR QUE — the reviewer needs the reasoning, not just the diff.
          A one-line note is all the model carries today; structured kinds
          (alternatives, evidence, risks) need a backend field. */}
      {suggestion.note && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            className="df-mono"
            style={{ fontSize: 10, letterSpacing: "var(--tracking-eyebrow)", color: "var(--color-faint)" }}
          >
            › POR QUE
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.65, color: "var(--color-dim)" }}>
            {suggestion.note}
          </div>
        </div>
      )}

      {rejecting && (
        <textarea
          autoFocus
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Por quê? Seu comentário vira feedback que o agente lê antes de reescrever…"
          maxLength={4000}
          rows={3}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface-mid)",
            border: "1px solid var(--color-error-line)",
            fontSize: 11.5,
            lineHeight: 1.5,
            color: "var(--color-dim)",
            fontFamily: "inherit",
            outline: "none",
            resize: "vertical",
          }}
        />
      )}

      {error && (
        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--color-error)" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 7 }}>
        {rejecting ? (
          <>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button variant="primary" grow disabled={busy} onClick={handleReject}>
              {busy ? "Recusando…" : "Confirmar recusa"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" grow disabled={busy} onClick={handleAccept}>
              {busy ? "Aceitando…" : "Aceitar"}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>
              Recusar
            </Button>
            <Button variant="ghost" onClick={() => setRejecting(true)}>
              Comentar
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Panel ────────────────────────────────────────────────────

interface EditorSuggestionPanelProps {
  documentId: string;
  refreshTick: number;
  onSuggestionResolved: () => void;
  /** Reports the current pending count upward, e.g. for a tab badge. */
  onCountChange?: (count: number) => void;
  /** Reports the pending suggestions themselves, so the nav can tally them per section. */
  onPendingChange?: (suggestions: Suggestion[]) => void;
  triage?: TriageState;
}

/** Review tab content — full height, single scroll region shared by every
 * suggestion card (diffs render inline, no nested scroll of their own). */
export function EditorSuggestionPanel({
  documentId,
  refreshTick,
  onSuggestionResolved,
  onCountChange,
  onPendingChange,
  triage,
}: EditorSuggestionPanelProps) {
  const { getToken } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const refetch = useCallback(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!token || cancelled) return;
      apiFetchSuggestions(documentId, () => Promise.resolve(token), "pending")
        .then((s) => { if (!cancelled) setSuggestions(s); })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [documentId, getToken]);

  useEffect(() => refetch(), [refetch, refreshTick]);
  useEffect(() => onCountChange?.(suggestions.length), [suggestions.length, onCountChange]);
  useEffect(() => onPendingChange?.(suggestions), [suggestions, onPendingChange]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <ScrollFadeContainer fadeColor="var(--color-bg)">
      <div
        style={{
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {suggestions.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: "8px 4px",
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "var(--color-faint)",
            }}
          >
            Nada pendente. Escritas de agente aparecem aqui para revisão.
          </p>
        ) : (
          suggestions.map((s, i) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              index={i + 1}
              onResolved={() => {
                refetch();
                onSuggestionResolved();
              }}
            />
          ))
        )}
      </div>
      </ScrollFadeContainer>

      {/* Triage footer — the mock's `↑↓ NAVEGAR · A ACEITAR · R RECUSAR`
          and `Salvar triagem`. Only meaningful once there is something to
          triage; the server applies base + accepted hunks. */}
      {triage && triage.total > 0 && (
        <div
          style={{
            flexShrink: 0,
            borderTop: "1px solid var(--color-outline)",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 11,
          }}
        >
          {triage.error && (
            <div style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--color-error)" }}>
              {triage.error}
            </div>
          )}
          <div
            className="df-mono"
            style={{ fontSize: 10, letterSpacing: "var(--tracking-data)", color: "var(--color-faint)" }}
          >
            ↑↓ NAVEGAR · A ACEITAR · R RECUSAR
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: "var(--radius-xs)",
                background: "var(--color-outline)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${(triage.decided / triage.total) * 100}%`,
                  height: "100%",
                  background: "var(--color-heat)",
                  transition: "width 0.2s",
                }}
              />
            </div>
            <span className="df-mono" style={{ fontSize: 10, color: "var(--color-faint)" }}>
              {triage.decided} / {triage.total}
            </span>
          </div>
          <Button
            variant={triage.decided > 0 ? "primary" : "secondary"}
            disabled={triage.decided === 0}
            onClick={triage.onSave}
          >
            {triage.accepted === 0
              ? "Recusar tudo"
              : `Salvar triagem — ${triage.accepted} de ${triage.total}`}
          </Button>
        </div>
      )}
    </div>
  );
}
