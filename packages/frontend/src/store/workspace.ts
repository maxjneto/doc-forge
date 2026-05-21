import { create } from "zustand";
import type {
  GuidedSectionType,
  SectionType,
  Section,
  SectionVersion,
  ChatMessage,
  SectionActionType,
} from "@/types";
import {
  apiFetchVersions,
  apiFetchMessages,
  apiSendEvent,
  apiRestoreVersion,
  apiCreateVersionSnapshot,
} from "@/utils/api";

type GetToken = () => Promise<string | null>;

// Stable empty references to avoid infinite re-renders in selectors
const EMPTY_VERSIONS: SectionVersion[] = [];
const EMPTY_MESSAGES: ChatMessage[] = [];

export const SECTION_LABELS: Record<SectionType, string> = {
  context: "Context",
  proposal: "Proposal",
  implementation: "Implementation",
  risks: "Risks",
  body: "Document",
};

// ─── Navigation Types ────────────────────────────────────────

export type ViewMode = "editing" | "readonly" | "locked";

// ─── Store Shape ─────────────────────────────────────────────

interface WorkspaceState {
  // Auth
  getToken: GetToken | null;
  setGetToken: (fn: GetToken) => void;

  // Data
  documentId: string | null;
  sections: Section[];
  versions: Record<string, SectionVersion[]>;
  messages: Record<string, ChatMessage[]>;
  sendingMessageBySection: Record<string, boolean>;
  awaitingAgentBySection: Record<string, boolean>;

  // UI state
  activeSection: SectionType;
  editorMode: "source" | "preview";

  // Hydration from polling
  hydrate: (documentId: string, sections: Section[]) => void;

  // Async data fetching
  fetchVersions: (sectionId: string) => Promise<void>;
  fetchMessages: (sectionId: string) => Promise<void>;

  // Actions
  setActiveSection: (section: SectionType) => void;
  setEditorMode: (mode: "source" | "preview") => void;
  updateActiveContent: (content: string) => void;

  // Version actions
  restoreVersion: (sectionId: string, versionId: string) => Promise<void>;
  createVersionSnapshot: (sectionId: string) => Promise<void>;
  patchVersionLocally: (sectionId: string, versionId: string, patch: { versionName?: string; changeSummary?: string | null }) => void;

  // Chat actions
  sendMessage: (content: string, actionType: SectionActionType) => Promise<void>;

  // Section actions
  finalizeSection: (sectionId: string) => Promise<void>;

  // Derived
  getActiveSection: () => Section | undefined;
  getActiveViewMode: () => ViewMode;
  getActiveVersionContent: () => string;
  getActiveSectionVersions: () => SectionVersion[];
  getActiveSectionMessages: () => ChatMessage[];
  getActiveSectionIsSendingMessage: () => boolean;
  getActiveSectionIsAwaitingAgent: () => boolean;
}

