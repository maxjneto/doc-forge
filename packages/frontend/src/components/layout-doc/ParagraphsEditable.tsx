import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";
import type { Inline, TextRole, Tokens } from "@docforge-lib/layout";
import { inlineToHtml, nodeToInline, plainText } from "./richText";
import { RunBar, runShortcut, type RunBarHandle } from "./RunBar";

export type Paragraph = string | { role?: TextRole; text: Inline };

export interface ParagraphsHandle {
  /** The paragraphs as the document should keep them (roles, markdown or runs). */
  read: () => Paragraph[];
  /** The role of the paragraph under the caret, if any. */
  currentRole: () => TextRole | null;
  focus: (where?: "start" | "end") => void;
  element: () => HTMLDivElement | null;
}

interface ParagraphsEditableProps {
  paragraphs: Paragraph[];
  defaultRole: TextRole;
  tokens: Tokens;
  /** Inline CSS for a paragraph of this role (the page's own look, or the panel's). */
  css: (role: TextRole) => string;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  autoFocus?: "start" | "end" | false;
  /** A paragraph's HTML when it has no text (so the caret has a place). */
  placeholder?: string;
  /** Keys the host handles first (Esc, Ctrl+Enter, "/"): return true to stop here. */
  onKey?: (e: KeyboardEvent<HTMLDivElement>) => boolean;
  onInput?: () => void;
  onBlur?: (e: FocusEvent<HTMLDivElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
}

const normalizeParagraph = (p: Paragraph, defaultRole: TextRole): { role: TextRole; text: Inline } =>
  typeof p === "string" ? { role: defaultRole, text: p } : { role: p.role ?? defaultRole, text: p.text };

/** Paragraphs → one `[data-role]` block each, styled like the page. */
export function paragraphsToHtml(paragraphs: Paragraph[], defaultRole: TextRole, tokens: Tokens, css: (role: TextRole) => string): string {
  return (paragraphs.length ? paragraphs : [""])
    .map((p) => {
      const { role, text } = normalizeParagraph(p, defaultRole);
      return `<div data-role="${role}" style="${css(role)}">${inlineToHtml(text, tokens) || "<br>"}</div>`;
    })
    .join("");
}

/** The color a role's CSS gives its text (so a run in that color reads as unmarked). */
const cssColor = (css: string): string | undefined => /(?:^|;)\s*color:\s*([^;]+)/.exec(css)?.[1]?.trim();

/** The blocks of a paragraphs editor, read back; blank ones dropped; the default role left implicit. */
export function readParagraphs(el: HTMLElement, defaultRole: TextRole, tokens: Tokens, skip?: (text: string) => boolean, css?: (role: TextRole) => string): Paragraph[] {
  const blocks = [...el.children].length ? [...el.children] : [el];
  return blocks
    .map((block) => {
      const role = ((block as HTMLElement).dataset.role ?? defaultRole) as TextRole;
      const text = nodeToInline(block, tokens, { baseColor: css ? cssColor(css(role)) : undefined });
      return { role, text };
    })
    .filter((p) => plainText(p.text).trim() && !(skip && skip(plainText(p.text))))
    .map((p) => (p.role === defaultRole && typeof p.text === "string" ? p.text : { role: p.role, text: p.text }));
}

/** The `[data-role]` block holding the caret. */
export function currentBlock(root: HTMLElement | null): HTMLElement | null {
  const node = window.getSelection()?.anchorNode;
  const el = node instanceof HTMLElement ? node : node?.parentElement;
  const block = el?.closest<HTMLElement>("[data-role]") ?? null;
  return block && root && root.contains(block) ? block : null;
}

/**
 * The paragraph editor both the page and the panel use: a contentEditable where
 * every paragraph is a block with a role (title, body, quote…), the floating bar
 * formats runs and changes the role, Enter starts a body paragraph after a title,
 * and reading back gives the document's own inline format.
 */
export const ParagraphsEditable = forwardRef<ParagraphsHandle, ParagraphsEditableProps>(function ParagraphsEditable(props, handle) {
  const { paragraphs, defaultRole, tokens, css, className, style, autoFocus = false, onKey, onInput, onBlur, onPointerDown, children } = props;
  const ref = useRef<HTMLDivElement>(null);
  const bar = useRef<RunBarHandle>(null);
  // One object for the life of the editor: a new one per render would make React rewrite
  // the HTML on every input event, throwing away what the browser just edited.
  const [html] = useState(() => ({ __html: paragraphsToHtml(paragraphs, defaultRole, tokens, css) }));
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [, bump] = useState(0);

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

  useImperativeHandle(
    handle,
    () => ({
      read: () => (ref.current ? readParagraphs(ref.current, defaultRole, tokens, undefined, css) : paragraphs),
      currentRole: () => (currentBlock(ref.current)?.dataset.role as TextRole | undefined) ?? null,
      focus,
      element: () => ref.current,
    }),
    [defaultRole, tokens, paragraphs, css],
  );

  const setRole = (role: TextRole) => {
    const block = currentBlock(ref.current);
    if (!block) return;
    block.dataset.role = role;
    block.setAttribute("style", css(role));
    onInput?.();
    bump((n) => n + 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (onKey?.(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      bar.current?.openLink();
      return;
    }
    if (runShortcut(e, tokens)) {
      onInput?.();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      document.execCommand("insertParagraph");
      // A new paragraph after a title is body text, not another title.
      const block = currentBlock(ref.current);
      if (block && block.dataset.role !== defaultRole && /^(title|subtitle)/.test(block.dataset.role ?? "")) {
        block.dataset.role = defaultRole;
        block.setAttribute("style", css(defaultRole));
      }
      if (block && !block.hasAttribute("data-role")) {
        block.dataset.role = defaultRole;
        block.setAttribute("style", css(defaultRole));
      }
      onInput?.();
    }
  };

  return (
    <>
      <div
        ref={(el) => {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (el !== root) setRoot(el);
          if (el && autoFocus && !el.dataset.focused) {
            el.dataset.focused = "1";
            requestAnimationFrame(() => focus(autoFocus));
          }
        }}
        role="textbox"
        aria-multiline
        aria-label={props["aria-label"]}
        contentEditable
        suppressContentEditableWarning
        className={className}
        style={style}
        onKeyDown={onKeyDown}
        onInput={() => {
          onInput?.();
          bump((n) => n + 1);
        }}
        onBlur={(e) => {
          // The bar's own controls (link field, role select) are part of the editor.
          if ((e.relatedTarget as HTMLElement | null)?.closest?.("[data-run-bar]")) return;
          onBlur?.(e);
        }}
        onPointerDown={onPointerDown}
        onPaste={(e) => {
          // Plain text only: pasted styles would not survive the inline format anyway.
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        dangerouslySetInnerHTML={html}
      />
      <RunBar ref={bar} root={root} tokens={tokens} role={{ current: (currentBlock(ref.current)?.dataset.role as TextRole | undefined) ?? null, onChange: setRole }} onChanged={onInput} />
      {children}
    </>
  );
});
