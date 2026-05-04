type GenerationStatus = "waiting" | "generating" | "done";

interface SectionProgressProps {
  label: string;
  status: GenerationStatus;
}

export function SectionProgress({ label, status }: SectionProgressProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Status icon */}
      <div className="w-5 h-5 flex items-center justify-center">
        {status === "done" && (
          <span className="text-green-400 text-sm">✓</span>
        )}
        {status === "generating" && (
          <span className="text-primary text-sm animate-spin">⟳</span>
        )}
        {status === "waiting" && (
          <span className="text-on-surface-variant/40 text-sm">…</span>
        )}
      </div>

      {/* Label */}
      <span
        className={`text-sm flex-1 ${
          status === "done"
            ? "text-on-surface/80"
            : status === "generating"
            ? "text-on-surface font-medium"
            : "text-on-surface-variant/50"
        }`}
      >
        {label}
      </span>

      {/* Progress bar */}
      <div className="w-32 h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        {status === "done" && (
          <div className="h-full bg-green-400 rounded-full w-full transition-all duration-300" />
        )}
        {status === "generating" && (
          <div className="h-full bg-primary rounded-full animate-progress-pulse" />
        )}
      </div>
    </div>
  );
}
