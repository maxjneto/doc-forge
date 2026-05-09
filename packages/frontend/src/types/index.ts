// ─── Document ────────────────────────────────────────────────

export type Phase =
  | "discovery"
  | "alignment"
  | "generation"
  | "refinement"
  | "audit"
  | "completed";

export type SectionType = "context" | "proposal" | "implementation" | "risks";

export type SectionStatus = "pending" | "drafting" | "refining" | "finalized";

export interface Document {
  id: string;
  title: string;
  currentPhase: Phase;
  globalContext: string | null;
  userPreferences: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Sections ────────────────────────────────────────────────

export interface Section {
  id: string;
  documentId: string;
  sectionType: SectionType;
  status: SectionStatus;
  summary: string | null;
  activeVersionContent?: string | null;
}

export interface SectionVersion {
  id: string;
  sectionId: string;
  parentVersionId: string | null;
  versionName: string;
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
  sections: SectionDefinition[];
}

// ─── Discovery (Phase 1) ─────────────────────────────────────

export interface DiscoveryQuestion {
  id: string;
  documentId: string;
  question: string;
  answer: string | null;
  skipped: boolean;
}

// ─── Alignment (Phase 2) ─────────────────────────────────────

export interface AlignmentSummary {
  sectionType: SectionType;
  summary: string;
  approved: boolean;
  rejectionReason?: string;
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
