/**
 * Replaces window.fetch for API calls with fixture responses, so every
 * authenticated screen renders without a backend. Mutations answer with a
 * plausible body and mostly keep no state — the preview is for looking, not
 * for testing flows.
 */
import * as fx from "./fixtures";
import { guidedChat, guidedDetail, guidedDocuments, guidedFindings, guidedFolder, guidedVersions } from "./guided";

const allDocuments = [...fx.documents, ...guidedDocuments];
const detailFor = (id: string) => guidedDetail(id, fx.documents.find((d) => d.id === id)) ?? fx.documentDetail(id);

type Handler = (match: RegExpMatchArray, init: RequestInit | undefined, url: URL) => unknown;
type Route = [method: string, pattern: RegExp, handler: Handler];

const json = (body: unknown) => body;
const docFrom = (m: RegExpMatchArray) => m[1];
const bodyOf = (init?: RequestInit) => {
  try {
    return JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const routes: Route[] = [
  ["GET", /\/tiers$/, () => ({ tiers: fx.tiers })],
  ["GET", /\/users\/me$/, () => fx.me],
  ["GET", /\/users\/me\/activity$/, () => ({ events: fx.myActivity })],
  ["GET", /\/users\/api-keys$/, () => fx.apiKeys],
  ["POST", /\/users\/api-keys$/, (_m, init) => ({ ...fx.apiKeys[0], id: "k-new", name: bodyOf(init).name, key: "df_live_preview_0000000000000000", created_at: fx.ago(0) })],
  ["PATCH", /\/users\/api-keys\/([^/]+)$/, (m, init) => ({ ...fx.apiKeys.find((k) => k.id === m[1]), ...bodyOf(init) })],

  ["GET", /\/documents$/, () => ({ documents: allDocuments })],
  ["POST", /\/documents$/, () => fx.documents[0]],
  ["GET", /\/shared-documents$/, () => ({ documents: fx.sharedDocuments })],
  ["GET", /\/documents\/([^/]+)$/, (m) => detailFor(docFrom(m))],
  ["PATCH", /\/documents\/([^/]+)$/, (m, init) => ({ ...fx.documentDetail(docFrom(m)).document, ...bodyOf(init) })],
  ["GET", /\/documents\/([^/]+)\/activity$/, () => fx.activity],
  ["GET", /\/documents\/([^/]+)\/suggestions$/, (m, _i, url) => {
    const status = url.searchParams.get("status");
    const all = fx.suggestions(docFrom(m));
    return { suggestions: status ? all.filter((s) => s.status === status) : all };
  }],
  ["GET", /\/documents\/([^/]+)\/feedback$/, () => ({ feedback: [] })],
  ["GET", /\/documents\/([^/]+)\/quality-gate$/, () => fx.gate],
  ["GET", /\/documents\/([^/]+)\/audit-findings$/, (m) => (docFrom(m).startsWith("doc-pipe") ? guidedFindings(docFrom(m)) : fx.gate.findings)],
  ["GET", /\/documents\/([^/]+)\/artifacts$/, (m) => ({ artifacts: fx.artifacts(docFrom(m)) })],
  ["GET", /\/documents\/([^/]+)\/members$/, () => fx.members],
  ["GET", /\/documents\/([^/]+)\/public-link$/, () => ({ token: "pub_preview", enabled: true })],
  ["POST", /\/documents\/([^/]+)\/public-link$/, (_m, _i, url) => ({ token: url.searchParams.get("enabled") === "true" ? "pub_preview" : null, enabled: url.searchParams.get("enabled") === "true" })],
  ["POST", /\/documents\/([^/]+)\/publish$/, () => ({ label: "v5" })],
  ["POST", /\/documents\/([^/]+)\/(archive|restore)$/, (m) => ({ ...fx.documentDetail(docFrom(m)).document, archived_at: m[2] === "archive" ? fx.ago(0) : null })],

  ["GET", /\/sections\/([^/]+)\/versions$/, (m) => (m[1].startsWith("sec-doc-pipe") ? guidedVersions(m[1]) : fx.versions(m[1]))],
  ["POST", /\/sections\/([^/]+)\/versions\/snapshot$/, (m) => fx.versions(m[1])[4]],
  ["PATCH", /\/sections\/([^/]+)\/content$/, (m) => fx.versions(m[1])[4]],
  ["GET", /\/sections\/([^/]+)\/chat$/, (m) => (m[1].startsWith("sec-doc-pipe-refinement") ? guidedChat(m[1]) : [])],
  ["POST", /\/suggestions\/([^/]+)\/(accept|reject|triage)$/, (m) => ({ ...fx.suggestions("doc-copasim")[0], status: m[2] === "reject" ? "rejected" : "accepted", resolved_at: fx.ago(0) })],

  ["GET", /\/folders$/, () => ({ folders: [...fx.folders, guidedFolder] })],
  ["POST", /\/folders$/, (_m, init) => ({ id: `f-${Date.now()}`, name: bodyOf(init).name, parent_id: bodyOf(init).parent_id ?? null })],
  ["PATCH", /\/folders\/([^/]+)$/, (m, init) => ({ ...fx.folders.find((f) => f.id === m[1]), ...bodyOf(init) })],

  ["GET", /\/document-types$/, () => fx.documentTypes],
  ["GET", /\/document-types\/([^/]+)$/, (m) => fx.documentTypes.find((d) => d.slug === m[1]) ?? fx.documentTypes[0]],
  ["GET", /\/pipeline-definitions$/, () => fx.pipelineDefinitions],
];

/** Keeps the SSE connection open and silent, like an idle document. */
function idleStream() {
  const stream = new ReadableStream({ start() {} });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.origin);
    const apiIndex = url.pathname.indexOf("/api/");
    if (apiIndex === -1) return realFetch(input, init);

    const path = url.pathname.slice(apiIndex + 4);
    const method = (init?.method ?? "GET").toUpperCase();

    if (path.endsWith("/stream")) return idleStream();
    if (path.includes("/export")) {
      return new Response(JSON.stringify({ detail: "Export is disabled in the design preview" }), { status: 403 });
    }

    for (const [m, pattern, handler] of routes) {
      if (m !== method) continue;
      const match = path.match(pattern);
      if (match) {
        await new Promise((r) => setTimeout(r, 60));
        return new Response(JSON.stringify(json(handler(match, init, url))), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (method === "DELETE") return new Response(null, { status: 204 });
    console.warn(`[preview] no fixture for ${method} ${path}`);
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
