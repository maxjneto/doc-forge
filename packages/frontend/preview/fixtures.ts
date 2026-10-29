/**
 * Backend-shaped (snake_case) fixtures for the design preview. The content is
 * the CopaSim document from the v4 mocks, so screens can be compared with
 * `DocForge Review v4.dc.html` side by side.
 */

const now = Date.now();
export const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

/** Creations renew every Monday at 00:00 UTC. */
function nextMondayUtc() {
  const d = new Date(now);
  const days = ((8 - d.getUTCDay()) % 7) || 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)).toISOString();
}

// ─── Account ──────────────────────────────────────────────────────

export const me = {
  id: "user_preview",
  email: "max@doc-forge.dev",
  name: "Max Aragão",
  plan: "pro",
  document_creations_remaining: 74,
  weekly_document_creations: 100,
  document_creations_reset_at: ago(60 * 24 * 3),
  next_document_creations_reset_at: nextMondayUtc(),
};

// Numbers follow backend/app/services/tiers.py.
export const tiers = [
  {
    slug: "free", name: "Free", price_monthly: 0, currency: "BRL", credits: "15 new documents / week",
    description: "Everything DocForge does, for one person and their agents.",
    features: ["Markdown documents and layout pages and slides", "15 new documents each week", "Up to 30 active documents", "2 connected agents (MCP)"],
    limits: { max_active_documents: 30, max_api_keys: 2, weekly_document_creations: 15, max_versions_per_section: 50, export_formats: ["md", "pdf"] },
    cta: "Start for free", highlight: false, available: true,
  },
  {
    slug: "pro", name: "Pro", price_monthly: 19, currency: "BRL", credits: "100 new documents / week",
    description: "For people who write with agents every day.",
    features: ["Everything in Free", "100 new documents each week", "Up to 1000 active documents", "10 connected agents (MCP)"],
    limits: { max_active_documents: 1000, max_api_keys: 10, weekly_document_creations: 100, max_versions_per_section: null, export_formats: ["md", "pdf", "docx"] },
    cta: "Upgrade to Pro", highlight: true, available: true,
  },
];

// ─── Library ──────────────────────────────────────────────────────

export const folders = [
  { id: "f-arch", name: "Arquitetura", parent_id: null, document_count: 3, direct_document_count: 2 },
  { id: "f-adr", name: "Decisões", parent_id: "f-arch", document_count: 1, direct_document_count: 1 },
  { id: "f-pay", name: "Payments", parent_id: null, document_count: 2, direct_document_count: 2 },
  { id: "f-run", name: "Runbooks", parent_id: null, document_count: 2, direct_document_count: 2 },
];

type DocSeed = {
  id: string; title: string; folder: string | null; updated: number;
  published?: number; unpublished?: boolean; agent?: string | null; archived?: number;
  layout?: boolean;
};

const docSeeds: DocSeed[] = [
  { id: "doc-copasim", title: "CopaSim — Salas e Partidas", folder: "f-arch", updated: 6, published: 60 * 26, unpublished: true, agent: "Claude Code — laptop" },
  { id: "doc-host", title: "Host autoritativo: migração do motor de partidas", folder: "f-arch", updated: 60 * 5, agent: "Codex — CI" },
  { id: "doc-adr7", title: "ADR-07 — por que o host simula", folder: "f-adr", updated: 60 * 30, published: 60 * 30 },
  { id: "doc-pay-rfc", title: "RFC: buffer assíncrono de pagamentos", folder: "f-pay", updated: 42, agent: "Claude Code — laptop" },
  { id: "doc-pay-rollback", title: "Plano de rollback do checkout v3", folder: "f-pay", updated: 60 * 50, published: 60 * 49 },
  { id: "doc-run-pg", title: "Runbook: rotação de chaves do Postgres", folder: "f-run", updated: 60 * 24 * 6, published: 60 * 24 * 6 },
  { id: "doc-run-hooks", title: "Postmortem 30/09 — fila de webhooks parada", folder: "f-run", updated: 60 * 24 * 2, published: 60 * 24 * 8, unpublished: true, agent: "Cursor" },
  { id: "doc-roadmap", title: "Roadmap Q4", folder: null, updated: 60 * 3, published: 60 * 24 * 12, unpublished: true },
  { id: "doc-layout-q3", title: "Relatório do 3º trimestre", folder: null, updated: 25, agent: "Claude Code — laptop", layout: true },
  { id: "doc-layout-deck", title: "Plano de crescimento 2027 (slides)", folder: null, updated: 40, agent: "Claude Code — laptop", layout: true },
  { id: "doc-notes", title: "Notas soltas de entrevistas com usuários", folder: null, updated: 60 * 24 * 9 },
  { id: "doc-old", title: "Proposta de pricing (v1)", folder: null, updated: 60 * 24 * 40, archived: 60 * 24 * 20 },
];

