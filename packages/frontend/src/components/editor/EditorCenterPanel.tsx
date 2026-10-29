import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, type ReactNode } from "react";
import { MarkdownRenderer } from "@/components/shared";
import { headingAtLine, type Heading } from "@/utils/documentStructure";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { EditorDiffView, EditorChangeBar } from "./EditorDiffView";
import type { Hunk } from "@/utils/diff";
import type { Artifact } from "@/types";
import { ArtifactInlineCard, ArtifactDetail } from "./EditorArtifactPanel";
import { EditorFindingCallout } from "./EditorFindingCallout";
import { resolveAnchor } from "@/utils/documentStructure";
import type { AuditFinding } from "@/types";
import { scrollToDocumentHeading, useDocumentScrollSpy } from "@/utils/useDocumentScrollSpy";
import { useI18n } from "@/i18n";

/** `::artefato[key]` — the explicit anchor an agent writes into the body. */
const ARTIFACT_DIRECTIVE = /^::artefato\[([a-z0-9][a-z0-9-]*)\]\s*$/gm;

type EditorMode = "source" | "preview" | "diff";

export interface EditorCenterHandle {
  /** Scroll to a section — in whichever mode is open, without switching. */
  navigateTo: (slug: string) => void;
  /** The passage the reader selected, in source or preview ("" when none). */
  selection: () => string;
}

interface EditorCenterPanelProps {
  content: string;
  mode: EditorMode;
  headings: Heading[];
  /** Read or comment only: the source opens without a cursor. */
  readOnly?: boolean;
  /** Tools at the end of the toolbar (commenting). */
  tools?: ReactNode;
  /** Pending changes, shown when mode is "diff". */
  hunks?: Hunk[];
  activeHunk?: number;
  onHunkSelect?: (index: number) => void;
  onHunkStep?: (delta: number) => void;
  decisions?: Record<number, import("./EditorDiffView").HunkDecision>;
  artifacts?: Artifact[];
  /** Open gate findings, drawn where they land in the text. */
  findings?: AuditFinding[];
  /** When set, the centre panel shows this artifact instead of the document. */
  openArtifact?: Artifact | null;
  onCloseArtifact?: () => void;
  onOpenArtifact?: (artifact: Artifact) => void;
  onAnchorArtifact?: (artifact: Artifact) => void;
  onMoveArtifactAnchor?: (artifact: Artifact) => void;
  /** Heading the reader is on, used as the target for "Inserir em". */
  activeHeading?: Heading | null;
  onModeChange: (mode: EditorMode) => void;
  onChange: (value: string) => void;
  onActiveSlugChange: (slug: string | null) => void;
}

