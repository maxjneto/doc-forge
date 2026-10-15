import type {
  Document,
  Section,
  SectionVersion,
  ChatMessage,
  DiscoveryQuestion,
  AuditFinding,
  DocumentType,
  SectionDefinition,
  ApiKey,
  ApiKeyCreateResponse,
  DocumentActivity,
  MyActivityEvent,
  Suggestion,
  FeedbackItem,
  PipelineDefinition,
  PipelineStep,
  PromptTemplate,
  Artifact,
  Folder,
  DocumentMember,
  MemberRole,
  SharedDocument,
} from "@/types";

export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

// ─── Response mappers (snake_case → camelCase) ───────────────

export function mapDocument(raw: Record<string, unknown>): Document {
  return {
    id: String(raw.id),
    title: raw.title as string,
    currentPhase: raw.current_phase as Document["currentPhase"],
    documentMode: (raw.document_mode as Document["documentMode"]) ?? "editor",
    agentWritePolicy: (raw.agent_write_policy as Document["agentWritePolicy"]) ?? "suggest",
    globalContext: (raw.global_context as string) ?? null,
    userPreferences: (raw.user_preferences as string) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
    hasApiKeyActivity: Boolean(raw.has_api_key_activity),
    folderId: (raw.folder_id as string | null) ?? null,
    lastApiKeyName: (raw.last_api_key_name as string) ?? null,
    publishedVersionId: (raw.published_version_id as string | null) ?? null,
    publishedAt: (raw.published_at as string | null) ?? null,
    hasUnpublishedChanges: Boolean(raw.has_unpublished_changes),
    archivedAt: (raw.archived_at as string | null) ?? null,
  };
}

export function mapSection(
  raw: Record<string, unknown>,
  documentId?: string
): Section {
  return {
    id: String(raw.id),
    documentId: documentId ?? String(raw.document_id ?? ""),
    sectionType: raw.section_type as Section["sectionType"],
    status: raw.status as Section["status"],
    summary: (raw.summary as string) ?? null,
    activeVersionContent: (raw.active_version_content as string) ?? null,
    versionCount: raw.version_count != null ? Number(raw.version_count) : undefined,
    currentVersionIndex: raw.current_version_index != null ? Number(raw.current_version_index) : undefined,
  };
}

export function mapVersion(raw: Record<string, unknown>): SectionVersion {
  return {
    id: String(raw.id),
    sectionId: String(raw.section_id),
    parentVersionId: raw.parent_version_id
      ? String(raw.parent_version_id)
      : null,
    versionName: raw.version_name as string,
    changeSummary: (raw.change_summary as string) ?? null,
    content: raw.content as string,
    isActive: raw.is_active as boolean,
    isPublished: Boolean(raw.is_published),
    publishedAt: (raw.published_at as string | null) ?? null,
    createdAt: raw.created_at as string,
  };
}

export function mapChatMessage(raw: Record<string, unknown>): ChatMessage {
  return {
    id: String(raw.id),
    documentId: String(raw.document_id),
    sectionId: String(raw.section_id),
    role: raw.role as ChatMessage["role"],
    content: raw.content as string,
    createdAt: raw.created_at as string,
  };
}

export function mapDiscoveryQuestion(
  raw: Record<string, unknown>,
  documentId?: string
): DiscoveryQuestion {
  return {
    id: String(raw.id),
    documentId: documentId ?? String(raw.document_id ?? ""),
    question: raw.question as string,
    answer: (raw.answer as string) ?? null,
    skipped: raw.skipped as boolean,
    sectionKey: (raw.section_key as string) ?? null,
  };
}

// ─── API helpers ─────────────────────────────────────────────

type GetToken = () => Promise<string | null>;

