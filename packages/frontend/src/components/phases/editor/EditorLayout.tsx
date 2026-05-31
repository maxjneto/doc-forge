import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import posthog from "posthog-js";
import type { Section } from "@/types";
import { apiUpdateSectionContent } from "@/utils/api";
import { EditorNavPanel, parseHeadings, type Heading } from "./EditorNavPanel";
import { EditorCenterPanel, type EditorMode } from "./EditorCenterPanel";
import { EditorVersionPanel } from "./EditorVersionPanel";
import { EditorActivityRail } from "./EditorActivityRail";

interface EditorLayoutProps {
  documentId: string;
  sections: Section[];
  sseTick: number;
}

export function EditorLayout({ documentId, sections, sseTick }: EditorLayoutProps) {
  const { getToken } = useAuth();

  const bodySection = sections.find((s) => s.sectionType === "body");
  const initialContent = (bodySection?.activeVersionContent ?? "").trim();

  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<EditorMode>("source");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [headings, setHeadings] = useState<Heading[]>(() => parseHeadings(initialContent));
  const [activityTick, setActivityTick] = useState(0);

  // Keep content in sync when sections prop updates (e.g. SSE push)
  const lastSectionContent = useRef(initialContent);
  useEffect(() => {
    const incoming = (bodySection?.activeVersionContent ?? "").trim();
    if (incoming !== lastSectionContent.current) {
      lastSectionContent.current = incoming;
      setContent(incoming);
    }
  }, [bodySection?.activeVersionContent]);

  // Re-parse headings whenever content changes
  useEffect(() => {
    setHeadings(parseHeadings(content));
  }, [content]);

  // Bump activityTick after auto-save so the panel refreshes
  const bumpActivity = useCallback(() => setActivityTick((n) => n + 1), []);

  // Auto-save debounce — 1.5s after last keystroke
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedContentRef = useRef(initialContent);
  // Use a ref so flushSave always captures the latest content without stale closure
  const contentRef = useRef(initialContent);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    contentRef.current = value;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!bodySection || value === savedContentRef.current) return;
      try {
        await apiUpdateSectionContent(bodySection.id, value, getToken);
        savedContentRef.current = value;
        posthog.capture("refinement_local_changes_saved", { document_id: documentId, section_id: bodySection.id, content_length: value.length });
      } catch {
        // silent — next keystroke will retry
      }
    }, 1500);
  }, [bodySection, getToken]);

  // Immediately cancel the debounce and flush any unsaved content to the backend.
  // Call this before switching versions so the current edit is never lost.
  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const current = contentRef.current;
    if (!bodySection || current === savedContentRef.current) return;
    try {
      await apiUpdateSectionContent(bodySection.id, current, getToken);
      savedContentRef.current = current;
    } catch {
      // best-effort
    }
  }, [bodySection, getToken]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  function handleNavigate(slug: string) {
    setMode("preview");
    // Small delay to allow preview to render before scrolling
    setTimeout(() => {
      const el = document.getElementById(slug);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSlug(slug);
    }, 50);
  }

  function handleExport() {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
    a.click();
    URL.revokeObjectURL(url);
    posthog.capture("document_exported", { document_id: documentId, export_format: "markdown" });
  }

  function handleVersionSwitch(switchedContent: string) {
    // Cancel any pending auto-save so the old version's content doesn't
    // get written to the newly-active version after we switch.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    contentRef.current = switchedContent;
    savedContentRef.current = switchedContent;
    lastSectionContent.current = switchedContent;
    setContent(switchedContent);
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        paddingTop: 56,
        display: "flex",
        overflow: "hidden",
        background: "var(--df-bg, #0a0b0c)",
      }}
    >
      <EditorNavPanel
        headings={headings}
        activeSlug={activeSlug}
        onNavigate={handleNavigate}
        onExport={handleExport}
        activitySlot={
          <EditorActivityRail documentId={documentId} refreshTick={activityTick + sseTick} />
        }
      />

      <EditorCenterPanel
        content={content}
        mode={mode}
        headings={headings}
        onModeChange={setMode}
        onChange={handleChange}
        onActiveSlugChange={setActiveSlug}
      />

      {bodySection && (
        <EditorVersionPanel
          sectionId={bodySection.id}
          currentContent={content}
          refreshTick={sseTick}
          onVersionSwitch={(c) => { handleVersionSwitch(c); bumpActivity(); }}
          onFlushSave={flushSave}
        />
      )}

    </div>
  );
}
