import { useState, useEffect, useRef, useCallback } from "react";
import posthog from "posthog-js";
import type { Section } from "@/types";
import { EditorNavPanel, parseHeadings, type Heading } from "./EditorNavPanel";
import { EditorCenterPanel, type EditorMode } from "./EditorCenterPanel";
import { EditorVersionPanel } from "./EditorVersionPanel";
import { EditorActivityRail } from "./EditorActivityRail";
import { EditorSuggestionPanel } from "./EditorSuggestionPanel";
import { EditorGatePanel } from "./EditorGatePanel";

interface EditorLayoutProps {
  documentId: string;
  sections: Section[];
  sseTick: number;
}

export function EditorLayout({ documentId, sections, sseTick }: EditorLayoutProps) {
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

  const bumpActivity = useCallback(() => setActivityTick((n) => n + 1), []);

  const handleChange = (value: string) => setContent(value);

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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            borderLeft: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
            width: 240,
            overflow: "hidden",
          }}
        >
          <EditorGatePanel documentId={documentId} refreshTick={sseTick + activityTick} />
          <EditorSuggestionPanel
            documentId={documentId}
            refreshTick={sseTick}
            onSuggestionResolved={bumpActivity}
          />
          <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
            <EditorVersionPanel
              sectionId={bodySection.id}
              documentId={documentId}
              currentContent={content}
              refreshTick={sseTick + activityTick}
              onVersionSwitch={(c) => { handleVersionSwitch(c); bumpActivity(); }}
            />
          </div>
        </div>
      )}

    </div>
  );
}