async function authHeaders(getToken: GetToken, extra?: Record<string, string>) {
  const token = await getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export interface Tier {
  slug: string;
  name: string;
  priceMonthlyUsd: number | null;
  credits: string;
  description: string;
  features: string[];
  limits: {
    maxActiveDocuments: number | null;
    maxApiKeys: number | null;
    weeklyDocumentCreations: number | null;
    exportFormats: ExportFormat[];
  };
  cta: string;
  highlight: boolean;
  available: boolean;
}

export async function apiFetchTiers(): Promise<Tier[]> {
  const res = await fetch(`${API_BASE}/tiers`);
  if (!res.ok) throw new Error("Failed to fetch tiers");
  const data = (await res.json()) as { tiers: Record<string, unknown>[] };
  return data.tiers.map((raw) => {
    const limits = (raw.limits ?? {}) as Record<string, unknown>;
    return {
      slug: raw.slug as string,
      name: raw.name as string,
      priceMonthlyUsd: (raw.price_monthly_usd as number) ?? null,
      credits: raw.credits as string,
      description: raw.description as string,
      features: (raw.features as string[]) ?? [],
      limits: {
        maxActiveDocuments: (limits.max_active_documents as number) ?? null,
        maxApiKeys: (limits.max_api_keys as number) ?? null,
        weeklyDocumentCreations: (limits.weekly_document_creations as number) ?? null,
        exportFormats: (limits.export_formats as ExportFormat[]) ?? [],
      },
      cta: raw.cta as string,
      highlight: Boolean(raw.highlight),
      available: Boolean(raw.available),
    };
  });
}

export async function apiCreateCheckoutSession(
  plan: "pro" | "team",
  getToken: GetToken,
): Promise<string> {
  const res = await fetch(`${API_BASE}/billing/checkout`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to start checkout");
  }
  return ((await res.json()) as { url: string }).url;
}

export async function apiCreatePortalSession(getToken: GetToken): Promise<string> {
  const res = await fetch(`${API_BASE}/billing/portal`, {
    method: "POST",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to open billing portal");
  }
  return ((await res.json()) as { url: string }).url;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  document_creations_remaining: number;
  weekly_document_creations: number;
  plan: string;
  document_creations_reset_at: string | null;
  next_document_creations_reset_at: string;
}

export async function apiFetchMe(getToken: GetToken): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json() as Promise<CurrentUser>;
}

export async function apiListDocuments(getToken: GetToken, includeArchived = false): Promise<Document[]> {
  const search = includeArchived ? "?include_archived=true" : "";
  const res = await fetch(`${API_BASE}/documents${search}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch documents");
  const data = (await res.json()) as { documents: Record<string, unknown>[] };
  return data.documents.map(mapDocument);
}

export type ExportFormat = "md" | "pdf" | "docx";

/**
 * Fetch a document export from the backend and trigger a browser download.
 * All formats require an authenticated Pro account; the backend is the only
 * download path so plan enforcement cannot be bypassed in the browser.
 */
export async function apiExportDocument(
  documentId: string,
  format: ExportFormat,
  getToken: GetToken,
): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/export?format=${format}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) {
    let detail = `Export failed (${res.status})`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `document.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiCreateDocument(
  title: string,
  documentContext: string,
  getToken: GetToken,
  userPreferences?: string,
  documentTypeSlug?: string,
  mode?: "guided" | "editor",
): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title || null,
      document_context: documentContext || null,
      user_preferences: userPreferences ?? null,
      document_type_slug: documentTypeSlug ?? null,
      mode: mode ?? "editor",
    }),
  });
  if (res.status === 429) throw new Error("WEEKLY_DOCUMENT_LIMIT_REACHED");
  if (!res.ok) throw new Error("Failed to create document");
  return mapDocument(await res.json());
}

export async function apiUpdateSectionContent(
  sectionId: string,
  content: string,
  getToken: GetToken,
): Promise<SectionVersion> {
  const res = await fetch(`${API_BASE}/sections/${sectionId}/content`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to update section content");
  return mapVersion(await res.json());
}

export async function apiAnswerQuestion(
  documentId: string,
  question: string,
  answer: string | null,
  getToken: GetToken,
) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/answer`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer }),
  });
  if (!res.ok) throw new Error("Failed to answer question");
  return res.json();
}

export async function apiSendEvent(
  documentId: string,
  eventType: string,
  data: Record<string, unknown>,
  getToken: GetToken,
) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/events`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ event_type: eventType, data }),
  });
  if (!res.ok) throw new Error("Failed to send event");
  return res.json();
}

export async function apiFetchVersions(
  sectionId: string,
  getToken: GetToken,
): Promise<SectionVersion[]> {
  const res = await fetch(`${API_BASE}/sections/${sectionId}/versions`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch versions");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapVersion);
}

export async function apiFetchMessages(
  sectionId: string,
  getToken: GetToken,
): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/sections/${sectionId}/chat`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch messages");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapChatMessage);
}

export async function apiRestoreVersion(
  sectionId: string,
  versionId: string,
  getToken: GetToken,
) {
  const res = await fetch(
    `${API_BASE}/sections/${sectionId}/versions/${versionId}/restore`,
    { method: "POST", headers: await authHeaders(getToken) }
  );
  if (!res.ok) throw new Error("Failed to restore version");
  return res.json();
}

function mapAuditFinding(raw: Record<string, unknown>): AuditFinding {
  return {
    id: String(raw.id),
    documentId: String(raw.document_id),
    sectionType: raw.section_type as AuditFinding["sectionType"],
    description: raw.description as string,
    severity: raw.severity as AuditFinding["severity"],
    quote: (raw.quote as string | null) ?? null,
    category: (raw.category as string | null) ?? null,
    dismissed: raw.dismissed as boolean,
    createdAt: raw.created_at as string,
  };
}

export async function apiFetchAuditFindings(
  documentId: string,
  getToken: GetToken,
): Promise<AuditFinding[]> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/audit-findings`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch audit findings");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapAuditFinding);
}

