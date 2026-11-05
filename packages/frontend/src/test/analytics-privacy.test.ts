import { describe, expect, it } from "vitest";
import type { CaptureResult } from "posthog-js";
import { BLOCK_SELECTOR, MASK_TEXT_SELECTOR, maskForRecording, scrubEvent, scrubUrl } from "@/analytics/privacy";

describe("maskForRecording", () => {
  it("marks the body of a rendered page so its text is masked", () => {
    const html = '<!doctype html><html><head><title>Plano Q3</title></head><body class="dfl-doc"><p>Receita</p></body></html>';
    const out = maskForRecording(html);
    const doc = new DOMParser().parseFromString(out, "text/html");
    expect(doc.body.hasAttribute("data-ph-mask")).toBe(true);
    expect(doc.body.className).toBe("dfl-doc");
    expect(doc.querySelector("p")?.closest(MASK_TEXT_SELECTOR)).not.toBeNull();
  });

  it("handles a bare <body> and leaves html without one alone", () => {
    expect(maskForRecording("<html><body><p>x</p></body></html>")).toContain("<body data-ph-mask>");
    expect(maskForRecording("<p>x</p>")).toBe("<p>x</p>");
    expect(maskForRecording("")).toBe("");
  });

  it("blocks images inside a masked page", () => {
    const doc = new DOMParser().parseFromString(maskForRecording('<body><img src="a.png"></body>'), "text/html");
    expect(doc.querySelector("img")?.matches(BLOCK_SELECTOR)).toBe(true);
  });
});

describe("public link tokens", () => {
  it("never leave the browser", () => {
    expect(scrubUrl("https://doc-forge.dev/public/abc123XYZ?x=1")).toBe("https://doc-forge.dev/public/:token?x=1");
    expect(scrubUrl("/public/abc123")).toBe("/public/:token");
    expect(scrubUrl("https://doc-forge.dev/document/42")).toBe("https://doc-forge.dev/document/42");
  });

  it("are scrubbed from event and person properties", () => {
    const event = {
      uuid: "1",
      event: "$pageview",
      properties: { $current_url: "https://doc-forge.dev/public/tok_1", $pathname: "/public/tok_1", $referrer: "https://doc-forge.dev/public/tok_1#h", n: 3 },
      $set_once: { $initial_current_url: "https://doc-forge.dev/public/tok_1" },
    } as unknown as CaptureResult;
    const out = scrubEvent(event)!;
    expect(JSON.stringify(out)).not.toContain("tok_1");
    expect(out.properties.$pathname).toBe("/public/:token");
    expect(out.properties.n).toBe(3);
  });
});
