# PR06 - Remocao Completa Do Legado De Eventos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remover integralmente o legado de eventos da aplicacao e do schema,
mantendo caixa, vendas, estoque, cancelamento e relatorios seguros e funcionais
por operador.

**Architecture:** O corte sera atomico no PR: uma migration evolutiva elimina os
objetos legados e recria `finalize_sale_v3` sem `event_id`; a aplicacao exclui o
modulo e deixa as URLs antigas cairem no 404 nativo; os gates validam tanto o
upgrade do schema PR05 com dados existentes quanto um banco criado do zero.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, pgTAP,
Vitest, Testing Library, Playwright, ESLint e Prettier.

**Spec:** `docs/superpowers/specs/2026-10-05-remove-events-legacy-design.md`

## Global Constraints

- Trabalhar somente na branch `feature/remove-events-legacy`, nunca em `main`
  ou `develop`.
- Nao reescrever migrations aplicadas; criar uma nova migration de evolucao.
- Nao acessar, resetar ou alterar nenhum Supabase remoto neste PR.
- `drop table public.events` deve ser executado sem `cascade`.
- O servidor continua derivando a identidade de `auth.uid()`; o frontend nao
  informa o operador de operacoes financeiras.
- Cada operador continua limitado a um caixa aberto, enquanto operadores
  diferentes podem manter caixas simultaneos.
- Preservar RLS, grants restritivos, `security definer`, `search_path`
  controlado, idempotencia e locks das RPCs V3.
- `/events` e `/events/new` devem responder com 404 para autenticados; usuarios
  anonimos continuam passando primeiro pelo login.
- Migrations historicas, ADR 0001, plano historico do PR05 e o plano de
  preparacao de ambiente permanecem como registro da transicao.
- Commits devem ser assinados e seguir Conventional Commits.

## Review Focus

1. **Upgrade com dados legados:** caixas e vendas PR05 que possuem `event_id`
   devem sobreviver ao corte; o teste de upgrade da Task 1 cria esses registros
   antes da migration e verifica seus IDs e vinculos financeiros depois dela.
2. **Seguranca da RPC recriada:** remover a coluna nao pode afrouxar grants,
   autenticacao, idempotencia ou locks; pgTAP e a integracao financeira da Task
   1 fixam assinatura, definicao, privilegios e comportamento concorrente.
3. **Escrita financeira direta:** a retirada dos triggers legados nao pode
   liberar inserts do cliente; a integracao da Task 1 e o E2E da Task 3 exigem
   erro de permissao/RLS para `sales`, `sale_items` e `payments`.
4. **URLs antigas sob autenticacao:** autenticados devem receber 404 real e
   anonimos devem preservar `next` no login; o teste dedicado da Task 2 cobre
   os dois estados para as duas URLs.
5. **Uso legitimo da palavra `event`:** APIs do navegador como `onChange`,
   `dispatchEvent` e o service worker devem continuar intactos; o verificador
   da Task 5 busca apenas assinaturas do dominio legado e a suite completa
   garante que as interacoes do navegador continuam funcionando.

---

### Task 1: Remover O Schema De Eventos E Validar Upgrade/Reset

**Files:**

- Create: `supabase/migrations/20261005143000_remove_events_legacy.sql`
- Create: `supabase/tests/database/002_remove_events_legacy.test.sql`
- Create: `scripts/test-remove-events-upgrade.mjs`
- Modify: `supabase/tests/database/000_cash_session_foundation.test.sql`
- Modify: `scripts/run-database-gate.mjs`
- Modify: `scripts/test-store-database.mjs`
- Modify: `scripts/test-sales-report-database.mjs`

**Interfaces:**

- Consumes: schema PR05 na migration `20261003120000_cut_store_cash_operator_flow.sql`.
- Produces: `public.finalize_sale_v3(uuid, uuid, jsonb, jsonb) returns uuid`
  sem dependencia de eventos; schema final sem `public.events`, sem as duas
  colunas `event_id` e sem RPCs/triggers/indices/FKs legados.
- Produces: `node scripts/test-remove-events-upgrade.mjs seed|verify`, usando
  `DATABASE_TEST_SUPABASE_URL` e `DATABASE_TEST_SUPABASE_SECRET_KEY` quando
  fornecidos pelo gate ou resolvendo-os por `supabase status -o env`; em ambos
  os casos, deve recusar hostname nao local e nunca imprimir a chave.

