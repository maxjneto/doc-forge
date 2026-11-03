import { inlineText, inlineToRuns, type Inline, type Run, type Tokens } from "@docforge-lib/layout";

/**
 * Inline content ⇄ editable HTML. The library's inline text is either a markdown
 * subset (`**bold**`, `*italic*`, `` `code` ``, `[text](url)`) or explicit runs when a
 * run carries a color, a highlight or a size. Editing happens in a contentEditable:
 * runs become nested tags and spans, the browser's own commands (bold, italic,
 * foreColor, hiliteColor, createLink) edit them, and reading the DOM back gives runs
 * again. The result is written in the shortest form the library accepts: the markdown
 * subset when no run needs more, runs otherwise.
 */

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const SAFE_HREF = /^(https?:|mailto:|#)/i;

/** A token's color, or the value itself when it is a literal. */
export function colorOf(value: string | undefined, tokens: Tokens): string | undefined {
  if (!value) return undefined;
  return value.startsWith("$color.") ? (tokens.color[value.slice(7)] ?? undefined) : value;
}

/** Inline content as HTML for a contentEditable, with run colors resolved and remembered. */
export function inlineToHtml(inline: Inline, tokens: Tokens): string {
  return inlineToRuns(inline)
    .map((run) => {
      let html = escapeHtml(run.text);
      if (run.code) html = `<code>${html}</code>`;
      if (run.italic) html = `<i>${html}</i>`;
      if (run.bold) html = `<b>${html}</b>`;
      if (run.size) html = `<span data-size="${escapeHtml(run.size)}">${html}</span>`;
      if (run.highlight) {
        const written = run.highlight === true ? "$color.highlight" : run.highlight;
        const css = colorOf(written, tokens) ?? colorOf("$color.highlight", tokens) ?? colorOf("$color.warning", tokens) ?? "";
        html = `<span data-highlight="${escapeHtml(written)}" style="background-color:${css}">${html}</span>`;
      }
      if (run.color) {
        const css = colorOf(run.color, tokens) ?? run.color;
        html = `<span data-color="${escapeHtml(run.color)}" style="color:${css}">${html}</span>`;
      }
      if (run.link && SAFE_HREF.test(run.link)) html = `<a href="${escapeHtml(run.link)}">${html}</a>`;
      return html;
    })
    .join("");
}

/** A red-green-blue triple or a three-digit hex becomes the six-digit hex; anything else stays as it is. */
export function normalizeColor(css: string): string {
  const s = css.trim().toLowerCase();
  const rgb = /^rgba?\s*\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(s);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
  if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  return s;
}

/** A background that paints nothing: unset, transparent, or a color with zero alpha. */
export function isTransparent(css: string | null | undefined): boolean {
  const s = (css ?? "").trim().toLowerCase();
  if (!s || s === "transparent" || s === "initial" || s === "inherit" || s === "none") return true;
  const inner = /\((.*)\)$/.exec(s)?.[1];
  if (!inner || !/^rgba?/.test(s)) return false;
  const parts = inner.split(/[\s,/]+/).filter(Boolean);
  return parts.length === 4 && Number(parts[3]) === 0;
}

/** The token that holds this color (`$color.danger`), so a new theme recolors the run too. */
export function tokenFor(css: string, tokens: Tokens): string | null {
  const wanted = normalizeColor(css);
  for (const [key, value] of Object.entries(tokens.color)) if (normalizeColor(String(value)) === wanted) return `$color.${key}`;
  return null;
}

type Marks = Omit<Run, "text">;

export interface ReadOptions {
  /** The text's own color where it is edited: a run in this color carries no color of its own. */
  baseColor?: string;
}

function walk(node: Node, marks: Marks, tokens: Tokens, out: Run[], options: ReadOptions): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/ /g, " ");
    if (text) out.push({ text, ...marks });
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  const next: Marks = { ...marks };
  switch (node.tagName) {
    case "B":
    case "STRONG":
      next.bold = true;
      break;
    case "I":
    case "EM":
      next.italic = true;
      break;
    case "CODE":
      next.code = true;
      break;
    case "A": {
      const href = node.getAttribute("href");
      if (href && SAFE_HREF.test(href)) next.link = href;
      break;
    }
    case "BR":
      out.push({ text: " ", ...marks });
      return;
    default:
      break;
  }
  if (node.tagName === "DIV" || node.tagName === "P") {
    // A block boundary inside one field reads as a space.
    if (out.length && !/\s$/.test(out[out.length - 1]?.text ?? "")) out.push({ text: " ", ...marks });
  }
  // Weight and slant come from tags only: the browser moves a block's own font-weight
  // into spans when it edits around it, and that is not a mark the person made.
  const dataColor = node.dataset.color;
  const fontColor = node.tagName === "FONT" ? node.getAttribute("color") : null;
  const cssColor = node.style.color || fontColor;
  if (dataColor) next.color = dataColor;
  else if (cssColor && cssColor !== "inherit") {
    const base = options.baseColor ? normalizeColor(options.baseColor) : null;
    if (base && normalizeColor(cssColor) === base) delete next.color;
    else next.color = tokenFor(cssColor, tokens) ?? normalizeColor(cssColor);
  }
  const dataHighlight = node.dataset.highlight;
  const cssBackground = node.style.backgroundColor;
  if (dataHighlight) next.highlight = dataHighlight === "$color.highlight" ? true : dataHighlight;
  else if (cssBackground && !isTransparent(cssBackground)) {
    const token = tokenFor(cssBackground, tokens);
    next.highlight = token === "$color.highlight" ? true : (token ?? normalizeColor(cssBackground));
  }
  if (node.dataset.size) next.size = node.dataset.size;
  for (const child of node.childNodes) walk(child, next, tokens, out, options);
}

