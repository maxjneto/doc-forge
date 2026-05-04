import { useState } from "react";

type CardStatus = "pending" | "approved" | "editing" | "regenerating";

interface SummaryCardProps {
  icon: string;
  label: string;
  summary: string;
  status: CardStatus;
  onApprove: () => void;
  onStartEdit: () => void;
  onReject: (reason: string) => void;
}

export function SummaryCard({
  icon,
  label,
  summary,
  status,
  onApprove,
  onStartEdit,
  onReject,
}: SummaryCardProps) {
  const [reason, setReason] = useState("");

  const borderClass =
    status === "approved"
      ? "border-green-500/50"
      : "border-outline-variant/30";

  return (
    <div
      className={`panel-depth rounded-xl p-5 bg-surface-container-low min-h-[180px] flex flex-col border ${borderClass} transition-colors`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary/70">{icon}</span>
          <h3 className="text-sm font-semibold text-on-surface">{label}</h3>
        </div>
        {status === "approved" && (
          <span className="text-green-400 text-xs font-medium">✓ Approved</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        {status === "regenerating" ? (
          <div className="space-y-2">
            <div className="h-3 bg-surface-container-high rounded animate-pulse w-full" />
            <div className="h-3 bg-surface-container-high rounded animate-pulse w-4/5" />
            <div className="h-3 bg-surface-container-high rounded animate-pulse w-3/5" />
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant/80 leading-relaxed">
            {summary}
          </p>
        )}
      </div>

      {/* Editing area */}
      {status === "editing" && (
        <div className="mt-4 animate-fade-in">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason..."
            className="w-full h-20 bg-surface-container rounded-lg p-3 text-xs text-on-surface placeholder:text-on-surface-variant/40 resize-none border border-outline-variant/30 focus:border-primary/50 focus:outline-none transition-colors mb-3"
          />
          <button
            onClick={() => onReject(reason)}
            disabled={!reason.trim()}
            className="px-4 py-2 bg-error-container text-on-error-container rounded-lg text-xs font-medium hover:brightness-110 transition-all disabled:opacity-30"
          >
            Resend
          </button>
        </div>
      )}

      {/* Actions */}
      {status === "pending" && (
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={onApprove}
            className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-xs font-medium hover:brightness-110 transition-all"
          >
            Approve
          </button>
          <button
            onClick={onStartEdit}
            className="px-4 py-2 text-on-surface-variant/60 text-xs font-medium hover:text-on-surface transition-colors"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