- [ ] **Step 1: Escrever o contrato pgTAP final antes da migration**

Em `002_remove_events_legacy.test.sql`, adicionar asserts nomeados para:

```sql
to_regclass('public.events') is null
extensions.hasnt_column('public', 'cash_sessions', 'event_id', ...)
extensions.hasnt_column('public', 'sales', 'event_id', ...)
to_regprocedure(<cada assinatura legada>) is null
not exists (<cada trigger, indice e FK legado>)
pg_get_functiondef('public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)'::regprocedure)
  not ilike '%event_id%'
```

Cobrir as seis funcoes, dois triggers, tres indices e duas FKs listados na
spec. No mesmo teste, reafirmar existencia, assinatura, `security definer`,
`search_path`, grant de `authenticated` e bloqueio de `anon` para a V3, alem
da permanencia de RLS e dos indices atuais por operador/data/sessao.

Em `000_cash_session_foundation.test.sql`, retirar apenas as assercoes de
transicao que exigem colunas, funcoes ou triggers legados, ajustar
`extensions.plan(...)` e preservar todo o contrato atual de seguranca e caixa.

- [ ] **Step 2: Confirmar que o contrato falha contra o schema PR05**

Run:

```powershell
npx.cmd supabase db reset --local --yes --version 20261003120000
npx.cmd supabase test db supabase/tests/database/002_remove_events_legacy.test.sql --local
```

Expected: `FAIL`, informando que `public.events`, `event_id` e os objetos
legados ainda existem.

- [ ] **Step 3: Criar o fixture executavel de upgrade**

Implementar `scripts/test-remove-events-upgrade.mjs` com dois modos:

```text
seed   -> cria usuario/perfil, evento, caixa fechado e venda concluida ligados
          por event_id; imprime os IDs sem imprimir chaves
verify -> confirma que caixa e venda continuam existentes e vinculados entre si,
          e que events/event_id/RPCs legadas nao estao expostos pelo PostgREST
```

Usar IDs deterministas reservados ao teste e falhar em qualquer resposta
inesperada. `seed` roda somente no schema PR05; `verify` roda somente depois da
migration PR06. Como o PostgREST recarrega o schema de forma assincrona,
`verify` deve repetir apenas as consultas de catalogo/API por no maximo 10
segundos antes de declarar falha.

- [ ] **Step 4: Executar o fixture no schema PR05**

Run: `node scripts/test-remove-events-upgrade.mjs seed`

Expected: `PASS`, com caixa e venda legados persistidos no Supabase local.

- [ ] **Step 5: Implementar a migration atomica**

Em `20261005143000_remove_events_legacy.sql`:

1. envolver todo o corte em `begin`/`commit` para impedir estado parcial;
2. copiar a definicao atual de `finalize_sale_v3(uuid,uuid,jsonb,jsonb)` e
   remover somente `event_id` da lista/valores do `insert into public.sales`;
3. reaplicar `revoke all`, bloqueio de `anon` e grant exclusivo para
   `authenticated`;
4. remover `cash_sessions_prepare_legacy_insert` e `sales_prepare_insert`;
5. remover `prepare_legacy_cash_session_insert()`, `prepare_sale_insert()`,
   `close_event(uuid)`, `open_cash_session_v2(integer,uuid)`,
   `finalize_sale_v2(uuid,jsonb,jsonb)` e
   `finalize_sale(uuid,uuid,uuid,timestamptz,jsonb,jsonb,integer)`;
6. remover explicitamente `cash_sessions_one_open_per_event_operator_idx`,
   `cash_sessions_event_idx` e `sales_event_completed_at_idx`;
7. remover explicitamente `cash_sessions_event_id_fkey` e
   `sales_event_id_fkey`;
8. remover `cash_sessions.event_id` e `sales.event_id`;
9. executar `drop table public.events` sem `cascade`;
10. finalizar com `notify pgrst, 'reload schema'`.

- [ ] **Step 6: Aplicar somente a migration PR06 e provar o upgrade**

Run:

```powershell
npx.cmd supabase migration up --local
npx.cmd supabase test db supabase/tests/database --local
node scripts/test-remove-events-upgrade.mjs verify
```

Expected: todos os pgTAP `PASS`; caixa e venda preexistentes permanecem; tabela,
colunas e contratos legados ficam ausentes.

- [ ] **Step 7: Atualizar as integracoes para o schema final**

Remover `event_id` de inserts, selects e asserts em
`test-store-database.mjs` e `test-sales-report-database.mjs`. Excluir a chamada
da RPC `finalize_sale` antiga e manter as provas de:

- abertura unica por operador e simultanea entre operadores;
- venda V3 autenticada e idempotente;
- disputa do ultimo item sem estoque negativo;
- corrida entre venda e fechamento do mesmo caixa;
- bloqueio de inserts financeiros diretos;
- cancelamento, conciliacao, relatorios e CSV.

- [ ] **Step 8: Fazer o gate executar os dois caminhos de banco**

Alterar `run-database-gate.mjs` para executar, sempre contra hostname local:

```text
reset --version 20261003120000
upgrade fixture seed
migration up --local
pgTAP + upgrade fixture verify + integracoes
reset completo --local
pgTAP + integracoes novamente
```

Nao aceitar `--linked` nem URL remota; manter a verificacao de hostname antes
de qualquer reset.

- [ ] **Step 9: Rodar o gate completo do banco**

Run: `npm run test:db`

Expected: os caminhos `upgrade` e `fresh reset` terminam com
`Database gate completed successfully.`

- [ ] **Step 10: Commit**

```powershell
git add supabase/migrations/20261005143000_remove_events_legacy.sql supabase/tests/database/000_cash_session_foundation.test.sql supabase/tests/database/002_remove_events_legacy.test.sql scripts/run-database-gate.mjs scripts/test-remove-events-upgrade.mjs scripts/test-store-database.mjs scripts/test-sales-report-database.mjs
git commit -S -m "feat(db): remove legacy event schema"
```

### Task 2: Excluir O Modulo De Eventos E Entregar 404 Controlado

**Files:**

- Create: `src/app/not-found.tsx`
- Create: `src/app/not-found.test.tsx`
- Create: `tests/e2e/legacy-event-routes.spec.ts`
- Delete: `src/app/events/` (duas rotas e seus testes)
- Delete: `src/modules/events/` (domain, application, infra e presentation)
- Modify: `src/shared/components/app-header.tsx`
- Modify: `src/shared/components/app-header.test.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/cash/open/page.test.tsx`
- Modify: `src/modules/auth/application/auth-route-protection.test.ts`
- Modify: `src/modules/sales/testing/sales-read-client.ts`
- Modify: `src/modules/sales/infra/supabase-sale-detail-repository.test.ts`
- Modify: `src/modules/sales/infra/supabase-sale-summary-repository.test.ts`

**Interfaces:**

- Consumes: protecao privada existente em `src/proxy.ts` e componentes visuais
  compartilhados.
- Produces: componente React default `NotFound`, com heading
  `Página não encontrada` e link `Voltar ao painel` para `/`.
- Produces: navegacao sem `/events` e nenhum import ativo de
  `@/modules/events`.
- Produces: contrato E2E das duas URLs antigas antes que suas rotas sejam
  excluidas.

- [ ] **Step 1: Escrever os testes que falham para navegacao e 404**

Em `app-header.test.tsx`, adicionar:

```tsx
expect(screen.queryByRole("link", { name: "Eventos" })).not.toBeInTheDocument();
```

Em `not-found.test.tsx`, renderizar o export default e verificar:

```tsx
screen.getByRole("heading", { level: 1, name: "Página não encontrada" });
screen.getByRole("link", { name: "Voltar ao painel" }); // href="/"
```

Em `legacy-event-routes.spec.ts`, para cada rota em
`['/events', '/events/new']`, escrever os cenarios:

```text
anonimo      -> URL /login?next=<rota codificada> e heading Acessar Sistema
autenticado  -> response.status() === 404, heading Página não encontrada e
                link Voltar ao painel
```

- [ ] **Step 2: Confirmar RED**

Run:

