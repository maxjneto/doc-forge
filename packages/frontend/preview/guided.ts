/**
 * Guided-pipeline fixtures: the same RFC ("buffer assíncrono de pagamentos")
 * at every phase, so each screen of the guided flow can be opened directly:
 *
 *   /document/doc-pipe-discovery   · questions half answered
 *   /document/doc-pay-rfc          · alignment, summaries to approve
 *   /document/doc-pipe-generation  · two sections forged, one pouring
 *   /document/doc-pipe-refinement  · workspace with chat
 *   /document/doc-pipe-audit       · audit with problems
 *   /document/doc-pipe-completed   · forged, with findings
 */
import { ago } from "./fixtures";

type SectionType = "context" | "proposal" | "implementation" | "risks";
const ORDER: SectionType[] = ["context", "proposal", "implementation", "risks"];

const SUMMARY: Record<SectionType, string> = {
  context:
    "O checkout chama o gateway de forma síncrona e, em picos, 4% dos pagamentos estouram o timeout de 30 s. O cliente vê erro, tenta de novo e às vezes é cobrado duas vezes.",
  proposal:
    "Colocar um buffer assíncrono entre checkout e gateway: o checkout grava a intenção de pagamento numa fila durável e responde na hora; um worker processa com idempotência por chave de pedido.",
  implementation:
    "Liberar atrás de feature flag para uma coorte de lojistas, medir latência p95 e taxa de duplicidade por duas semanas e só então ampliar. Fila em Postgres com SKIP LOCKED, sem infraestrutura nova.",
  risks:
    "O principal risco é o pedido ficar 'pendente' por mais tempo do que o lojista tolera. Alternativas descartadas: aumentar o timeout (só adia o problema) e trocar de gateway (custo e prazo).",
};

const CONTENT: Record<SectionType, string> = {
  context: `O checkout chama o gateway de pagamento de forma **síncrona**. Em horários de pico, cerca de 4% das chamadas passam do timeout de 30 segundos.

Quando isso acontece o cliente vê uma mensagem de erro, tenta de novo e, em parte dos casos, a primeira cobrança já tinha sido aprovada: o resultado é cobrança em dobro e um chamado no suporte.

- Pico de 1.800 pagamentos por minuto na Black Friday de 2025
- 312 cobranças duplicadas estornadas no último trimestre`,
  proposal: `Introduzir um **buffer assíncrono** entre o checkout e o gateway.

1. O checkout grava a intenção de pagamento numa fila durável e responde imediatamente com o pedido em estado \`pending\`.
2. Um worker consome a fila e chama o gateway com uma **chave de idempotência** derivada do número do pedido.
3. O resultado volta por webhook e atualiza o pedido; a página de confirmação acompanha por polling.

A chave de idempotência é o que elimina a cobrança dupla: uma segunda tentativa com a mesma chave devolve o resultado da primeira.`,
  implementation: `A fila fica no próprio Postgres (\`SELECT … FOR UPDATE SKIP LOCKED\`), sem infraestrutura nova.

| Etapa | Duração | Critério para seguir |
|---|---|---|
| Coorte de 5% dos lojistas | 2 semanas | p95 < 2 s, zero duplicidade |
| 50% dos lojistas | 1 semana | sem aumento de chamados |
| Todos | — | — |

O rollback é desligar a flag: o checkout volta ao caminho síncrono e a fila é drenada pelo worker.`,
  risks: `**Pedido pendente por tempo demais.** Se o worker atrasar, o lojista vê pedidos parados. Mitigação: alarme quando a idade do item mais antigo passar de 60 s.

**Alternativas descartadas**

- *Aumentar o timeout* — só adia o problema e piora a experiência no pico.
- *Trocar de gateway* — resolve parte da latência, mas leva dois trimestres e não elimina a cobrança dupla.`,
};

type Status = "pending" | "drafting" | "refining" | "finalized";

function sections(docId: string, statusOf: (t: SectionType) => Status, withContent: (t: SectionType) => boolean, withSummary = true) {
  return ORDER.map((t, i) => ({
    id: `sec-${docId}-${t}`,
    document_id: docId,
    section_type: t,
    status: statusOf(t),
    summary: withSummary ? SUMMARY[t] : null,
    active_version_content: withContent(t) ? CONTENT[t] : null,
    version_count: withContent(t) ? 2 : 0,
    current_version_index: withContent(t) ? 1 : 0,
    order: i,
  }));
}

const question = (docId: string, id: string, sectionKey: SectionType, q: string, answer: string | null) => ({
  id, document_id: docId, question: q, answer, skipped: false, section_key: sectionKey,
});

const doc = (id: string, title: string, phase: string, minutes: number) => ({
  id,
  title,
  current_phase: phase,
  document_mode: "guided",
  agent_write_policy: "suggest",
  global_context: null,
  user_preferences: null,
  created_at: ago(minutes + 60 * 24),
  updated_at: ago(minutes),
  has_api_key_activity: true,
  folder_id: "f-pipe",
  last_api_key_name: "Claude Code — laptop",
  published_version_id: null,
  published_at: null,
  has_unpublished_changes: false,
  archived_at: null,
});

const TITLE = "RFC: buffer assíncrono de pagamentos";

