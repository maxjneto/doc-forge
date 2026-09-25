---
name: validate
description: Use quando o usuário pedir para validar em tela, "confere no navegador", "tira print", "sobe e testa", "vê como ficou a tela", ou para revisar visualmente telas do DocForge antes de considerar uma mudança de UI pronta. Sobe a stack local (Postgres + backend real + front) com uma sessão Clerk falsa e tira screenshots de todas as telas. Não usar para checagens de rotina (tsc, vitest, ruff) — essas rodam sem esta skill.
---

# /validate — ver as telas do DocForge

O front depende do Clerk (login) e o backend valida JWT do Clerk. Para rodar localmente sem conta
Clerk, `scripts/preview/` troca só a ponta da autenticação:

- `dev_auth.py` gera uma chave RSA local, serve o JWKS em `:8765` e emite um JWT com as mesmas
  claims do Clerk. O backend roda **sem mudança de código** — só com `CLERK_JWKS_URL` apontando
  para esse servidor.
- No front, `VITE_DEV_AUTH_TOKEN` faz o Vite trocar `@clerk/clerk-react` por
  `src/dev/clerk-stub.tsx` (só no dev server; `vite build` recusa rodar com essa variável).
- `seed.py` recria o usuário `user_preview` com um documento por fase (discovery, alignment,
  generation, refinement, audit, completed, editor com sugestão de agente, editor vazio, doc com
  erro) + uma API key `claude-laptop`. Rodar de novo reseta tudo.

Sem IA: Azure OpenAI e Inngest não sobem. Telas renderizam com os dados do seed, mas ações que
chamam IA (responder discovery, aprovar alignment, pedir edição) falham — valide o visual, não
o fluxo de IA.

## 1. Subir

```bash
scripts/preview/up.sh        # idempotente: sobe o que falta e re-seeda
scripts/preview/up.sh stop   # derruba backend, front e JWKS (Postgres fica)
```

Portas: Postgres 5480, JWKS 8765, backend 8000, front 5173. Logs em
`scripts/preview/.preview-state/*.log`. Na primeira vez instala o venv do backend (`uv`) e
`npm ci` — demora alguns minutos. O script usa `setsid`, então rode-o com `run_in_background`
se o terminal ficar preso.

## 2. Screenshots

```bash
node scripts/preview/shoot.mjs                         # todas as telas, desktop 1440x900
node scripts/preview/shoot.mjs --mobile                # 390x844
node scripts/preview/shoot.mjs --only=home,doc-editor  # filtra por prefixo do nome
node scripts/preview/shoot.mjs --locale=en-US          # default é pt-BR (locale do dono)
```

Saída em `scripts/preview/.preview-state/shots/*.png` (um PNG full-page por tela). Abra os PNGs
com a ferramenta Read para ver. No fim o script lista erros de console, respostas 4xx/5xx da API
e fontes de ícone que não carregaram — uma tela pode parecer ok com metade das chamadas falhando.

Telas cobertas: landing, how-it-works, pricing, legal (deslogado); home, mcp, billing, customize,
document/new e um `/document/:id` por documento do seed (logado).

Para um fluxo interativo (clicar, abrir dialog, trocar aba), escreva um script Playwright curto
baseado em `shoot.mjs` (mesmo `addInitScript` para a sessão) ou use a skill `run`.
Deslogado: `localStorage["df-dev-signed-out"] = "1"`.

## 3. Reportar

Diga o que foi verificado (telas, desktop/mobile, locale) e o que não foi ("fluxo de IA não
testado"). Se algo quebrou, descreva o sintoma visual e cole a linha relevante da seção
`problems` do `shoot.mjs` ou do `backend.log`.