// ─── Store Implementation ────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // Initial data (empty — populated via hydrate)
  documentId: null,
  sections: [],
  versions: {},
  messages: {},
  sendingMessageBySection: {},
  awaitingAgentBySection: {},

  // Auth
  getToken: null,
  setGetToken: (fn) => set({ getToken: fn }),

  // UI defaults
  activeSection: "context",
  editorMode: "preview",

  // ─── Hydration ───────────────────────────────────────────

  hydrate: (documentId, sections) => {
    const state = get();
    if (state.documentId !== documentId) {
      // New document — reset everything
      set({
        documentId,
        sections,
        versions: {},
        messages: {},
        sendingMessageBySection: {},
        awaitingAgentBySection: {},
        activeSection: "context",
      });
    } else {
      // Same document — update sections from polling
      set({ sections });
    }
  },

  // ─── Async Data Fetching ─────────────────────────────────

  fetchVersions: async (sectionId) => {
    const { getToken } = get();
    if (!getToken) return;
    const versions = await apiFetchVersions(sectionId, getToken);
    set((state) => ({
      versions: { ...state.versions, [sectionId]: versions },
    }));
  },

  fetchMessages: async (sectionId) => {
    const { getToken } = get();
    if (!getToken) return;
    const apiMessages = await apiFetchMessages(sectionId, getToken);
    const state = get();
    const current = state.messages[sectionId] ?? [];

    // Preserve pending (optimistic) messages not yet reflected in API
    const pendingMsgs = current.filter((m) => m.id.startsWith("pending-"));
    const apiContentSet = new Set(apiMessages.map((m) => m.content));
    const stillPending = pendingMsgs.filter(
      (m) => !apiContentSet.has(m.content)
    );

    // Guard against stale responses from concurrent in-flight fetches
    const currentConfirmed = current.filter((m) => !m.id.startsWith("pending-"));
    if (apiMessages.length < currentConfirmed.length) return;

    const merged = [...apiMessages, ...stillPending];

    // Only update if data changed
    if (merged.length !== current.length || merged.some((m, i) => m.id !== current[i]?.id)) {
      set((state) => ({
        messages: { ...state.messages, [sectionId]: merged },
      }));
    }

    const lastKnownAgent = current.filter(
      (m) => m.role === "agent" && !m.id.startsWith("pending-")
    ).pop();
    const lastApiAgent = apiMessages.filter((m) => m.role === "agent").pop();

    if (
      state.awaitingAgentBySection[sectionId] &&
      lastApiAgent &&
      lastApiAgent.id !== lastKnownAgent?.id
    ) {
      set((state) => ({
        awaitingAgentBySection: {
          ...state.awaitingAgentBySection,
          [sectionId]: false,
        },
      }));
    }

    // If a new agent message appeared, also refresh versions
    const lastApiMsg = apiMessages[apiMessages.length - 1];
    const lastCurrentReal = current.filter((m) => !m.id.startsWith("pending-")).pop();
    if (lastApiMsg?.role === "agent" && lastApiMsg.id !== lastCurrentReal?.id) {
      const versions = await apiFetchVersions(sectionId, getToken);
      set((state) => ({
        versions: { ...state.versions, [sectionId]: versions },
      }));
    }
  },

  // ─── Actions ─────────────────────────────────────────────

  setActiveSection: (section) => set({ activeSection: section }),

  setEditorMode: (mode) => set({ editorMode: mode }),

  updateActiveContent: (content) =>
    set((state) => {
      const section = state.sections.find(
        (s) => s.sectionType === state.activeSection
      );
      if (!section) return state;

      const sectionVersions = state.versions[section.id];
      if (!sectionVersions) return state;

      const updated = sectionVersions.map((v) =>
        v.isActive ? { ...v, content } : v
      );

      return {
        versions: { ...state.versions, [section.id]: updated },
      };
    }),

  patchVersionLocally: (sectionId, versionId, patch) => {
    set((state) => {
      const sectionVersions = state.versions[sectionId];
      if (!sectionVersions) return state;
      return {
        versions: {
          ...state.versions,
          [sectionId]: sectionVersions.map((v) =>
            v.id === versionId ? { ...v, ...patch } : v
          ),
        },
      };
    });
  },

  createVersionSnapshot: async (sectionId) => {
    const { getToken } = get();
    if (!getToken) return;
    await apiCreateVersionSnapshot(sectionId, getToken);
    const versions = await apiFetchVersions(sectionId, getToken);
    set((state) => ({
      versions: { ...state.versions, [sectionId]: versions },
    }));
  },

  restoreVersion: async (sectionId, versionId) => {
    const { getToken } = get();
    if (!getToken) return;
    // Optimistic update
    set((state) => {
      const sectionVersions = state.versions[sectionId];
      if (!sectionVersions) return state;

      const updated = sectionVersions.map((v) => ({
        ...v,
        isActive: v.id === versionId,
      }));

      return {
        versions: { ...state.versions, [sectionId]: updated },
      };
    });

    await apiRestoreVersion(sectionId, versionId, getToken);
  },

  sendMessage: async (content, actionType) => {
    const state = get();
    const section = state.sections.find(
      (s) => s.sectionType === state.activeSection
    );
    if (!section || !state.documentId || !state.getToken) return;

    // Optimistic user message
    const userMsg: ChatMessage = {
      id: `pending-${Date.now()}`,
      documentId: state.documentId,
      sectionId: section.id,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      const sectionMessages = state.messages[section.id] ?? [];
      return {
        messages: {
          ...state.messages,
          [section.id]: [...sectionMessages, userMsg],
        },
        sendingMessageBySection: {
          ...state.sendingMessageBySection,
          [section.id]: true,
        },
        awaitingAgentBySection: {
          ...state.awaitingAgentBySection,
          [section.id]: true,
        },
      };
    });

    // Build event data based on action type
    const eventData: Record<string, unknown> = {
      action_type: actionType,
      section_id: section.id,
    };

    if (actionType === "ask_question") {
      eventData.message = content;
    } else if (actionType === "request_edit") {
      eventData.prompt = content;
    }

    try {
      await apiSendEvent(state.documentId, "section_action", eventData, state.getToken!);
      // Message polling in WorkspaceLayout will pick up the agent response
    } catch (error) {
      set((state) => ({
        awaitingAgentBySection: {
          ...state.awaitingAgentBySection,
          [section.id]: false,
        },
      }));
      throw error;
    } finally {
      set((state) => ({
        sendingMessageBySection: {
          ...state.sendingMessageBySection,
          [section.id]: false,
        },
      }));
    }
  },

  finalizeSection: async (sectionId) => {
    const state = get();
    if (!state.documentId || !state.getToken) return;

    await apiSendEvent(state.documentId, "section_action", {
      action_type: "finalize",
      section_id: sectionId,
    }, state.getToken);
    // Polling from DocumentPage will update section status
  },

  // ─── Derived ─────────────────────────────────────────────

  getActiveSection: () => {
    const state = get();
    return state.sections.find((s) => s.sectionType === state.activeSection);
  },

  getActiveViewMode: () => {
    const state = get();
    const section = state.sections.find(
      (s) => s.sectionType === state.activeSection
    );
    if (!section) return "locked";

    if (section.status === "finalized") return "readonly";
    if (section.status === "refining" || section.status === "drafting") return "editing";

    const order: GuidedSectionType[] = ["context", "proposal", "implementation", "risks"];
    const currentIdx = order.indexOf(section.sectionType as GuidedSectionType);

    const firstNonFinalized = state.sections.find((s) => s.status !== "finalized");
    if (firstNonFinalized && firstNonFinalized.sectionType === section.sectionType) {
      return "editing";
    }

    const sectionsBefore = order.slice(0, currentIdx);
    const allBeforeFinalized = sectionsBefore.every((type) => {
      const s = state.sections.find((sec) => sec.sectionType === type);
      return s?.status === "finalized";
    });

    return allBeforeFinalized ? "editing" : "readonly";
  },

  getActiveVersionContent: () => {
    const state = get();
    const section = state.sections.find(
      (s) => s.sectionType === state.activeSection
    );
    if (!section) return "";

    const sectionVersions = state.versions[section.id] || EMPTY_VERSIONS;
    const active = sectionVersions.find((v) => v.isActive);
    return active?.content ?? "";
  },

  getActiveSectionVersions: () => {
    const state = get();
    const section = state.sections.find(
      (s) => s.sectionType === state.activeSection
    );
    if (!section) return EMPTY_VERSIONS;
    return state.versions[section.id] || EMPTY_VERSIONS;
  },

  getActiveSectionMessages: () => {
    const state = get();
    const section = state.sections.find(
      (s) => s.sectionType === state.activeSection
    );
    if (!section) return EMPTY_MESSAGES;
    return state.messages[section.id] || EMPTY_MESSAGES;
  },

  getActiveSectionIsSendingMessage: () => {
    const state = get();
    const section = state.sections.find(
      (s) => s.sectionType === state.activeSection
    );
    if (!section) return false;
    return state.sendingMessageBySection[section.id] ?? false;
  },

  getActiveSectionIsAwaitingAgent: () => {
    const state = get();
    const section = state.sections.find(
      (s) => s.sectionType === state.activeSection
    );
    if (!section) return false;
    return state.awaitingAgentBySection[section.id] ?? false;
  },
}));
