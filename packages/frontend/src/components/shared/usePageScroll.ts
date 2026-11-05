import { useEffect } from "react";

/**
 * The body doesn't scroll by default: the document editor fills the screen and
 * scrolls its own panes. Every other page is a normal scrolling page and turns
 * the body's scroll on while it is mounted.
 */
export function usePageScroll() {
  useEffect(() => {
    document.body.style.overflow = "auto";
    return () => { document.body.style.overflow = ""; };
  }, []);
}
