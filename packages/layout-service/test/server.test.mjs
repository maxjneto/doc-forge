import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../server.mjs";

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
  server = createApp();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const post = async (path, body) => {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

describe("layout-service", () => {
  it("reports health", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });

  it("validates a document and returns the level-1 map", async () => {
    const { status, body } = await post("/validate", { doc: doc() });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.pages, 1);
    assert.match(body.map, /s-1/);
  });

  it("flags an invalid document", async () => {
    const { body } = await post("/validate", { doc: { format: "docforge/layout" } });
    assert.equal(body.ok, false);
    assert.equal(body.diagnostics[0].code, "schema");
  });

  it("applies operations and returns the new document", async () => {
    const { body } = await post("/apply", {
      doc: doc(),
      ops: [
        {
          op: "add",
          component: { id: "k", type: "kpi", content: { value: "42", label: "Answer" } },
          at: { section: "s-1", band: "b-2", colStart: 1, colSpan: 4, newBand: { span: "auto" } },
        },
      ],
    });
    assert.equal(body.ok, true, JSON.stringify(body.diagnostics));
    assert.ok(body.doc.components.some((c) => c.id === "k"));
    assert.match(body.map, /k kpi 1-4/);
  });

  it("reports operation errors without a document", async () => {
    const { body } = await post("/apply", { doc: doc(), ops: [{ op: "remove", component: "missing" }] });
    assert.equal(body.ok, false);
    assert.equal(body.diagnostics[0].code, "invalid-op");
  });

  it("turns a malformed operation into a diagnostic instead of a 500", async () => {
    const { status, body } = await post("/apply", { doc: doc(), ops: [{ op: "add", component: { id: "x", type: "text", content: { paragraphs: ["x"] } } }] });
    assert.equal(status, 200);
    assert.equal(body.ok, false);
    assert.equal(body.diagnostics[0].code, "invalid-op");
  });

  it("returns a map at the requested level", async () => {
    const { body } = await post("/map", { doc: doc(), level: 0 });
    assert.equal(body.level, 0);
    assert.match(body.text, /sections:/);
  });

  it("rejects bad requests", async () => {
    assert.equal((await post("/validate", "not json")).status, 400);
    assert.equal((await post("/validate", {})).status, 400);
    assert.equal((await post("/apply", { doc: doc(), ops: [] })).status, 400);
    assert.equal((await post("/map", { doc: doc(), level: 7 })).status, 400);
    assert.equal((await post("/nope", {})).status, 404);
  });

  it("rejects bodies over the size limit", async () => {
    const huge = { doc: { pad: "x".repeat(2_100_000) } };
    assert.equal((await post("/validate", huge)).status, 413);
  });
});
