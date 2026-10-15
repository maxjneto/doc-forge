// The routes and response fields packages/backend/app/services/layout.py relies on.
// The lib tests its server in depth; this pins the contract against the vendored
// version, so updating the tarball fails here before it fails in the backend.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createLayoutServer } from "@docforge/layout/server";

const doc = () => ({
  format: "docforge/layout",
  version: 2,
  meta: { title: "Test" },
  surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }],
  components: [{ id: "t", type: "text", content: { paragraphs: ["Hello"] }, at: { page: 1, x: 0, y: 0, w: 89 } }],
});

let server;
let base;

before(async () => {
  server = createLayoutServer({ onError: () => {} });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const post = async (path, body) => {
  const res = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

describe("layout service contract", () => {
  it("GET /health", async () => {
    assert.equal((await fetch(`${base}/health`)).status, 200);
  });

  it("POST /validate -> ok, diagnostics, map, pages", async () => {
    const { body } = await post("/validate", { doc: doc() });
    assert.equal(body.ok, true);
    assert.ok(Array.isArray(body.diagnostics));
    assert.equal(typeof body.map, "string");
    assert.equal(body.pages, 1);
  });

  it("POST /apply -> ok, doc, diagnostics, changes, map", async () => {
    const { body } = await post("/apply", {
      doc: doc(),
      ops: [{ op: "add", component: { id: "k", type: "kpi", content: { value: "42", label: "Answer" } }, at: { below: "t", cols: [1, 4] } }],
      pages: [1],
      draw: false,
    });
    assert.equal(body.ok, true);
    assert.ok(body.doc.components.some((c) => c.id === "k"));
    assert.ok(Array.isArray(body.changes));
    assert.equal(typeof body.map, "string");
  });

  it("POST /apply reports side effects as changes with code, severity, component, message, recovery", async () => {
    const d = doc();
    d.components.push({ id: "u", type: "text", content: { paragraphs: ["below"] }, at: { page: 1, x: 0, y: 4, w: 89 } });
    const { body } = await post("/apply", { doc: d, ops: [{ op: "update", component: "t", content: { paragraphs: ["Hello", "a", "b", "c"] } }] });
    assert.equal(body.ok, true);
    const change = body.changes[0];
    assert.equal(change.code, "moved");
    assert.equal(change.component, "u");
    assert.equal(typeof change.severity, "string");
    assert.equal(typeof change.message, "string");
    assert.equal(change.recovery, false);
  });

  it("a malformed op is a 200 with an invalid-op diagnostic", async () => {
    const { status, body } = await post("/apply", { doc: doc(), ops: [{ op: "place", component: "t" }] });
    assert.equal(status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.diagnostics[0].code, "invalid-op");
  });

  it("POST /map -> level, text", async () => {
    const { body } = await post("/map", { doc: doc(), level: 2, components: ["t"] });
    assert.equal(body.level, 2);
    assert.match(body.text, /^t · text/m);
  });

  it("POST /diff -> changes", async () => {
    const after = doc();
    after.components[0].at.y = 10;
    const { body } = await post("/diff", { before: doc(), after });
    assert.equal(body.changes[0].code, "moved");
  });

  it("POST /measure -> ok, measurements, text", async () => {
    const { body } = await post("/measure", { component: { id: "x", type: "text", content: { paragraphs: ["Hello"] } }, doc: doc(), widths: [20], cols: [[1, 6]] });
    assert.equal(body.ok, true);
    assert.equal(body.measurements.length, 2);
    assert.equal(typeof body.measurements[0].rows, "number");
    assert.equal(typeof body.text, "string");
  });

  it("POST /find -> matches, text", async () => {
    const { body } = await post("/find", { doc: doc(), query: { text: "hello", page: 1 } });
    assert.deepEqual(body.matches.map((m) => m.id), ["t"]);
    assert.equal(typeof body.text, "string");
  });

  it("POST /locate -> anchors with component, under, text", async () => {
    const { body } = await post("/locate", { doc: doc(), anchors: [{ component: "t" }, { rect: { page: 1, x: 0, y: 0, w: 4, h: 4 } }] });
    assert.equal(body.anchors[0].component.exists, true);
    assert.deepEqual(body.anchors[1].under, ["t"]);
    assert.equal(typeof body.anchors[0].text, "string");
  });

  it("POST /review -> findings, text", async () => {
    const { body } = await post("/review", { doc: doc() });
    assert.ok(Array.isArray(body.findings));
    assert.equal(typeof body.text, "string");
  });

  it("POST /apply -> summary", async () => {
    const { body } = await post("/apply", { doc: doc(), ops: [{ op: "edit", component: "t", set: { "paragraphs.0": "hi" } }] });
    assert.equal(body.ok, true);
    assert.match(body.summary, /you changed/);
  });

  it("POST /calibrate -> ok, variants, text", async () => {
    const { body } = await post("/calibrate", { doc: doc(), target: { component: "t" }, variants: [{ fontSize: 22 }] });
    assert.equal(body.ok, true);
    assert.equal(body.variants.length, 2);
    assert.equal(typeof body.variants[1].components[0].h, "number");
    assert.equal(typeof body.text, "string");
  });

  it("compact and fit are ops; fit reports through diagnostics", async () => {
    const compacted = await post("/apply", { doc: doc(), ops: [{ op: "compact" }] });
    assert.equal(compacted.body.ok, true);
    const fitted = await post("/apply", { doc: doc(), ops: [{ op: "fit", pages: 1 }] });
    assert.equal(fitted.body.ok, true);
    assert.equal(fitted.body.diagnostics.find((d) => d.code === "fit-result").severity, "info");
  });

  it("POST /upgrade -> ok, doc, notes", async () => {
    const v1 = {
      format: "docforge/layout",
      version: 1,
      surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }],
      sections: [{ id: "s-1", bands: [{ id: "b-1", span: "auto", items: [{ component: "t", colStart: 1, colSpan: 12 }] }] }],
      components: [{ id: "t", type: "text", content: { paragraphs: ["Hello"] } }],
    };
    const { body } = await post("/upgrade", { doc: v1 });
    assert.equal(body.ok, true);
    assert.equal(body.doc.version, 2);
    assert.ok(Array.isArray(body.notes));
  });

  it("bad requests are 400 (the backend maps them to 422)", async () => {
    assert.equal((await post("/apply", { doc: doc(), ops: [] })).status, 400);
  });
});
