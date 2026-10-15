/**
 * Replaces window.fetch for API calls with fixture responses, so every
 * authenticated screen renders without a backend. Mutations answer with a
 * plausible body and mostly keep no state — the preview is for looking, not
 * for testing flows.
 */
import * as fx from "./fixtures";
import { createEngine, type Engine } from "@docforge/layout";
import { loadRegistry } from "../src/components/layout-doc/fonts";
import { layoutContent } from "./layout";
import { guidedChat, guidedDetail, guidedDocuments, guidedFindings, guidedFolder, guidedVersions } from "./guided";

const allDocuments = [...fx.documents, ...guidedDocuments];
const detailFor = (id: string) => guidedDetail(id, fx.documents.find((d) => d.id === id)) ?? fx.documentDetail(id);

type Handler = (match: RegExpMatchArray, init: RequestInit | undefined, url: URL) => unknown;

/**
 * Layout documents keep state in the preview, so the editor can be tried for real:
 * ops run through the same library, revisions go up, side effects become notices.
 */
const layoutStore = {
  content: structuredClone(layoutContent) as unknown,
  revision: 3,
  notes: [] as Record<string, unknown>[],
  revisions: [{ revision: 3, description: "Created", ops_count: null, by_agent: true, created_at: fx.ago(25), content: structuredClone(layoutContent) as unknown }] as Record<string, unknown>[],
};
let layoutEngine: Promise<Engine> | null = null;
const engineFor = () => (layoutEngine ??= loadRegistry().then((registry) => createEngine({ registry })));

