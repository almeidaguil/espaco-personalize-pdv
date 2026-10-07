# E2E Multioperador E Concorrencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar automaticamente, em ambiente local isolado, que dois operadores usam caixas independentes, disputas concorrentes preservam estoque e financeiro, e o admin consegue executar a contingencia auditada.

**Architecture:** O gate inicia um Supabase local efemero, deriva as chaves locais somente em memoria, aplica reset, cria de forma idempotente um admin e dois operadores e executa o Playwright contra o Next.js local. Os cenarios usam contextos de navegador separados e clientes autenticados por identidade; preparacao e limpeza financeira passam pelas RPCs publicas, sem `update` direto e sem reset remoto.

**Tech Stack:** Next.js 16, TypeScript, Supabase CLI 2.105, Supabase JS, Playwright 1.60, Vitest 4, GitHub Actions.

**Spec:** `docs/plano-reestruturacao-loja-fisica.md` (PR07), complementado por `docs/adr/0001-loja-fisica-caixas-por-operador.md`.

## Global Constraints

- Cada operador pode manter no maximo um caixa aberto; operadores diferentes podem operar simultaneamente.
- O mesmo operador pode fechar e abrir nova sessao no mesmo dia.
- Identidade financeira vem da sessao autenticada, nunca de campo escolhido no frontend.
- Preparacao financeira usa RPCs ou reset do Supabase local isolado; nenhum reset remoto faz parte deste PR.
- O gate nao imprime senhas, cookies, tokens, publishable key nem secret key.
- Traces e relatorios sao publicados somente quando houver falha e devem usar dados efemeros locais.
- O PR07 nao cria projetos Supabase/Vercel e nao altera ambientes remotos; isso pertence ao PR08.
- Desenvolvimento segue TDD, commits assinados, Conventional Commits e integracao exclusiva por PR em `develop`.

## Review Focus

- Ausencia de qualquer uma das tres identidades deve falhar antes do Playwright, sem pular teste autenticado; cobrir em Task 1.
- Duas tentativas concorrentes do mesmo usuario devem produzir exatamente uma sessao aberta; cobrir em Task 2.
- Fechar um caixa nao pode encerrar, ocultar ou impedir vendas no caixa do outro operador; cobrir em Task 2.
- Duas vendas disputando a ultima unidade devem produzir um sucesso, uma rejeicao e saldo final zero; cobrir em Task 3.
- Falha no CI deve preservar evidencia sem expor variaveis sensiveis, e o Supabase deve parar mesmo assim; cobrir em Task 4.

---

### Task 1: Contrato De Identidades E Seed Local Idempotente

**Files:**

