/**
 * Line diff and hunk grouping.
 *
 * Review and version comparison both need the same thing: "what changed, and
 * which section is it in". The document stays one markdown blob, so the
 * grouping happens at presentation time, over hunks, rather than by slicing
 * storage.
 */

import { parseHeadings, headingAtLine, type Heading } from "./documentStructure";

export type RowKind = "context" | "add" | "del";

export interface DiffRow {
  kind: RowKind;
  /** 1-based line number in the old text, null for additions. */
  oldLine: number | null;
  /** 1-based line number in the new text, null for deletions. */
  newLine: number | null;
  text: string;
}

/** What a hunk does, in the vocabulary the review screen shows. */
export type ChangeKind = "rewrite" | "addition" | "removal";

export const CHANGE_LABEL: Record<ChangeKind, string> = {
  rewrite: "REESCRITA",
  addition: "ADIÇÃO",
  removal: "REMOÇÃO",
};

export interface Hunk {
  /** Stable index within the diff — the "#3" in `CHANGE 3 OF 12`. */
  index: number;
  kind: ChangeKind;
  rows: DiffRow[];
  /** First and last changed line in the new text (1-based). */
  newStart: number;
  newEnd: number;
  /** Section of the new text this lands in. */
  heading: Heading | null;
  added: number;
  removed: number;
}

/**
 * Longest common subsequence over lines, after trimming the shared head and
 * tail. Documents under review usually differ in a few places, so the trim
 * keeps the quadratic core small.
 */
function lcsRows(a: string[], b: string[], offA: number, offB: number): DiffRow[] {
  const n = a.length;
  const m = b.length;

  // Degenerate sides: pure insert or pure delete.
  if (n === 0 || m === 0) {
    return [
      ...a.map((text, i) => ({
        kind: "del" as const,
        oldLine: offA + i + 1,
        newLine: null,
        text,
      })),
      ...b.map((text, i) => ({
        kind: "add" as const,
        oldLine: null,
        newLine: offB + i + 1,
        text,
      })),
    ];
  }

  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] =
        a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ kind: "context", oldLine: offA + i + 1, newLine: offB + j + 1, text: a[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      rows.push({ kind: "del", oldLine: offA + i + 1, newLine: null, text: a[i] });
      i++;
    } else {
      rows.push({ kind: "add", oldLine: null, newLine: offB + j + 1, text: b[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ kind: "del", oldLine: offA + i + 1, newLine: null, text: a[i++] });
  }
  while (j < m) {
    rows.push({ kind: "add", oldLine: null, newLine: offB + j + 1, text: b[j++] });
  }
  return rows;
}

/** Every line of both texts, aligned. */
export function diffLines(oldText: string, newText: string): DiffRow[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");

  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;

  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail++;
  }

  const rows: DiffRow[] = [];
  for (let i = 0; i < head; i++) {
    rows.push({ kind: "context", oldLine: i + 1, newLine: i + 1, text: a[i] });
  }
  rows.push(
    ...lcsRows(a.slice(head, a.length - tail), b.slice(head, b.length - tail), head, head),
  );
  for (let i = 0; i < tail; i++) {
    const ai = a.length - tail + i;
    const bi = b.length - tail + i;
    rows.push({ kind: "context", oldLine: ai + 1, newLine: bi + 1, text: a[ai] });
  }
  return rows;
}

function kindOf(added: number, removed: number): ChangeKind {
  if (removed === 0) return "addition";
  if (added === 0) return "removal";
  return "rewrite";
}

/**
 * Group changed rows into hunks, each padded with `context` lines and tagged
 * with the section it lands in.
 */
export function toHunks(
  rows: DiffRow[],
  newText: string,
  context = 3,
  headings: Heading[] = parseHeadings(newText),
): Hunk[] {
  const changed = rows
    .map((r, i) => (r.kind === "context" ? -1 : i))
    .filter((i) => i >= 0);
  if (changed.length === 0) return [];

  /** Section a changed row belongs to, by its position in the new text. */
  const sectionOf = (rowIndex: number): string | null => {
    for (let i = rowIndex; i >= 0; i--) {
      const line = rows[i].newLine;
      if (line !== null) return headingAtLine(headings, line - 1)?.slug ?? null;
    }
    return null;
  };

  // Merge nearby changes — but never across a section boundary, since the
  // whole point of hunks here is that each one belongs to one section.
  // The floor of 1 keeps a del immediately followed by an add together: that
  // pair is a single rewrite, not two changes, even at context 0.
  const reach = Math.max(1, context * 2);
  const groups: Array<[number, number]> = [];
  let start = changed[0];
  let end = changed[0];
  for (const i of changed.slice(1)) {
    if (i - end <= reach && sectionOf(i) === sectionOf(end)) {
      end = i;
    } else {
      groups.push([start, end]);
      start = i;
      end = i;
    }
  }
  groups.push([start, end]);

  return groups.map(([from, to], index) => {
    const lo = Math.max(0, from - context);
    const hi = Math.min(rows.length - 1, to + context);
    const slice = rows.slice(lo, hi + 1);

    const added = slice.filter((r) => r.kind === "add").length;
    const removed = slice.filter((r) => r.kind === "del").length;

    const newLines = slice.filter((r) => r.newLine !== null).map((r) => r.newLine!);
    const changedNew = rows
      .slice(from, to + 1)
      .filter((r) => r.newLine !== null)
      .map((r) => r.newLine!);

    // A pure deletion has no new line of its own; anchor it where the removed
    // text used to begin, which is the surrounding context.
    const anchorLine = (changedNew[0] ?? newLines[0] ?? 1) - 1;

    return {
      index: index + 1,
      kind: kindOf(added, removed),
      rows: slice,
      newStart: changedNew[0] ?? newLines[0] ?? 1,
      newEnd: changedNew[changedNew.length - 1] ?? newLines[newLines.length - 1] ?? 1,
      heading: headingAtLine(headings, anchorLine),
      added,
      removed,
    };
  });
}

/** Hunks between two texts, tagged with the section each one falls in. */
export function diffHunks(oldText: string, newText: string, context = 3): Hunk[] {
  return toHunks(diffLines(oldText, newText), newText, context);
}

/** How many hunks land in each section — the tally the nav shows. */
export function hunkCountsBySection(oldText: string, newText: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const h of diffHunks(oldText, newText)) {
    const slug = h.heading?.slug;
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1;
  }
  return counts;
}

// ─── Word-level refinement ────────────────────────────────────────
// Character diff inside a 340px column was unreadable; word granularity with
// only the changed span highlighted is what the review screen needs.

export interface WordPart {
  text: string;
  changed: boolean;
}

function splitWords(s: string): string[] {
  return s.split(/(\s+)/).filter((x) => x !== "");
}

/** Align two lines word-by-word so only the differing words get painted. */
export function wordDiff(oldLine: string, newLine: string): [WordPart[], WordPart[]] {
  const a = splitWords(oldLine);
  const b = splitWords(newLine);
  const rows = lcsRows(a, b, 0, 0);

  const left: WordPart[] = [];
  const right: WordPart[] = [];
  for (const r of rows) {
    if (r.kind === "context") {
      left.push({ text: r.text, changed: false });
      right.push({ text: r.text, changed: false });
    } else if (r.kind === "del") {
      left.push({ text: r.text, changed: true });
    } else {
      right.push({ text: r.text, changed: true });
    }
  }
  return [left, right];
}
