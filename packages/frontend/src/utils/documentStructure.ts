/**
 * Deriving structure from a markdown document.
 *
 * The document is a single blob of markdown — that is deliberate, and the
 * reason is in docs/product/document-surface-revamp.md §2.1: writing is not
 * sectional, structure emerges from the text rather than preceding it.
 *
 * So a "section" here is a **view**, computed at read time from the headings.
 * Nothing in this module is persisted. It exists so review, diff and the table
 * of contents can say "this refers to that part of the document" without the
 * storage ever being sliced up.
 */

export interface Heading {
  level: number;
  text: string;
  slug: string;
  /** 0-based line where the heading itself sits. */
  line: number;
  /**
   * 0-based line where this section stops — the line before the next heading
   * of the same or shallower level, or the last line of the document.
   */
  endLine: number;
}

const HEADING_RE = /^[ \t]*(#{1,5})\s+(.+)/;
const FENCE_RE = /^[ \t]*(```|~~~)/;

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Headings in document order, each carrying the line range it owns.
 *
 * Fenced code blocks are skipped: a `#` comment inside a shell snippet is not
 * a section, and treating it as one used to put phantom entries in the nav.
 */
export function parseHeadings(content: string): Heading[] {
  const lines = content.split("\n");
  const headings: Heading[] = [];
  const slugCount: Record<string, number> = {};
  let fence: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      if (fence === null) fence = fenceMatch[1];
      else if (fenceMatch[1] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;

    const match = HEADING_RE.exec(line);
    if (!match) continue;

    const level = match[1].length;
    const text = match[2].trim();
    const base = slugify(text);
    slugCount[base] = (slugCount[base] ?? 0) + 1;
    const slug = slugCount[base] === 1 ? base : `${base}-${slugCount[base] - 1}`;

    headings.push({ level, text, slug, line: i, endLine: lines.length - 1 });
  }

  // Close each range at the next heading of the same or shallower level.
  for (let i = 0; i < headings.length; i++) {
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= headings[i].level) {
        headings[i].endLine = headings[j].line - 1;
        break;
      }
    }
  }

  return headings;
}

/** The deepest heading whose range covers `line`, or null above the first one. */
export function headingAtLine(headings: Heading[], line: number): Heading | null {
  let found: Heading | null = null;
  for (const h of headings) {
    if (h.line <= line && line <= h.endLine) {
      if (!found || h.level > found.level) found = h;
    }
  }
  return found;
}

/** Char offset where `line` starts. */
export function offsetOfLine(content: string, line: number): number {
  let offset = 0;
  const lines = content.split("\n");
  for (let i = 0; i < line && i < lines.length; i++) offset += lines[i].length + 1;
  return offset;
}

/** 0-based line containing char `offset`. */
export function lineAtOffset(content: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

// ─── Anchors ──────────────────────────────────────────────────────

/**
 * Where something (a suggestion, a gate finding) claims to live.
 *
 * Both fields are hints, and both can go stale when an agent rewrites the
 * text. Resolution degrades rather than failing — see `resolveAnchor`.
 */
export interface Anchor {
  /** Slug of the heading it was filed under. */
  headingSlug?: string | null;
  /** The text it refers to, verbatim at the time it was created. */
  quote?: string | null;
}

export type AnchorPrecision = "quote" | "heading" | "document";

export interface ResolvedAnchor {
  start: number;
  end: number;
  line: number;
  heading: Heading | null;
  /**
   * How much of the anchor survived:
   *  - `quote`    — found the exact text; point precision
   *  - `heading`  — text moved or changed, but the section still exists
   *  - `document` — nothing matched; shown at document level
   */
  precision: AnchorPrecision;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Resolve an anchor against the current text, degrading in three steps:
 * exact quote → heading → document.
 *
 * Never throws and never returns null: a stale anchor still renders, just at
 * lower precision, so a rewritten section shows "this comment lost its anchor"
 * instead of dropping the comment on the floor.
 */
export function resolveAnchor(
  content: string,
  anchor: Anchor,
  headings: Heading[] = parseHeadings(content),
): ResolvedAnchor {
  const heading = anchor.headingSlug
    ? (headings.find((h) => h.slug === anchor.headingSlug) ?? null)
    : null;

  const quote = anchor.quote?.trim();
  if (quote) {
    // Prefer a hit inside the claimed section — the same sentence can appear
    // in two places, and the heading disambiguates.
    const searchFrom = heading ? offsetOfLine(content, heading.line) : 0;
    const searchTo = heading
      ? offsetOfLine(content, heading.endLine + 1)
      : content.length;

    for (const [from, to] of [
      [searchFrom, searchTo],
      [0, content.length],
    ] as const) {
      const window = content.slice(from, to);
      let idx = window.indexOf(quote);
      let length = quote.length;

      if (idx === -1) {
        // Whitespace-insensitive retry: reflowing a paragraph shouldn't
        // orphan a comment.
        const pattern = normalizeWhitespace(quote)
          .split(" ")
          .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("\\s+");
        const match = new RegExp(pattern).exec(window);
        if (match) {
          idx = match.index;
          length = match[0].length;
        }
      }

      if (idx !== -1) {
        const start = from + idx;
        const line = lineAtOffset(content, start);
        return {
          start,
          end: start + length,
          line,
          heading: headingAtLine(headings, line),
          precision: "quote",
        };
      }
    }
  }

  if (heading) {
    const start = offsetOfLine(content, heading.line);
    return {
      start,
      end: start + heading.text.length,
      line: heading.line,
      heading,
      precision: "heading",
    };
  }

  return { start: 0, end: 0, line: 0, heading: null, precision: "document" };
}

/** Per-section tallies the nav shows next to each entry. */
export type SectionCounts = Record<string, number>;

/**
 * Group anchored items by the section they resolve into, so the nav can show
 * "this section has 4 pending changes" without the caller re-resolving.
 */
export function countBySection<T>(
  content: string,
  items: T[],
  toAnchor: (item: T) => Anchor,
  headings: Heading[] = parseHeadings(content),
): SectionCounts {
  const counts: SectionCounts = {};
  for (const item of items) {
    const resolved = resolveAnchor(content, toAnchor(item), headings);
    const slug = resolved.heading?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}