export async function apiDismissAuditFinding(
  documentId: string,
  findingId: string,
  getToken: GetToken,
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/documents/${documentId}/audit-findings/${findingId}/dismiss`,
    { method: "POST", headers: await authHeaders(getToken) },
  );
  if (!res.ok) throw new Error("Failed to dismiss audit finding");
}

export async function apiCreateVersionSnapshot(
  sectionId: string,
  getToken: GetToken,
): Promise<SectionVersion> {
  const res = await fetch(`${API_BASE}/sections/${sectionId}/versions/snapshot`, {
    method: "POST",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to create version snapshot");
  return mapVersion(await res.json());
}

export async function apiUpdateSectionVersion(
  sectionId: string,
  versionId: string,
  patch: { changeSummary?: string | null; versionName?: string | null },
  getToken: GetToken,
): Promise<SectionVersion> {
  const body: Record<string, unknown> = {};
  if ("changeSummary" in patch) body.change_summary = patch.changeSummary;
  if ("versionName" in patch) body.version_name = patch.versionName;
  const res = await fetch(`${API_BASE}/sections/${sectionId}/versions/${versionId}`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update version");
  return mapVersion(await res.json());
}

function mapSectionDefinition(raw: Record<string, unknown>): SectionDefinition {
  return {
    id: String(raw.id),
    sectionKey: raw.section_key as string,
    displayName: raw.display_name as string,
    order: raw.order as number,
    roleDescription: raw.role_description as string,
  };
}

function mapDocumentType(raw: Record<string, unknown>): DocumentType {
  return {
    id: String(raw.id),
    slug: raw.slug as string,
    name: raw.name as string,
    description: raw.description as string,
    isActive: raw.is_active as boolean,
    isCustom: Boolean(raw.is_custom),
    sections: ((raw.sections as Record<string, unknown>[]) ?? []).map(mapSectionDefinition),
  };
}

export async function apiCreateDocumentType(
  payload: {
    name: string;
    description: string;
    sections: { section_key: string; display_name: string; order: number; role_description: string }[];
  },
  getToken: GetToken,
): Promise<DocumentType> {
  const res = await fetch(`${API_BASE}/document-types`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to create document type");
  }
  return mapDocumentType(await res.json());
}

export async function apiUpsertPrompt(
  slug: string,
  payload: { phase: string; section_key: string | null; prompt_text: string },
  getToken: GetToken,
): Promise<PromptTemplate> {
  const res = await fetch(`${API_BASE}/document-types/${slug}/prompts`, {
    method: "PUT",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to save prompt");
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    id: String(data.id),
    documentTypeId: String(data.document_type_id),
    phase: data.phase as string,
    sectionKey: (data.section_key as string) ?? null,
    promptText: data.prompt_text as string,
  };
}

// ─── Pipeline definitions (M4 — clone/edit the BYOA pipeline) ─

function mapPipelineDefinition(raw: Record<string, unknown>): PipelineDefinition {
  return {
    id: String(raw.id),
    name: raw.name as string,
    baseDocumentTypeId: raw.base_document_type_id ? String(raw.base_document_type_id) : null,
    steps: (raw.steps as PipelineStep[]) ?? [],
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export async function apiListPipelineDefinitions(getToken: GetToken): Promise<PipelineDefinition[]> {
  const res = await fetch(`${API_BASE}/pipeline-definitions`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch pipeline definitions");
  const data = (await res.json()) as Record<string, unknown>[];
  return data.map(mapPipelineDefinition);
}

export async function apiClonePipelineDefinition(
  documentTypeSlug: string,
  name: string | null,
  getToken: GetToken,
): Promise<PipelineDefinition> {
  const res = await fetch(`${API_BASE}/pipeline-definitions/clone`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ document_type_slug: documentTypeSlug, name }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to clone pipeline");
  }
  return mapPipelineDefinition(await res.json());
}

export async function apiUpdatePipelineDefinition(
  id: string,
  patch: { name?: string; steps?: PipelineStep[] },
  getToken: GetToken,
): Promise<PipelineDefinition> {
  const res = await fetch(`${API_BASE}/pipeline-definitions/${id}`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to update pipeline");
  }
  return mapPipelineDefinition(await res.json());
}

export async function apiDeletePipelineDefinition(id: string, getToken: GetToken): Promise<void> {
  const res = await fetch(`${API_BASE}/pipeline-definitions/${id}`, {
    method: "DELETE",
    headers: await authHeaders(getToken),
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete pipeline");
}

export async function apiUpdateDocumentTitle(
  documentId: string,
  title: string,
  getToken: GetToken,
): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to update document title");
  return mapDocument(await res.json());
}

export interface LayoutState {
  /** The @docforge/layout document, rendered in the browser by the same library. */
  content: unknown;
  revision: number;
  updatedAt: string | null;
}

export async function apiGetLayout(documentId: string, getToken: GetToken): Promise<LayoutState> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error(`Failed to load layout (${res.status})`);
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    content: raw.content,
    revision: Number(raw.revision),
    updatedAt: (raw.updated_at as string | null) ?? null,
  };
}

/** A layout write the server refused because someone wrote first (HTTP 409). */
export class LayoutConflictError extends Error {
  constructor(readonly revision: number | null) {
    super("The layout document changed on the server.");
  }
}

export interface LayoutWriteResult {
  ok: boolean;
  revision: number;
  diagnostics: { severity: string; code: string; message: string; component?: string }[];
  changes: { code: string; severity: string; component?: string; message: string; recovery: boolean; data: Record<string, unknown> }[];
}

async function layoutWrite(res: Response): Promise<LayoutWriteResult> {
  if (res.status === 409) {
    const detail = ((await res.json().catch(() => ({}))) as { detail?: { revision?: number } }).detail;
    throw new LayoutConflictError(typeof detail?.revision === "number" ? detail.revision : null);
  }
  if (!res.ok) throw new Error(`Layout write failed (${res.status})`);
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    ok: Boolean(raw.ok),
    revision: Number(raw.revision),
    diagnostics: (raw.diagnostics as LayoutWriteResult["diagnostics"]) ?? [],
    changes: (raw.changes as LayoutWriteResult["changes"]) ?? [],
  };
}

export async function apiApplyLayoutOps(
  documentId: string,
  ops: unknown[],
  baseRevision: number,
  getToken: GetToken,
): Promise<LayoutWriteResult> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout/ops`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ ops, base_revision: baseRevision, draw: false, pages: [1] }),
  });
  return layoutWrite(res);
}