```powershell
npm test -- src/shared/components/app-header.test.tsx src/app/not-found.test.tsx
npx.cmd playwright test tests/e2e/legacy-event-routes.spec.ts
```

Expected: `FAIL`; o menu ainda possui Eventos, `not-found.tsx` ainda nao existe
e as rotas antigas ainda respondem com suas telas.

- [ ] **Step 3: Implementar a apresentacao minima**

Remover o item de eventos de `navigationItems`. Criar `not-found.tsx` com
`<main>`, identidade visual Roberto Multimarcas, a explicacao
`O endereço informado não existe ou não está mais disponível.` e link ao
painel. Nao criar redirects nas rotas antigas.

- [ ] **Step 4: Excluir o codigo de dominio e as rotas**

Remover integralmente `src/app/events` e `src/modules/events`. Nao mover tipos,
repositorios ou componentes para outra camada: nenhum fluxo restante os
consome.

- [ ] **Step 5: Limpar fixtures de compatibilidade no codigo ativo**

Remover `event_id` de `saleRow` e simplificar os dois testes de repositorio
para vendas do schema final. Trocar nomes/asserts textuais `event-free` por
descricao de caixa por operador. No teste de protecao de rotas, usar um query
parametro neutro, como `cashSessionId`, preservando a prova de codificacao de
`next`.

- [ ] **Step 6: Confirmar GREEN e ausencia de imports residuais**

Run:

```powershell
npm test -- src/shared/components/app-header.test.tsx src/app/not-found.test.tsx src/app/page.test.tsx src/app/cash/open/page.test.tsx src/modules/auth/application/auth-route-protection.test.ts src/modules/sales/infra/supabase-sale-detail-repository.test.ts src/modules/sales/infra/supabase-sale-summary-repository.test.ts
npx.cmd playwright test tests/e2e/legacy-event-routes.spec.ts
rg -n "@/modules/events|event_id|/events" src --glob "!*.test.*"
```

Expected: testes `PASS`; `rg` sem resultados. Identificadores de eventos do
navegador, como o parametro de `onChange`, nao devem ser renomeados.

- [ ] **Step 7: Rodar regressao unitaria, lint e tipos**

Run:

```powershell
npm test
npm run lint
npm run type-check
```

Expected: todas as suites `PASS` e nenhum erro de lint/TypeScript.

- [ ] **Step 8: Commit**

```powershell
git add src/app src/modules/events src/modules/auth/application/auth-route-protection.test.ts src/modules/sales src/shared/components/app-header.tsx src/shared/components/app-header.test.tsx tests/e2e/legacy-event-routes.spec.ts
git commit -S -m "refactor: remove event application module"
```

### Task 3: Atualizar O Gate E2E Sem Fixture De Evento

**Files:**

- Delete: `tests/e2e/event-create.spec.ts`
- Delete: `tests/e2e/global-setup.ts`
- Modify: `playwright.config.ts`
- Modify: `tests/e2e/accessibility.spec.ts`
- Modify: `tests/e2e/v1-route-smoke.spec.ts`
- Modify: `tests/e2e/read-only-visual-smoke.spec.ts`
- Modify: `tests/e2e/cash-open.spec.ts`
- Modify: `tests/e2e/financial-security.spec.ts`
- Modify: `tests/e2e/reports.spec.ts`

**Interfaces:**

- Consumes: `authenticatePage(page)` e `hasAuthenticatedE2EConfig()` de
  `tests/e2e/support/auth.ts`.
- Produces: gate E2E sem criar eventos nem executar setup global, preservando a
  cobertura das URLs antigas criada na Task 2.

- [ ] **Step 1: Reexecutar o contrato E2E das URLs removidas**

Run: `npx.cmd playwright test tests/e2e/legacy-event-routes.spec.ts`

Expected: `PASS` para anonimo e autenticado. O bloco autenticado usa o mesmo
`test.skip(!hasAuthenticatedE2EConfig(), ...)` das suites privadas.

- [ ] **Step 2: Retirar eventos das suites positivas**

Remover `/events` e `/events/new` das listas de smoke, visual e acessibilidade;
excluir `event-create.spec.ts`; remover asserts/copy de evento em
`cash-open.spec.ts` sem reduzir a cobertura de abertura e uso automatico do
caixa.

