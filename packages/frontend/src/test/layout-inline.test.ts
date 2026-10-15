import { describe, expect, it } from "vitest";
import { canEditInline, markdownToHtml, nodeToMarkdown } from "@/components/layout-doc/InlineTextEditor";
import type { Component } from "@docforge/layout";

const roundTrip = (md: string) => {
  const div = document.createElement("div");
  div.innerHTML = markdownToHtml(md);
  return nodeToMarkdown(div);
};

describe("inline text editing", () => {
  it("keeps the markdown subset through HTML", () => {
    expect(roundTrip("A receita cresceu **18%** com *upgrades* e `api`.")).toBe("A receita cresceu **18%** com *upgrades* e `api`.");
    expect(roundTrip("Veja a [nova integração](#grafico).")).toBe("Veja a [nova integração](#grafico).");
  });

  it("escapes HTML and never turns an unsafe link into a link", () => {
    expect(markdownToHtml("<img src=x onerror=alert(1)>")).not.toContain("<img");
    expect(markdownToHtml("[x](javascript:alert(1))")).not.toContain("<a");
  });

  it("only edits text blocks made of plain inline text", () => {
    expect(canEditInline({ id: "t", type: "text", content: { paragraphs: ["a", { role: "title-1", text: "b" }] } } as Component)).toBe(true);
    expect(canEditInline({ id: "t", type: "text", content: { paragraphs: [{ text: [{ text: "a", color: "$color.primary" }] }] } } as Component)).toBe(false);
    expect(canEditInline({ id: "k", type: "kpi", content: { value: "1", label: "x" } } as Component)).toBe(false);
  });
});