function noticeFrom(change: { code: string; severity: string; component?: string; message: string; recovery: boolean; data: Record<string, unknown> }, revision: number) {
  return {
    id: `n-${revision}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "notice",
    code: change.code,
    severity: change.severity,
    anchor: change.component ? { component: change.component } : {},
    message: change.message,
    data: change.data,
    revision,
    by_agent: false,
    status: "open",
    created_at: new Date().toISOString(),
    where: null,
  };
}

async function layoutWrite(ops: unknown[] | null, replace: unknown | null, who: { byAgent?: boolean; note?: string } = {}) {
  const engine = await engineFor();
  const result = ops ? engine.apply(layoutStore.content, ops) : { ok: true, doc: replace, diagnostics: [], changes: engine.diff(layoutStore.content, replace) };
  if (!result.ok || !result.doc) return { ok: false, revision: layoutStore.revision, diagnostics: result.diagnostics, changes: [], map: "" };
  layoutStore.content = result.doc;
  layoutStore.revision += 1;
  layoutStore.revisions.unshift({
    revision: layoutStore.revision,
    description: who.note ?? (ops ? `${ops.length} layout operation${ops.length === 1 ? "" : "s"}` : "Layout replaced"),
    ops_count: ops?.length ?? null,
    by_agent: Boolean(who.byAgent),
    created_at: new Date().toISOString(),
    content: structuredClone(result.doc),
  });
  for (const change of result.changes) {
    for (const note of layoutStore.notes) {
      if (note.kind === "notice" && note.status === "open" && (note.anchor as { component?: string }).component === change.component) note.status = "resolved";
    }
    if (!change.recovery) layoutStore.notes.push(noticeFrom(change, layoutStore.revision));
  }
  return { ok: true, revision: layoutStore.revision, diagnostics: result.diagnostics, changes: result.changes, map: "" };
}
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
  // The preview has one layout document: "creating" one opens it.
  ["POST", /\/layout-documents$/, () => ({ document_id: "doc-layout-q3", ok: true, revision: layoutStore.revision, diagnostics: [], map: "" })],
  ["GET", /\/documents\/([^/]+)\/layout$/, (m) => ({ document_id: docFrom(m), content: layoutStore.content, revision: layoutStore.revision, updated_at: fx.ago(25) })],
  ["POST", /\/documents\/([^/]+)\/layout\/ops$/, (_m, init) => layoutWrite(bodyOf(init).ops as unknown[], null, { note: bodyOf(init).note as string | undefined })],
  ["GET", /\/documents\/([^/]+)\/layout\/revisions$/, () => ({ revision: layoutStore.revision, revisions: layoutStore.revisions.map(({ content: _c, ...r }) => r) })],
  ["GET", /\/documents\/([^/]+)\/layout\/revisions\/(\d+)$/, (m) => layoutStore.revisions.find((r) => r.revision === Number(m[2])) ?? {}],
  ["PUT", /\/documents\/([^/]+)\/layout$/, (_m, init) => layoutWrite(null, bodyOf(init).content)],
  ["GET", /\/documents\/([^/]+)\/layout\/notes$/, () => ({ notes: layoutStore.notes.filter((n) => n.status === "open"), revision: layoutStore.revision })],
  ["POST", /\/documents\/([^/]+)\/layout\/notes$/, (_m, init) => {
    const body = bodyOf(init);
    const data = body.code === "review-answer" ? { answers: body.answers, request_id: body.request_id } : null;
    const note = { id: `a-${Date.now()}`, kind: "annotation", code: body.code ?? null, severity: "info", anchor: body.anchor ?? {}, message: body.message, data, revision: layoutStore.revision, by_agent: false, status: "open", created_at: new Date().toISOString(), where: null };
    layoutStore.notes.push(note);
    return note;
  }],
  ["PATCH", /\/layout-notes\/([^/]+)$/, (m, init) => {
    const note = layoutStore.notes.find((n) => n.id === m[1]);
    if (note) note.status = bodyOf(init).status;
    return note ?? {};
  }],
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

/** Open SSE streams: silent like an idle document, until the preview pretends an agent wrote. */
const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
function idleStream() {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streams.push(controller);
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}
function emit(type: string) {
  const chunk = new TextEncoder().encode(`data: ${JSON.stringify({ type, payload: { doc_id: "doc-layout-q3" } })}\n\n`);
  for (const c of streams) {
    try {
      c.enqueue(chunk);
    } catch {
      // A closed stream (the page moved on).
    }
  }
}

/**
 * Preview only: pretend an agent worked on the layout document through MCP, so the
 * review of its changes can be seen. Run `__previewAgent()` in the console.
 */
async function previewAgent() {
  const doc = layoutStore.content as { components: { id: string; type: string }[] };
  const text = doc.components.find((c) => c.type === "text" && c.id !== doc.components[0]?.id);
  const chart = doc.components.find((c) => c.type === "chart");
  const ops: unknown[] = [];
  if (text) ops.push({ op: "edit", component: text.id, set: { "paragraphs.0": "A receita cresceu **18%** puxada pelo plano Pro, com o churn caindo 0,4 p.p. depois da nova integração." } });
  if (chart) ops.push({ op: "place", component: chart.id, at: { h: 36 } });
  ops.push({ op: "add", component: { id: "nota-agente", type: "card", content: { eyebrow: "Próximo passo", title: "Revisar preços em novembro", text: "Proposta do agente." } }, at: { end: true, page: 1, cols: [1, 4] } });
  await layoutWrite(ops, null, { byAgent: true, note: "Juntei a análise num parágrafo, aumentei o gráfico e sugeri um próximo passo." });
  layoutStore.notes.push({
    id: `r-${Date.now()}`,
    kind: "annotation",
    code: "review-request",
    severity: "info",
    anchor: chart ? { component: chart.id } : {},
    message: "Montei a página 1 e deixei o gráfico mais alto. Dá uma olhada antes de eu seguir para a página 2.",
    data: { focus: [chart?.id, "nota-agente"].filter(Boolean), questions: [{ text: "O gráfico fica melhor ao lado do texto ou abaixo dele?", options: ["Ao lado", "Abaixo"] }] },
    revision: layoutStore.revision,
    by_agent: true,
    status: "open",
    created_at: new Date().toISOString(),
    where: null,
  });
  emit("layout_updated");
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  (window as unknown as { __previewAgent: () => Promise<void> }).__previewAgent = previewAgent;

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
        return new Response(JSON.stringify(json(await handler(match, init, url))), {
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
