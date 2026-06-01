import { useRef, useCallback } from "react";
import { MarkdownRenderer } from "@/components/shared";
import type { Heading } from "./EditorNavPanel";

type EditorMode = "source" | "preview";

interface EditorCenterPanelProps {
  content: string;
  mode: EditorMode;
  headings: Heading[];
  onModeChange: (mode: EditorMode) => void;
  onChange: (value: string) => void;
  onActiveSlugChange: (slug: string | null) => void;
}

export function EditorCenterPanel({
  content,
  mode,
  headings,
  onModeChange,
  onChange,
  onActiveSlugChange,
}: EditorCenterPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Attach IntersectionObserver after preview renders
  const previewRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              onActiveSlugChange(entry.target.id || null);
              break;
            }
          }
        },
        { root: scrollRef.current, rootMargin: "0px 0px -60% 0px", threshold: 0 },
      );

      for (const h of headings) {
        const el = node.querySelector(`#${CSS.escape(h.slug)}`);
        if (el) observerRef.current.observe(el);
      }
    },
    [headings, onActiveSlugChange],
  );

  return (
    <section
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "rgba(255,255,255,0.01)",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "12px 24px",
          borderBottom: "1px solid var(--df-outline, rgba(255,255,255,0.06))",
          background: "rgba(18,20,20,0.6)",
          backdropFilter: "blur(8px)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            padding: 3,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(["source", "preview"] as EditorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              style={{
                padding: "5px 14px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: mode === m ? "var(--df-surface-container-highest, rgba(255,255,255,0.08))" : "transparent",
                color: mode === m ? "var(--df-on-surface, #e3e2e2)" : "rgba(227,226,226,0.45)",
                transition: "all 0.15s",
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto" }}
        className="hide-scrollbar editor-content"
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 56px 80px" }}>
          {mode === "preview" ? (
            <div ref={previewRef}>
              <MarkdownRenderer
                content={content}
                variant="editor"
                headingIds
              />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => onChange(e.target.value)}
              placeholder={"# My Document\n\n## Section 1\n\nStart writing..."}
              style={{
                width: "100%",
                minHeight: "calc(100vh - 200px)",
                background: "transparent",
                border: "none",
                color: "var(--df-on-surface, #e3e2e2)",
                fontFamily: "var(--df-font-mono, 'JetBrains Mono', monospace)",
                fontSize: 13,
                lineHeight: 1.7,
                resize: "none",
                outline: "none",
              }}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export { type EditorMode };
