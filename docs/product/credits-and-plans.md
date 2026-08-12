# Créditos e planos — comportamento vigente

> **Status:** implementado em 11/08/2026. Este documento descreve a regra
> operacional do produto; ideias futuras continuam em `product-plan.md`.

## Princípio

Créditos representam custo de IA pago pelo DocForge. Recursos de armazenamento,
edição e colaboração pertencem ao plano e não devem parar quando o saldo chega a
zero.

## O que consome créditos

| Operação | Custo atual | Motivo |
|---|---:|---|
| Documento guiado com IA hospedada | 3 | O DocForge executa discovery, geração e auditoria |
| Quality gate executado pelo servidor | 1 | O DocForge chama o modelo de auditoria |

O quality gate devolve o crédito automaticamente se a execução falhar.

## O que não consome créditos

- Criar e editar documentos no editor Markdown.
- Criar documentos pelo MCP.
- Executar uma pipeline BYOA pelo próprio agente do usuário.
- Escrever, sugerir, revisar, versionar, publicar e compartilhar documentos.
- Quality gate executado pelo agente e submetido ao DocForge.

Esses fluxos continuam disponíveis com saldo zero, sujeitos apenas aos limites
do plano (por exemplo, documentos ativos e agentes conectados no Free).

## Renovação semanal

- O período vai de **segunda-feira 00:00 UTC** até a segunda seguinte.
- O cron do Inngest antecipa a renovação em lote.
- Toda autenticação também verifica o período no banco e renova o saldo de forma
  atômica quando necessário. Portanto, a correção não depende do cron.
- Usuários existentes sem período registrado são renovados no primeiro acesso
  após a migration `032`.
- `GET /api/users/me` expõe `credits_reset_at` e `next_credit_reset_at`; a UI deve
  mostrar essa data recebida do servidor, sem recalcular uma regra própria.

## Estado atual dos planos

O Free usa `WEEKLY_CREDITS`, `FREE_MAX_ACTIVE_DOCUMENTS` e
`FREE_MAX_API_KEYS`. O Pro já possui gates de feature e integração Stripe, mas
sua quantidade própria de créditos ainda não foi definida. Durante o beta, ele
recebe a mesma allowance semanal configurada em `WEEKLY_CREDITS`. Team permanece
indisponível porque workspace, SSO e políticas organizacionais ainda não estão
entregues. A aplicação não deve prometer top-up, créditos mensais ou uma
quantidade paga diferente sem configuração correspondente no backend.