export async function apiReplaceLayout(
  documentId: string,
  content: unknown,
  baseRevision: number,
  getToken: GetToken,
): Promise<LayoutWriteResult> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout`, {
    method: "PUT",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ content, base_revision: baseRevision }),
  });
  return layoutWrite(res);
}

export interface LayoutRect {
  page?: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutNote {
  id: string;
  kind: "notice" | "annotation";
  code: string | null;
  severity: "info" | "warning";
  anchor: { component?: string; rect?: LayoutRect };
  message: string;
  /** The change behind a notice (before/after boxes, pushedBy…), to say it in the person's language. */
  data: Record<string, unknown> | null;
  revision: number;
  byAgent: boolean;
  authorUserId: string | null;
  status: "open" | "acknowledged" | "resolved";
  resolutionNote: string | null;
  createdAt: string | null;
  /** Where the anchor is now, resolved by the server against the current layout. */
  where: string | null;
}

function mapLayoutNote(raw: Record<string, unknown>): LayoutNote {
  return {
    id: String(raw.id),
    kind: raw.kind as LayoutNote["kind"],
    code: (raw.code as string | null) ?? null,
    severity: (raw.severity as LayoutNote["severity"]) ?? "info",
    anchor: (raw.anchor as LayoutNote["anchor"]) ?? {},
    message: String(raw.message ?? ""),
    data: (raw.data as Record<string, unknown> | null) ?? null,
    revision: Number(raw.revision),
    byAgent: Boolean(raw.by_agent),
    authorUserId: (raw.author_user_id as string | null) ?? null,
    status: raw.status as LayoutNote["status"],
    resolutionNote: (raw.resolution_note as string | null) ?? null,
    createdAt: (raw.created_at as string | null) ?? null,
    where: (raw.where as string | null) ?? null,
  };
}

export async function apiListLayoutNotes(
  documentId: string,
  getToken: GetToken,
  status: "open" | "all" = "open",
): Promise<LayoutNote[]> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout/notes?status=${status}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error(`Failed to load layout notes (${res.status})`);
  const raw = (await res.json()) as { notes: Record<string, unknown>[] };
  return raw.notes.map(mapLayoutNote);
}

export async function apiCreateLayoutAnnotation(
  documentId: string,
  message: string,
  anchor: LayoutNote["anchor"],
  getToken: GetToken,
): Promise<LayoutNote> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout/notes`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ message, anchor }),
  });
  if (!res.ok) throw new Error(`Failed to create the annotation (${res.status})`);
  return mapLayoutNote((await res.json()) as Record<string, unknown>);
}

export type LayoutTemplateSlug = "relatorio" | "proposta" | "one-pager";

/** Create a layout document, empty or from a curated template. Returns the new document's id. */
export async function apiCreateLayoutDocument(title: string, template: LayoutTemplateSlug | null, getToken: GetToken): Promise<string> {
  const res = await fetch(`${API_BASE}/layout-documents`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ ...(title ? { title } : {}), ...(template ? { template } : {}) }),
  });
  if (res.status === 403 || res.status === 429) throw new Error("WEEKLY_DOCUMENT_LIMIT_REACHED");
  if (!res.ok) throw new Error(`Failed to create the layout document (${res.status})`);
  return String(((await res.json()) as { document_id: string }).document_id);
}