export const guidedDocuments = [
  doc("doc-pipe-discovery", `${TITLE} (descoberta)`, "discovery", 12),
  doc("doc-pipe-generation", `${TITLE} (geração)`, "generation", 25),
  doc("doc-pipe-refinement", `${TITLE} (refinamento)`, "refinement", 60),
  doc("doc-pipe-audit", `${TITLE} (auditoria)`, "audit", 90),
  doc("doc-pipe-completed", `${TITLE} (forjado)`, "completed", 60 * 26),
];

export const guidedFolder = { id: "f-pipe", name: "Pipelines guiados", parent_id: null, document_count: 5, direct_document_count: 5 };

/** Document detail for a guided doc id, or null when the id is not guided. */
export function guidedDetail(id: string, base: Record<string, unknown> | undefined) {
  const d = guidedDocuments.find((g) => g.id === id) ?? (id === "doc-pay-rfc" && base ? { ...base, current_phase: "alignment", document_mode: "guided" } : null);
  if (!d) return null;
  const phase = (d as { current_phase: string }).current_phase;

  switch (phase) {
    case "discovery":
      return {
        document: d,
        sections: [],
        discovery_questions: [
          question(id, "q1", "context", "Qual problema concreto o time de pagamentos está vendo hoje?", "Timeouts do gateway no pico geram cobrança dupla."),
          question(id, "q2", "context", "Quem sente esse problema primeiro: cliente, lojista ou suporte?", "O cliente, e o suporte logo depois com os estornos."),
          question(id, "q3", "proposal", "A solução precisa funcionar sem trocar de gateway?", "Sim — trocar de gateway está fora do trimestre."),
          question(id, "q4", "implementation", "Existe alguma restrição de infraestrutura nova (fila gerenciada, Kafka)?", null),
          question(id, "q5", "risks", "Quanto tempo um pedido pode ficar pendente antes de virar problema para o lojista?", null),
        ],
        audit_problems: [],
      };
    case "alignment":
      return { document: d, sections: sections(id, () => "pending", () => false), discovery_questions: [], audit_problems: [] };
    case "generation":
      return {
        document: d,
        sections: sections(id, (t) => (t === "context" || t === "proposal" ? "finalized" : t === "implementation" ? "drafting" : "pending"), (t) => t === "context" || t === "proposal"),
        discovery_questions: [],
        audit_problems: [],
      };
    case "refinement":
      return {
        document: d,
        sections: sections(id, (t) => (t === "risks" ? "refining" : "finalized"), () => true),
        discovery_questions: [],
        audit_problems: [],
      };
    case "audit":
      return {
        document: d,
        sections: sections(id, () => "finalized", () => true),
        discovery_questions: [],
        audit_problems: [
          { section: "implementation", issue: "O rollback descrito não diz o que acontece com os itens já na fila quando a flag é desligada.", severity: "high" },
          { section: "proposal", issue: "\"Responde imediatamente\" contradiz o polling da página de confirmação descrito no passo 3.", severity: "medium" },
          { section: "risks", issue: "O alarme de 60 s não tem dono nem canal definido.", severity: "low" },
        ],
      };
    default:
      return { document: d, sections: sections(id, () => "finalized", () => true), discovery_questions: [], audit_problems: [] };
  }
}

/** Findings shown on the completed screen of a guided doc. */
export function guidedFindings(docId: string) {
  const f = (id: string, section: SectionType, severity: "high" | "low", description: string, category: string) => ({
    id, document_id: docId, section_type: section, description, severity, quote: null, category, dismissed: false, created_at: ago(60 * 25),
  });
  return [
    f("gf-1", "implementation", "high", "O rollback não diz o que acontece com os itens já na fila.", "escopo"),
    f("gf-2", "risks", "low", "O alarme de 60 s não tem dono definido.", "responsabilidade"),
  ];
}

export function guidedChat(sectionId: string) {
  return [
    { id: "m1", document_id: "doc-pipe-refinement", section_id: sectionId, role: "user", content: "Deixe mais claro por que trocar de gateway foi descartado.", created_at: ago(70) },
    { id: "m2", document_id: "doc-pipe-refinement", section_id: sectionId, role: "agent", content: "Reescrevi o item: além do prazo de dois trimestres, a troca não elimina a cobrança dupla — a idempotência é o que resolve.", created_at: ago(68) },
  ];
}

/** Two versions per guided section, carrying that section's own content. */
export function guidedVersions(sectionId: string) {
  const type = (ORDER.find((t) => sectionId.endsWith(`-${t}`)) ?? "context") as SectionType;
  return [
    { id: `${sectionId}-v1`, section_id: sectionId, parent_version_id: null, version_name: "Primeira forja", change_summary: null, content: CONTENT[type], is_active: false, is_published: false, published_at: null, is_frozen: true, revision: 0, created_at: ago(60 * 3) },
    { id: `${sectionId}-v2`, section_id: sectionId, parent_version_id: `${sectionId}-v1`, version_name: "Refinada no chat", change_summary: "Deixa claro por que a troca de gateway foi descartada", content: CONTENT[type], is_active: true, is_published: false, published_at: null, is_frozen: false, revision: 2, created_at: ago(68) },
  ];
}
