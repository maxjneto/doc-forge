# DocForge agent-first — cotas de documentos e fluxo legado

> **Status:** aprovado para implementação em 11/08/2026.
> Este documento substitui a regra anterior de créditos por IA hospedada. A
> infraestrutura de IA permanece disponível para recursos futuros, mas deixa de
> ser uma jornada pública de criação de documentos.

## Decisão de produto

O DocForge coordena a escrita, revisão, histórico e publicação. Humanos podem
escrever no editor e agentes conectados via MCP executam a parte de IA com seus
próprios modelos e ferramentas.

Créditos representam **criações de documentos por semana**, não tokens ou
execuções de IA.

## Regras vigentes após esta entrega

- Cada documento novo consome uma criação semanal: editor, MCP ou pipeline.
- Editar, sugerir, revisar, versionar, publicar, compartilhar e mover um
  documento não consome criação.
- O saldo renova toda segunda-feira, 00:00 UTC, e se recupera no primeiro acesso
  mesmo que o cron não execute.
- Excluir ou arquivar um documento não devolve uma criação da semana.
- Documentos arquivados não contam para o limite de documentos ativos.
- Desarquivar exige uma vaga dentro do limite de documentos ativos.
- O limite semanal e o limite de documentos ativos são independentes.

## Planos

| Recurso | Free | Pro |
|---|---:|---:|
| Criações de documento por semana | 5 | 50 |
| Documentos ativos | 10 | 200 |
| Agentes conectados | 1 | 10 |
| Versões por seção | 20 | Fair use |
| Pipelines, tipos e prompts customizados | Não | Sim |
| Exportação autenticada | Não | Markdown, PDF e DOCX |

Os números ficam configuráveis no backend. Team permanece uma oferta futura.

## Fluxos

### Criar no editor

1. O usuário inicia um documento novo.
2. O backend atualiza a janela semanal, valida o limite ativo e consome uma
   criação atomicamente.
3. O documento é criado diretamente no editor Markdown.
4. O usuário ou agente pode trabalhar nele sem custo adicional.

### Criar por MCP ou pipeline

1. O agente solicita a criação de um documento ou inicia uma pipeline.
2. A mesma regra de criação semanal é aplicada pelo backend.
3. O agente usa seu próprio modelo, ferramentas e contexto externo.
4. O DocForge mantém estado, sugestões, checkpoints, histórico e publicação.

### Arquivar e publicar

- Arquivar esconde o documento da biblioteca padrão e libera uma vaga ativa.
- Publicar fixa uma versão pública. Uma edição posterior abre um novo rascunho e
  não altera o conteúdo do link público até a próxima publicação explícita.

## Fluxo guiado hospedado

- Não há novas criações guiadas pela interface ou API pública.
- Documentos guiados existentes continuam abrindo e podem ser editados.
- As funções, providers, prompts e observabilidade de IA ficam preservados.
- A execução hospedada fica protegida por `HOSTED_GUIDED_WORKFLOW_ENABLED=false`
  para permitir uso interno e migração de jobs antigos, sem expor a jornada.

## Quality gate

- Não consome criação semanal.
- O gate executado pelo agente continua sendo o fluxo público principal.
- Checagens estruturais e findings continuam podendo bloquear a publicação.
- A auditoria hospedada permanece como capacidade interna para recursos futuros;
  ela não é uma oferta atual de créditos.

## Exportação

- Exportar exige usuário autenticado no plano Pro.
- Markdown, PDF e DOCX passam pelo mesmo endpoint do backend.
- Links públicos não oferecem exportação.
- Usuários Pro com acesso de leitura a um documento compartilhado podem exportá-lo.

## Comunicação

Mensagem central:

> Seus agentes escrevem. Você revisa, organiza e publica.

O How It Works deve apresentar: criar ou conectar, trabalhar com contexto real,
revisar mudanças e publicar versões estáveis. Exportação entra como benefício Pro.

## Fora do escopo

- Remover providers de IA ou Inngest.
- Converter fisicamente documentos guiados existentes.
- Definir preço definitivo do Pro.
- Implementar Team, workspaces ou SSO.
- Construir uma nova suíte completa de verificadores semânticos determinísticos.
