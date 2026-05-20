import { useState } from "react";

type CardStatus = "pending" | "approved" | "editing" | "regenerating";

interface SummaryCardProps {
  label: string;
  summary: string;
  status: CardStatus;
  locked?: boolean;
  onApprove: () => void;
  onStartEdit: () => void;
  onReject: (reason: string) => void;
  onReopen: () => void;
}

export function SummaryCard({
  label,
  summary,
  status,
  locked = false,
  onApprove,
  onStartEdit,
  onReject,
  onReopen,
}: SummaryCardProps) {
  const [reason, setReason] = useState("");

  const isApproved = status === "approved";
  const isRevising = status === "regenerating";
  const isEditing = status === "editing";
  const isPending = status === "pending";

  return (
    <div
      style={{
        border: "1px solid",
        borderColor: isApproved
          ? "var(--df-steel-border, rgba(138,160,184,0.35))"
          : isRevising
          ? "rgba(255,77,0,0.30)"
          : "var(--df-outline, rgba(255,255,255,0.06))",
        borderRadius: 10,
        padding: "20px 22px",
        background: isApproved
          ? "linear-gradient(180deg, rgba(138,160,184,0.05), rgba(18,20,20,0.5))"
          : "rgba(18,20,20,0.5)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Shimmer overlay while revising */}
      {isRevising && (
        <div
          className="animate-df-shimmer"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(120deg, transparent 0%, rgba(255,77,0,0.07) 35%, transparent 65%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          className="df-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#e3e2e2",
          }}
        >
          › {label}
        </span>

        {isApproved && (
          <span className="df-pill df-pill-steel">Forged · approved</span>
        )}
        {isRevising && (
          <span className="df-pill df-pill-heat">Re-pouring</span>
        )}
        {isPending && (
          <span className="df-pill df-pill-ghost">Pending review</span>
        )}
        {isEditing && (
          <span className="df-pill df-pill-warn">Editing</span>
        )}
      </div>

      {/* Summary content */}
      {isRevising ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              height: 6,
              borderRadius: 2,
              background: "rgba(255,77,0,0.20)",
              animation: "pulse 1.6s ease-in-out infinite",
              width: "90%",
            }}
          />
          <div
            style={{
              height: 6,
              borderRadius: 2,
              background: "rgba(255,77,0,0.20)",
              animation: "pulse 1.6s ease-in-out infinite",
              width: "75%",
            }}
          />
          <div
            style={{
              height: 6,
              borderRadius: 2,
              background: "rgba(255,77,0,0.20)",
              animation: "pulse 1.6s ease-in-out infinite",
              width: "60%",
            }}
          />
          {reason && (
            <span
              className="df-mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.10em",
                color: "var(--df-faint, rgba(227,226,226,0.38))",
                marginTop: 6,
              }}
            >
              Recasting from your note: "{reason}"
            </span>
          )}
        </div>
      ) : (
        <p
          style={{
            fontSize: 13,
            color: isApproved
              ? "var(--df-on-surface-soft, #c6c5c4)"
              : "var(--df-dim, rgba(227,226,226,0.62))",
            lineHeight: 1.55,
            margin: 0,
            flex: 1,
          }}
        >
          {summary}
        </p>
      )}

      {/* Editing input */}
      {isEditing && (
        <div style={{ marginTop: 4 }}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what to change…"
            style={{
              width: "100%",
              height: 72,
              background: "rgba(0,0,0,0.20)",
              border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              color: "#e3e2e2",
              fontFamily: "inherit",
              resize: "none",
              outline: "none",
              marginBottom: 10,
            }}
          />
          <button
            onClick={() => {
              onReject(reason);
              setReason("");
            }}
            disabled={!reason.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              border: "1px solid rgba(255,77,0,0.30)",
              background: "rgba(255,77,0,0.06)",
              color: "var(--df-amber-200, #ffb59e)",
              cursor: !reason.trim() ? "not-allowed" : "pointer",
              opacity: !reason.trim() ? 0.4 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
            Resend with notes
          </button>
        </div>
      )}

      {/* Actions */}
      {(isApproved || isPending) && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {isApproved ? (
            <>
              <button
                onClick={locked ? undefined : onStartEdit}
                disabled={locked}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
                  color: "var(--df-on-surface-soft, #c6c5c4)", background: "transparent",
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.35 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                Edit
              </button>
              <button
                onClick={locked ? undefined : onReopen}
                disabled={locked}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: "1px solid var(--df-outline-md, rgba(255,255,255,0.10))",
                  color: "var(--df-on-surface-soft, #c6c5c4)", background: "transparent",
                  cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.35 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>undo</span>
                Reopen
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onApprove}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: "1px solid var(--df-steel-border, rgba(138,160,184,0.35))",
                  color: "var(--df-steel-100, #b9c6d4)",
                  background: "var(--df-steel-bg, rgba(138,160,184,0.10))",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                Approve
              </button>
              <button
                onClick={onStartEdit}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                  border: "1px solid rgba(255,77,0,0.30)",
                  color: "var(--df-amber-200, #ffb59e)",
                  background: "rgba(255,77,0,0.06)",
                  cursor: "pointer",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
                Resend with notes
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
