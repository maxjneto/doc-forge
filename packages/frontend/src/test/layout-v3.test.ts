import { describe, expect, it } from "vitest";
import { createEngine, mergeTokens, type LayoutDocument } from "@docforge-lib/layout";
import { createNodeRegistry } from "@docforge-lib/layout/node";
import { describeRevision, groupTimeline, threadsOf } from "@/components/layout-doc/history";
import { newSlideOps } from "@/components/layout-doc/SlideRail";
import { completeTheme, contrast, currentTheme, draftSize, presetKey, readability, RADIUS_PRESETS, themeOps, withDraft } from "@/components/layout-doc/themes";
import { translate } from "@/i18n";
import type { LayoutNote, LayoutRevisionItem, LayoutTheme } from "@/utils/api";

const engine = createEngine({ registry: createNodeRegistry() });
const t = (key: string, vars?: Record<string, string | number>) => translate("pt-BR", key, vars);
const doc = (extra: Partial<LayoutDocument> = {}): LayoutDocument =>
  ({ format: "docforge/layout", version: 3, surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }], components: [], ...extra }) as LayoutDocument;

const theme = (name: string, color: Record<string, string>, key: string | null = null): LayoutTheme => ({ id: key ? `builtin:${key}` : name, key, name, description: null, builtin: Boolean(key), byAgent: false, tokens: { color } });

describe("themes", () => {
  it("completes a partial theme so applying it resets what it leaves out", () => {
    const full = completeTheme({ color: { primary: "#ff0055" } });
    expect(full.color?.primary).toBe("#ff0055");
    expect(full.color?.surface).toBe("#ffffff");
    expect(full.font?.heading).toBe("Inter");
    expect(full.radius?.m).toBe(8);
  });

  it("applies as one setTokens and the theme's name, which the engine accepts", () => {
    const ops = themeOps(theme("Noite", { surface: "#14161a", text: "#eef0f3" }));
    const result = engine.apply(doc(), ops);
    expect(result.ok).toBe(true);
    expect(result.doc?.meta?.theme).toBe("Noite");
    expect(mergeTokens(result.doc?.tokens).color.surface).toBe("#14161a");
  });

  it("recognizes the current theme by name while its colors still match, and by colors otherwise", () => {
    const night = theme("Noite", { surface: "#14161a" }, "night");
    const sober = theme("Sóbrio", {}, "sober");
    const applied = engine.apply(doc(), themeOps(night)).doc as LayoutDocument;
    expect(currentTheme(applied, [sober, night])?.name).toBe("Noite");
    const edited = engine.apply(applied, [{ op: "setTokens", tokens: { color: { surface: "#000000" } } }]).doc as LayoutDocument;
    expect(currentTheme(edited, [sober, night])).toBeNull();
    expect(currentTheme(doc(), [sober, night])?.name).toBe("Sóbrio");
  });

  it("shows a draft over the document without touching it", () => {
    const base = doc({ tokens: { color: { primary: "#111111" } } });
    const shown = withDraft(base, { color: { surface: "#222222" } });
    expect(shown.tokens?.color).toEqual({ primary: "#111111", surface: "#222222" });
    expect(base.tokens?.color).toEqual({ primary: "#111111" });
    expect(withDraft(base, null)).toBe(base);
    expect(draftSize({ color: { a: "#1", b: "#2" }, radius: { m: 4 } })).toBe(3);
  });

  it("warns when text would be hard to read on the page", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    const dark = mergeTokens({ color: { surface: "#14161a", text: "#1a1c1e" } });
    expect(readability(dark).map((r) => r.pair.join("/"))).toContain("text/surface");
    expect(readability(mergeTokens({}))).toEqual([]);
  });

  it("names the corner preset the radii match", () => {
    expect(presetKey(RADIUS_PRESETS, { none: 0, s: 4, m: 8 })).toBe("round");
    expect(presetKey(RADIUS_PRESETS, { none: 0, s: 5, m: 9 })).toBeNull();
  });
});

const rev = (revision: number, minutesAgo: number, extra: Partial<LayoutRevisionItem> = {}): LayoutRevisionItem => ({
  revision,
  description: `${1} layout operation`,
  opsCount: 1,
  byAgent: false,
  authorName: null,
  harness: null,
  createdAt: new Date(Date.UTC(2026, 9, 15, 12, 0) - minutesAgo * 60_000).toISOString(),
  name: null,
  note: null,
  summary: { ops: { place: 1 }, components: ["k1"] },
  ...extra,
});

