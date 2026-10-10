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
          <span className="text-ok text-body">✓</span>
        )}
        {status === "generating" && (
          <span className="text-heat-hi text-body animate-spin">⟳</span>
        )}
        {status === "waiting" && (
          <span className="text-faint text-body">…</span>
        )}
      </div>

      {/* Label */}
      <span
        className={`text-body flex-1 ${
          status === "done"
            ? "text-text"
            : status === "generating"
            ? "text-text font-medium"
            : "text-faint"
        }`}
      >
        {label}
      </span>

      {/* Progress bar */}
      <div className="w-32 h-1.5 bg-surface-high rounded-full overflow-hidden">
        {status === "done" && (
          <div className="h-full bg-ok rounded-full w-full transition-all duration-300" />
        )}
        {status === "generating" && (
          <div className="h-full bg-heat rounded-full animate-progress-pulse" />
        )}
      </div>
    </div>
  );
}