- [ ] **Step 3: Remover setup global e payloads de banco legados**

Excluir `global-setup.ts` e a propriedade `globalSetup` de
`playwright.config.ts`. Retirar `event_id` dos inserts de relatorio e da
tentativa direta de venda em `financial-security.spec.ts`; a tentativa deve
continuar falhando por permissao/RLS, e nao por coluna inexistente no payload.

- [ ] **Step 4: Rodar as suites E2E direcionadas**

Run:

```powershell
npx.cmd playwright test tests/e2e/legacy-event-routes.spec.ts tests/e2e/v1-route-smoke.spec.ts tests/e2e/financial-security.spec.ts tests/e2e/reports.spec.ts
npx.cmd playwright test --config playwright.readonly.config.ts
```

Expected: `PASS`, sem skip quando as variaveis E2E obrigatorias estiverem
presentes; nenhuma suite cria ou consulta eventos.

- [ ] **Step 5: Rodar o gate E2E obrigatorio**

Run: `npm run test:e2e:required`

Expected: `PASS` para todos os fluxos configurados, sem `globalSetup`.

- [ ] **Step 6: Commit**

```powershell
git add playwright.config.ts tests/e2e
git commit -S -m "test(e2e): cover removed event routes"
```

### Task 4: Alinhar PWA E Documentacao Ao Runtime Da Loja

**Files:**

