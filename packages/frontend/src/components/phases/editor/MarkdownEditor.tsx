import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, highlightActiveLine, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, foldGutter, foldKeymap } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export interface MarkdownEditorHandle {
  /** 0-based line to scroll to and put the caret on. */
  goToLine: (line: number) => void;
  /** 0-based line currently at the top of the viewport. */
  topLine: () => number;
  /** Resolve a visual Y coordinate to a document line. */
  lineAtClientY: (clientY: number) => number;
  focus: () => void;
}

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Fires with the 0-based caret line, for the table of contents. */
  onCaretLine?: (line: number) => void;
  onScrollLine?: (line: number) => void;
  placeholderText?: string;
}

/**
 * Markdown source editor.
 *
 * Replaces a bare `<textarea>`: headings, emphasis, code and links now read as
 * what they are while you write, sections fold, and undo history survives.
 * The document is still plain markdown — that is deliberate (revamp plan
 * §2.1), so what the agent reads over MCP is exactly what is on screen.
 */
const theme = EditorView.theme(
  {
    "&": {
      color: "var(--df-on-surface)",
      backgroundColor: "transparent",
      fontSize: "13px",
    },
    ".cm-content": {
      fontFamily: "var(--df-font-mono)",
      lineHeight: "1.7",
      padding: "0",
      caretColor: "var(--df-amber-500)",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-line": { padding: "0" },
    ".cm-activeLine": { backgroundColor: "var(--color-active-line)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      border: "none",
      color: "var(--df-mute)",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--df-surface-high)",
      border: "1px solid var(--df-outline-md)",
      color: "var(--df-faint)",
      borderRadius: "var(--radius-xs)",
      padding: "0 6px",
      margin: "0 4px",
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-heat-selection)",
    },
  },
  { dark: true },
);

/** Markdown syntax colours, drawn from the ramp so they stay in the system. */
const highlight = HighlightStyle.define([
  { tag: tags.heading1, color: "var(--df-on-surface)", fontWeight: "700", fontSize: "1.25em" },
  { tag: tags.heading2, color: "var(--df-on-surface)", fontWeight: "600", fontSize: "1.12em" },
  { tag: [tags.heading3, tags.heading4, tags.heading5], color: "var(--df-on-surface)", fontWeight: "600" },
  { tag: tags.strong, color: "var(--df-on-surface)", fontWeight: "700" },
  { tag: tags.emphasis, color: "var(--df-dim)", fontStyle: "italic" },
  { tag: tags.link, color: "var(--df-amber-300)" },
  { tag: tags.url, color: "var(--df-faint)" },
  { tag: tags.monospace, color: "var(--df-steel-100)" },
  { tag: tags.quote, color: "var(--df-faint)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--df-amber-300)" },
  { tag: tags.processingInstruction, color: "var(--df-mute)" },
  { tag: tags.contentSeparator, color: "var(--df-outline-md)" },
]);

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, onCaretLine, onScrollLine, placeholderText = "# My document\n\n## Section 1\n\nStart writing…" }, ref) {
    const host = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    // Handlers change every render; keep them off the extension list so the
    // editor is never torn down mid-typing.
    const handlers = useRef({ onChange, onCaretLine, onScrollLine });
    handlers.current = { onChange, onCaretLine, onScrollLine };

    useEffect(() => {
      if (!host.current) return;

      const extensions: Extension[] = [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]),
        markdown({ base: markdownLanguage, addKeymap: true }),
        syntaxHighlighting(highlight),
        foldGutter({ openText: "▾", closedText: "▸" }),
        highlightActiveLine(),
        EditorView.lineWrapping,
        placeholder(placeholderText),
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handlers.current.onChange(update.state.doc.toString());
          }
          if (update.selectionSet || update.docChanged) {
            const pos = update.state.selection.main.head;
            handlers.current.onCaretLine?.(update.state.doc.lineAt(pos).number - 1);
          }
          if (update.viewportChanged || update.geometryChanged) {
            const rect = update.view.scrollDOM.getBoundingClientRect();
            const clientY = rect.top + Math.min(120, rect.height * 0.22);
            const block = update.view.lineBlockAtHeight(Math.max(0, clientY - update.view.documentTop));
            handlers.current.onScrollLine?.(update.state.doc.lineAt(block.from).number - 1);
          }
        }),
      ];

      const editor = new EditorView({
        state: EditorState.create({ doc: value, extensions }),
        parent: host.current,
      });
      view.current = editor;
      return () => {
        editor.destroy();
        view.current = null;
      };
      // Mount once: the document is pushed in through the effect below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Outside edits (version switch, SSE push, accepted suggestion) replace the
    // document without disturbing the caret when the text is already right.
    useEffect(() => {
      const editor = view.current;
      if (!editor) return;
      const current = editor.state.doc.toString();
      if (current === value) return;
      editor.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }, [value]);

    useImperativeHandle(ref, () => ({
      goToLine(line: number) {
        const editor = view.current;
        if (!editor) return;
        const target = Math.min(Math.max(line + 1, 1), editor.state.doc.lines);
        const pos = editor.state.doc.line(target).from;
        editor.dispatch({
          selection: { anchor: pos },
          effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 24 }),
        });
        editor.focus();
      },
      topLine() {
        const editor = view.current;
        if (!editor) return 0;
        const top = editor.lineBlockAtHeight(editor.scrollDOM.scrollTop).from;
        return editor.state.doc.lineAt(top).number - 1;
      },
      lineAtClientY(clientY: number) {
        const editor = view.current;
        if (!editor) return 0;
        const block = editor.lineBlockAtHeight(Math.max(0, clientY - editor.documentTop));
        return editor.state.doc.lineAt(block.from).number - 1;
      },
      focus() {
        view.current?.focus();
      },
    }));

    return <div ref={host} style={{ minHeight: "calc(100vh - 240px)" }} />;
  },
);
