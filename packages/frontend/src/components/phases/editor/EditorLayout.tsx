import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Section } from "@/types";
import { apiUpdateSectionContent } from "@/utils/api";
import { EditorNavPanel, parseHeadings, type Heading } from "./EditorNavPanel";
import { EditorCenterPanel, type EditorMode } from "./EditorCenterPanel";
import { EditorVersionPanel } from "./EditorVersionPanel";
import { EditorActivityPanel } from "./EditorActivityPanel";
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
  const [showActivity, setShowActivity] = useState(false);
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

      {/* Activity toggle button */}
      <button
        onClick={() => setShowActivity((v) => !v)}
        title={showActivity ? "Hide activity" : "Show activity"}
        style={{
          position: "absolute",
          bottom: 16,
          right: showActivity ? 256 : 16,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "6px 12px",
          borderRadius: 6,
          border: `1px solid ${showActivity ? "rgba(255,77,0,0.4)" : "rgba(255,255,255,0.08)"}`,
          background: showActivity ? "rgba(255,77,0,0.08)" : "rgba(13,14,15,0.85)",
          color: showActivity ? "var(--df-amber-300, #ff8d4a)" : "rgba(200,198,197,0.45)",
          cursor: "pointer",
          fontSize: 11,
          transition: "all 0.2s",
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>history</span>
        <span className="df-mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase" }}>Activity</span>
      </button>

      {showActivity && (
        <EditorActivityPanel
          documentId={documentId}
          refreshTick={activityTick + sseTick}
        />
      )}
    </div>
  );
}
