import type {
  Section,
  SectionType,
  SectionVersion,
  ChatMessage,
} from "@/types";

// ─── Mock Data ───────────────────────────────────────────────

export const MOCK_SECTIONS: Section[] = [
  {
    id: "sec-1",
    documentId: "doc-1",
    sectionType: "context",
    status: "finalized",
    summary: "The PostgreSQL 14 bottleneck impacts response times in high-demand regions.",
  },
  {
    id: "sec-2",
    documentId: "doc-1",
    sectionType: "proposal",
    status: "refining",
    summary: "Migrate to a microservices architecture with Redis distributed cache.",
  },
  {
    id: "sec-3",
    documentId: "doc-1",
    sectionType: "implementation",
    status: "pending",
    summary: "Migration sequence: ElasticSearch → Payments API → global cache.",
  },
  {
    id: "sec-4",
    documentId: "doc-1",
    sectionType: "risks",
    status: "pending",
    summary: "Eventual consistency risks and Memcached fallback.",
  },
];

export const MOCK_VERSIONS: Record<string, SectionVersion[]> = {
  "sec-1": [
    {
      id: "v-1-1",
      sectionId: "sec-1",
      parentVersionId: null,
      versionName: "Initial",
      content: "# Context\n\nThe current system faces significant bottlenecks in PostgreSQL 14, especially in high-demand regions where latency exceeds 200ms during peak hours.",
      isActive: true,
      createdAt: "2024-10-01T10:00:00Z",
    },
  ],
  "sec-2": [
    {
      id: "v-2-1",
      sectionId: "sec-2",
      parentVersionId: null,
      versionName: "Initial: Base",
      content: "# Proposal\n\nThe core strategy for Q4 is based on consolidating the microservices architecture. The goal is to reduce response latency by 15% in high-demand regions.\n\n## Key Milestones\n\n- Full migration of the search engine to ElasticSearch.\n- Launch of the new Payments API in production.\n- Implementation of global distributed cache.",
      isActive: false,
      createdAt: "2024-10-02T10:00:00Z",
    },
    {
      id: "v-2-2",
      sectionId: "sec-2",
      parentVersionId: "v-2-1",
      versionName: "Draft: Initial Structure",
      content: "# Proposal\n\nThe core strategy for Q4 is based on consolidating the microservices architecture. The goal is to reduce response latency by 15% in high-demand regions.\n\n## Key Milestones\n\n- Full migration of the search engine to ElasticSearch.\n- Launch of the new Payments API in production.\n- Implementation of global distributed cache.\n\n## Proposed Architecture\n\nThe system will be decomposed into 3 main services communicating via gRPC.",
      isActive: false,
      createdAt: "2024-10-02T11:00:00Z",
    },
    {
      id: "v-2-3",
      sectionId: "sec-2",
      parentVersionId: "v-2-2",
      versionName: "Alternative: Memcached Cache",
      content: "# Proposal\n\nThe core strategy is based on Memcached as a distributed cache layer, replacing the previous approach with Redis.\n\n## Key Milestones\n\n- Full migration of the search engine to ElasticSearch.\n- Multi-region Memcached cluster deployment.\n- Implementation of invalidation via pub/sub.",
      isActive: false,
      createdAt: "2024-10-02T14:00:00Z",
    },
    {
      id: "v-2-4",
      sectionId: "sec-2",
      parentVersionId: "v-2-2",
      versionName: "Edit 1: Added Redis",
      content: "# Proposal\n\nThe core strategy for Q4 is based on consolidating the microservices architecture with Redis as a distributed cache. The goal is to reduce response latency by 15% in high-demand regions.\n\n## Key Milestones\n\n- Full migration of the search engine to ElasticSearch.\n- Launch of the new Payments API in production.\n- Implementation of global distributed cache with Redis Cluster.\n\n## Deploy Pipeline\n\n```\npipeline.on('deploy', (event) => {\n  validate(event.bundle);\n  notify('infra-alerts');\n});\n```",
      isActive: false,
      createdAt: "2024-10-03T09:00:00Z",
    },
    {
      id: "v-2-5",
      sectionId: "sec-2",
      parentVersionId: "v-2-4",
      versionName: "Current Version",
      content: "# Proposal\n\nThe core strategy for Q4 is based on consolidating the microservices architecture with Redis as a distributed cache. The goal is to reduce response latency by 15% in high-demand regions.\n\n## Key Milestones\n\n- Full migration of the search engine to ElasticSearch.\n- Launch of the new Payments API in production.\n- Implementation of global distributed cache with Redis Cluster.\n\n## High-Level Architecture\n\n```mermaid\nflowchart LR\n    Client[Client] --> Gateway[API Gateway]\n    Gateway --> Auth[Auth Service]\n    Gateway --> Search[Search Service]\n    Gateway --> Payments[Payments Service]\n    Search --> ES[(ElasticSearch)]\n    Payments --> PG[(PostgreSQL)]\n    Gateway --> Cache[(Redis Cluster)]\n```\n\n## Deploy Pipeline\n\n```\npipeline.on('deploy', (event) => {\n  validate(event.bundle);\n  notify('infra-alerts');\n});\n```\n\nContinuous monitoring through our pipeline infrastructure ensures that each commit is validated against the regression test suite before automatic deployment.",
      isActive: true,
      createdAt: "2024-10-03T10:30:00Z",
    },
  ],
  "sec-3": [
    {
      id: "v-3-1",
      sectionId: "sec-3",
      parentVersionId: null,
      versionName: "Initial",
      content: "# Implementation\n\n*(Awaiting generation)*",
      isActive: true,
      createdAt: "2024-10-01T10:00:00Z",
    },
  ],
  "sec-4": [
    {
      id: "v-4-1",
      sectionId: "sec-4",
      parentVersionId: null,
      versionName: "Initial",
      content: "# Risks and Alternatives\n\n*(Awaiting generation)*",
      isActive: true,
      createdAt: "2024-10-01T10:00:00Z",
    },
  ],
};

export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  "sec-2": [
    {
      id: "msg-1",
      documentId: "doc-1",
      sectionId: "sec-2",
      role: "agent",
      content: "How can I help with the corporate planning today?",
      createdAt: "2024-10-03T09:00:00Z",
    },
    {
      id: "msg-2",
      documentId: "doc-1",
      sectionId: "sec-2",
      role: "user",
      content: "Adjust the tone to be more corporate and technical, focusing on quarterly infrastructure results.",
      createdAt: "2024-10-03T09:01:00Z",
    },
    {
      id: "msg-3",
      documentId: "doc-1",
      sectionId: "sec-2",
      role: "agent",
      content: "Understood. I'll revise the document highlighting the microservices architecture and the 15% latency reduction.",
      createdAt: "2024-10-03T09:02:00Z",
    },
  ],
};

export const SECTION_LABELS: Record<SectionType, string> = {
  context: "Context",
  proposal: "Proposal",
  implementation: "Implementation",
  risks: "Risks",
};
