/**
 * Replaces window.fetch for API calls with fixture responses, so every
 * authenticated screen renders without a backend. Mutations answer with a
 * plausible body and mostly keep no state — the preview is for looking, not
 * for testing flows.
 */
import * as fx from "./fixtures";
import { createEngine, type Engine } from "@docforge-lib/layout";
import { loadRegistry } from "../src/components/layout-doc/fonts";
import { layoutContent } from "./layout";
import deckContent from "../../backend/app/layout_templates/apresentacao.json";
import { builtinThemes, themeFonts } from "./themes";

type Handler = (match: RegExpMatchArray, init: RequestInit | undefined, url: URL) => unknown;

/**
 * Layout documents keep state in the preview, so the editor can be tried for real:
 * ops run through the same library, revisions go up, side effects become notices.
 * Two documents: a report (pages) and a deck (slides).
 */
type Store = { content: unknown; revision: number; notes: Record<string, unknown>[]; revisions: Record<string, unknown>[] };
const storeOf = (content: unknown): Store => ({
  content: structuredClone(content),
  revision: 3,
  notes: [],
  revisions: [{ revision: 3, description: "Created", ops_count: null, by_agent: true, author_name: "Claude Code — laptop", harness: "claude_code", created_at: fx.ago(25), content: structuredClone(content), name: null, note: null, summary: null }],
});
const layoutStores: Record<string, Store> = { "doc-layout-q3": storeOf(layoutContent), "doc-layout-deck": storeOf(deckContent) };
const storeFor = (id: string) => layoutStores[id] ?? (layoutStores["doc-layout-q3"] as Store);
const layoutStore = layoutStores["doc-layout-q3"] as Store;

// What each layout document published (the public link serves this snapshot).
const published: Record<string, { token: string; revision: number; at: string; content: unknown }> = {};
const publication = (id: string) => {
  const entry = published[id];
  return {
    document_id: id,
    published: Boolean(entry),
    token: entry?.token ?? null,
    revision: entry?.revision ?? null,
    published_at: entry?.at ?? null,
    current_revision: storeFor(id).revision,
  };
};
const savedThemes: Record<string, unknown>[] = [];
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
    parent_id: null,
    for_agent: false,
  };
}

/** What a write did, from its ops (the backend's `summary`). */
function opsSummary(ops: unknown[] | null) {
  if (!ops?.length) return null;
  const counts: Record<string, number> = {};
  const components: string[] = [];
  for (const raw of ops as Record<string, unknown>[]) {
    const name = String(raw.op);
    counts[name] = (counts[name] ?? 0) + 1;
    const target = raw.component;
    const ids = name === "row" ? ((raw.items as unknown[]) ?? []).map((i) => (typeof i === "string" ? i : (i as { id?: string }).id)) : [typeof target === "object" && target ? (target as { id?: string }).id : target];
    for (const id of ids) if (typeof id === "string" && !components.includes(id)) components.push(id);
  }
  return { ops: counts, components: components.slice(0, 20) };
}

async function layoutWrite(store: Store, ops: unknown[] | null, replace: unknown | null, who: { byAgent?: boolean; note?: string } = {}) {
  const engine = await engineFor();
  const result = ops ? engine.apply(store.content, ops) : { ok: true, doc: replace, diagnostics: [], changes: engine.diff(store.content, replace) };
  if (!result.ok || !result.doc) return { ok: false, revision: store.revision, diagnostics: result.diagnostics, changes: [], map: "" };
  store.content = result.doc;
  store.revision += 1;
  store.revisions.unshift({
    revision: store.revision,
    description: who.note ?? (ops ? `${ops.length} layout operation${ops.length === 1 ? "" : "s"}` : "Layout replaced"),
    ops_count: ops?.length ?? null,
    by_agent: Boolean(who.byAgent),
    author_name: who.byAgent ? "Claude Code — laptop" : "Max Aragão",
    harness: who.byAgent ? "claude_code" : null,
    created_at: new Date().toISOString(),
    content: structuredClone(result.doc),
    name: null,
    note: null,
    summary: opsSummary(ops),
  });
  for (const change of result.changes) {
    for (const note of store.notes) {
      if (note.kind === "notice" && note.status === "open" && (note.anchor as { component?: string }).component === change.component) note.status = "resolved";
    }
    if (!change.recovery) store.notes.push(noticeFrom(change, store.revision));
  }
  return { ok: true, revision: store.revision, diagnostics: result.diagnostics, changes: result.changes, map: "" };
}

