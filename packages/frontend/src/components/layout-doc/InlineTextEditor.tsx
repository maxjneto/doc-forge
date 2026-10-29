import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Component, LayoutDocument, ResolvedStyle, TextRole, Tokens } from "@docforge-lib/layout";
import type { InsertKey } from "./defaults";
import { componentStyle, textCssString } from "./inlineStyle";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";
import { useI18n } from "@/i18n";

type Paragraph = string | { role?: TextRole; text: unknown };

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The inline markdown subset → HTML for editing: **bold**, *italic*, `code`, [text](url). */
export function markdownToHtml(text: string): string {
  return escapeHtml(text)
    // Only the link schemes the library accepts become links; anything else stays as typed.
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all: string, label: string, href: string) => (/^(https?:|mailto:|#)/i.test(href) ? `<a href="${href}">${label}</a>` : all))
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

/** Edited HTML → the same markdown subset. Anything else keeps its text. */
export function nodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/ /g, " ");
  if (!(node instanceof HTMLElement)) return "";
  const inner = [...node.childNodes].map(nodeToMarkdown).join("");
  switch (node.tagName) {
    case "B":
    case "STRONG":
      return inner.trim() ? `**${inner}**` : inner;
    case "I":
    case "EM":
      return inner.trim() ? `*${inner}*` : inner;
    case "CODE":
      return inner ? `\`${inner}\`` : "";
    case "A":
      return node.getAttribute("href") ? `[${inner}](${node.getAttribute("href")})` : inner;
    case "BR":
      return " ";
    default:
      return inner;
  }
}

/** True when every paragraph is plain inline text (explicit runs carry colors the editor would lose). */
export function canEditInline(component: Component): boolean {
  if (component.type !== "text") return false;
  const paragraphs = ((component as { content?: { paragraphs?: Paragraph[] } }).content?.paragraphs ?? []) as Paragraph[];
  return paragraphs.every((p) => typeof p === "string" || typeof p.text === "string");
}

interface InlineTextEditorProps {
  component: Component;
  doc: LayoutDocument;
  tokens: Tokens;
  style: CSSProperties;
  /** New paragraphs, or null when nothing changed. */
  onDone: (paragraphs: Paragraph[] | null) => void;
  /** "/" in an empty paragraph picked a block to insert below this one (after `onDone`). */
  onInsert: (key: InsertKey) => void;
}

const SLASH = /^\/([\p{L}\p{N}-]*)$/u;

/**
 * Edit a text block where it is drawn. The page itself is static HTML in a sandboxed
 * iframe; this editor sits over the block, styled with the same cascade the library
 * measures with, and turns back into the markdown subset when it closes.
 * Enter starts a body paragraph, Ctrl/⌘+B and +I format, "/" in an empty paragraph
 * inserts a block below, Esc cancels, leaving saves.
 */
export function InlineTextEditor({ component, doc, tokens, style, onDone, onInsert }: InlineTextEditorProps) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const menu = useRef<SlashMenuHandle>(null);
  const done = useRef(false);
  const [slash, setSlash] = useState<{ query: string; top: number } | null>(null);
  const defaultRole = ((component as { props?: { role?: TextRole } }).props?.role ?? "body") as TextRole;
  const paragraphs = useMemo(() => (((component as { content?: { paragraphs?: Paragraph[] } }).content?.paragraphs ?? []) as Paragraph[]), [component]);

  const roleStyle = useMemo(() => {
    const cache = new Map<string, ResolvedStyle>();
    return (role: string): ResolvedStyle => {
      const hit = cache.get(role) ?? componentStyle(component, doc, tokens, role);
      cache.set(role, hit);
      return hit;
    };
  }, [component, doc, tokens]);

  const css = (role: string): string => {
    const s = roleStyle(role);
    return [textCssString(s), role === "quote" ? `padding-left:14px;border-left:3px solid ${s.accent}` : ""].filter(Boolean).join(";");
  };
  const gap = roleStyle(defaultRole).gap;

  const [html] = useState(() =>
    (paragraphs.length ? paragraphs : [""])
      .map((p) => {
        const role = typeof p === "string" ? defaultRole : (p.role ?? defaultRole);
        const text = typeof p === "string" ? p : String(p.text ?? "");
        return `<div data-role="${role}" style="${css(role)}">${markdownToHtml(text) || "<br>"}</div>`;
      })
      .join(""),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    // Caret at the end, where people usually continue.
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);

  const currentBlock = (): HTMLElement | null => {
    const node = window.getSelection()?.anchorNode;
    return (node instanceof HTMLElement ? node : node?.parentElement)?.closest<HTMLElement>("[data-role]") ?? null;
  };

  const read = (): Paragraph[] => {
    const el = ref.current;
    if (!el) return paragraphs;
    const blocks = [...el.children].length ? [...el.children] : [el];
    return blocks
      .map((block) => {
        const role = ((block as HTMLElement).dataset.role ?? defaultRole) as TextRole;
        const text = nodeToMarkdown(block).replace(/\s+/g, " ").trim();
        return { role, text };
      })
      .filter((p) => p.text && !SLASH.test(p.text))
      .map((p) => (p.role === defaultRole ? p.text : { role: p.role, text: p.text }));
  };

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (!save) return onDone(null);
    const next = read();
    onDone(JSON.stringify(next) === JSON.stringify(paragraphs) ? null : next);
  };

  /** Show the "/" menu while the paragraph under the caret is "/" plus a few letters. */
  const onInput = () => {
    const block = currentBlock();
    const match = block ? SLASH.exec((block.textContent ?? "").trim()) : null;
    if (!block || !match || !ref.current) return setSlash(null);
    setSlash({ query: match[1] ?? "", top: block.offsetTop + block.offsetHeight + 6 });
  };

  const pickInsert = (key: InsertKey) => {
    setSlash(null);
    finish(true);
    onInsert(key);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (slash) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        menu.current?.move(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        menu.current?.pick();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      finish(true);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("insertParagraph");
      // A new paragraph after a title is body text, not another title.
      const block = currentBlock();
      if (block && block.dataset.role !== defaultRole && /^(title|subtitle)/.test(block.dataset.role ?? "")) {
        block.dataset.role = defaultRole;
        block.setAttribute("style", css(defaultRole));
      }
    } else if ((e.ctrlKey || e.metaKey) && (e.key === "b" || e.key === "i")) {
      e.preventDefault();
      document.execCommand(e.key === "b" ? "bold" : "italic");
    }
  };

  return (
    <>
      <div
        ref={ref}
        role="textbox"
        aria-multiline
        aria-label={t("layout.inline.label")}
        contentEditable
        suppressContentEditableWarning
        className="df-inline-editor"
        onKeyDown={onKeyDown}
        onInput={onInput}
        onPointerDown={(e) => e.stopPropagation()}
        onBlur={() => finish(true)}
        onPaste={(e) => {
          // Plain text only: pasted styles would not survive the markdown subset anyway.
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        style={{ ...style, background: tokens.color.surface, "--gap": `${gap}px` } as CSSProperties}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {slash && (
        <SlashMenu
          ref={menu}
          query={slash.query}
          onPick={pickInsert}
          onClose={() => setSlash(null)}
          style={{ position: "absolute", left: style.left, top: Number(style.top) + slash.top, zIndex: "var(--z-popover)" }}
        />
      )}
    </>
  );
}
