import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { TEXT_ROLES, type TextRole, type Tokens } from "@docforge-lib/layout";
import { useI18n } from "@/i18n";

/** Colors offered for a run, by token, so a theme change recolors the text too. */
const RUN_COLORS = ["text", "muted", "primary", "success", "danger", "warning"];
const SAFE_HREF = /^(https?:|mailto:|#)/i;

interface RunBarProps {
  /** The contentEditable the bar serves: it shows for a selection inside it and nowhere else. */
  root: HTMLElement | null;
  tokens: Tokens;
  /** The paragraph role under the caret, with a way to change it (paragraph editors only). */
  role?: { current: TextRole | null; onChange: (role: TextRole) => void };
  /** After a command changed the HTML (hosts that keep a draft re-read it). */
  onChanged?: () => void;
}

/** Whether the selection sits inside `root` (so the bar belongs to this editor). */
function selectionIn(root: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  return el && root.contains(el) ? range : null;
}

/** Wrap the selection in `<code>` or take it out of one. */
function toggleCode(range: Range): void {
  const node = range.commonAncestorContainer;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  const code = el?.closest("code");
  if (code) {
    const parent = code.parentNode;
    if (!parent) return;
    while (code.firstChild) parent.insertBefore(code.firstChild, code);
    parent.removeChild(code);
    return;
  }
  const text = range.toString();
  if (!text) return;
  document.execCommand("insertHTML", false, `<code>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code>`);
}

export interface RunBarHandle {
  /** Open the link field for the current selection (Ctrl+K). */
  openLink: () => void;
}

/**
 * The floating bar over a text selection: bold, italic, code, link, color, highlight
 * and (for paragraphs) the role. Buttons keep the selection by cancelling mousedown;
 * the two controls that must take focus (link, role) restore the selection after.
 */
export const RunBar = forwardRef<RunBarHandle, RunBarProps>(function RunBar({ root, tokens, role, onChanged }, handle) {
  const { t } = useI18n();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [state, setState] = useState({ bold: false, italic: false, code: false, link: false, highlight: false });
  const [linkOpen, setLinkOpen] = useState<string | null>(null);
  const saved = useRef<Range | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    if (!root) return setRect(null);
    const range = selectionIn(root);
    if (!range) {
      if (!linkOpen) setRect(null);
      return;
    }
    saved.current = range.cloneRange();
    const r = range.getBoundingClientRect();
    setRect(r.width || r.height ? r : null);
    const node = range.commonAncestorContainer;
    const el = node instanceof HTMLElement ? node : node.parentElement;
    const background = document.queryCommandValue("hiliteColor");
    setState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      code: !!el?.closest("code"),
      link: !!el?.closest("a"),
      highlight: !!background && background !== "transparent" && background !== "rgba(0, 0, 0, 0)" && background !== "initial",
    });
  }, [root, linkOpen]);

  useEffect(() => {
    document.addEventListener("selectionchange", refresh);
    window.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      document.removeEventListener("selectionchange", refresh);
      window.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [refresh]);

  const restore = () => {
    const range = saved.current;
    if (!range || !root) return;
    root.focus({ preventScroll: true });
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  const run = (command: () => void) => {
    restore();
    command();
    onChanged?.();
    refresh();
  };
  const keep = (e: MouseEvent) => e.preventDefault();

  const openLink = () => {
    if (!root) return;
    const range = saved.current ?? selectionIn(root);
    if (!range) return;
    saved.current = range.cloneRange();
    if (!rect) setRect(range.getBoundingClientRect());
    const node = range.commonAncestorContainer;
    const el = node instanceof HTMLElement ? node : node.parentElement;
    setLinkOpen(el?.closest("a")?.getAttribute("href") ?? "");
    requestAnimationFrame(() => linkInput.current?.focus());
  };
  useImperativeHandle(handle, () => ({ openLink }), [root, rect]);
  const applyLink = () => {
    const href = (linkOpen ?? "").trim();
    setLinkOpen(null);
    run(() => {
      if (!href) document.execCommand("unlink");
      else if (SAFE_HREF.test(href)) document.execCommand("createLink", false, href);
    });
  };

  if (!rect || !root) return null;
  const width = bar.current?.offsetWidth ?? 320;
  const height = bar.current?.offsetHeight ?? 36;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + rect.width / 2 - width / 2));
  const above = rect.top - height - 8;
  const top = above >= 8 ? above : rect.bottom + 8;
  const style: CSSProperties = { position: "fixed", left, top, zIndex: "var(--z-popover)" };

  return (
    <div ref={bar} className="df-run-bar" role="toolbar" aria-label={t("layout.runbar.label")} data-run-bar style={style} onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {role && (
        <select
          className="df-run-bar__role"
          aria-label={t("layout.content.role")}
          value={role.current ?? "body"}
          onChange={(e) => {
            const next = e.target.value as TextRole;
            restore();
            role.onChange(next);
            onChanged?.();
          }}
        >
          {TEXT_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`layout.role.${r}`)}
            </option>
          ))}
        </select>
      )}
      <button type="button" aria-pressed={state.bold} title={`${t("layout.runbar.bold")} (Ctrl+B)`} aria-label={t("layout.runbar.bold")} onMouseDown={keep} onClick={() => run(() => document.execCommand("bold"))}>
        <b>B</b>
      </button>
      <button type="button" aria-pressed={state.italic} title={`${t("layout.runbar.italic")} (Ctrl+I)`} aria-label={t("layout.runbar.italic")} onMouseDown={keep} onClick={() => run(() => document.execCommand("italic"))}>
        <i>I</i>
      </button>
      <button type="button" aria-pressed={state.code} title={t("layout.runbar.code")} aria-label={t("layout.runbar.code")} onMouseDown={keep} onClick={() => run(() => saved.current && toggleCode(saved.current))}>
        <span className="df-mono">{"<>"}</span>
      </button>
      <button type="button" aria-pressed={state.link} title={`${t("layout.runbar.link")} (Ctrl+K)`} aria-label={t("layout.runbar.link")} onMouseDown={keep} onClick={openLink}>
        <span className="material-symbols-outlined" aria-hidden>
          link
        </span>
      </button>
      <span className="df-run-bar__sep" aria-hidden />
      <span className="df-run-bar__swatches" role="group" aria-label={t("layout.runbar.color")}>
        {RUN_COLORS.map((key) => (
          <button
            key={key}
            type="button"
            className="df-run-bar__swatch"
            title={`${t("layout.runbar.color")}: ${key}`}
            aria-label={`${t("layout.runbar.color")}: ${key}`}
            onMouseDown={keep}
            onClick={() => run(() => document.execCommand("foreColor", false, String(tokens.color[key] ?? "#000")))}
            style={{ background: String(tokens.color[key] ?? "#000") }}
          />
        ))}
      </span>
      <button
        type="button"
        aria-pressed={state.highlight}
        title={`${t("layout.runbar.highlight")} (Ctrl+Shift+H)`}
        aria-label={t("layout.runbar.highlight")}
        onMouseDown={keep}
        onClick={() => run(() => document.execCommand("hiliteColor", false, state.highlight ? "transparent" : String(tokens.color.highlight ?? "#fff3b0")))}
      >
        <span className="material-symbols-outlined" aria-hidden style={{ color: state.highlight ? undefined : String(tokens.color.highlight ?? "#fff3b0") }}>
          ink_highlighter
        </span>
      </button>
      <button
        type="button"
        title={t("layout.runbar.clear")}
        aria-label={t("layout.runbar.clear")}
        onMouseDown={keep}
        onClick={() =>
          run(() => {
            document.execCommand("removeFormat");
            document.execCommand("unlink");
            const node = saved.current?.commonAncestorContainer;
            const el = node instanceof HTMLElement ? node : node?.parentElement;
            const code = el?.closest("code");
            if (code && saved.current) toggleCode(saved.current);
          })
        }
      >
        <span className="material-symbols-outlined" aria-hidden>
          format_clear
        </span>
      </button>
      {linkOpen !== null && (
        <form
          className="df-run-bar__link"
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            ref={linkInput}
            className="df-input"
            placeholder={t("layout.runbar.linkPlaceholder")}
            value={linkOpen}
            onChange={(e) => setLinkOpen(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                setLinkOpen(null);
                restore();
              }
            }}
          />
          <button type="submit">{t("layout.runbar.apply")}</button>
        </form>
      )}
    </div>
  );
});

/** Ctrl+B, Ctrl+I and Ctrl+Shift+H inside an editor: the same commands as the bar. */
export function runShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; preventDefault: () => void }, tokens: Tokens): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  const key = e.key.toLowerCase();
  if (key === "b" || key === "i") {
    e.preventDefault();
    document.execCommand(key === "b" ? "bold" : "italic");
    return true;
  }
  if (key === "h" && e.shiftKey) {
    e.preventDefault();
    const current = document.queryCommandValue("hiliteColor");
    const on = !!current && current !== "transparent" && current !== "rgba(0, 0, 0, 0)" && current !== "initial";
    document.execCommand("hiliteColor", false, on ? "transparent" : String(tokens.color.highlight ?? "#fff3b0"));
    return true;
  }
  return false;
}
