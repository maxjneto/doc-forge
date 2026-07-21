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
  lastApiKeyName?: string | null;
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
  dismissed: boolean;
  createdAt: string;
}