/** The person's answers to an agent's review request (stored as an annotation the agent reads back). */
export async function apiAnswerLayoutReview(
  documentId: string,
  request: LayoutNote,
  answers: Record<string, string>,
  message: string,
  getToken: GetToken,
): Promise<LayoutNote> {
  const focus = (request.data?.focus as string[] | undefined)?.[0];
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout/notes`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ message, code: "review-answer", answers, request_id: request.id, ...(focus ? { anchor: { component: focus } } : {}) }),
  });
  if (!res.ok) throw new Error(`Failed to send the answers (${res.status})`);
  return mapLayoutNote((await res.json()) as Record<string, unknown>);
}

export interface LayoutRevisionItem {
  revision: number;
  description: string | null;
  opsCount: number | null;
  byAgent: boolean;
  createdAt: string | null;
}

export async function apiListLayoutRevisions(documentId: string, getToken: GetToken, limit = 30): Promise<LayoutRevisionItem[]> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout/revisions?limit=${limit}`, { headers: await authHeaders(getToken) });
  if (!res.ok) throw new Error(`Failed to list revisions (${res.status})`);
  const data = (await res.json()) as { revisions: Record<string, unknown>[] };
  return data.revisions.map((r) => ({
    revision: Number(r.revision),
    description: (r.description as string | null) ?? null,
    opsCount: (r.ops_count as number | null) ?? null,
    byAgent: Boolean(r.by_agent),
    createdAt: (r.created_at as string | null) ?? null,
  }));
}

export async function apiGetLayoutRevision(documentId: string, revision: number, getToken: GetToken): Promise<{ revision: number; content: unknown }> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/layout/revisions/${revision}`, { headers: await authHeaders(getToken) });
  if (!res.ok) throw new Error(`Failed to read revision ${revision} (${res.status})`);
  const data = (await res.json()) as { revision: number; content: unknown };
  return { revision: data.revision, content: data.content };
}

export async function apiUpdateLayoutNote(
  noteId: string,
  status: LayoutNote["status"],
  getToken: GetToken,
  resolutionNote?: string,
): Promise<LayoutNote> {
  const res = await fetch(`${API_BASE}/layout-notes/${noteId}`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ status, resolution_note: resolutionNote ?? null }),
  });
  if (!res.ok) throw new Error(`Failed to update the note (${res.status})`);
  return mapLayoutNote((await res.json()) as Record<string, unknown>);
}

export async function apiListDocumentTypes(getToken: GetToken): Promise<DocumentType[]> {
  const res = await fetch(`${API_BASE}/document-types`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch document types");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapDocumentType);
}

export async function apiGetDocumentType(slug: string, getToken: GetToken): Promise<DocumentType> {
  const res = await fetch(`${API_BASE}/document-types/${slug}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch document type");
  return mapDocumentType(await res.json());
}

export async function apiGenerateSectionSummary(
  payload: { document_type_name: string; document_type_description: string; section_display_name: string },
  getToken: GetToken,
): Promise<string> {
  const res = await fetch(`${API_BASE}/document-types/generate-section-summary`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to generate section summary");
  }
  return ((await res.json()) as { role_description: string }).role_description;
}

function mapApiKey(raw: Record<string, unknown>): ApiKey {
  return {
    id: String(raw.id),
    name: raw.name as string,
    harness: (raw.harness as string) ?? null,
    createdAt: raw.created_at as string,
    lastUsedAt: (raw.last_used_at as string) ?? null,
    revokedAt: (raw.revoked_at as string) ?? null,
  };
}

function mapDocumentActivity(raw: Record<string, unknown>): DocumentActivity {
  return {
    id: String(raw.id),
    actionType: raw.action_type as DocumentActivity["actionType"],
    description: (raw.description as string) ?? null,
    actorName: raw.actor_name as string,
    isAgent: raw.is_agent as boolean,
    harness: (raw.harness as string) ?? null,
    bytesDelta: raw.bytes_delta != null ? Number(raw.bytes_delta) : null,
    versionId: (raw.version_id as string) ?? null,
    createdAt: raw.created_at as string,
  };
}

export async function apiCreateApiKey(
  name: string,
  getToken: GetToken,
  harness?: string | null,
): Promise<ApiKeyCreateResponse> {
  const res = await fetch(`${API_BASE}/users/api-keys`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ name, harness: harness ?? null }),
  });
  if (!res.ok) throw new Error("Failed to create API key");
  const data = await res.json() as Record<string, unknown>;
  return {
    id: String(data.id),
    name: data.name as string,
    harness: (data.harness as string) ?? null,
    key: data.key as string,
    createdAt: data.created_at as string,
  };
}

