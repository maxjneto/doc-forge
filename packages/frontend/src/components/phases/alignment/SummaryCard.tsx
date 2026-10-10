import { useState } from "react";
import { Button, Pill } from "@/components/ui";
import { useI18n } from "@/i18n";

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

/**
 * One section summary in the alignment step. Actions stay quiet (secondary /
 * ghost): the screen's single primary is "Confirm and pour" in the header.
 */
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
  const { t } = useI18n();
  const [reason, setReason] = useState("");

  const isApproved = status === "approved";
  const isRevising = status === "regenerating";
  const isEditing = status === "editing";
  const isPending = status === "pending";

  return (
    <div
      style={{
        border: "1px solid",
        borderColor: isApproved ? "var(--color-steel-line)" : isRevising || isEditing ? "var(--color-heat-line)" : "var(--color-outline)",
        borderRadius: "var(--radius-md)",
        padding: "18px 20px",
        background: isApproved ? "linear-gradient(180deg, var(--color-steel-tint), var(--color-surface))" : "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isRevising && (
        <div
          className="animate-df-shimmer"
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, transparent 0%, var(--color-heat-tint) 35%, transparent 65%)",
            pointerEvents: "none",
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span
          className="df-mono"
          style={{ fontSize: 10, fontWeight: 600, letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--color-text)" }}
        >
          › {label}
        </span>
        {isApproved && <Pill tone="steel" compact>{t("g.sc.approved")}</Pill>}
        {isRevising && <Pill tone="heat" compact>{t("g.sc.repouring")}</Pill>}
        {isPending && <Pill tone="ghost" compact>{t("g.sc.pending")}</Pill>}
        {isEditing && <Pill tone="warn" compact>{t("g.sc.editing")}</Pill>}
      </div>

      {isRevising ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[90, 75, 60].map((w) => (
            <div key={w} className="animate-df-pulse" style={{ height: 6, borderRadius: "var(--radius-xs)", background: "var(--color-heat-strong)", width: `${w}%` }} />
          ))}
          {reason && (
            <span style={{ fontSize: 11.5, color: "var(--color-faint)", marginTop: 6 }}>
              {t("g.sc.recasting", { note: reason })}
            </span>
          )}
        </div>
      ) : (
        <p data-ph-mask style={{ fontSize: 13, color: "var(--color-dim)", lineHeight: 1.6, margin: 0 }}>
          {summary}
        </p>
      )}

      {isEditing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            className="df-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("g.sc.ph")}
            aria-label={t("g.sc.ph")}
            rows={3}
            style={{ resize: "vertical", lineHeight: 1.5 }}
          />
          <div>
            <Button
              icon="refresh"
              iconPosition="start"
              disabled={!reason.trim()}
              onClick={() => {
                onReject(reason);
                setReason("");
              }}
            >
              {t("g.sc.resend")}
            </Button>
          </div>
        </div>
      )}

      {(isApproved || isPending) && (
        <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
          {isApproved ? (
            <>
              <Button variant="ghost" icon="edit" iconPosition="start" onClick={onStartEdit} disabled={locked}>
                {t("g.sc.edit")}
              </Button>
              <Button variant="ghost" icon="undo" iconPosition="start" onClick={onReopen} disabled={locked}>
                {t("g.sc.reopen")}
              </Button>
            </>
          ) : (
            <>
              <Button icon="check" iconPosition="start" onClick={onApprove}>
                {t("g.sc.approve")}
              </Button>
              <Button variant="ghost" icon="refresh" iconPosition="start" onClick={onStartEdit}>
                {t("g.sc.requestChanges")}
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
