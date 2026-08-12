import { describe, it, expect } from "vitest";
import {
  diffLines,
  diffHunks,
  hunkCountsBySection,
  wordDiff,
  CHANGE_LABEL,
} from "@/utils/diff";

const OLD = ["# Doc", "", "## Um", "", "linha a", "linha b", "", "## Dois", "", "linha c"].join(
  "\n",
);

describe("diffLines", () => {
  it("reports no changes for identical text", () => {
    expect(diffLines(OLD, OLD).every((r) => r.kind === "context")).toBe(true);
  });

  it("pairs a replaced line as one del and one add", () => {
    const rows = diffLines(OLD, OLD.replace("linha a", "linha A!"));
    expect(rows.filter((r) => r.kind === "del").map((r) => r.text)).toEqual(["linha a"]);
    expect(rows.filter((r) => r.kind === "add").map((r) => r.text)).toEqual(["linha A!"]);
  });

  it("numbers old and new lines independently", () => {
    const rows = diffLines("a\nb", "a\nx\nb");
    const add = rows.find((r) => r.kind === "add")!;
    expect(add.oldLine).toBeNull();
    expect(add.newLine).toBe(2);
    const last = rows[rows.length - 1];
    expect(last.oldLine).toBe(2);
    expect(last.newLine).toBe(3);
  });
});

describe("diffHunks", () => {
  it("returns nothing when the texts match", () => {
    expect(diffHunks(OLD, OLD)).toEqual([]);
  });

  it("classifies rewrite, addition and removal", () => {
    expect(diffHunks(OLD, OLD.replace("linha a", "outra"))[0].kind).toBe("rewrite");
    expect(diffHunks(OLD, OLD.replace("linha a", "linha a\nnova"))[0].kind).toBe("addition");
    expect(diffHunks(OLD, OLD.replace("linha a\n", ""))[0].kind).toBe("removal");
  });

  it("exposes the labels the review screen shows", () => {
    expect(CHANGE_LABEL.rewrite).toBe("REESCRITA");
    expect(CHANGE_LABEL.addition).toBe("ADIÇÃO");
    expect(CHANGE_LABEL.removal).toBe("REMOÇÃO");
  });

  it("tags each hunk with the section it lands in", () => {
    const next = OLD.replace("linha c", "linha C alterada");
    const [hunk] = diffHunks(next === OLD ? OLD : OLD, next);
    expect(hunk.heading?.slug).toBe("dois");
  });

  it("numbers hunks 1..n in document order", () => {
    const next = OLD.replace("linha a", "X").replace("linha c", "Y");
    const hunks = diffHunks(next === OLD ? OLD : OLD, next, 0);
    expect(hunks.map((h) => h.index)).toEqual([1, 2]);
    expect(hunks[0].heading?.slug).toBe("um");
    expect(hunks[1].heading?.slug).toBe("dois");
  });

  it("merges nearby changes into one hunk", () => {
    const next = OLD.replace("linha a", "X").replace("linha b", "Y");
    expect(diffHunks(OLD, next)).toHaveLength(1);
  });

  it("never merges across a section boundary, however close", () => {
    // "linha b" and "linha c" are only a few lines apart, but "## Dois" sits
    // between them — one hunk cannot belong to two sections.
    const next = OLD.replace("linha b", "X").replace("linha c", "Y");
    const hunks = diffHunks(OLD, next);
    expect(hunks).toHaveLength(2);
    expect(hunks.map((h) => h.heading?.slug)).toEqual(["um", "dois"]);
  });
});

describe("hunkCountsBySection", () => {
  it("tallies hunks per section slug", () => {
    const next = OLD.replace("linha a", "X").replace("linha c", "Y");
    const counts = hunkCountsBySection(OLD, next);
    expect(counts["um"]).toBe(1);
    expect(counts["dois"]).toBe(1);
  });
});

describe("wordDiff", () => {
  it("marks only the words that differ", () => {
    const [left, right] = wordDiff("o servidor é o cano", "o servidor é o cofre");
    expect(left.filter((p) => p.changed).map((p) => p.text)).toEqual(["cano"]);
    expect(right.filter((p) => p.changed).map((p) => p.text)).toEqual(["cofre"]);
  });

  it("leaves an unchanged line entirely unpainted", () => {
    const [left, right] = wordDiff("igual", "igual");
    expect(left.some((p) => p.changed)).toBe(false);
    expect(right.some((p) => p.changed)).toBe(false);
  });
});
