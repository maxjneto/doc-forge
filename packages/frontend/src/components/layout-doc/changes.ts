/**
 * Layout side effects in the person's language. The library writes them in
 * English for agents; the code, component and data carry everything needed to
 * say the same thing here.
 */

type T = (key: string, vars?: Record<string, string | number>) => string;

interface Box {
  page: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface ChangeLike {
  code: string | null;
  component?: string | null;
  message: string;
  data?: Record<string, unknown> | null;
}

const isBox = (v: unknown): v is Box => !!v && typeof v === "object" && "page" in v && "y" in v;

/** `name` turns ids into what people call the blocks ("Receita"); ids are kept without it. */
export function describeChange(change: ChangeLike, t: T, name: (id: string) => string = (id) => id): string {
  const id = change.component ? name(change.component) : "";
  const data = change.data ?? {};
  switch (change.code) {
    case "moved":
    case "moved-page": {
      const before = data.before;
      const after = data.after;
      if (!isBox(before) || !isBox(after)) break;
      const by = typeof data.pushedBy === "string" ? name(data.pushedBy) : null;
      if (before.page !== after.page) {
        return t(by ? "layout.change.movedPageBy" : "layout.change.movedPage", { id, from: before.page, to: after.page, by: by ?? "" });
      }
      const dy = after.y - before.y;
      if (dy > 0) return t(by ? "layout.change.downBy" : "layout.change.down", { id, rows: dy, by: by ?? "" });
      if (dy < 0) return t("layout.change.up", { id, rows: -dy });
      return t("layout.change.sideways", { id });
    }
    case "resized":
      if (typeof data.before === "number" && typeof data.after === "number") return t("layout.change.resized", { id, before: data.before, after: data.after });
      break;
    case "split":
      if (Array.isArray(data.pieces)) return t("layout.change.split", { id, count: data.pieces.length });
      break;
    case "joined":
      return t("layout.change.joined", { id });
    case "page-count":
      if (typeof data.before === "number" && typeof data.after === "number") return t("layout.change.pageCount", { before: data.before, after: data.after });
      break;
    case "page-limit":
      if (typeof data.pages === "number" && typeof data.maxPages === "number") return t("layout.change.pageLimit", { pages: data.pages, max: data.maxPages });
      return t("layout.change.pageLimitBack");
  }
  return change.message;
}
