import { useEffect } from "react";
import type { RefObject } from "react";
import type { Heading } from "./documentStructure";

interface DocumentScrollSpyOptions {
  scrollRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  headings: Heading[];
  enabled?: boolean;
  onActiveSlugChange: (slug: string | null) => void;
}

export function scrollToDocumentHeading(
  scroll: HTMLElement | null,
  content: HTMLElement | null,
  slug: string,
) {
  if (!scroll || !content) return false;
  const element = Array.from(content.querySelectorAll<HTMLElement>("[id]"))
    .find((candidate) => candidate.id === slug);
  if (!element) return false;
  const top = element.getBoundingClientRect().top
    - scroll.getBoundingClientRect().top
    + scroll.scrollTop
    - 24;
  scroll.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  return true;
}

/** Keep a table of contents aligned with the prose occupying the reading line. */
export function useDocumentScrollSpy({
  scrollRef,
  contentRef,
  headings,
  enabled = true,
  onActiveSlugChange,
}: DocumentScrollSpyOptions) {
  useEffect(() => {
    if (!enabled) return;
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (!scroll || !content) return;
    let frame = 0;

    function update() {
      frame = 0;
      if (headings.length === 0) {
        onActiveSlugChange(null);
        return;
      }

      const rootRect = scroll!.getBoundingClientRect();
      const readingLine = rootRect.top + Math.min(120, rootRect.height * 0.22);
      let active: string | null = null;
      const renderedHeadings = Array.from(
        content!.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id], h4[id], h5[id]"),
      );

      for (const element of renderedHeadings) {
        if (element.getBoundingClientRect().top <= readingLine) active = element.id;
        else break;
      }

      const canScroll = scroll!.scrollHeight > scroll!.clientHeight + 4;
      const atBottom = canScroll && scroll!.scrollTop + scroll!.clientHeight >= scroll!.scrollHeight - 4;
      if (atBottom) active = renderedHeadings[renderedHeadings.length - 1]?.id ?? active;
      onActiveSlugChange(active ?? renderedHeadings[0]?.id ?? headings[0]?.slug ?? null);
    }

    function scheduleUpdate() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    scroll.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();
    return () => {
      scroll.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [contentRef, enabled, headings, onActiveSlugChange, scrollRef]);
}