export const documents = docSeeds.map((d) => ({
  id: d.id,
  title: d.title,
  document_mode: d.layout ? "layout" : "editor",
  agent_write_policy: "suggest",
  created_at: ago(d.updated + 60 * 24 * 3),
  updated_at: ago(d.updated),
  has_api_key_activity: Boolean(d.agent),
  folder_id: d.folder,
  last_api_key_name: d.agent ?? null,
  published_version_id: d.published ? `v-${d.id}-pub` : null,
  published_at: d.published ? ago(d.published) : null,
  has_unpublished_changes: Boolean(d.unpublished),
  archived_at: d.archived ? ago(d.archived) : null,
}));

export const sharedDocuments = [
  { id: "doc-shared-1", title: "Design review — onboarding de times", role: "commenter", updated_at: ago(90) },
  { id: "doc-shared-2", title: "Contrato de API pública v2", role: "editor", updated_at: ago(60 * 20) },
];

// ─── The CopaSim document ─────────────────────────────────────────

export const copasimBody = `# CopaSim — Salas e Partidas

## 1. O que é o CopaSim

O CopaSim é um simulador de torneios de futebol jogado em salas privadas. Cada sala reúne até oito jogadores que montam seleções, acompanham as rodadas e disputam o chaveamento até a final.

## 2. A ideia central: a sala é uma sessão do host

A regra mental do projeto, escrita no \`CLAUDE.md\` do monorepo:

> *"A sala é uma sessão do host: o navegador do dono roda o relógio das rodadas e o motor determinístico das partidas."*

O servidor faz duas coisas e só duas: **relaia** os snapshots para os outros jogadores e **persiste** o estado ao fim de cada rodada.

Todo o "jogo" — o relógio das rodadas, o chaveamento, a simulação — vive no navegador do host.

## 3. O monorepo: quem é quem

| Pacote | Papel | Roda onde |
|---|---|---|
| \`apps/web\` | interface e motor de partidas | navegador |
| \`apps/relay\` | WebSocket de snapshots | servidor |
| \`packages/engine\` | simulação determinística | navegador |
| \`packages/protocol\` | tipos das mensagens | ambos |

## 4. Conceitos fundamentais

### 4.1 Sala (Room) e as duas identidades

Uma sala tem um \`roomId\` público e um \`hostToken\` secreto. Quem tem o token é o host.

### 4.2 Identidade: playerId

Cada jogador recebe um \`playerId\` estável, guardado no navegador, que sobrevive a recarregamentos.

### 4.3 As fases da sala

\`lobby → drafting → running → finished\`. A transição é sempre disparada pelo host.

## 5. Ciclo de vida da sala

### 5.1 Criação e entrada

O dono cria a sala, recebe o link e compartilha. Os demais entram pelo link e aparecem no lobby.

### 5.2 Como o estado chega até os outros jogadores

A cada tick, o host serializa o \`RoomState\` e envia pelo socket. O servidor recebe o snapshot, guarda em memória e distribui para os demais participantes da sala.

::artefato[ciclo-do-host]

### 5.3 O início

Quando o dono clica **Iniciar**, a sala transiciona para \`running\` e o worker do host começa a emitir ticks.

## 6. O host assume: claim e watchdog

Se o host cai, o primeiro jogador a reivindicar a sala em até 30 segundos vira o novo host.

## 7. O ciclo da rodada

### 7.1 As fases

Cada rodada tem preparação, partidas e consolidação. Cada transição produz um snapshot que o resto da sala consome.

\`\`\`ts
const room = await claimHost(roomId, hostToken);
room.on("tick", (state) => relay.publish(state));
\`\`\`

## 8. A partida: como uma rodada é simulada

O motor recebe as escalações e uma semente, e devolve o placar lance a lance. A mesma semente sempre produz o mesmo jogo.
`;