export async function apiListApiKeys(getToken: GetToken): Promise<ApiKey[]> {
  const res = await fetch(`${API_BASE}/users/api-keys`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch API keys");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapApiKey);
}

export async function apiRevokeApiKey(keyId: string, getToken: GetToken): Promise<void> {
  const res = await fetch(`${API_BASE}/users/api-keys/${keyId}`, {
    method: "DELETE",
    headers: await authHeaders(getToken),
  });
  if (!res.ok && res.status !== 204) throw new Error("Failed to revoke API key");
}

export async function apiUpdateApiKeyHarness(
  keyId: string,
  harness: string | null,
  getToken: GetToken,
): Promise<ApiKey> {
  const res = await fetch(`${API_BASE}/users/api-keys/${keyId}`, {
    method: "PATCH",
    headers: { ...await authHeaders(getToken), "Content-Type": "application/json" },
    body: JSON.stringify({ harness }),
  });
  if (!res.ok) throw new Error("Failed to update API key");
  return mapApiKey(await res.json());
}

export async function apiFetchActivity(
  documentId: string,
  getToken: GetToken,
  limit = 50,
): Promise<DocumentActivity[]> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/activity?limit=${limit}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch activity");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapDocumentActivity);
}

export async function apiFetchMyActivity(
  getToken: GetToken,
  limit = 50,
): Promise<MyActivityEvent[]> {
  const res = await fetch(`${API_BASE}/users/me/activity?limit=${limit}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch activity feed");
  const data = (await res.json()) as { events: Record<string, unknown>[] };
  return data.events.map((raw) => ({
    id: String(raw.id),
    actionType: raw.action_type as string,
    description: (raw.description as string) ?? null,
    actorName: raw.actor_name as string,
    isAgent: Boolean(raw.is_agent),
    harness: (raw.harness as string) ?? null,
    bytesDelta: raw.bytes_delta != null ? Number(raw.bytes_delta) : null,
    versionId: (raw.version_id as string) ?? null,
    docId: String(raw.doc_id),
    docTitle: raw.doc_title as string,
    createdAt: raw.created_at as string,
  }));
}

// ─── Suggestions & feedback (trust layer) ────────────────────

function mapSuggestion(raw: Record<string, unknown>): Suggestion {
  return {
    id: String(raw.id),
    documentId: String(raw.document_id),
    sectionId: String(raw.section_id),
    proposedVersionId: String(raw.proposed_version_id),
    baseVersionId: raw.base_version_id ? String(raw.base_version_id) : null,
    status: raw.status as Suggestion["status"],
    note: (raw.note as string) ?? null,
    reviewComment: (raw.review_comment as string) ?? null,
    agentName: (raw.agent_name as string) ?? null,
    proposedContent: (raw.proposed_content as string) ?? null,
    currentContent: (raw.current_content as string) ?? null,
    isStale: Boolean(raw.is_stale),
    createdAt: raw.created_at as string,
    resolvedAt: (raw.resolved_at as string) ?? null,
  };
}

function mapFeedback(raw: Record<string, unknown>): FeedbackItem {
  return {
    id: String(raw.id),
    documentId: String(raw.document_id),
    sectionId: raw.section_id ? String(raw.section_id) : null,
    suggestionId: raw.suggestion_id ? String(raw.suggestion_id) : null,
    content: raw.content as string,
    status: raw.status as FeedbackItem["status"],
    resolutionNote: (raw.resolution_note as string) ?? null,
    createdAt: raw.created_at as string,
    resolvedAt: (raw.resolved_at as string) ?? null,
  };
}

export async function apiFetchSuggestions(
  documentId: string,
  getToken: GetToken,
  status?: "pending" | "accepted" | "rejected",
): Promise<Suggestion[]> {
  const qs = status ? `?status=${status}` : "";
  const res = await fetch(`${API_BASE}/documents/${documentId}/suggestions${qs}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch suggestions");
  const data = (await res.json()) as { suggestions: Record<string, unknown>[] };
  return data.suggestions.map(mapSuggestion);
}

export async function apiAcceptSuggestion(
  suggestionId: string,
  getToken: GetToken,
): Promise<Suggestion> {
  const res = await fetch(`${API_BASE}/suggestions/${suggestionId}/accept`, {
    method: "POST",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) {
    // Surface the backend reason (e.g. the quality gate blocking message)
    let detail = "Failed to accept suggestion";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail;
    } catch { /* keep generic message */ }
    throw new Error(detail);
  }
  return mapSuggestion(await res.json());
}

export async function apiRejectSuggestion(
  suggestionId: string,
  comment: string | null,
  getToken: GetToken,
): Promise<Suggestion> {
  const res = await fetch(`${API_BASE}/suggestions/${suggestionId}/reject`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error("Failed to reject suggestion");
  return mapSuggestion(await res.json());
}

export async function apiFetchFeedback(
  documentId: string,
  getToken: GetToken,
  status?: "open" | "addressed" | "resolved",
): Promise<FeedbackItem[]> {
  const qs = status ? `?status=${status}` : "";
  const res = await fetch(`${API_BASE}/documents/${documentId}/feedback${qs}`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch feedback");
  const data = (await res.json()) as { feedback: Record<string, unknown>[] };
  return data.feedback.map(mapFeedback);
}

export async function apiCreateFeedback(
  documentId: string,
  content: string,
  sectionId: string | null,
  getToken: GetToken,
): Promise<FeedbackItem> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/feedback`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ content, section_id: sectionId }),
  });
  if (!res.ok) throw new Error("Failed to create feedback");
  return mapFeedback(await res.json());
}

export interface GateStatus {
  requireGateOnAccept: boolean;
  openFindings: number;
  openHighFindings: number;
  blocking: boolean;
  findings: AuditFinding[];
}

export async function apiFetchGateStatus(
  documentId: string,
  getToken: GetToken,
): Promise<GateStatus> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/quality-gate`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch quality gate status");
  const raw = (await res.json()) as Record<string, unknown>;
  return {
    requireGateOnAccept: Boolean(raw.require_gate_on_accept),
    openFindings: Number(raw.open_findings ?? 0),
    openHighFindings: Number(raw.open_high_findings ?? 0),
    blocking: Boolean(raw.blocking),
    findings: ((raw.findings as Record<string, unknown>[]) ?? []).map(mapAuditFinding),
  };
}

export async function apiSetRequireGateOnAccept(
  documentId: string,
  requireGateOnAccept: boolean,
  getToken: GetToken,
): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ require_gate_on_accept: requireGateOnAccept }),
  });
  if (!res.ok) throw new Error("Failed to update quality gate setting");
}

