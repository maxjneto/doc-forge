/**
 * Internal layout service: runs @docforge/layout for the Python backend.
 *
 * Stateless — every request carries the whole document. The backend owns
 * storage, auth and revisions; this process only measures, validates, applies
 * operations and writes the text map the agent reads. It is reachable only on
 * the internal network (no published port, no proxy route).
 *
 *   GET  /health
 *   POST /validate  { doc, surface? }                 -> { ok, diagnostics, map, pages }
 *   POST /apply     { doc, ops, surface? }            -> { ok, doc, diagnostics, map }
 *   POST /map       { doc, level, components?, surface? } -> { level, text }
 */

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { createEngine } from "@docforge/layout";
import { createNodeRegistry } from "@docforge/layout/node";

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 2_000_000);

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(json) });
  res.end(json);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, `Request body is larger than ${MAX_BODY_BYTES} bytes.`);
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return body;
  } catch {
    throw new HttpError(400, "Request body must be a JSON object.");
  }
}

function requireDoc(body) {
  if (body.doc === null || typeof body.doc !== "object" || Array.isArray(body.doc)) {
    throw new HttpError(400, "`doc` must be a layout document object.");
  }
  return body.doc;
}

function surfaceOf(body) {
  if (body.surface === undefined || body.surface === null) return undefined;
  if (typeof body.surface !== "string") throw new HttpError(400, "`surface` must be a surface id.");
  return body.surface;
}

const hasErrors = (diagnostics) => diagnostics.some((d) => d.severity === "error");

/** Request handler around one engine (one font registry, loaded once). */
export function createHandler(engine) {
  const routes = {
    "POST /validate": (body) => {
      const doc = requireDoc(body);
      const surfaceId = surfaceOf(body);
      const layout = engine.layout(doc, surfaceId);
      return {
        ok: !hasErrors(layout.diagnostics),
        diagnostics: layout.diagnostics,
        map: engine.map(doc, { level: 1, surfaceId }).text,
        pages: layout.pages.length,
      };
    },

    "POST /apply": (body) => {
      const doc = requireDoc(body);
      if (!Array.isArray(body.ops) || body.ops.length === 0) throw new HttpError(400, "`ops` must be a non-empty array.");
      const surfaceId = surfaceOf(body);
      try {
        return engine.apply(doc, body.ops, { surfaceId });
      } catch (error) {
        // Operations are not schema-checked by the lib yet, so a malformed one
        // can throw. Report it the way the agent reads every other problem.
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          doc: null,
          diagnostics: [
            {
              severity: "error",
              code: "invalid-op",
              message: `The operations could not be applied (${message}). Check each op's fields against the layout guide.`,
            },
          ],
          map: "",
        };
      }
    },

    "POST /map": (body) => {
      const doc = requireDoc(body);
      const level = body.level ?? 1;
      if (![0, 1, 2].includes(level)) throw new HttpError(400, "`level` must be 0, 1 or 2.");
      if (body.components !== undefined && (!Array.isArray(body.components) || !body.components.every((c) => typeof c === "string"))) {
        throw new HttpError(400, "`components` must be an array of component ids.");
      }
      return engine.map(doc, { level, components: body.components, surfaceId: surfaceOf(body) });
    },
  };

  return async function handle(req, res) {
    try {
      const path = new URL(req.url ?? "/", "http://layout").pathname;
      if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true });
      const route = routes[`${req.method} ${path}`];
      if (!route) throw new HttpError(404, `No route for ${req.method} ${path}.`);
      send(res, 200, route(await readJson(req)));
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { error: error.message });
      console.error(error);
      send(res, 500, { error: "Internal error while running the layout engine." });
    }
  };
}

export function createApp() {
  return createServer(createHandler(createEngine({ registry: createNodeRegistry() })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8002);
  const host = process.env.HOST ?? "0.0.0.0";
  createApp().listen(port, host, () => console.log(`layout-service listening on ${host}:${port}`));
}