const proposedBody = copasimBody
  .replace(
    "O servidor recebe o snapshot, guarda em memória e distribui para os demais participantes da sala.",
    "O servidor só relaia o snapshot para os demais participantes e o persiste ao fim da rodada; ele não interpreta o conteúdo.",
  )
  .replace(
    "Se o host cai, o primeiro jogador a reivindicar a sala em até 30 segundos vira o novo host.",
    "Se o host cai, o watchdog do relay marca a sala como órfã. O primeiro jogador a reivindicá-la em até 30 segundos vira o novo host e retoma do último snapshot persistido.",
  );

export const documentDetail = (id: string) => {
  const doc = documents.find((d) => d.id === id) ?? documents[0];
  const isCopasim = doc.id === "doc-copasim";
  if (doc.document_mode === "layout") {
    return { document: doc, sections: [] };
  }
  return {
    document: doc,
    sections: [
      {
        id: `sec-${doc.id}`,
        document_id: doc.id,
        section_type: "body",
        active_version_content: isCopasim ? copasimBody : `# ${doc.title}\n\nRascunho inicial.\n\n## Contexto\n\nEscreva aqui.\n`,
      },
    ],
  };
};

export const versions = (sectionId: string) => {
  const names = ["Primeiro rascunho", "Estrutura do monorepo", "Ciclo de vida", "v4 — publicada", "Draft after v4"];
  return names.map((name, i) => ({
    id: `ver-${i + 1}`,
    section_id: sectionId,
    parent_version_id: i ? `ver-${i}` : null,
    version_name: name,
    change_summary: i === 4 ? "Rascunho em revisão com mudanças do agente" : i === 3 ? "Versão publicada para o time" : null,
    content: copasimBody,
    is_active: i === 4,
    is_published: i === 3,
    published_at: i === 3 ? ago(60 * 26) : null,
    is_frozen: i !== 4,
    revision: i === 4 ? 7 : 0,
    created_at: ago(60 * 24 * (5 - i)),
  }));
};

export const suggestions = (docId: string) => [
  {
    id: "sug-1",
    document_id: docId,
    section_id: `sec-${docId}`,
    proposed_version_id: "ver-prop-1",
    base_version_id: "ver-5",
    status: "pending",
    note: "Atualiza o documento para o estado pós-migração host-autoritativa. A metáfora “cano e cofre” fazia o leitor supor lógica de jogo no servidor.",
    review_comment: null,
    agent_name: "Claude Code — laptop",
    proposed_content: proposedBody,
    current_content: copasimBody,
    is_stale: false,
    created_at: ago(120),
    resolved_at: null,
  },
  {
    id: "sug-0",
    document_id: docId,
    section_id: `sec-${docId}`,
    proposed_version_id: "ver-prop-0",
    base_version_id: "ver-4",
    status: "accepted",
    note: "Define matchCycle na primeira menção.",
    review_comment: null,
    agent_name: "Claude Code — laptop",
    proposed_content: copasimBody,
    current_content: copasimBody,
    is_stale: false,
    created_at: ago(60 * 20),
    resolved_at: ago(60 * 19),
  },
];

const finding = (id: string, severity: "high" | "low", description: string, quote: string, category: string, minutes: number) => ({
  id, document_id: "doc-copasim", section_type: "body", description, severity, quote, category, dismissed: false, created_at: ago(minutes),
});

