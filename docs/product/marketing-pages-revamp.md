# DocForge — Revamp de How it works, Billing e Legal/Contact

> **Atualização de 11/08/2026:** os campos e mensagens de crédito deste plano
> foram substituídos pela capacidade semanal de documentos descrita em
> [agent-first-document-quotas.md](agent-first-document-quotas.md).

> **Status:** implementação parcial; Billing concluído em 11/08/2026.
> **Contexto:** levantamento pedido pelo Max após notar que `HowItWorksPage` não reflete todas as funcionalidades já commitadas (M1–M5), que `BillingPage` é hoje um clone de `PricingPage`, e que `LegalPage`/Contact fogem do padrão visual do resto do site.

## Como ler este documento

Três blocos independentes — um por página/grupo de páginas. Cada um tem: **diagnóstico** (o que existe hoje e por que incomoda), **decisão tomada** (resolvida com o Max antes de codar) e **plano de mudança** (checklist do que implementar). Nenhum item está implementado ainda.

---

## 1. How it works (`HowItWorksPage.tsx`)

### Diagnóstico

A página cobre bem os dois caminhos de entrada (`TrackPickerCards`), a instalação MCP em 3 blocos (`McpStepBlocks`) e as 6 fases do Forger com mocks ricos (`ScrollNarratedPhases`). Dois problemas:

1. **Funcionalidades ausentes.** Suggestion review (M1), quality gates (M5), pipelines/prompts customizados (M4, Pro) e export PDF/Word não aparecem em nenhum lugar da página — hoje só existem na grade de features da `LandingPage`.
2. **Forger visualmente apagado.** `McpStepBlocks` usa a paleta âmbar (cor de marca, `var(--df-amber-300)` etc.) para tudo — eyebrow, ícones, progress. `ScrollNarratedPhases` usa steel/cinza (`var(--df-steel-100)`) para o eyebrow "Path B · The Forger" e boa parte dos estados. O conteúdo do Forger é rico, mas o tratamento cromático o deixa com menos peso que o Path A, mesmo o produto não querendo isso.

**Bugs de conteúdo encontrados (independem do redesign):**
- O mock da fase "Completed" (`CompletedMock`/copy da fase 06) promete export para **Confluence** e **cópia como comentário do Linear** — só **Markdown, PDF e DOCX** foram implementados (`GET /api/documents/{id}/export?format=md|pdf|docx`).
- As 6 fases usam sempre um exemplo de RFC (`payments-rfc.md`, "RFC-0142"...) — hoje existem 4 tipos guiados (RFC/ADR/Postmortem/Runbook, migração 024) e a página não reflete isso.

### Plano de mudança

- [ ] **Hero** — ajustar copy para sinalizar o conjunto completo do produto (review + audit + gate + versionamento + export), não só "review".
- [ ] **TrackPickerCards** — mantém como está.
- [ ] **Nova seção "Shared trust layer"** logo após o picker, antes das seções específicas de cada caminho: grade compacta com Suggestion review & diffs, Quality gates, Versionamento & atribuição, Export (MD/PDF/DOCX), Pipelines & prompts custom (tag Pro). Estabelece que esses recursos valem para os dois caminhos, resolvendo o gap #1.
- [ ] **McpStepBlocks (Path A)** — adicionar um 4º `StepBlock` ("Toda escrita vira revisão") mostrando a UI de diff/sugestão (estilo `EditorSuggestionPanel`), conectando os passos de instalação ao loop de review.
- [ ] **ScrollNarratedPhases (Path B) — rebalanceamento visual** — trocar os tons steel/cinza do eyebrow, labels e estados por âmbar, equiparando o peso visual ao Path A.
- [ ] **ScrollNarratedPhases — correção de conteúdo** — mock/copy da fase Completed passa a citar só MD/PDF/DOCX; variar o exemplo entre os 4 tipos guiados (ou adicionar um seletor de tipo) em vez de RFC fixo.
- [ ] **ClosingCta** — reaproveitar o componente já existente (hoje não usado nesta página) no fim, em vez de terminar abruptamente no `AppFooter`.

---

## 2. Billing (`BillingPage.tsx`)

### Diagnóstico

Hoje `BillingPage` é quase idêntica a `PricingPage`: mesmo grid de 3 tiers, mesmo copy ("Simple, credit-based pricing."), sem nada específico da conta do usuário logado. Não mostra créditos restantes, quanto dos limites do plano já foi consumido, nem quando os créditos resetam — ou seja, é uma tela de vendas, não de conta.

