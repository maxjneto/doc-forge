import { useRef, useCallback } from "react";
import { useWorkspaceStore, SECTION_LABELS } from "@/store";
import { Icon, MarkdownRenderer } from "../shared";
import type { SectionType } from "@/types";

type EditorMode = "source" | "preview";

// ─── Editor Toolbar ──────────────────────────────────────────

function EditorToolbar({
  mode,
  onModeChange,
  isReadonly,
}: {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  isReadonly: boolean;
}) {
  return (
    <div className="flex items-center justify-center px-6 py-3 border-b border-outline-variant/20 bg-surface/40 backdrop-blur-md gap-4">
      <div className="flex items-center bg-surface-container-high/50 p-0.5 rounded-lg border border-outline-variant/10">
        <button
          onClick={() => onModeChange("source")}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            mode === "source"
              ? "text-on-surface bg-surface-container-highest shadow-sm"
              : "text-on-surface-variant/60 hover:text-on-surface"
          }`}
        >
          Source
        </button>
        <button
          onClick={() => onModeChange("preview")}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            mode === "preview"
              ? "text-on-surface bg-surface-container-highest shadow-sm"
              : "text-on-surface-variant/60 hover:text-on-surface"
          }`}
        >
          Preview
        </button>
      </div>
      {isReadonly && (
        <span className="flex items-center gap-1 text-[11px] text-on-surface-variant/50 font-medium">
          <Icon name="lock" className="!text-[14px]" />
          Read-only
        </span>
      )}
    </div>
  );
}

// ─── Markdown Preview ────────────────────────────────────────

function MarkdownPreview({ content }: { content: string }) {
  return <MarkdownRenderer content={content} variant="editor" />;
}

// ─── Source Editor ────────────────────────────────────────────

function SourceEditor({
  content,
  readonly,
  onChange,
}: {
  content: string;
  readonly: boolean;
  onChange: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <div className="w-full h-full relative">
      <textarea
        ref={textareaRef}
        readOnly={readonly}
        value={content}
        onChange={handleChange}
        className={`w-full h-full bg-transparent text-on-surface-variant/90 font-mono text-sm leading-relaxed resize-none focus:outline-none p-0 ${
          readonly ? "cursor-default opacity-70" : ""
        }`}
      />
    </div>
  );
}

// ─── Section Tab Strip ───────────────────────────────────────

const SECTION_ORDER: SectionType[] = ["context", "proposal", "implementation", "risks"];

function SectionTabStrip() {
  const sections = useWorkspaceStore((s) => s.sections);
  const activeSection = useWorkspaceStore((s) => s.activeSection);
  const setActiveSection = useWorkspaceStore((s) => s.setActiveSection);

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-outline-variant/20 bg-surface/30 overflow-x-auto hide-scrollbar">
      {SECTION_ORDER.map((type) => {
        const section = sections.find((s) => s.sectionType === type);
        const status = section?.status ?? "pending";
        const isActive = activeSection === type;
        const isFinalized = status === "finalized";

        return (
          <button
            key={type}
            onClick={() => setActiveSection(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              isActive
                ? "bg-primary/10 text-primary border border-primary/25"
                : "text-on-surface-variant/60 hover:text-on-surface hover:bg-surface-container-high/40 border border-transparent"
            }`}
          >
            {isFinalized ? (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
            ) : isActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant/25 shrink-0" />
            )}
            {SECTION_LABELS[type]}
          </button>
        );
      })}
    </div>
  );
}

// ─── Editor Panel ────────────────────────────────────────────

export function EditorPanel() {
  const editorMode = useWorkspaceStore((s) => s.editorMode);
  const setEditorMode = useWorkspaceStore((s) => s.setEditorMode);
  const content = useWorkspaceStore((s) => s.getActiveVersionContent());
  const viewMode = useWorkspaceStore((s) => s.getActiveViewMode());
  const updateContent = useWorkspaceStore((s) => s.updateActiveContent);

  const isReadonly = viewMode === "readonly" || viewMode === "locked";

  return (
    <section className="w-[60%] h-full flex flex-col relative bg-surface/10">
      <SectionTabStrip />
      <EditorToolbar
        mode={editorMode}
        onModeChange={setEditorMode}
        isReadonly={isReadonly}
      />

      <div className="flex-1 overflow-y-auto px-12 pt-12 hide-scrollbar flex justify-center">
        <div className="w-full max-w-[800px]">
          {editorMode === "preview" ? (
            <MarkdownPreview content={content} />
          ) : (
            <SourceEditor
              content={content}
              readonly={isReadonly}
              onChange={updateContent}
            />
          )}
          <div className="h-32" />
        </div>
      </div>
    </section>
  );
}
