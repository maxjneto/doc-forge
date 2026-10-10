import { useRef, useCallback } from "react";
import { useWorkspaceStore } from "@/store";
import { Icon, MarkdownRenderer } from "../shared";

import { useI18n } from "@/i18n";
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
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center px-6 py-3 border-b border-outline bg-surface/60 backdrop-blur-md gap-4">
      <div className="flex items-center bg-surface-mid/50 p-0.5 rounded-sm border border-outline">
        <button
          onClick={() => onModeChange("source")}
          className={`px-3 py-1 text-body-sm font-medium rounded-xs transition-colors ${
            mode === "source"
              ? "text-text bg-surface-high shadow-sm"
              : "text-faint hover:text-text"
          }`}
        >
          {t("editor.source")}
        </button>
        <button
          onClick={() => onModeChange("preview")}
          className={`px-3 py-1 text-body-sm font-medium rounded-xs transition-colors ${
            mode === "preview"
              ? "text-text bg-surface-high shadow-sm"
              : "text-faint hover:text-text"
          }`}
        >
          {t("editor.preview")}
        </button>
      </div>
      {isReadonly && (
        <span className="flex items-center gap-1 text-caption text-faint font-medium">
          <Icon name="lock" className="!text-[14px]" />
          {t("g.ws.readOnly")}
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
        className={`w-full h-full bg-transparent text-dim font-mono text-body leading-relaxed resize-none focus:outline-none p-0 ${
          readonly ? "cursor-default opacity-70" : ""
        }`}
      />
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