export async function apiApprovePipelineAlignment(
  documentId: string,
  getToken: GetToken,
): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/pipeline/approve`, {
    method: "POST",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to approve pipeline checkpoint");
}

export async function apiRejectPipelineAlignment(
  documentId: string,
  comment: string,
  getToken: GetToken,
  sectionKey?: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/pipeline/reject`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ comment, section_key: sectionKey ?? null }),
  });
  if (!res.ok) throw new Error("Failed to reject pipeline checkpoint");
}

export async function apiUpdateAgentWritePolicy(
  documentId: string,
  policy: "suggest" | "direct",
  getToken: GetToken,
): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${documentId}`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ agent_write_policy: policy }),
  });
  if (!res.ok) throw new Error("Failed to update write policy");
  return mapDocument(await res.json());
}

export async function apiUpdateCompletedDocument(
  documentId: string,
  sections: Array<{
    section_type: Section["sectionType"];
    content: string;
  }>,
  getToken: GetToken,
) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/completed-content`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ sections }),
  });
  if (!res.ok) throw new Error("Failed to save completed document");
  return res.json();
}

// ─── Artifacts ────────────────────────────────────────────────

function mapArtifact(raw: Record<string, unknown>): Artifact {
  return {
    id: raw.id as string,
    documentId: raw.document_id as string,
    key: raw.key as string,
    kind: raw.kind as Artifact["kind"],
    title: raw.title as string,
    content: raw.content as string,
    author: (raw.author as string | null) ?? null,
    isAgent: Boolean(raw.is_agent),
    revision: raw.revision as number,
    anchored: Boolean(raw.anchored),
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

export async function apiFetchArtifacts(
  documentId: string,
  getToken: GetToken,
): Promise<Artifact[]> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/artifacts`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch artifacts");
  const data = await res.json();
  return (data.artifacts as Record<string, unknown>[]).map(mapArtifact);
}

export async function apiDeleteArtifact(artifactId: string, getToken: GetToken): Promise<void> {
  const res = await fetch(`${API_BASE}/artifacts/${artifactId}`, {
    method: "DELETE",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to delete artifact");
}

/**
 * Accept some of a proposal's changes and turn down the rest.
 *
 * Indexes are the `CHANGE n OF m` numbers the reviewer saw. The server
 * recomputes the hunks with the same algorithm and applies the subset — the
 * browser numbers the changes, it does not decide what the document becomes.
 */
export async function apiTriageSuggestion(
  suggestionId: string,
  acceptedIndexes: number[],
  comment: string | null,
  getToken: GetToken,
): Promise<Suggestion> {
  const res = await fetch(`${API_BASE}/suggestions/${suggestionId}/triage`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ accepted_indexes: acceptedIndexes, comment }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? "Failed to save triage");
  }
  return mapSuggestion(await res.json());
}

// ─── Folders and sharing ──────────────────────────────────────

export async function apiFetchFolders(getToken: GetToken): Promise<Folder[]> {
  const res = await fetch(`${API_BASE}/folders`, { headers: await authHeaders(getToken) });
  if (!res.ok) throw new Error("Failed to fetch folders");
  const data = await res.json();
  return (data.folders as Record<string, unknown>[]).map((f) => ({
    id: f.id as string,
    name: f.name as string,
    parentId: (f.parent_id as string | null) ?? null,
    documentCount: f.document_count as number,
    directDocumentCount: (f.direct_document_count as number | undefined) ?? f.document_count as number,
  }));
}

export async function apiCreateFolder(
  name: string,
  parentId: string | null,
  getToken: GetToken,
): Promise<Folder> {
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: parentId }),
  });
  if (!res.ok) throw new Error("Failed to create folder");
  const f = await res.json();
  return { id: f.id, name: f.name, parentId: f.parent_id ?? null, documentCount: 0, directDocumentCount: 0 };
}

export async function apiDeleteFolder(folderId: string, getToken: GetToken): Promise<void> {
  const res = await fetch(`${API_BASE}/folders/${folderId}`, {
    method: "DELETE",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to delete folder");
}

export async function apiUpdateFolder(
  folderId: string,
  update: { name?: string; parentId?: string | null },
  getToken: GetToken,
): Promise<Folder> {
  const body: Record<string, unknown> = {};
  if (update.name !== undefined) body.name = update.name;
  if (update.parentId !== undefined) body.parent_id = update.parentId;
  const res = await fetch(`${API_BASE}/folders/${folderId}`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail ?? "Failed to update folder");
  }
  const f = await res.json();
  return {
    id: f.id,
    name: f.name,
    parentId: f.parent_id ?? null,
    documentCount: f.document_count ?? 0,
    directDocumentCount: f.direct_document_count ?? 0,
  };
}

/** Move a document into a folder, or to the root with `null`. */
export async function apiMoveDocument(
  documentId: string,
  folderId: string | null,
  getToken: GetToken,
): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/folder`, {
    method: "PATCH",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ folder_id: folderId }),
  });
  if (!res.ok) throw new Error("Failed to move document");
}