- Create: `scripts/e2e-test-users.mjs`
- Create: `scripts/e2e-test-users.test.ts`
- Modify: `scripts/seed-local-e2e-user.mjs`
- Modify: `scripts/verify-e2e-env.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `E2EUserName = "admin" | "operatorA" | "operatorB"`.
- Produces: `resolveE2EUsers(environment)` com `{ name, email, password, fullName, role }[]` para `E2E_USER_*`, `E2E_OPERATOR_A_*` e `E2E_OPERATOR_B_*`.
- Produces: `assertLocalSupabaseUrl(value)` e mensagens que citam apenas nomes de variaveis ausentes.
- Preserves: `npm run e2e:seed-local` como comando publico, agora criando/atualizando as tres identidades.

- [x] **Step 1: Escrever os testes unitarios que falham**

Cobrir em `scripts/e2e-test-users.test.ts`: resolucao das tres identidades e roles, lista exata de variaveis ausentes, recusa de hostname remoto, aceite de `localhost`, `127.0.0.1` e loopback IPv6, e ausencia de valores secretos nas mensagens.

- [x] **Step 2: Executar o teste e confirmar RED**

Run: `npm test -- scripts/e2e-test-users.test.ts`

Expected: FAIL porque `scripts/e2e-test-users.mjs` ainda nao existe.

- [x] **Step 3: Implementar o contrato e adaptar seed/verificador**

Implementar as funcoes puras, reutiliza-las no seed e no verificador e manter a verificacao de ambiente antes de criar clientes. O seed deve usar `auth.admin.listUsers`, `createUser`/`updateUserById` e atualizar `profiles` para garantir um admin e dois operadores mesmo em nova execucao.

- [x] **Step 4: Confirmar GREEN e idempotencia real**

Run: `npm test -- scripts/e2e-test-users.test.ts`

Expected: PASS.

Com Supabase local iniciado e resetado, run duas vezes: `npm run e2e:seed-local`.

Expected: as duas execucoes terminam com exit code 0; a segunda atualiza as mesmas identidades sem duplicar usuarios.

- [x] **Step 5: Commit**

```bash
git add package.json scripts/e2e-test-users.mjs scripts/e2e-test-users.test.ts scripts/seed-local-e2e-user.mjs scripts/verify-e2e-env.mjs
git commit -S -m "test(e2e): seed isolated multioperator users"
```

### Task 2: Autenticacao Parametrizada E Fluxo De Caixas Independentes

**Files:**

- Create: `tests/e2e/support/cash.ts`
- Create: `tests/e2e/multi-operator-cash.spec.ts`
- Modify: `tests/e2e/support/auth.ts`
- Modify: `tests/e2e/cash-open.spec.ts`
- Modify: `tests/e2e/cash-close.spec.ts`
- Modify: `tests/e2e/full-ui-login.spec.ts`
- Modify: `tests/e2e/product-create.spec.ts`
- Modify: `tests/e2e/sale-flow.spec.ts`

**Interfaces:**

- Consumes: `E2EUserName` e `resolveE2EUsers(environment)` da Task 1.
- Produces: `authenticatePage(page, userName = "admin")` e `createAuthenticatedSupabaseClient(userName = "admin")`.
- Produces: `createAuthenticatedPage(browser, userName)` com um `BrowserContext` novo por chamada.
- Produces: `closeOwnOpenCashSession(userName)` via `close_cash_session`, nunca por `update` direto.
- Produces: helpers de abertura/fechamento pela UI com identificacao explicita da sessao esperada.

- [x] **Step 1: Escrever o E2E multioperador que falha**

Em `multi-operator-cash.spec.ts`, cobrir: dois contextos do mesmo operador disputando abertura e deixando uma unica sessao; operadores A e B abrindo simultaneamente; operador sem acesso ao caixa alheio; fechamento do proprio caixa; fechamento administrativo auditado; caixa B continuando aberto depois do fechamento de A; e operador A reabrindo no mesmo dia.

- [x] **Step 2: Executar o cenario e confirmar RED**

Run: `npx playwright test tests/e2e/multi-operator-cash.spec.ts --project=chromium`

Expected: FAIL porque autenticacao parametrizada, contextos e helpers ainda nao existem.

- [x] **Step 3: Implementar helpers e remover limpeza administrativa ampla**

Generalizar `auth.ts`, criar `cash.ts` e migrar os specs tocados para os helpers compartilhados. Remover copias locais de autenticacao e `closeAllOpenCashSessions`; cada usuario fecha apenas a propria sessao, salvo o cenario explicito de contingencia do admin.

- [x] **Step 4: Confirmar GREEN e independencia de ordem**

Run: `npx playwright test tests/e2e/multi-operator-cash.spec.ts tests/e2e/cash-open.spec.ts tests/e2e/cash-close.spec.ts --project=chromium`

Expected: PASS sem skips autenticados.

Run novamente com ordem invertida dos arquivos.

Expected: PASS, sem depender de sessao deixada por teste anterior.

- [x] **Step 5: Commit**

```bash
git add tests/e2e/support tests/e2e/multi-operator-cash.spec.ts tests/e2e/cash-open.spec.ts tests/e2e/cash-close.spec.ts tests/e2e/full-ui-login.spec.ts tests/e2e/product-create.spec.ts tests/e2e/sale-flow.spec.ts
git commit -S -m "test(e2e): cover independent operator cash sessions"
```

### Task 3: Concorrencia De Vendas E Relatorios Multioperador

**Files:**

- Create: `tests/e2e/support/store.ts`
- Create: `tests/e2e/multi-operator-sales.spec.ts`
- Modify: `tests/e2e/reports.spec.ts`
- Modify: `tests/e2e/sale-flow.spec.ts`

**Interfaces:**

- Consumes: clientes e paginas autenticados por identidade das Tasks 1 e 2.
- Produces: `createTestProductWithStock(adminPage, quantity)` retornando `{ productId, productName }` com identificador unico.
- Produces: `finalizeSale(client, cashSessionId, productId, saleId)` para sincronizar chamadas `finalize_sale_v3` concorrentes.
- Preserves: UI de relatorio e CSV com os mesmos totais para consolidado, operador e sessao.

- [x] **Step 1: Escrever os testes concorrentes que falham**

Cobrir em `multi-operator-sales.spec.ts`: operadores A e B com caixas distintos disputando estoque unitario via `Promise.all`; exatamente uma venda persistida; exatamente uma rejeicao por estoque insuficiente; saldo final zero; venda/fechamento concorrentes serializados; vendas normais vinculadas aos caixas corretos.

Em `reports.spec.ts`, preparar vendas reais dos dois operadores, conferir consolidado diario, filtro individual por operador, filtro por caixa e equivalencia do CSV. Eliminar insercao/exclusao financeira direta por secret key.

- [x] **Step 2: Executar e confirmar RED**

Run: `npx playwright test tests/e2e/multi-operator-sales.spec.ts tests/e2e/reports.spec.ts --project=chromium`

Expected: FAIL porque os helpers e a preparacao por fluxo real ainda nao existem.

- [x] **Step 3: Implementar o minimo para GREEN**

Criar produto e saldo pela UI administrativa; abrir/fechar caixas por UI ou RPC autenticada; usar `finalize_sale_v3` para a barreira concorrente; consultar saldo, vendas e `closed_by` apenas para afirmar o resultado. Dados recebem UUID e a limpeza financeira usa RPCs, sem apagar historico para tornar as assercoes verdes.

- [x] **Step 4: Confirmar GREEN e regressao do fluxo atual**

Run: `npx playwright test tests/e2e/multi-operator-sales.spec.ts tests/e2e/reports.spec.ts tests/e2e/sale-flow.spec.ts --project=chromium`

Expected: PASS sem skips autenticados.

- [x] **Step 5: Commit**

```bash
git add tests/e2e/support/store.ts tests/e2e/multi-operator-sales.spec.ts tests/e2e/reports.spec.ts tests/e2e/sale-flow.spec.ts
git commit -S -m "test(e2e): prove concurrent sales and reports"
```

### Task 4: Gate E2E Local No GitHub Actions E Artefatos De Falha

**Files:**

- Create: `scripts/local-e2e-environment.mjs`
- Create: `scripts/local-e2e-environment.test.ts`
- Create: `scripts/run-local-e2e-gate.mjs`
- Modify: `package.json`
- Modify: `playwright.config.ts`
- Modify: `.github/workflows/e2e-release.yml`
- Modify: `.github/workflows/quality.yml`

**Interfaces:**

- Produces: `parseSupabaseEnvironment(output)` e `buildLocalE2EEnvironment(environment, supabaseStatus)` sem logar valores.
- Produces: `npm run test:e2e:local-reset`, que recusa argumentos remotos, confirma hostname local, executa `supabase db reset --local`, seed e `test:e2e:required` no mesmo ambiente filho.
- Produces: upload de `playwright-report/` e `test-results/` somente quando o Playwright falha.

- [x] **Step 1: Escrever os testes do orquestrador que falham**

Cobrir parsing de `supabase status -o env`, mapeamento `API_URL`/`PUBLISHABLE_KEY`/`SECRET_KEY`, geracao das tres credenciais efemeras, recusa de URL remota, ausencia de valores nos logs e propagacao do primeiro exit code diferente de zero.

- [x] **Step 2: Executar e confirmar RED**

Run: `npm test -- scripts/local-e2e-environment.test.ts`

Expected: FAIL porque o modulo ainda nao existe.

- [x] **Step 3: Implementar orquestrador, reporter e workflow**

Adicionar reporter HTML somente no CI, manter `trace: "retain-on-failure"`, iniciar Supabase local no workflow, executar o novo gate em PRs para `develop` e `main`, publicar `playwright-report/` e `test-results/` com `if: failure()` e retencao curta, e parar o Supabase com `if: always()`. Remover secrets e project ref do staging legado do job automatico. Acrescentar `npm run test:no-event-legacy` ao job de qualidade para preservar o corte do PR06.

- [x] **Step 4: Confirmar GREEN local**

Run: `npm test -- scripts/local-e2e-environment.test.ts`

Expected: PASS.

Run: `npm run test:e2e:local-reset`

Expected: reset, seed e suite Playwright completos com exit code 0; nenhuma chave aparece na saida.

- [x] **Step 5: Commit**

```bash
git add package.json playwright.config.ts scripts/local-e2e-environment.mjs scripts/local-e2e-environment.test.ts scripts/run-local-e2e-gate.mjs .github/workflows/e2e-release.yml .github/workflows/quality.yml
git commit -S -m "ci(e2e): run multioperator gate on local Supabase"
```

### Task 5: Documentacao, Gates Completos E Preparacao Do PR

**Files:**

- Modify: `docs/e2e-release-gate.md`
- Modify: `docs/checklist-go-live.md`
- Modify: `docs/runbook-operacional.md`
- Modify: `docs/plano-reestruturacao-loja-fisica.md`
- Modify: `docs/plano-execucao-incremental.md`
- Modify: `docs/superpowers/plans/2026-10-06-e2e-multioperator-concurrency.md`

**Interfaces:**

- Consumes: comandos e comportamento entregues nas Tasks 1-4.
- Produces: instrucoes alinhadas ao runtime e ao gate local/CI do PR07.
- Preserves: provisionamento remoto como escopo exclusivo do PR08.

- [x] **Step 1: Atualizar a documentacao operacional**

Documentar tres identidades, reset exclusivamente local, execucao `test:e2e:local-reset`, cobertura automatizada multioperador, artefatos de falha e ausencia de secrets no workflow. Corrigir o status documental dos PR05 e PR06 sem declarar PR08/PR09 concluidos.

- [x] **Step 2: Executar verificacoes direcionadas de consistencia**

Run: `rg -n "cria somente o admin|nao cria automaticamente dois operadores|verificacoes manuais ate|staging legado" docs scripts tests .github/workflows`

Expected: nenhuma afirmacao obsoleta sobre o gate atual; referencias historicas devem estar identificadas como tal.

- [x] **Step 3: Executar todos os gates obrigatorios**

Run separadamente, exigindo exit code 0:

```bash
npm run format:check
npm run lint
npm run type-check
npm test
npm run test:no-event-legacy
npm run test:db
npm run build
npm run test:e2e:local-reset
git diff --check
```

Expected: todos aprovados; testes E2E autenticados executados sem skips.

- [x] **Step 4: Revisar segredo e diff final**

Inspecionar `git status --short`, o diff completo e nomes de variaveis sensiveis sem imprimir valores de `.env*`. Confirmar que nenhum valor de senha, token, cookie ou chave entrou no Git.

- [x] **Step 5: Commit documental**

```bash
git add docs/e2e-release-gate.md docs/checklist-go-live.md docs/runbook-operacional.md docs/plano-reestruturacao-loja-fisica.md docs/plano-execucao-incremental.md docs/superpowers/plans/2026-10-06-e2e-multioperator-concurrency.md
git commit -S -m "docs: document multioperator E2E gate"
```

- [ ] **Step 6: Revisao independente, push e PR**

Etapa exclusiva do controlador: executar revisao independente final do branch. Depois fazer push de `feature/e2e-multioperator`, abrir PR para `develop`, aguardar `Quality`, `Database contract`, `E2E Release Gate` e preview aplicavel. Nao fazer merge enquanto houver check obrigatorio pendente ou falhando.
