import type {
  Document,
  Section,
  SectionVersion,
  ChatMessage,
  DiscoveryQuestion,
  AuditFinding,
  DocumentType,
  SectionDefinition,
} from "@/types";

export const API_BASE =
  import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

// ─── Response mappers (snake_case → camelCase) ───────────────

export function mapDocument(raw: Record<string, unknown>): Document {
  return {
    id: String(raw.id),
    title: raw.title as string,
    currentPhase: raw.current_phase as Document["currentPhase"],
    globalContext: (raw.global_context as string) ?? null,
    userPreferences: (raw.user_preferences as string) ?? null,
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
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

export async function apiFetchMe(getToken: GetToken) {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error("Failed to fetch user");
  return res.json() as Promise<{ id: string; email: string; name: string | null; credits: number }>;
}

export async function apiCreateDocument(
  title: string,
  documentContext: string,
  getToken: GetToken,
  userPreferences?: string,
  documentTypeSlug?: string,
): Promise<Document> {
  const res = await fetch(`${API_BASE}/documents`, {
    method: "POST",
    headers: { ...(await authHeaders(getToken)), "Content-Type": "application/json" },
    body: JSON.stringify({
      title: title || null,
      document_context: documentContext,
      user_preferences: userPreferences ?? null,
      document_type_slug: documentTypeSlug ?? "rfc",
    }),
  });
  if (!res.ok) throw new Error("Failed to create document");
  return mapDocument(await res.json());
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
    sections: ((raw.sections as Record<string, unknown>[]) ?? []).map(mapSectionDefinition),
  };
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

export async function apiListDocumentTypes(): Promise<DocumentType[]> {
  const res = await fetch(`${API_BASE}/document-types`);
  if (!res.ok) throw new Error("Failed to fetch document types");
  const data = await res.json();
  return (data as Record<string, unknown>[]).map(mapDocumentType);
}

export async function apiGetDocumentType(slug: string): Promise<DocumentType> {
  const res = await fetch(`${API_BASE}/document-types/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch document type");
  return mapDocumentType(await res.json());
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
