import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { Inline, Tokens } from "@docforge-lib/layout";
import { inlineToHtml, nodeToInline } from "./richText";
import { RunBar, runShortcut, type RunBarHandle } from "./RunBar";

export interface InlineFieldHandle {
  read: () => Inline;
  focus: (where?: "start" | "end") => void;
  element: () => HTMLDivElement | null;
}

interface InlineFieldProps {
  value: Inline;
  tokens: Tokens;
  style?: CSSProperties;
  className?: string;
  placeholder?: string;
  "aria-label": string;
  /** Keys the host handles (Enter to move on, Backspace on empty, Tab to indent): return true to stop here. */
  onKey?: (e: KeyboardEvent<HTMLDivElement>, state: { empty: boolean; atStart: boolean; atEnd: boolean }) => boolean;
  onInput?: () => void;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}

/** Where the caret is inside `el`, for Backspace-at-start and Enter-at-end decisions. */
function caretState(el: HTMLElement): { empty: boolean; atStart: boolean; atEnd: boolean } {
  const text = el.textContent ?? "";
  const empty = !text.trim();
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return { empty, atStart: empty, atEnd: empty };
  const range = selection.getRangeAt(0);
  const before = range.cloneRange();
  before.selectNodeContents(el);
  before.setEnd(range.startContainer, range.startOffset);
  const after = range.cloneRange();
  after.selectNodeContents(el);
  after.setStart(range.endContainer, range.endOffset);
  return { empty, atStart: before.toString().length === 0, atEnd: after.toString().length === 0 };
}

/**
 * One piece of inline text (a card title, a list item, a step's text) edited in a
 * contentEditable with the floating bar: bold, italic, code, link, color, highlight.
 * Never holds a line break: the document's inline text has none.
 */
export const InlineField = forwardRef<InlineFieldHandle, InlineFieldProps>(function InlineField(props, handle) {
  const { value, tokens, style, className, placeholder, onKey, onInput, onPointerDown } = props;
  const ref = useRef<HTMLDivElement>(null);
  const bar = useRef<RunBarHandle>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  // One object for the life of the field (see ParagraphsEditable): React must never rewrite the HTML mid-edit.
  const [html] = useState(() => ({ __html: inlineToHtml(value, tokens) }));

  const focus = (where: "start" | "end" = "end") => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(where === "start");
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  const baseColor = typeof style?.color === "string" ? style.color : undefined;
  useImperativeHandle(handle, () => ({ read: () => (ref.current ? nodeToInline(ref.current, tokens, { baseColor }) : value), focus, element: () => ref.current }), [tokens, value, baseColor]);

  // Keys bubble to the editor that holds the field (it handles Esc and Ctrl+Enter, and keeps the rest from the page).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (el && onKey?.(e, caretState(el))) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      bar.current?.openLink();
      return;
    }
    if (runShortcut(e, tokens)) {
      onInput?.();
      return;
    }
    // Inline text has no line breaks.
    if (e.key === "Enter") e.preventDefault();
  };

  return (
    <>
      <div
        ref={(el) => {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (el !== root) setRoot(el);
        }}
        role="textbox"
        aria-label={props["aria-label"]}
        contentEditable
        suppressContentEditableWarning
        className={className ? `df-inline-field ${className}` : "df-inline-field"}
        data-placeholder={placeholder}
        style={style}
        onKeyDown={onKeyDown}
        onInput={onInput}
        onPointerDown={onPointerDown}
        onPaste={(e) => {
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s*\n\s*/g, " "));
        }}
        dangerouslySetInnerHTML={html}
      />
      <RunBar ref={bar} root={root} tokens={tokens} onChanged={onInput} />
    </>
  );
});
