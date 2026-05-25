import { describe, it, expect } from "vitest";

// Inline store creation for isolated test — avoids import side-effects
import type { SectionType } from "@/types";
import { SECTION_LABELS } from "@/store/workspace";

describe("workspace store", () => {
  it("SECTION_LABELS maps all 5 section types", () => {
    const types: SectionType[] = ["context", "proposal", "implementation", "risks", "body"];
    for (const t of types) {
      expect(SECTION_LABELS[t]).toBeDefined();
      expect(typeof SECTION_LABELS[t]).toBe("string");
    }
  });

  it("has exactly 5 section labels", () => {
    expect(Object.keys(SECTION_LABELS)).toHaveLength(5);
  });
});
