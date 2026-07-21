import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import DiffMatchPatch from "diff-match-patch";
import type { Suggestion } from "@/types";
import {
  apiFetchSuggestions,
  apiAcceptSuggestion,
  apiRejectSuggestion,
} from "@/utils/api";

const dmp = new DiffMatchPatch();

// ─── Diff view (same visual language as EditorVersionPanel) ───

function SuggestionDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);

  return (
    <pre
      style={{
        fontFamily: "var(--df-font-mono, monospace)",
        fontSize: 10,
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        margin: 0,
        color: "rgba(227,226,226,0.6)",
      }}
    >
      {diffs.map(([op, text], i) => (
        <span
          key={i}
          style={{
            background: op === 1 ? "rgba(80,200,120,0.15)" : op === -1 ? "rgba(232,100,100,0.15)" : "transparent",
            color: op === 1 ? "#50c878" : op === -1 ? "#e86464" : "rgba(227,226,226,0.45)",
            textDecoration: op === -1 ? "line-through" : "none",
          }}
        >
          {text}
        </span>
      ))}
    </pre>
  );
}

// ─── Single suggestion card ───────────────────────────────────

interface SuggestionCardProps {
  suggestion: Suggestion;
  onResolved: () => void;
}

function SuggestionCard({ suggestion, onResolved }: SuggestionCardProps) {
  const { getToken } = useAuth();
  const [expanded, setExpanded] = useState(true);
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

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid rgba(120,160,255,0.25)",
        background: "rgba(120,160,255,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: "#8aa8ff" }}>
          rate_review
        </span>
        <span
          className="df-mono"
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: "#b8c8ff",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {suggestion.agentName ?? "Agent"}
        </span>
        {suggestion.isStale && (
          <span
            className="df-mono"
            title="The document changed after this was proposed — review the diff carefully."
            style={{
              fontSize: 8.5,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "1px 5px",
              borderRadius: 3,
              background: "rgba(255,196,0,0.15)",
              color: "#ffd25e",
              flexShrink: 0,
            }}
          >
            Stale
          </span>
        )}
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 14, color: "rgba(227,226,226,0.3)" }}
        >
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "0 10px 10px" }}>
          {suggestion.note && (
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 10.5,
                lineHeight: 1.5,
                color: "rgba(227,226,226,0.62)",
              }}
            >
              {suggestion.note}
            </p>
          )}
          <div className="df-mono" style={{ fontSize: 9, color: "rgba(227,226,226,0.25)", marginBottom: 6 }}>
            {new Date(suggestion.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
          </div>

          {/* Diff */}
          <div
            className="hide-scrollbar"
            style={{
              padding: 8,
              borderRadius: 6,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
              maxHeight: 220,
              overflowY: "auto",
              marginBottom: 8,
            }}
          >
            <SuggestionDiff
              oldText={suggestion.currentContent ?? ""}
              newText={suggestion.proposedContent ?? ""}
            />
          </div>

          {/* Reject comment input */}
          {rejecting && (
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why? Your comment becomes feedback the agent reads before rewriting…"
              maxLength={4000}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: 8,
                padding: "6px 8px",
                borderRadius: 6,
                background: "rgba(0,0,0,0.3)",
                border: "1px solid rgba(232,100,100,0.3)",
                fontSize: 10.5,
                lineHeight: 1.5,
                color: "rgba(227,226,226,0.75)",
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
              }}
            />
          )}

          {error && (
            <p
              style={{
                margin: "0 0 8px",
                padding: "6px 8px",
                borderRadius: 6,
                background: "rgba(232,100,100,0.1)",
                border: "1px solid rgba(232,100,100,0.3)",
                fontSize: 10,
                lineHeight: 1.5,
                color: "#e88",
              }}
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            {rejecting ? (
              <>
                <button
                  onClick={() => setRejecting(false)}
                  className="df-mono"
                  style={{
                    fontSize: 9.5,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "transparent",
                    color: "rgba(227,226,226,0.38)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={busy}
                  className="df-mono"
                  style={{
                    fontSize: 9.5,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid rgba(232,100,100,0.4)",
                    background: "rgba(232,100,100,0.12)",
                    color: "#e88",
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? "Rejecting…" : "Confirm reject"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setRejecting(true)}
                  disabled={busy}
                  className="df-mono"
                  style={{
                    fontSize: 9.5,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid rgba(232,100,100,0.35)",
                    background: "transparent",
                    color: "#e88",
                    cursor: "pointer",
                  }}
                >
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="df-mono"
                  style={{
                    fontSize: 9.5,
                    padding: "4px 10px",
                    borderRadius: 4,
                    border: "1px solid rgba(80,200,120,0.4)",
                    background: "rgba(80,200,120,0.12)",
                    color: "#50c878",
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.6 : 1,
                    fontWeight: 600,
                  }}
                >
                  {busy ? "Accepting…" : "Accept"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────

interface EditorSuggestionPanelProps {
  documentId: string;
  refreshTick: number;
  onSuggestionResolved: () => void;
}

export function EditorSuggestionPanel({
  documentId,
  refreshTick,
  onSuggestionResolved,
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

  if (suggestions.length === 0) return null;

  return (
    <div
      style={{
        flexShrink: 0,
        maxHeight: "45%",
        display: "flex",
        flexDirection: "column",
        borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
        background: "rgba(120,160,255,0.02)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 18px 12px",
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          className="df-mono"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#8aa8ff",
          }}
        >
          › Review
        </span>
        <span
          className="df-mono"
          style={{
            fontSize: 9,
            padding: "1px 6px",
            borderRadius: 8,
            background: "rgba(120,160,255,0.15)",
            color: "#b8c8ff",
            fontWeight: 600,
          }}
        >
          {suggestions.length}
        </span>
      </div>

      {/* List */}
      <div
        className="hide-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {suggestions.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            onResolved={() => {
              refetch();
              onSuggestionResolved();
            }}
          />
        ))}
      </div>
    </div>
  );
}
