import { describe, expect, it } from "vitest";
import { normalizeLocale, translate } from "@/i18n";

describe("i18n", () => {
  it("normalizes Portuguese browser locales", () => {
    expect(normalizeLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeLocale("pt-PT")).toBe("pt-BR");
    expect(normalizeLocale("en-GB")).toBe("en");
  });

  it("translates stable interface terminology", () => {
    expect(translate("pt-BR", "nav.dashboard")).toBe("Painel");
    expect(translate("en", "nav.dashboard")).toBe("Dashboard");
    expect(translate("pt-BR", "editor.review")).toBe("Revisão");
    expect(translate("en", "editor.review")).toBe("Review");
  });

  it("interpolates variables", () => {
    expect(translate("pt-BR", "folder.moveDocument", { name: "RFC" })).toBe("Mover “RFC”");
    expect(translate("en", "dashboard.lastEditedBy", { name: "Codex" })).toBe("Last edited by Codex");
  });

  it("falls back to English and then to the key", () => {
    expect(translate("pt-BR", "language.english")).toBe("English");
    expect(translate("en", "missing.message")).toBe("missing.message");
  });
});