- Modify: `public/manifest.webmanifest`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/manual-usuario-final.md`
- Modify: `docs/runbook-operacional.md`
- Modify: `docs/checklist-go-live.md`
- Modify: `docs/e2e-release-gate.md`
- Modify: `docs/observabilidade.md`
- Modify: `docs/plano-desenvolvimento-pdv.md`
- Modify: `docs/plano-execucao-incremental.md`
- Modify: `docs/plano-reestruturacao-loja-fisica.md`
- Preserve: `docs/plano-preparacao-ambiente.md`
- Preserve: `docs/adr/0001-loja-fisica-caixas-por-operador.md`
- Preserve: `docs/superpowers/plans/2026-10-03-store-cash-and-pdv-operator-flow.md`

**Interfaces:**

- Consumes: runtime final das Tasks 1-3.
- Produces: instrucoes operacionais exclusivamente da Roberto Multimarcas e
  planos vigentes com PR05 concluido e PR06 ainda aguardando o gate final.

- [ ] **Step 1: Atualizar metadados publicos do PWA**

Definir a descricao do manifesto como:

```json
"description": "Sistema privado de vendas e gestão da loja física Roberto Multimarcas."
```

Nao alterar os handlers `event` legitimos de `public/sw.js`.

- [ ] **Step 2: Reescrever manual e runbook pelo fluxo diario**

O manual deve orientar login, abertura do proprio caixa, venda, cancelamento,
fechamento, reabertura no mesmo dia, estoque, usuarios e relatorios. O runbook
deve usar `inicio do dia/turno`, `durante a operacao` e `encerramento do dia`,
incluindo caixas simultaneos e contingencia administrativa. Remover criacao,
selecao e fechamento de evento.

- [ ] **Step 3: Atualizar go-live, E2E e observabilidade**

No checklist e gate E2E, substituir fixtures/eventos por ambiente isolado,
sessao do operador e reset local. Em observabilidade, renomear a secao
ambigua `Eventos Criticos` para `Ocorrencias Criticas` e registrar somente IDs
de operador, caixa e venda, nunca credenciais.

- [ ] **Step 4: Atualizar documentos normativos e estado dos planos**

README e AGENTS passam a declarar o modulo removido. O plano de desenvolvimento
deixa de anunciar rotas legadas. Marcar todas as tarefas e aceites do PR05 como
concluidos nos planos vigentes. Manter PR06 pendente ate a Task 5 comprovar
todos os gates.

- [ ] **Step 5: Verificar a documentacao operacional**

Run:

```powershell
rg -n -i "evento|event_id|/events|Espaco Personalize|Espaço Personalize" README.md AGENTS.md docs/manual-usuario-final.md docs/runbook-operacional.md docs/checklist-go-live.md docs/e2e-release-gate.md docs/observabilidade.md public/manifest.webmanifest
npm run format:check
```

Expected: `rg` sem resultados; Prettier `PASS`. Referencias historicas nos tres
arquivos preservados e nos planos de transicao nao sao defeitos.

- [ ] **Step 6: Commit**

```powershell
git add README.md AGENTS.md public/manifest.webmanifest docs/manual-usuario-final.md docs/runbook-operacional.md docs/checklist-go-live.md docs/e2e-release-gate.md docs/observabilidade.md docs/plano-desenvolvimento-pdv.md docs/plano-execucao-incremental.md docs/plano-reestruturacao-loja-fisica.md
git commit -S -m "docs: align operations with physical store"
```

### Task 5: Automatizar O Gate De Residuos E Fechar O PR06

**Files:**

- Create: `scripts/verify-no-event-legacy.mjs`
- Modify: `package.json`
- Modify: `docs/plano-execucao-incremental.md`
- Modify: `docs/plano-reestruturacao-loja-fisica.md`
- Modify: `docs/superpowers/plans/2026-10-05-remove-events-legacy.md`

**Interfaces:**

- Consumes: schema, aplicacao, E2E e documentacao concluidos nas Tasks 1-4.
- Produces: `npm run test:no-event-legacy`, com exit code `0` somente quando nao
  houver dependencia operacional do dominio removido.

- [ ] **Step 1: Criar o verificador de residuos ativos**

O script deve falhar com caminho e padrao encontrados quando detectar:

- `src/app/events`, `src/modules/events`, `tests/e2e/event-create.spec.ts` ou
  `tests/e2e/global-setup.ts` existentes;
- `event_id`, `/events` ou cliente `.from("events")` no runtime, scripts de
  integracao ou testes E2E, exceto o fixture de upgrade da Task 1, o contrato
  pgTAP final e as duas URLs no teste dedicado de 404;
- linguagem operacional de evento ou marca Espaco Personalize nos documentos
  ativos listados na Task 4.

O script nao deve buscar o identificador generico `event`, evitando falsos
positivos em `onChange`, `dispatchEvent`, `pointer-events` e service workers.

- [ ] **Step 2: Expor e executar o gate**

Adicionar a `package.json`:

```json
"test:no-event-legacy": "node scripts/verify-no-event-legacy.mjs"
```

Run: `npm run test:no-event-legacy`

Expected: `PASS` com uma mensagem curta de que nao ha dependencias ativas.

- [ ] **Step 3: Executar todos os gates obrigatorios com evidencia nova**

Run, nesta ordem:

```powershell
npm run format:check
npm run lint
npm run type-check
npm test
npm run test:no-event-legacy
npm run test:db
npm run build
npm run test:e2e:required
```

Expected: todos com exit code `0`. Nao reutilizar resultados anteriores a
ultima alteracao funcional.

- [ ] **Step 4: Solicitar revisao independente do branch**

Usar `superpowers:requesting-code-review` para revisar o diff completo contra
`origin/develop`, com foco nos cinco itens de **Review Focus**. Corrigir achados
Critical/Important e repetir os gates afetados.

- [ ] **Step 5: Registrar conclusao somente depois dos gates**

Marcar Task 1-5 neste plano, a Entrega 6 no plano incremental e todas as tarefas
e aceites do PR06 no plano de reestruturacao como concluidos. Registrar a data,
os comandos executados e que nenhum ambiente remoto foi alterado.

- [ ] **Step 6: Verificar somente a mudanca documental final**

Run:

```powershell
npm run format:check
npm run test:no-event-legacy
git diff --check
```

Expected: todos `PASS` e nenhum erro de whitespace.

- [ ] **Step 7: Commit**

```powershell
git add package.json scripts/verify-no-event-legacy.mjs docs/plano-execucao-incremental.md docs/plano-reestruturacao-loja-fisica.md docs/superpowers/plans/2026-10-05-remove-events-legacy.md
git commit -S -m "chore: enforce complete event removal"
```

- [ ] **Step 8: Preparar o handoff do PR**

Confirmar branch limpa, commits assinados e diff restrito ao PR06. Somente
depois usar `superpowers:finishing-a-development-branch` para push, abertura do
PR contra `develop`, checks remotos e decisao de merge. Nao incluir PR07,
provisionamento Supabase/Vercel ou operacoes remotas neste handoff.