/** Notes as the backend lists them: the status picks threads by their root; replies follow. */
function listNotes(store: Store, url: URL) {
  const status = url.searchParams.get("status") ?? "open";
  const kind = url.searchParams.get("kind");
  const every = store.notes.filter((n) => !kind || n.kind === kind);
  const roots = every.filter((n) => !n.parent_id && (status === "all" || n.status === status));
  const kept = new Set(roots.map((n) => n.id));
  return { notes: every.filter((n) => kept.has(n.id) || kept.has(n.parent_id)), revision: store.revision };
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

  ["GET", /\/documents$/, () => ({ documents: fx.documents })],
  ["POST", /\/documents$/, () => fx.documents[0]],
  ["GET", /\/shared-documents$/, () => ({ documents: fx.sharedDocuments })],
  ["GET", /\/documents\/([^/]+)$/, (m) => fx.documentDetail(docFrom(m))],
  ["PATCH", /\/documents\/([^/]+)$/, (m, init) => ({ ...fx.documentDetail(docFrom(m)).document, ...bodyOf(init) })],
  // "Creating" a layout document opens one of the two the preview keeps (slides → the deck).
  ["POST", /\/layout-documents$/, (_m, init) => {
    const body = bodyOf(init);
    const id = body.template === "apresentacao" || body.format === "slide" ? "doc-layout-deck" : "doc-layout-q3";
    return { document_id: id, ok: true, revision: storeFor(id).revision, diagnostics: [], map: "" };
  }],
  ["GET", /\/documents\/([^/]+)\/layout$/, (m) => ({ document_id: docFrom(m), content: storeFor(docFrom(m)).content, revision: storeFor(docFrom(m)).revision, updated_at: fx.ago(25) })],
  ["POST", /\/documents\/([^/]+)\/layout\/ops$/, (m, init) => layoutWrite(storeFor(docFrom(m)), bodyOf(init).ops as unknown[], null, { note: bodyOf(init).note as string | undefined })],
  ["GET", /\/documents\/([^/]+)\/layout\/revisions$/, (m) => ({ revision: storeFor(docFrom(m)).revision, revisions: storeFor(docFrom(m)).revisions.map(({ content: _c, ...r }) => r) })],
  ["GET", /\/documents\/([^/]+)\/layout\/revisions\/(\d+)$/, (m) => storeFor(docFrom(m)).revisions.find((r) => r.revision === Number(m[2])) ?? {}],
  ["PATCH", /\/documents\/([^/]+)\/layout\/revisions\/(\d+)$/, (m, init) => {
    const r = storeFor(docFrom(m)).revisions.find((x) => x.revision === Number(m[2]));
    if (r) Object.assign(r, bodyOf(init));
    const { content: _c, ...rest } = r ?? {};
    return rest;
  }],
  ["POST", /\/documents\/([^/]+)\/layout\/versions$/, (m, init) => {
    const store = storeFor(docFrom(m));
    const body = bodyOf(init);
    const r = store.revisions.find((x) => x.revision === (body.revision ?? store.revision));
    if (r) Object.assign(r, { name: body.name, note: body.note ?? null });
    const { content: _c, ...rest } = r ?? {};
    return rest;
  }],
  ["GET", /\/documents\/([^/]+)\/layout\/publish$/, (m) => publication(docFrom(m))],
  ["POST", /\/documents\/([^/]+)\/layout\/publish$/, (m) => {
    const id = docFrom(m);
    const store = storeFor(id);
    published[id] = { token: published[id]?.token ?? `pub_layout_${id}`, revision: store.revision, at: new Date().toISOString(), content: structuredClone(store.content) };
    return publication(id);
  }],
  ["DELETE", /\/documents\/([^/]+)\/layout\/publish$/, (m) => {
    delete published[docFrom(m)];
    return publication(docFrom(m));
  }],
  ["GET", /\/public\/(pub_layout_[^/]+)$/, (m) => {
    const entry = Object.values(published).find((p) => p.token === m[1]);
    return entry ? { mode: "layout", title: "Relatório Q3", content: entry.content, revision: entry.revision, updated_at: entry.at } : {};
  }],
  ["PUT", /\/documents\/([^/]+)\/layout$/, (m, init) => layoutWrite(storeFor(docFrom(m)), null, bodyOf(init).content)],
  ["GET", /\/documents\/([^/]+)\/layout\/notes$/, (m, _i, url) => listNotes(storeFor(docFrom(m)), url)],
  ["POST", /\/documents\/([^/]+)\/layout\/notes$/, (m, init) => {
    const store = storeFor(docFrom(m));
    const body = bodyOf(init);
    const data = body.code === "review-answer" ? { answers: body.answers, request_id: body.request_id } : null;
    let parent = body.parent_id ? store.notes.find((n) => n.id === body.parent_id) : undefined;
    if (parent?.parent_id) parent = store.notes.find((n) => n.id === parent?.parent_id);
    if (parent && parent.status === "resolved") parent.status = "open";
    const note = {
      id: `a-${Date.now()}`,
      kind: "annotation",
      code: body.code ?? null,
      severity: "info",
      anchor: body.anchor ?? parent?.anchor ?? {},
      message: body.message,
      data,
      revision: store.revision,
      by_agent: false,
      author_name: "Max Aragão",
      status: "open",
      created_at: new Date().toISOString(),
      where: null,
      parent_id: parent?.id ?? null,
      for_agent: Boolean(body.for_agent) && !parent,
    };
    store.notes.push(note);
    return note;
  }],
  ["PATCH", /\/layout-notes\/([^/]+)$/, (m, init) => {
    const note = Object.values(layoutStores).flatMap((st) => st.notes).find((n) => n.id === m[1]);
    const body = bodyOf(init);
    if (note && body.status) note.status = body.status;
    if (note && body.for_agent !== undefined) note.for_agent = body.for_agent;
    return note ?? {};
  }],
  ["GET", /\/layout-themes$/, () => ({ themes: [...builtinThemes, ...savedThemes], fonts: themeFonts })],
  ["POST", /\/layout-themes$/, (_m, init) => {
    const body = bodyOf(init);
    const theme = { id: `t-${Date.now()}`, key: null, name: body.name, description: body.description ?? null, builtin: false, by_agent: false, tokens: body.tokens };
    savedThemes.push(theme);
    return theme;
  }],
  ["PATCH", /\/layout-themes\/([^/]+)$/, (m, init) => {
    const theme = savedThemes.find((x) => x.id === m[1]);
    if (theme) Object.assign(theme, bodyOf(init));
    return theme ?? {};
  }],
  ["GET", /\/documents\/([^/]+)\/activity$/, () => fx.activity],
  ["GET", /\/documents\/([^/]+)\/suggestions$/, (m, _i, url) => {
    const status = url.searchParams.get("status");
    const all = fx.suggestions(docFrom(m));
    return { suggestions: status ? all.filter((s) => s.status === status) : all };
  }],
  ["GET", /\/documents\/([^/]+)\/presence$/, () => fx.presence],
  ["GET", /\/documents\/([^/]+)\/feedback$/, (_m, _i, url) => {
    const status = url.searchParams.get("status");
    const roots = fx.feedback.filter((f) => !f.parent_id && (!status || f.status === status));
    const ids = new Set(roots.map((f) => f.id));
    return { feedback: [...roots, ...fx.feedback.filter((f) => ids.has(f.parent_id))] };
  }],
  ["POST", /\/documents\/([^/]+)\/feedback$/, (m, init) => {
    const body = bodyOf(init);
    const item = { id: `c-${Date.now()}`, document_id: docFrom(m), section_id: null, suggestion_id: null, parent_id: null, anchor: body.anchor ?? null, for_agent: Boolean(body.for_agent), content: body.content, status: "open", resolution_note: null, created_at: new Date().toISOString(), resolved_at: null, author_name: "Max Aragão", by_agent: false, harness: null, is_mine: true };
    fx.feedback.push(item);
    return item;
  }],
  ["POST", /\/feedback\/([^/]+)\/replies$/, (m, init) => {
    const root = fx.feedback.find((f) => f.id === m[1]);
    const item = { ...root, id: `c-${Date.now()}`, parent_id: m[1], for_agent: false, anchor: null, content: bodyOf(init).content, created_at: new Date().toISOString(), author_name: "Max Aragão", by_agent: false, harness: null, is_mine: true };
    fx.feedback.push(item);
    return item;
  }],
  ["POST", /\/feedback\/([^/]+)\/resolve$/, (m) => {
    const root = fx.feedback.find((f) => f.id === m[1]);
    if (root) Object.assign(root, { status: "resolved", resolved_at: new Date().toISOString() });
    return root ?? {};
  }],
  ["PATCH", /\/feedback\/([^/]+)$/, (m, init) => {
    const root = fx.feedback.find((f) => f.id === m[1]);
    const body = bodyOf(init);
    if (root && body.status === "open") Object.assign(root, { status: "open", resolved_at: null });
    if (root && typeof body.for_agent === "boolean") root.for_agent = body.for_agent;
    return root ?? {};
  }],
  ["GET", /\/documents\/([^/]+)\/quality-gate$/, () => fx.gate],
  ["GET", /\/documents\/([^/]+)\/audit-findings$/, () => fx.gate.findings],
  ["GET", /\/documents\/([^/]+)\/artifacts$/, (m) => ({ artifacts: fx.artifacts(docFrom(m)) })],
  ["GET", /\/documents\/([^/]+)\/members$/, () => fx.members],
  ["GET", /\/documents\/([^/]+)\/public-link$/, () => ({ token: "pub_preview", enabled: true })],
  ["POST", /\/documents\/([^/]+)\/public-link$/, (_m, _i, url) => ({ token: url.searchParams.get("enabled") === "true" ? "pub_preview" : null, enabled: url.searchParams.get("enabled") === "true" })],
  ["POST", /\/documents\/([^/]+)\/publish$/, () => ({ label: "v5" })],
  ["POST", /\/documents\/([^/]+)\/(archive|restore)$/, (m) => ({ ...fx.documentDetail(docFrom(m)).document, archived_at: m[2] === "archive" ? fx.ago(0) : null })],

  ["GET", /\/sections\/([^/]+)\/versions$/, (m) => fx.versions(m[1])],
  ["POST", /\/sections\/([^/]+)\/versions\/snapshot$/, (m) => fx.versions(m[1])[4]],
  ["PATCH", /\/sections\/([^/]+)\/content$/, (m) => fx.versions(m[1])[4]],
  ["POST", /\/suggestions\/([^/]+)\/(accept|reject|triage)$/, (m) => ({ ...fx.suggestions("doc-copasim")[0], status: m[2] === "reject" ? "rejected" : "accepted", resolved_at: fx.ago(0) })],

  ["GET", /\/folders$/, () => ({ folders: fx.folders })],
  ["POST", /\/folders$/, (_m, init) => ({ id: `f-${Date.now()}`, name: bodyOf(init).name, parent_id: bodyOf(init).parent_id ?? null })],
  ["PATCH", /\/folders\/([^/]+)$/, (m, init) => ({ ...fx.folders.find((f) => f.id === m[1]), ...bodyOf(init) })],
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
  await layoutWrite(layoutStore, ops, null, { byAgent: true, note: "Juntei a análise num parágrafo, aumentei o gráfico e sugeri um próximo passo." });
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
    parent_id: null,
    for_agent: false,
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

    if (method === "DELETE") {
      const theme = path.match(/\/layout-themes\/([^/]+)$/);
      if (theme) savedThemes.splice(savedThemes.findIndex((x) => x.id === theme[1]), 1);
      return new Response(null, { status: 204 });
    }
    console.warn(`[preview] no fixture for ${method} ${path}`);
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