Dados usados pela implementação:
- `GET /api/users/me` → `credits`, `weekly_credits`, `plan`, `next_credit_reset_at`
- `GET /api/tiers` → `limits.max_active_documents`, `limits.max_api_keys`
- `GET /api/documents` → lista de documentos do usuário (contagem = documentos ativos)
- `apiListApiKeys` (já usado em `McpPage`) → contagem de agentes conectados

"Manage billing" já redireciona para o Stripe Customer Portal (`apiCreatePortalSession`) — faturas e forma de pagamento já têm um lugar; não precisa ser reconstruído aqui.

### Decisão tomada

Billing vira **dashboard de conta/uso como conteúdo principal**; a grade completa de 3 tiers sai daqui e vira um CTA compacto que linka para `/pricing` (evita redundância com a Pricing page).

### Plano de mudança

- [x] **Header** — status do plano atual em destaque ("Você está no Free" / nome + preço se pago), substituindo a abertura atual em "Simple, credit-based pricing."
- [x] **Painel de uso (novo)**:
  - Créditos: `credits` / `weekly_credits`, barra de progresso e próximo reset recebido do backend (segunda 00:00 UTC).
  - Documentos ativos: contagem via `GET /api/documents` / `limits.max_active_documents` (mostrar "sem limite" em Pro/Team).
  - Agentes conectados: contagem via `apiListApiKeys` / `limits.max_api_keys`.
- [x] **CTA de upgrade compacto** — o grid saiu da tela de conta; comparação detalhada permanece em `/pricing`.
- [x] Manter os banners de checkout `success`/`cancel`.
- [x] Manter o botão de cobrança apontando para o Stripe Portal, com label explícito sobre faturas.

---

## 3. Privacy, Terms e Contact

### Diagnóstico

`LegalPage.tsx` (serve `/legal/privacy` e `/legal/terms`) usa um shell próprio, diferente do resto do site: fundo `#0d0e0f` (vs. `#050608` usado em Landing/HowItWorks/Pricing/Billing), header bespoke (só link "← Back" + título, sem `MarketingNav`/`TopBar`), footer bespoke (não usa `AppFooter`), sem o glow ambiente (`radial-gradient`) presente nas outras páginas.

"Contact" hoje **não é uma página** — é só um link `mailto:maxjneto@gmail.com` no `AppFooter`.

**Bug de conteúdo:** a Privacy Policy (§5, "Data Storage and Retention") ainda declara que os dados ficam em "PostgreSQL database hosted on Microsoft Azure" — a infra migrou para VPS self-hosted (`docker-compose.prod.yml`, ver commit `8c2bb99`). "Last updated: May 5, 2026" está defasado frente a tudo que mudou desde então (Stripe, tiers, 4 tipos guiados, export, pivot de infra).

### Decisões tomadas

1. **Contact vira página própria** (`/contact`), não fica só como `mailto:`.
2. **Privacy/Terms adotam o chrome completo de marketing** (`MarketingNav`/`TopBar` + `AppFooter` + ambient), não um layout minimalista à parte.
3. **Corrigir o texto desatualizado da Privacy Policy** (Azure → VPS self-hosted) e atualizar "Last updated" nesta mesma leva.

### Plano de mudança

- [ ] Reconstruir o shell de `LegalPage`: `MarketingNav` (deslogado) / `TopBar` (logado) + `AppFooter` + mesmo fundo/ambient das demais páginas de marketing.
- [ ] Coluna de conteúdo mantém `MarkdownRenderer` (variant `chat`), largura ~800px preservada dentro do novo shell.
- [ ] Nova rota `/contact` com o mesmo shell: pill "Contact", canal de contato (email + expectativa de resposta, dado o estágio beta/solo), sem formulário (só `mailto:` estilizado dentro da página, mesmo padrão visual do resto).
- [ ] `AppFooter` — trocar o link "Contact" de `mailto:` direto para `<Link to="/contact">`.
- [ ] Corrigir Privacy §5 (Azure → VPS self-hosted) e §4 se necessário (confirmar se o provedor de IA listado ainda é preciso); atualizar "Last updated".

---

## Ordem sugerida de implementação

1. **Billing** — menor escopo, nenhuma rota nova, todos os dados já existem no backend.
2. **Legal + Contact** — reaproveita componentes de shell já existentes (`MarketingNav`, `TopBar`, `AppFooter`); rota nova simples.
3. **How it works** — maior esforço (novas seções, rebalanceamento visual, variação de conteúdo entre 4 tipos guiados).
