# Capacidade de documentos e planos

> **Status:** implementado em 11/08/2026. A especificação completa e o
> racional da transição estão em
> [agent-first-document-quotas.md](agent-first-document-quotas.md).

## Regra vigente

O campo histórico `users.credits` agora mede **criações de documento restantes
na semana**, e não saldo de chamadas de IA do DocForge.

| Plano | Criações por semana | Documentos ativos | Agentes | Exportação |
|---|---:|---:|---:|---|
| Free | 5 | 10 | 1 | indisponível |
| Pro | 50 | 200 | 10 | Markdown, PDF e DOCX |

Uma criação pelo editor, MCP ou início de pipeline BYOA consome uma unidade. A
edição, versões, publicação, compartilhamento, sugestões e quality gates
executados pelo agente não consomem a quota. O período reinicia toda segunda,
00:00 UTC; a verificação é autocorretiva em cada autenticação e não depende do
cron.

Arquivar um documento remove-o do limite de documentos ativos; ele pode ser
restaurado mais tarde. O modo guiado hospedado e o quality gate hospedado estão
desligados para contas públicas, mas sua infraestrutura continua preservada
atrás das flags de configuração.

`GET /api/users/me` expõe `document_creations_remaining`,
`weekly_document_creations`, `document_creations_reset_at` e
`next_document_creations_reset_at`. Clientes devem exibir esses valores sem
recalcular a data de reset.