function mapMember(raw: Record<string, unknown>): DocumentMember {
  return {
    id: raw.id as string,
    email: raw.email as string,
    role: raw.role as MemberRole,
    accepted: Boolean(raw.accepted),
  };
}

export async function apiFetchMembers(
  documentId: string,
  getToken: GetToken,
): Promise<{ members: DocumentMember[]; myRole: string }> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/members`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch members");
  const data = await res.json();
  return {
    members: (data.members as Record<string, unknown>[]).map(mapMember),
    myRole: data.my_role as string,
  };
}

export async function apiShareDocument(
  documentId: string,
  email: string,
  role: MemberRole,
  getToken: GetToken,
): Promise<DocumentMember> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/members`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Failed to share document");
  }
  return mapMember(await res.json());
}

export async function apiUnshareDocument(
  documentId: string,
  memberId: string,
  getToken: GetToken,
): Promise<void> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/members/${memberId}`, {
    method: "DELETE",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to remove member");
}

export async function apiFetchSharedDocuments(getToken: GetToken): Promise<SharedDocument[]> {
  const res = await fetch(`${API_BASE}/shared-documents`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch shared documents");
  const data = await res.json();
  return (data.documents as Record<string, unknown>[]).map((d) => ({
    id: d.id as string,
    title: d.title as string,
    role: d.role as MemberRole,
    updatedAt: d.updated_at as string,
  }));
}

export async function apiPublishDocument(
  documentId: string,
  getToken: GetToken,
): Promise<{ label: string }> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/publish`, {
    method: "POST",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Failed to publish");
  }
  return await res.json();
}

/**
 * Turn the read-only public link on or off.
 *
 * The token is the capability, so turning it off clears it and any link
 * already shared stops working.
 */
export async function apiSetPublicLink(
  documentId: string,
  enabled: boolean,
  getToken: GetToken,
): Promise<{ token: string | null; enabled: boolean }> {
  const res = await fetch(
    `${API_BASE}/documents/${documentId}/public-link?enabled=${enabled}`,
    { method: "POST", headers: await authHeaders(getToken) },
  );
  if (!res.ok) throw new Error("Failed to update public link");
  return await res.json();
}

export async function apiSetDocumentArchived(
  documentId: string,
  archived: boolean,
  getToken: GetToken,
): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/${archived ? "archive" : "restore"}`, {
    method: "POST",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Failed to update document archive state");
  }
  return mapDocument(await res.json());
}

export async function apiGetPublicLink(
  documentId: string,
  getToken: GetToken,
): Promise<{ token: string | null; enabled: boolean }> {
  const res = await fetch(`${API_BASE}/documents/${documentId}/public-link`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch public link");
  return await res.json();
}
