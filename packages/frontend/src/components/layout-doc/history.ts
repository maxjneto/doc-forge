import type { LayoutNote, LayoutRevisionItem } from "@/utils/api";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Descriptions the server writes by itself; anything else is the writer's "why". */
export const GENERIC_DESCRIPTION = /^(\d+ layout operations?|Created|Layout replaced)$/;

/** Op names → what they did, most telling first (a write that added and moved says "added"). */
const OP_ORDER = ["add", "row", "remove", "page", "edit", "replaceText", "update", "place", "setStyle", "setTokens", "setSurface", "setGrid", "fit", "compact", "setMeta", "setRegion", "removeRegion", "removeSurface"];

/** One line for a revision: the writer's note, else what its ops did ("Editou o texto de “Receita”"). */
export function describeRevision(r: LayoutRevisionItem, t: T, nameOf: (id: string) => string): string {
  if (r.description && !GENERIC_DESCRIPTION.test(r.description)) {
    if (r.description.startsWith("Tema: ")) return t("layout.history.op.theme", { name: r.description.slice(6) });
    return r.description;
  }
  if (r.description === "Created") return t("layout.history.created");
  if (!r.summary) return r.description === "Layout replaced" ? t("layout.history.replaced") : t("layout.changes.genericRevision", { count: r.opsCount ?? 0 });
  const rank = (op: string) => (OP_ORDER.includes(op) ? OP_ORDER.indexOf(op) : OP_ORDER.length);
  const ops = Object.keys(r.summary.ops).sort((a, b) => rank(a) - rank(b));
  const main = ops[0] ?? "";
  const names = r.summary.components.slice(0, 2).map((id) => `“${nameOf(id)}”`);
  const more = r.summary.components.length - names.length;
  const who = names.length ? names.join(", ") + (more > 0 ? ` +${more}` : "") : t("layout.history.aBlock");
  const key = `layout.history.op.${main}`;
  const text = t(key, { what: who, count: r.summary.ops[main] ?? 0 });
  return text === key ? t("layout.changes.genericRevision", { count: r.opsCount ?? 0 }) : text;
}

export interface TimelineGroup {
  key: string;
  byAgent: boolean;
  /** Who wrote this group: the person's or the agent's name, when the server knows it. */
  authorName: string | null;
  harness: string | null;
  /** Newest first, as the server lists them. */
  items: LayoutRevisionItem[];
  from: string | null;
  to: string | null;
}

/**
 * Consecutive writes by the same writer (a given agent, or a given person) close in
 * time become one group: a person's forty nudges read as one session, not forty
 * lines, and two people taking turns stay two people.
 */
export function groupTimeline(revisions: LayoutRevisionItem[], gapMinutes = 15): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  const time = (r: LayoutRevisionItem) => (r.createdAt ? Date.parse(r.createdAt) : NaN);
  for (const r of revisions) {
    const last = groups[groups.length - 1];
    const prev = last?.items[last.items.length - 1];
    const close = prev && Math.abs(time(prev) - time(r)) <= gapMinutes * 60_000;
    // An agent's writes each carry their own "why": they stay separate lines inside the group.
    const sameWriter = last && last.byAgent === r.byAgent && last.authorName === r.authorName;
    if (last && prev && sameWriter && (close || Number.isNaN(time(r)))) {
      last.items.push(r);
      last.from = r.createdAt ?? last.from;
    } else {
      groups.push({ key: `g${r.revision}`, byAgent: r.byAgent, authorName: r.authorName, harness: r.harness, items: [r], from: r.createdAt, to: r.createdAt });
    }
  }
  return groups;
}

export interface Thread {
  root: LayoutNote;
  replies: LayoutNote[];
  /** Position among the open threads (the number on the page pin); 0 when resolved. */
  number: number;
}

/** Annotations as conversations: roots with their replies, oldest first; open ones numbered for the pins. */
export function threadsOf(notes: LayoutNote[]): Thread[] {
  const annotations = notes.filter((n) => n.kind === "annotation" && n.code !== "review-request" && n.code !== "review-answer");
  const byRoot = new Map<string, LayoutNote[]>();
  for (const n of annotations) if (n.parentId) byRoot.set(n.parentId, [...(byRoot.get(n.parentId) ?? []), n]);
  const order = (a: LayoutNote, b: LayoutNote) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
  let open = 0;
  return annotations
    .filter((n) => !n.parentId)
    .sort(order)
    .map((root) => ({ root, replies: (byRoot.get(root.id) ?? []).sort(order), number: root.status === "resolved" ? 0 : ++open }));
}
