import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import type { Section, SectionType } from "@/types";
import { apiUpdateCompletedDocument } from "@/utils/api";
import { MarkdownRenderer } from "@/components/shared";

const SECTION_ORDER: SectionType[] = [
  "context",
  "proposal",
  "implementation",
  "risks",
];

const SECTION_HEADINGS: Record<SectionType, string> = {
  context: "Context",
  proposal: "Proposal",
  implementation: "Implementation",
  risks: "Risks & Alternatives",
};

interface CompletedLayoutProps {
  documentId: string;
  sections: Section[];
  onSaved?: () => void;
}

function buildMergedMarkdown(sections: Section[]): string {
  const byType = new Map(sections.map((section) => [section.sectionType, section]));

  return SECTION_ORDER.map((sectionType) => {
    const section = byType.get(sectionType);
    const content = (section?.activeVersionContent ?? "").trim();
    return `## ${SECTION_HEADINGS[sectionType]}\n\n${content}`;
  }).join("\n\n");
}

function parseMergedMarkdown(markdown: string): Record<SectionType, string> | null {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();

  const pattern = /^##\s*Context\s*\n([\s\S]*?)\n##\s*Proposal\s*\n([\s\S]*?)\n##\s*Implementation\s*\n([\s\S]*?)\n##\s*Risks\s*(?:&|and)\s*Alternatives\s*\n([\s\S]*)$/i;
  const matches = normalized.match(pattern);
  if (!matches) {
    return null;
  }

  return {
    context: matches[1].trim(),
    proposal: matches[2].trim(),
    implementation: matches[3].trim(),
    risks: matches[4].trim(),
  };
}

type PanelMode = "source" | "preview";

export function CompletedLayout({ documentId, sections, onSaved }: CompletedLayoutProps) {
  const { getToken } = useAuth();
  const initialContent = useMemo(() => buildMergedMarkdown(sections), [sections]);
  const [content, setContent] = useState(initialContent);
  const [mode, setMode] = useState<PanelMode>("preview");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setContent(initialContent);
    }
  }, [initialContent, dirty]);

  const handleSave = async () => {
    const parsed = parseMergedMarkdown(content);
    if (!parsed) {
      setError(
        "Could not map edits to sections. Keep all four section headings: Context, Proposal, Implementation, and Risks & Alternatives."
      );
      setSaved(false);
      return;
    }

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      await apiUpdateCompletedDocument(documentId, [
        { section_type: "context", content: parsed.context },
        { section_type: "proposal", content: parsed.proposal },
        { section_type: "implementation", content: parsed.implementation },
        { section_type: "risks", content: parsed.risks },
      ], getToken);
      setDirty(false);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save completed document");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfc-${documentId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full pt-[64px] flex flex-col px-4 md:px-6 overflow-hidden">
      <div className="max-w-5xl w-full mx-auto py-6 md:py-8 h-full flex flex-col gap-4 md:gap-5">
        <div className="rounded-xl p-4 bg-primary/10 border border-primary/30">
          <p className="text-sm text-on-surface font-medium">
            Document completed. You can now edit the full RFC directly (no agentic actions).
          </p>
          <p className="text-xs text-on-surface-variant/70 mt-1">
            Keep the four section headings so edits can be saved back to the document.
          </p>
        </div>

        <div className="panel-depth rounded-xl bg-surface-container-low border border-outline-variant/20 flex-1 min-h-0 flex flex-col">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/15 shrink-0 bg-surface/40 backdrop-blur-md">
            <div className="flex items-center bg-surface-container-high/50 p-0.5 rounded-lg border border-outline-variant/10">
              <button
                onClick={() => setMode("source")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  mode === "source"
                    ? "text-on-surface bg-surface-container-highest shadow-sm"
                    : "text-on-surface-variant/60 hover:text-on-surface"
                }`}
              >
                Source
              </button>
              <button
                onClick={() => setMode("preview")}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  mode === "preview"
                    ? "text-on-surface bg-surface-container-highest shadow-sm"
                    : "text-on-surface-variant/60 hover:text-on-surface"
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar">
            {mode === "preview" ? (
              <div className="px-12 pt-10 pb-8 max-w-[800px] mx-auto">
                <MarkdownRenderer content={content} variant="editor" />
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  setDirty(true);
                  setSaved(false);
                }}
                className="w-full h-full bg-transparent resize-none px-12 pt-10 font-mono text-sm leading-7 text-on-surface outline-none"
                spellCheck={false}
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pb-4 md:pb-0">
          <div className="text-xs text-on-surface-variant/70 min-h-[1rem]">
            {error ? <span className="text-error">{error}</span> : null}
            {!error && saved ? <span className="text-green-400">Saved.</span> : null}
            {!error && !saved && dirty ? <span>Unsaved changes.</span> : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm hover:brightness-110 transition-all border border-outline-variant/20"
            >
              Export Markdown
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