export const gate = {
  require_gate_on_accept: true,
  open_findings: 4,
  open_high_findings: 2,
  blocking: true,
  findings: [
    finding("g-1", "high", "O texto diz que o servidor guarda e distribui o estado — a §2 diz que ele só relaia e persiste.", "O servidor recebe o snapshot, guarda em memória e distribui", "coerência", 120),
    finding("g-2", "high", "A seção promete explicar o watchdog e não explica como a órfã é detectada.", "Se o host cai, o primeiro jogador a reivindicar", "escopo", 118),
    finding("g-3", "low", "“dono da sala” e “host” usados como sinônimos sem definir a relação.", "Quando o dono clica Iniciar", "terminologia", 117),
    finding("g-4", "low", "matchCycle aparece antes de ser definido.", "As fases da sala", "definição", 116),
  ],
};

export const artifacts = (docId: string) => [
  {
    id: "art-1", document_id: docId, key: "ciclo-do-host", kind: "diagram", title: "Ciclo do host — fases 0‑5",
    content: "flowchart LR\n  lobby --> drafting --> running --> finished\n  running -->|host cai| orphan\n  orphan -->|claim| running",
    author: "Claude Code — laptop", is_agent: true, revision: 2, anchored: true, created_at: ago(130), updated_at: ago(122),
  },
  {
    id: "art-2", document_id: docId, key: "pacotes", kind: "table", title: "Os 4 pacotes do monorepo",
    content: "| Pacote | Papel |\n|---|---|\n| apps/web | interface |\n| apps/relay | snapshots |",
    author: "Claude Code — laptop", is_agent: true, revision: 1, anchored: false, created_at: ago(60 * 22), updated_at: ago(60 * 22),
  },
  {
    id: "art-3", document_id: docId, key: "adr-07", kind: "decision", title: "ADR-07 — por que o host simula",
    content: "**Decisão:** o motor roda no navegador do host.\n\n**Por quê:** custo zero de servidor e determinismo por semente.",
    author: "Max Aragão", is_agent: false, revision: 1, anchored: false, created_at: ago(60 * 30), updated_at: ago(60 * 30),
  },
];

const event = (id: string, action: string, actor: string, isAgent: boolean, harness: string | null, minutes: number, description: string | null, bytes: number | null = null) => ({
  id, action_type: action, description, actor_name: actor, is_agent: isAgent, harness, bytes_delta: bytes, version_id: null, created_at: ago(minutes),
});

export const activity = [
  event("a1", "suggestion_created", "Claude Code — laptop", true, "claude_code", 120, "Propôs a v5: estado pós-migração"),
  event("a2", "write", "Max Aragão", false, null, 6, "Editou §5.2", 214),
  event("a3", "suggestion_accepted", "Max Aragão", false, null, 60 * 19, "Aceitou: define matchCycle"),
  event("a4", "snapshot", "Max Aragão", false, null, 60 * 26, "v4 — publicada"),
  event("a5", "feedback_created", "Max Aragão", false, null, 60 * 27, "Pediu correção em §8"),
  event("a6", "write", "Codex — CI", true, "codex", 60 * 30, "Reescreveu §3", 1180),
].sort((a, b) => b.created_at.localeCompare(a.created_at));

export const myActivity = activity.map((e, i) => ({
  ...e,
  doc_id: i % 2 ? "doc-host" : "doc-copasim",
  doc_title: i % 2 ? "Host autoritativo: migração do motor de partidas" : "CopaSim — Salas e Partidas",
}));

export const apiKeys = [
  { id: "k1", name: "Claude Code — laptop", harness: "claude_code", created_at: ago(60 * 24 * 30), last_used_at: ago(6), revoked_at: null },
  { id: "k2", name: "Codex — CI", harness: "codex", created_at: ago(60 * 24 * 12), last_used_at: ago(60 * 5), revoked_at: null },
  { id: "k3", name: "Cursor", harness: "cursor", created_at: ago(60 * 24 * 9), last_used_at: ago(60 * 24 * 2), revoked_at: null },
];

export const members = {
  my_role: "owner",
  members: [
    { id: "m1", email: "ana@time.dev", role: "editor", accepted: true },
    { id: "m2", email: "joao@time.dev", role: "commenter", accepted: false },
  ],
};