describe("timeline", () => {
  it("groups a person's close edits into one session and keeps agents apart", () => {
    const groups = groupTimeline([rev(6, 0), rev(5, 2), rev(4, 5, { byAgent: true }), rev(3, 6, { byAgent: true }), rev(2, 60), rev(1, 62)]);
    expect(groups.map((g) => [g.byAgent, g.items.map((r) => r.revision)])).toEqual([
      [false, [6, 5]],
      [true, [4, 3]],
      [false, [2, 1]],
    ]);
  });

  it("splits a person's edits far apart in time", () => {
    expect(groupTimeline([rev(2, 0), rev(1, 120)])).toHaveLength(2);
  });

  it("keeps two people (or two agents) taking turns apart", () => {
    const groups = groupTimeline([
      rev(4, 0, { authorName: "Ana" }),
      rev(3, 1, { authorName: "Bruno" }),
      rev(2, 2, { authorName: "Bruno" }),
      rev(1, 3, { byAgent: true, authorName: "Claude Code" }),
    ]);
    expect(groups.map((g) => [g.authorName, g.items.length])).toEqual([
      ["Ana", 1],
      ["Bruno", 2],
      ["Claude Code", 1],
    ]);
  });

  it("describes a write by its note, else by what its ops did, in the person's words", () => {
    const nameOf = (id: string) => (id === "k1" ? "Receita" : id);
    expect(describeRevision(rev(3, 0, { description: "Juntei a análise" }), t, nameOf)).toBe("Juntei a análise");
    expect(describeRevision(rev(3, 0), t, nameOf)).toBe("Moveu ou redimensionou “Receita”");
    expect(describeRevision(rev(3, 0, { summary: { ops: { place: 1, add: 1 }, components: ["k1", "k2", "k3"] } }), t, nameOf)).toBe("Adicionou “Receita”, “k2” +1");
    expect(describeRevision(rev(3, 0, { description: "Tema: Noite" }), t, nameOf)).toBe("Aplicou o tema “Noite”");
    expect(describeRevision(rev(1, 0, { description: "Created", summary: null }), t, nameOf)).toBe("Criado");
  });
});

const note = (id: string, extra: Partial<LayoutNote> = {}): LayoutNote => ({
  id,
  kind: "annotation",
  code: null,
  severity: "info",
  anchor: { component: "k1" },
  message: id,
  data: null,
  revision: 1,
  byAgent: false,
  authorUserId: null,
  authorName: null,
  harness: null,
  status: "open",
  resolutionNote: null,
  createdAt: `2026-10-15T12:0${id.length}:00Z`,
  where: null,
  parentId: null,
  forAgent: false,
  ...extra,
});

describe("comment threads", () => {
  it("puts replies under their root and numbers the open threads for the pins", () => {
    const threads = threadsOf([
      note("a"),
      note("bb", { parentId: "a", byAgent: true }),
      note("ccc", { status: "resolved" }),
      note("dddd"),
      note("n", { kind: "notice" }),
      note("r", { code: "review-request" }),
    ]);
    expect(threads.map((th) => [th.root.id, th.number, th.replies.map((r) => r.id)])).toEqual([
      ["a", 1, ["bb"]],
      ["ccc", 0, []],
      ["dddd", 2, []],
    ]);
  });
});

describe("slides", () => {
  it("adds a slide after the current one with a title on it", () => {
    const deck = doc({
      surfaces: [{ id: "s", kind: "page", size: "Slide", margin: 56 }],
      components: [
        { id: "a", type: "text", content: { paragraphs: ["Um"] }, at: { page: 1, x: 0, y: 0, w: 40 } },
        { id: "b", type: "text", content: { paragraphs: ["Dois"] }, at: { page: 2, x: 0, y: 0, w: 40 } },
      ] as LayoutDocument["components"],
    });
    const { ops, id } = newSlideOps(deck, engine.layout(deck), 1, "Título do slide");
    const result = engine.apply(deck, ops);
    expect(result.ok).toBe(true);
    const after = engine.layout(result.doc as LayoutDocument);
    expect(after.pages).toHaveLength(3);
    expect(after.components[id]?.box.page).toBe(2);
    expect(after.components.b?.box.page).toBe(3);
  });
});
