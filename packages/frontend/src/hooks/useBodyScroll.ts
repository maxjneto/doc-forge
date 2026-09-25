import { useEffect } from "react";

/**
 * `body` is `overflow: hidden` globally so the document workspaces can own
 * their scroll containers. Regular pages (dashboard, settings, marketing,
 * legal) opt back into page scroll with this hook, which restores the
 * default on unmount.
 */
export function useBodyScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
}
