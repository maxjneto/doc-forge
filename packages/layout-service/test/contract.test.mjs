// The routes and response fields packages/backend/app/services/layout.py relies on.
// The lib tests its server in depth; this pins the contract against the vendored
// version, so updating the tarball fails here before it fails in the backend.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createLayoutServer } from "@docforge/layout/server";

const doc = () => ({
  format: "docforge/layout",
  version: 1,
  meta: { title: "Test" },
  surfaces: [{ id: "a4", kind: "page", size: "A4", margin: 40 }],
  sections: [{ id: "s-1", bands: [{ id: "b-1", span: "auto", items: [{ component: "t", colStart: 1, colSpan: 12 }] }] }],
  components: [{ id: "t", type: "text", content: { paragraphs: ["Hello"] } }],
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

  it("POST /apply -> ok, doc, diagnostics, map", async () => {
    const { body } = await post("/apply", {
      doc: doc(),
      ops: [{ op: "add", component: { id: "k", type: "kpi", content: { value: "42", label: "Answer" } }, at: { section: "s-1", band: "b-2", colStart: 1, colSpan: 4, newBand: {} } }],
    });
    assert.equal(body.ok, true);
    assert.ok(body.doc.components.some((c) => c.id === "k"));
    assert.equal(typeof body.map, "string");
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

  it("bad requests are 400 (the backend maps them to 422)", async () => {
    assert.equal((await post("/apply", { doc: doc(), ops: [] })).status, 400);
  });
});