const sameMarks = (a: Run, b: Run) => a.bold === b.bold && a.italic === b.italic && a.code === b.code && a.color === b.color && a.highlight === b.highlight && a.link === b.link && a.size === b.size;

/** Runs read from a contentEditable, adjacent equal runs joined, blank runs dropped. */
export function nodeToRuns(node: Node, tokens: Tokens, options: ReadOptions = {}): Run[] {
  const raw: Run[] = [];
  walk(node, {}, tokens, raw, options);
  const merged: Run[] = [];
  for (const run of raw) {
    const last = merged[merged.length - 1];
    if (last && sameMarks(last, run)) last.text += run.text;
    else merged.push({ ...run });
  }
  // Marks on whitespace-only runs carry nothing: fold them into their neighbours.
  return merged
    .map((run) => (run.text.trim() ? run : { text: run.text }))
    .reduce<Run[]>((acc, run) => {
      const last = acc[acc.length - 1];
      if (last && sameMarks(last, run)) last.text += run.text;
      else acc.push({ ...run });
      return acc;
    }, [])
    .map((run) => Object.fromEntries(Object.entries(run).filter(([, v]) => v !== undefined && v !== false)) as Run);
}

const needsRuns = (runs: Run[]) => runs.some((r) => r.color !== undefined || r.highlight !== undefined || r.size !== undefined);

/** Runs with only bold, italic, code and links, as the markdown subset. */
export function runsToMarkdown(runs: Run[]): string {
  return runs
    .map((run) => {
      let s = run.text;
      if (!s.trim()) return s;
      if (run.code) s = `\`${s}\``;
      if (run.italic) s = `*${s}*`;
      if (run.bold) s = `**${s}**`;
      if (run.link) s = `[${s}](${run.link})`;
      return s;
    })
    .join("");
}

/**
 * What a contentEditable holds, in the form the document should keep: a string when
 * the markdown subset says it all, runs when a color, highlight or size is involved.
 * Whitespace is collapsed, as the page shows it.
 */
export function nodeToInline(node: Node, tokens: Tokens, options: ReadOptions = {}): Inline {
  const runs = nodeToRuns(node, tokens, options).map((r) => ({ ...r, text: r.text.replace(/\s+/g, " ") }));
  while (runs.length && !runs[0]!.text.trim()) runs.shift();
  while (runs.length && !runs[runs.length - 1]!.text.trim()) runs.pop();
  if (runs.length) {
    runs[0]!.text = runs[0]!.text.replace(/^\s+/, "");
    runs[runs.length - 1]!.text = runs[runs.length - 1]!.text.replace(/\s+$/, "");
  }
  const kept = runs.filter((r) => r.text);
  if (!kept.length) return "";
  return needsRuns(kept) ? kept : runsToMarkdown(kept);
}

/** The text alone, for emptiness checks and summaries. */
export const plainText = (inline: Inline): string => inlineText(inline);

/** True when two inline values would produce the same document. */
export function sameInline(a: Inline | undefined, b: Inline | undefined): boolean {
  return JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
}
