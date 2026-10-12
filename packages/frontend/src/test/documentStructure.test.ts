import { describe, it, expect } from "vitest";
import {
  parseHeadings,
  headingAtLine,
  resolveAnchor,
  countBySection,
  offsetOfLine,
  lineAtOffset,
} from "@/utils/documentStructure";

const DOC = [
  "# CopaSim",
  "",
  "Intro paragraph.",
  "",
  "## A ideia central",
  "",
  "A sala é uma sessão do host.",
  "",
  "### Detalhe",
  "",
  "Mais texto.",
  "",
  "## Ciclo de vida",
  "",
  "```bash",
  "# não é um heading",
  "```",
  "",
  "Fim.",
].join("\n");

describe("parseHeadings", () => {
  it("captures level, text and slug in document order", () => {
    const h = parseHeadings(DOC);
    expect(h.map((x) => x.slug)).toEqual([
      "copasim",
      "a-ideia-central",
      "detalhe",
      "ciclo-de-vida",
    ]);
    expect(h[2].level).toBe(3);
  });

  it("ignores headings inside fenced code blocks", () => {
    const h = parseHeadings(DOC);
    expect(h.some((x) => x.text.includes("não é um heading"))).toBe(false);
  });

  it("closes each range at the next same-or-shallower heading", () => {
    const h = parseHeadings(DOC);
    const ideia = h.find((x) => x.slug === "a-ideia-central")!;
    const detalhe = h.find((x) => x.slug === "detalhe")!;
    // "## A ideia central" ends where "## Ciclo de vida" starts
    expect(ideia.endLine).toBe(11);
    // the h3 nested inside it ends at the same place
    expect(detalhe.endLine).toBe(11);
    // the last heading runs to the end of the document
    expect(h[h.length - 1].endLine).toBe(DOC.split("\n").length - 1);
  });

  it("disambiguates repeated headings", () => {
    const h = parseHeadings("## Notas\n\n## Notas\n");
    expect(h.map((x) => x.slug)).toEqual(["notas", "notas-1"]);
  });
});

describe("headingAtLine", () => {
  it("returns the deepest section covering the line", () => {
    const h = parseHeadings(DOC);
    expect(headingAtLine(h, 10)?.slug).toBe("detalhe");
    expect(headingAtLine(h, 6)?.slug).toBe("a-ideia-central");
    expect(headingAtLine(h, 2)?.slug).toBe("copasim");
  });
});

describe("offsets", () => {
  it("round-trips line ↔ offset", () => {
    for (const line of [0, 4, 8, 12]) {
      expect(lineAtOffset(DOC, offsetOfLine(DOC, line))).toBe(line);
    }
  });
});

describe("resolveAnchor", () => {
  it("finds an exact quote and reports point precision", () => {
    const r = resolveAnchor(DOC, { quote: "A sala é uma sessão do host." });
    expect(r.precision).toBe("quote");
    expect(DOC.slice(r.start, r.end)).toBe("A sala é uma sessão do host.");
    expect(r.heading?.slug).toBe("a-ideia-central");
  });

  it("survives a paragraph being reflowed", () => {
    const reflowed = DOC.replace(
      "A sala é uma sessão do host.",
      "A sala é uma\nsessão do host.",
    );
    const r = resolveAnchor(reflowed, { quote: "A sala é uma sessão do host." });
    expect(r.precision).toBe("quote");
  });

  it("falls back to the heading when the quote is gone", () => {
    const rewritten = DOC.replace("A sala é uma sessão do host.", "Outra coisa.");
    const r = resolveAnchor(rewritten, {
      headingSlug: "a-ideia-central",
      quote: "A sala é uma sessão do host.",
    });
    expect(r.precision).toBe("heading");
    expect(r.heading?.slug).toBe("a-ideia-central");
  });

  it("falls back to the document when the section is gone too", () => {
    const r = resolveAnchor("# Outro doc\n\nnada aqui", {
      headingSlug: "a-ideia-central",
      quote: "sumiu",
    });
    expect(r.precision).toBe("document");
    expect(r.start).toBe(0);
  });

  it("prefers the hit inside the claimed section when text repeats", () => {
    const doc = [
      "## Um",
      "",
      "repetido",
      "",
      "## Dois",
      "",
      "repetido",
    ].join("\n");
    const r = resolveAnchor(doc, { headingSlug: "dois", quote: "repetido" });
    expect(r.heading?.slug).toBe("dois");
  });
});

describe("countBySection", () => {
  it("tallies anchored items per section", () => {
    const items = [
      { quote: "A sala é uma sessão do host." },
      { headingSlug: "a-ideia-central", quote: "sumiu" },
      { quote: "Mais texto." },
      { headingSlug: "nao-existe", quote: "nada" },
    ];
    const counts = countBySection(DOC, items, (i) => i);
    expect(counts["a-ideia-central"]).toBe(2);
    expect(counts["detalhe"]).toBe(1);
    expect(counts["nao-existe"]).toBeUndefined();
  });
});
