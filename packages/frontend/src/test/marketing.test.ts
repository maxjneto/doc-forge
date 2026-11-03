import { describe, expect, it } from "vitest";
import { COMPONENT_TYPES, createEngine, reviewLayout } from "@docforge-lib/layout";
import { createNodeRegistry } from "@docforge-lib/layout/node";
import { GCD_COMPONENT_TYPES } from "@/components/marketing/componentTypes";
import demo from "@/components/marketing/demo/report-demo.json";

const engine = createEngine({ registry: createNodeRegistry() });

describe("marketing pages", () => {
  it("list every component type the library has", () => {
    expect([...GCD_COMPONENT_TYPES].sort()).toEqual([...COMPONENT_TYPES].sort());
  });

  it("replay a demo that spills onto page 2 and fits back on one page", () => {
    let doc: unknown = demo.base;
    const pages: number[] = [];
    for (const step of demo.steps) {
      const result = engine.apply(doc, step.ops);
      expect(result.ok, step.key).toBe(true);
      doc = result.doc;
      pages.push(engine.layout(doc).pages.length);
    }
    const keys = demo.steps.map((s) => s.key);
    expect(pages[keys.indexOf("more")]).toBe(2);
    expect(pages[pages.length - 1]).toBe(1);
    expect(reviewLayout(engine.layout(doc)).findings).toEqual([]);
  });

  it("apply every demo theme", () => {
    for (const theme of demo.themes) expect(engine.apply(demo.base, theme.ops).ok, theme.name).toBe(true);
  });
});
