import { useRef, useCallback } from "react";
import { useWorkspaceStore } from "@/store";
import { Icon, MarkdownRenderer } from "../shared";

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

// ─── Locked Overlay ──────────────────────────────────────────

function LockedOverlay() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", width: "320px" }}>
        <div className="w-12 h-12 rounded-full bg-surface-container-high/50 border border-outline-variant/20 flex items-center justify-center mx-auto mb-4">
          <Icon name="lock" className="text-on-surface-variant/40 !text-xl" />
        </div>
        <h3 className="text-sm font-semibold text-on-surface/80 mb-2">
          Section not yet available
        </h3>
        <p className="text-xs text-on-surface-variant/50 leading-relaxed">
          You need to finalize the previous section before working on this one.
          Follow the order: Context → Proposal → Implementation → Risks.
        </p>
      </div>
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

  const isReadonly = viewMode === "readonly";
  const isLocked = viewMode === "locked";

  if (isLocked) {
    return (
      <section className="w-[60%] h-full relative bg-surface/10">
        <LockedOverlay />
      </section>
    );
  }

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