export const EditorCenterPanel = forwardRef<EditorCenterHandle, EditorCenterPanelProps>(
  function EditorCenterPanel(
    {
      content,
      mode,
      headings,
      readOnly = false,
      tools,
      hunks = [],
      activeHunk = 1,
      onHunkSelect,
      onHunkStep,
      decisions = {},
      artifacts = [],
      findings = [],
      openArtifact = null,
      onCloseArtifact,
      onOpenArtifact,
      onAnchorArtifact,
      onMoveArtifactAnchor,
      activeHeading = null,
      onModeChange,
      onChange,
      onActiveSlugChange,
    },
    ref,
  ) {
    const { t } = useI18n();
    const scrollRef = useRef<HTMLDivElement>(null);
    const previewContentRef = useRef<HTMLDivElement>(null);
    const sourceRef = useRef<MarkdownEditorHandle>(null);
    const sourceScrollFrame = useRef(0);

    // ─── Preview: track by intersection ─────────────────────────
    useDocumentScrollSpy({
      scrollRef,
      contentRef: previewContentRef,
      headings,
      enabled: mode === "preview" && !openArtifact,
      onActiveSlugChange,
    });

    // ─── Source: CodeMirror reports caret and scroll directly ───
    // The nav used to freeze while writing, because only the preview had an
    // observer — and source is the default mode, so it froze most of the time.

    const reportLine = useCallback(
      (line: number) => onActiveSlugChange(headingAtLine(headings, line)?.slug ?? null),
      [headings, onActiveSlugChange],
    );

    const reportSourceViewport = useCallback(() => {
      if (mode !== "source") return;
      if (sourceScrollFrame.current) window.cancelAnimationFrame(sourceScrollFrame.current);
      sourceScrollFrame.current = window.requestAnimationFrame(() => {
        sourceScrollFrame.current = 0;
        const scroll = scrollRef.current;
        if (!scroll) return;
        const rect = scroll.getBoundingClientRect();
        const readingY = rect.top + Math.min(120, rect.height * 0.22);
        reportLine(sourceRef.current?.lineAtClientY(readingY) ?? 0);
      });
    }, [mode, reportLine]);

    useEffect(() => {
      if (mode === "source") reportSourceViewport();
      return () => {
        if (sourceScrollFrame.current) window.cancelAnimationFrame(sourceScrollFrame.current);
      };
    }, [mode, reportSourceViewport]);

    useImperativeHandle(
      ref,
      () => ({
        navigateTo(slug: string) {
          const heading = headings.find((h) => h.slug === slug);
          if (!heading) return;

          if (mode === "preview") {
            scrollToDocumentHeading(scrollRef.current, previewContentRef.current, slug);
            return;
          }
          sourceRef.current?.goToLine(heading.line);
        },
        selection() {
          if (mode === "source") return sourceRef.current?.selectedText() ?? "";
          const picked = window.getSelection();
          if (!picked || picked.isCollapsed || !scrollRef.current?.contains(picked.anchorNode)) return "";
          return picked.toString();
        },
      }),
      [headings, mode],
    );

    return (
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "var(--color-hover)",
        }}
      >
        {/* Toolbar: how to look at the text, then the tools — the same strip the layout editor has. */}
        <div role="toolbar" aria-label={t("doc.toolbar")} className="df-doc-toolbar">
          <div role="radiogroup" aria-label={t("doc.view")} className="df-seg" style={{ flex: "0 0 auto" }}>
            {(hunks.length > 0
              ? (["source", "preview", "diff"] as EditorMode[])
              : (["source", "preview"] as EditorMode[])
            ).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                aria-pressed={mode === m}
                onClick={() => onModeChange(m)}
                style={{ padding: "5px 14px" }}
              >
                {t(m === "source" ? "editor.source" : m === "preview" ? "editor.preview" : "editor.diff")}
                {m === "diff" && hunks.length > 0 ? ` ${hunks.length}` : ""}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          {tools}
        </div>

        {/* `CHANGE n OF m` — only meaningful while reading the diff */}
        {mode === "diff" && (
          <EditorChangeBar
            hunks={hunks}
            activeIndex={activeHunk}
            onPrev={() => onHunkStep?.(-1)}
            onNext={() => onHunkStep?.(1)}
          />
        )}

        {/* Content */}
        <div
          ref={scrollRef}
          onScroll={reportSourceViewport}
          style={{ flex: 1, overflowY: "auto" }}
          className="df-scroll-thin editor-content"
        >
          {openArtifact ? (
            <div>
              <div style={{ padding: "12px 40px 0" }}>
                <button
                  onClick={onCloseArtifact}
                  className="df-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "var(--tracking-label)",
                    color: "var(--color-faint)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  ← {t("editor.backToDocument").toUpperCase()}
                </button>
              </div>
              <ArtifactDetail
                artifact={openArtifact}
                documentContent={content}
                currentSection={activeHeading}
                onAnchor={onAnchorArtifact}
                onMoveAnchor={onMoveArtifactAnchor}
              />
            </div>
          ) : mode === "diff" ? (
            <EditorDiffView
              hunks={hunks}
              activeIndex={activeHunk}
              decisions={decisions}
              onSelect={(i) => onHunkSelect?.(i)}
            />
          ) : (
          <div
            style={{
              maxWidth: 820,
              margin: "0 auto",
              padding: "40px 56px 80px",
            }}
          >
            {mode === "preview" ? (
              <div ref={previewContentRef}>
                {(() => {
                  type Insert =
                    | { at: number; skip: number; node: React.ReactNode }
                    | { at: number; skip: number; finding: AuditFinding; precision: ReturnType<typeof resolveAnchor>["precision"] };

                  const inserts: Insert[] = [];

                  // Artifact directives: explicit anchors, exact by construction.
                  ARTIFACT_DIRECTIVE.lastIndex = 0;
                  for (
                    let m = ARTIFACT_DIRECTIVE.exec(content);
                    m !== null;
                    m = ARTIFACT_DIRECTIVE.exec(content)
                  ) {
                    const key = m[1];
                    inserts.push({
                      at: m.index,
                      skip: m[0].length,
                      node: (
                        <ArtifactInlineCard
                          artifact={artifacts.find((a) => a.key === key)}
                          onOpen={
                            onOpenArtifact
                              ? () => {
                                  const found = artifacts.find((a) => a.key === key);
                                  if (found) onOpenArtifact(found);
                                }
                              : undefined
                          }
                        />
                      ),
                    });
                  }

                  // Findings: resolved anchors, which may have degraded.
                  for (const f of findings) {
                    if (!f.quote) continue;
                    const r = resolveAnchor(content, { quote: f.quote }, headings);
                    if (r.precision === "document") continue;
                    inserts.push({ at: r.start, skip: 0, finding: f, precision: r.precision });
                  }

                  inserts.sort((a, b) => a.at - b.at);

                  const out: React.ReactNode[] = [];
                  let last = 0;
                  let key = 0;
                  for (const ins of inserts) {
                    const before = content.slice(last, ins.at);
                    if (before.trim()) {
                      out.push(
                        <MarkdownRenderer key={`md-${key++}`} content={before} variant="editor" headingIds />,
                      );
                    }
                    if ("finding" in ins) {
                      // Give the callout the paragraph it sits in, so the
                      // phrase can be underlined in context.
                      const paraEnd = content.indexOf("\n\n", ins.at);
                      out.push(
                        <EditorFindingCallout
                          key={`gate-${key++}`}
                          finding={ins.finding}
                          precision={ins.precision}
                          paragraph={content.slice(ins.at, paraEnd === -1 ? undefined : paraEnd)}
                        />,
                      );
                      // The prose it quotes is rendered inside the callout.
                      last = paraEnd === -1 ? content.length : paraEnd;
                    } else {
                      out.push(<div key={`art-${key++}`}>{ins.node}</div>);
                      last = ins.at + ins.skip;
                    }
                  }
                  const rest = content.slice(last);
                  if (rest.trim() || out.length === 0) {
                    out.push(
                      <MarkdownRenderer key={`md-${key++}`} content={rest} variant="editor" headingIds />,
                    );
                  }
                  return out;
                })()}
              </div>
            ) : (
              <MarkdownEditor
                key={t("editor.markdownPlaceholder")}
                placeholderText={t("editor.markdownPlaceholder")}
                ref={sourceRef}
                readOnly={readOnly}
                value={content}
                onChange={onChange}
                onCaretLine={reportLine}
                onScrollLine={reportLine}
              />
            )}
          </div>
          )}
        </div>

      </section>
    );
  },
);

export { type EditorMode };
