import { describe, expect, it } from "vitest";
import { defaultTokens, type Component } from "@docforge-lib/layout";
import { canEditInline } from "@/components/layout-doc/InlineTextEditor";
import { nestItems } from "@/components/layout-doc/InlineBlockEditors";
import { paragraphsToHtml, readParagraphs } from "@/components/layout-doc/ParagraphsEditable";
import { inlineToHtml, nodeToInline, tokenFor } from "@/components/layout-doc/richText";

const tokens = defaultTokens;
const roundTrip = (inline: Parameters<typeof inlineToHtml>[0]) => {
  const div = document.createElement("div");
  div.innerHTML = inlineToHtml(inline, tokens);
  return nodeToInline(div, tokens);
};

describe("inline text editing", () => {
  it("keeps the markdown subset through HTML", () => {
    expect(roundTrip("A receita cresceu **18%** com *upgrades* e `api`.")).toBe("A receita cresceu **18%** com *upgrades* e `api`.");
    expect(roundTrip("Veja a [nova integração](#grafico).")).toBe("Veja a [nova integração](#grafico).");
  });

  it("keeps colors and highlights as runs, by token", () => {
    const runs = [{ text: "leem só " }, { text: "as execuções concluídas", bold: true, color: "$color.danger" }, { text: " desse agente", highlight: true }];
    expect(roundTrip(runs)).toEqual(runs);
  });

  it("reads what the browser's own commands write (font colors, background colors)", () => {
    const div = document.createElement("div");
    div.innerHTML = `Preço <font color="${tokens.color.primary}">anual</font> com <span style="background-color: ${tokens.color.highlight}">desconto</span>`;
    expect(nodeToInline(div, tokens)).toEqual([{ text: "Preço " }, { text: "anual", color: "$color.primary" }, { text: " com " }, { text: "desconto", highlight: true }]);
    expect(tokenFor("rgb(31, 79, 216)", tokens)).toBe("$color.primary");
  });

  it("escapes HTML and never turns an unsafe link into a link", () => {
    expect(inlineToHtml("<img src=x onerror=alert(1)>", tokens)).not.toContain("<img");
    expect(inlineToHtml("[x](javascript:alert(1))", tokens)).not.toContain("<a");
  });

  it("edits every text block in place, runs included", () => {
    expect(canEditInline({ id: "t", type: "text", content: { paragraphs: ["a", { role: "title-1", text: "b" }] } } as Component)).toBe(true);
    expect(canEditInline({ id: "t", type: "text", content: { paragraphs: [{ text: [{ text: "a", color: "$color.primary" }] }] } } as Component)).toBe(true);
    expect(canEditInline({ id: "k", type: "kpi", content: { value: "1", label: "x" } } as Component)).toBe(false);
  });

  it("reads paragraphs back with their roles, the default one left implicit", () => {
    const div = document.createElement("div");
    div.innerHTML = paragraphsToHtml(["Corpo", { role: "title-2", text: "Título" }, { role: "body", text: [{ text: "cor", color: "$color.danger" }] }], "body", tokens, () => "");
    expect(readParagraphs(div, "body", tokens)).toEqual(["Corpo", { role: "title-2", text: "Título" }, { role: "body", text: [{ text: "cor", color: "$color.danger" }] }]);
  });
});

describe("list items edited in place", () => {
  it("nests flat items by depth and keeps plain items plain", () => {
    expect(nestItems([{ text: "a", depth: 0 }, { text: "b", depth: 1 }, { text: "c", depth: 2 }, { text: "d", depth: 0, checked: true }])).toEqual([
      { text: "a", items: [{ text: "b", items: ["c"] }] },
      { text: "d", checked: true },
    ]);
    // A depth deeper than the previous item allows is pulled up.
    expect(nestItems([{ text: "a", depth: 0 }, { text: "b", depth: 3 }])).toEqual([{ text: "a", items: ["b"] }]);
  });
});
