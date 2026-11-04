import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import type { Component, LayoutDocument, ResolvedStyle, TextRole, Tokens } from "@docforge-lib/layout";
import type { InsertKey } from "./defaults";
import { componentStyle, textCssString } from "./inlineStyle";
import { currentBlock, ParagraphsEditable, readParagraphs, type Paragraph, type ParagraphsHandle } from "./ParagraphsEditable";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";
import { useI18n } from "@/i18n";

/** Every text block edits in place: explicit runs (colors, highlights) survive the round trip now. */
export function canEditInline(component: Component): boolean {
  return component.type === "text";
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
 * measures with, and turns back into the document's inline format when it closes.
 * Enter starts a body paragraph, the floating bar formats a selection, "/" in an
 * empty paragraph inserts a block below, Esc cancels, leaving saves.
 */
export function InlineTextEditor({ component, doc, tokens, style, onDone, onInsert }: InlineTextEditorProps) {
  const { t } = useI18n();
  const editor = useRef<ParagraphsHandle>(null);
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

  const css = (role: TextRole): string => {
    const s = roleStyle(role);
    return [textCssString(s), role === "quote" ? `padding-left:14px;border-left:3px solid ${s.accent}` : ""].filter(Boolean).join(";");
  };
  const gap = roleStyle(defaultRole).gap;

  const read = (): Paragraph[] => {
    const el = editor.current?.element();
    return el ? readParagraphs(el, defaultRole, tokens, (text) => SLASH.test(text.trim()), css) : paragraphs;
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
    const block = currentBlock(editor.current?.element() ?? null);
    const match = block ? SLASH.exec((block.textContent ?? "").trim()) : null;
    if (!block || !match) return setSlash(null);
    setSlash({ query: match[1] ?? "", top: block.offsetTop + block.offsetHeight + 6 });
  };

  const pickInsert = (key: InsertKey) => {
    setSlash(null);
    finish(true);
    onInsert(key);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>): boolean => {
    if (slash) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        menu.current?.move(e.key === "ArrowDown" ? 1 : -1);
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        menu.current?.pick();
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlash(null);
        return true;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      finish(false);
      return true;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      finish(true);
      return true;
    }
    return false;
  };

  return (
    <>
      <ParagraphsEditable
        ref={editor}
        paragraphs={paragraphs}
        defaultRole={defaultRole}
        tokens={tokens}
        css={css}
        className="df-inline-editor"
        aria-label={t("layout.inline.label")}
        autoFocus="end"
        style={{ ...style, background: tokens.color.surface, "--gap": `${gap}px` } as CSSProperties}
        onKey={onKey}
        onInput={onInput}
        onBlur={() => finish(true)}
        onPointerDown={(e) => e.stopPropagation()}
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
