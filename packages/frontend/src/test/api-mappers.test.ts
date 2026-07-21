import { describe, it, expect } from "vitest";
import { mapDocument, mapSection, mapVersion, mapChatMessage } from "@/utils/api";

describe("API response mappers", () => {
  it("mapDocument converts snake_case to camelCase", () => {
    const raw = {
      id: "abc-123",
      title: "My RFC",
      current_phase: "discovery",
      document_mode: "guided",
      global_context: "Some context",
      user_preferences: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
      has_api_key_activity: false,
      last_api_key_name: null,
    };

    const result = mapDocument(raw);

    expect(result).toEqual({
      id: "abc-123",
      title: "My RFC",
      currentPhase: "discovery",
      documentMode: "guided",
      agentWritePolicy: "suggest",
      globalContext: "Some context",
      userPreferences: null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-02T00:00:00Z",
      hasApiKeyActivity: false,
      lastApiKeyName: null,
    });
  });

  it("mapSection handles optional documentId", () => {
    const raw = {
      id: "sec-1",
      document_id: "doc-1",
      section_type: "context",
      status: "pending",
      summary: null,
      active_version_content: "Hello world",
    };

    const result = mapSection(raw);
    expect(result.documentId).toBe("doc-1");
    expect(result.sectionType).toBe("context");
    expect(result.activeVersionContent).toBe("Hello world");

    // With explicit documentId override
    const result2 = mapSection(raw, "doc-override");
    expect(result2.documentId).toBe("doc-override");
  });

  it("mapVersion converts all fields correctly", () => {
    const raw = {
      id: "v-1",
      section_id: "sec-1",
      parent_version_id: null,
      version_name: "v1",
      content: "# Hello",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
    };

    const result = mapVersion(raw);
    expect(result.sectionId).toBe("sec-1");
    expect(result.parentVersionId).toBeNull();
    expect(result.isActive).toBe(true);
  });

  it("mapChatMessage converts role and timestamps", () => {
    const raw = {
      id: "msg-1",
      document_id: "doc-1",
      section_id: "sec-1",
      role: "user",
      content: "Hello",
      created_at: "2025-01-01T00:00:00Z",
    };

    const result = mapChatMessage(raw);
    expect(result.role).toBe("user");
    expect(result.documentId).toBe("doc-1");
  });
});
