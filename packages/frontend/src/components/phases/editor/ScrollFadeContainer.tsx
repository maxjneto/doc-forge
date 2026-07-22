import { useRef, useState, useCallback, useEffect } from "react";

interface ScrollFadeContainerProps {
  children: React.ReactNode;
  fadeColor: string;
  className?: string;
}

/**
 * Fills all remaining flex space with a single scrollable region, showing a
 * bottom fade-out gradient when there's more content below the fold — so a
 * cut reads as "scroll for more", not "broken". The fade hides itself once
 * scrolled to the bottom. Meant to be the ONE scroll owner per tab pane —
 * nesting one of these inside another creates a scroll trap (the inner one
 * captures wheel input and the outer one never reaches its own bottom).
 */
export function ScrollFadeContainer({ children, fadeColor, className }: ScrollFadeContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  const recompute = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setShowFade(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);

  useEffect(() => {
    recompute();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  });

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div
        ref={ref}
        onScroll={recompute}
        className={className ?? "hide-scrollbar"}
        style={{ flex: 1, minHeight: 0, overflowY: "auto" }}
      >
        {children}
      </div>
      {showFade && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 28,
            background: `linear-gradient(rgba(0,0,0,0), ${fadeColor})`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
