import { useEffect } from "react";
import { Icon } from "@/components/shared";

const AUTO_DISMISS_MS = 6000;

interface EditorCompletionBannerProps {
  onDismiss: () => void;
}

/** Shown once, right after a BYOA pipeline hands off audit→editing (A-lite,
 * docs/product/pipeline-collaboration-implementation.md Fase 2/6). Auto-
 * dismisses so it never blocks the editor from being usable. */
export function EditorCompletionBanner({ onDismiss }: EditorCompletionBannerProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 16px",
        borderBottom: "1px solid var(--color-outline)",
        background: "var(--color-ok-wash)",
        flexShrink: 0,
      }}
    >
      <Icon name="check_circle" className="!text-[16px] text-ok" />
      <span style={{ fontSize: 13, color: "var(--color-text)", flex: 1 }}>
        Pipeline complete — you're now in the free editor.
      </span>
      <button
        onClick={onDismiss}
        title="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 4,
          display: "flex",
          color: "var(--color-dim)",
        }}
      >
        <Icon name="close" className="!text-[14px]" />
      </button>
    </div>
  );
}
