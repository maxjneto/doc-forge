// The service as it runs in Docker (`docforge-layout serve`), with resvg installed:
// /render-image must answer with a real PNG, drawn without a browser.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";

// The CLI sits next to the server entry in the package's dist/.
const cli = fileURLToPath(import.meta.resolve("@docforge/layout/server")).replace(/server\.js$/, "cli.js");
const port = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
let child;

const doc = {
  format: "docforge/layout",
  version: 2,
  surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }],
  components: [
    { id: "t", type: "text", content: { paragraphs: [{ role: "title-1", text: "Relatório" }] }, at: { page: 1, x: 0, y: 0, w: 89 } },
    { id: "k", type: "kpi", content: { value: "42", label: "Clientes" }, at: { page: 1, x: 0, y: 12, w: 28, h: 14 } },
  ],
};

before(async () => {
  child = spawn(process.execPath, [cli, "serve", "--host", "127.0.0.1", "--port", String(port)], { stdio: "pipe" });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("the service did not start");
});

after(() => child?.kill());

describe("page images", () => {
  it("POST /render-image -> a PNG of the page, at the scale asked", async () => {
    const res = await fetch(`${base}/render-image`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc, page: 1, scale: 0.5, highlight: ["k"] }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    const png = Buffer.from(body.png, "base64");
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(body.width, 397);
    assert.equal(body.height, 561);
    assert.equal(body.pages, 1);
  });
});
