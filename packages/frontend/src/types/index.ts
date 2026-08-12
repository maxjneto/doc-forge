// ─── Document ────────────────────────────────────────────────

export type Phase =
  | "discovery"
  | "alignment"
  | "generation"
  | "refinement"
  | "audit"
  | "completed"
  | "editing";

export type GuidedSectionType = "context" | "proposal" | "implementation" | "risks";
export type SectionType = GuidedSectionType | "body";

export type SectionStatus = "pending" | "drafting" | "refining" | "finalized";

export interface Document {
  id: string;
  title: string;
  currentPhase: Phase;
  documentMode: "guided" | "editor" | "pipeline";
  agentWritePolicy?: "suggest" | "direct";
  globalContext: string | null;
  userPreferences: string | null;
  createdAt: string;
  updatedAt: string;
  hasApiKeyActivity?: boolean;
  /** Folder it is filed under, null at the root. */
  folderId?: string | null;
  lastApiKeyName?: string | null;
  publishedVersionId?: string | null;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
}

// ─── Sections ────────────────────────────────────────────────

export interface Section {
  id: string;
  documentId: string;
  sectionType: SectionType;
  status: SectionStatus;
  summary: string | null;
  activeVersionContent?: string | null;
  versionCount?: number;
  currentVersionIndex?: number;
}

export interface SectionVersion {
  id: string;
  sectionId: string;
  parentVersionId: string | null;
  versionName: string;
  changeSummary: string | null;
  content: string;
  isActive: boolean;
  isPublished?: boolean;
  publishedAt?: string | null;
  createdAt: string;
}

// ─── Chat ────────────────────────────────────────────────────

export type MessageRole = "user" | "agent";

export interface ChatMessage {
  id: string;
  documentId: string;
  sectionId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

// ─── Phase 4 Actions ─────────────────────────────────────────

export type SectionActionType =
  | "ask_question"
  | "request_edit"
  | "finalize";

export interface SectionAction {
  actionType: SectionActionType;
  sectionId: string;
  message?: string;
  prompt?: string;
}

// ─── Document Types ───────────────────────────────────────────

export interface SectionDefinition {
  id: string;
  sectionKey: string;
  displayName: string;
  order: number;
  roleDescription: string;
}

export interface DocumentType {
  id: string;
  slug: string;
  name: string;
  description: string;
  isActive: boolean;
  isCustom: boolean;
  sections: SectionDefinition[];
}

// ─── Customization (M4 — pipelines, prompts, document types) ─

export interface PipelineStep {
  phase: string;
  section_key?: string | null;
  prompt?: string;
  checkpoint?: "human";
}

export interface PipelineDefinition {
  id: string;
  name: string;
  baseDocumentTypeId: string | null;
  steps: PipelineStep[];
  createdAt: string;
  updatedAt: string;
}

export interface PromptTemplate {
  id: string;
  documentTypeId: string;
  phase: string;
  sectionKey: string | null;
  promptText: string;
}

// ─── Discovery (Phase 1) ─────────────────────────────────────

export interface DiscoveryQuestion {
  id: string;
  documentId: string;
  question: string;
  answer: string | null;
  skipped: boolean;
  sectionKey: string | null;
}

// ─── Alignment (Phase 2) ─────────────────────────────────────

export interface AlignmentSummary {
  sectionType: SectionType;
  summary: string;
  approved: boolean;
  rejectionReason?: string;
}

// ─── API Keys ────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  harness: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  harness: string | null;
  key: string;
  createdAt: string;
}

// ─── Activity Log ────────────────────────────────────────────

export interface MyActivityEvent {
  id: string;
  actionType: string;
  description: string | null;
  actorName: string;
  isAgent: boolean;
  harness: string | null;
  bytesDelta: number | null;
  versionId: string | null;
  docId: string;
  docTitle: string;
  createdAt: string;
}

export interface DocumentActivity {
  id: string;
  actionType:
    | "write"
    | "snapshot"
    | "version_selected"
    | "document_created"
    | "suggestion_created"
    | "suggestion_accepted"
    | "suggestion_rejected"
    | "feedback_created"
    | "feedback_resolved";
  description: string | null;
  actorName: string;
  isAgent: boolean;
  harness: string | null;
  bytesDelta: number | null;
  versionId: string | null;
  createdAt: string;
}

// ─── Suggestions & Feedback (trust layer) ────────────────────

export type SuggestionStatus = "pending" | "accepted" | "rejected";

export interface Suggestion {
  id: string;
  documentId: string;
  sectionId: string;
  proposedVersionId: string;
  baseVersionId: string | null;
  status: SuggestionStatus;
  note: string | null;
  reviewComment: string | null;
  agentName: string | null;
  proposedContent: string | null;
  currentContent: string | null;
  isStale: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export type FeedbackStatus = "open" | "addressed" | "resolved";

export interface FeedbackItem {
  id: string;
  documentId: string;
  sectionId: string | null;
  suggestionId: string | null;
  content: string;
  status: FeedbackStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ─── Audit (Phase 5) ─────────────────────────────────────────

export interface AuditProblem {
  section: string;
  issue: string;
  severity: string;
}

export interface AuditFinding {
  id: string;
  documentId: string;
  sectionType: SectionType;
  description: string;
  severity: "high" | "low";
  /** Verbatim phrase the finding is about — null when it concerns the whole
   * document. Drives the underline in the text. */
  quote: string | null;
  /** Short label shown next to the severity pill: "coerência", "escopo"… */
  category: string | null;
  dismissed: boolean;
  createdAt: string;
}

// ─── Artifacts ────────────────────────────────────────────────
// Supporting material around the text: the diagram, table or decision note
// that explains why a passage says what it says. Anchored explicitly from the
// markdown via a `::artefato[key]` directive, so the anchor never drifts.

export type ArtifactKind = "diagram" | "table" | "decision";

export interface Artifact {
  id: string;
  documentId: string;
  key: string;
  kind: ArtifactKind;
  title: string;
  content: string;
  author: string | null;
  isAgent: boolean;
  revision: number;
  /** True when a ::artefato[key] directive for this key exists in the body. */
  anchored: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Organization ─────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  documentCount: number;
  directDocumentCount?: number;
}

/** Least to most capable. The owner is not a member row. */
export type MemberRole = "viewer" | "commenter" | "editor";

export interface DocumentMember {
  id: string;
  email: string;
  role: MemberRole;
  /** False while the invitation is addressed to someone with no account yet. */
  accepted: boolean;
}

export interface SharedDocument {
  id: string;
  title: string;
  role: MemberRole;
  updatedAt: string;
}
