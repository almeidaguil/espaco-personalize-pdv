# Store Cash And PDV Operator Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o PR05 com caixa diário por vendedor, PDV vinculado automaticamente ao caixa do usuário e operação sem dependência de evento.

**Architecture:** O navegador envia somente a intenção de venda; o servidor identifica o caixa aberto do usuário e passa a sessão exata para uma RPC transacional, que revalida autenticação, propriedade e estado sob lock. Leituras operacionais usam um read model de caixas abertos para exibir vendedor, abertura e sessão, enquanto o domínio de caixa permanece sem `eventId`. Uma migration aditiva fecha os caminhos legados graváveis, sem remover ainda tabelas/colunas de eventos reservadas ao PR06.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase/PostgreSQL, Vitest, Testing Library, Playwright.

**Spec:** `docs/plano-reestruturacao-loja-fisica.md` — PR 05, linhas 335-362.

## Global Constraints

- Preservar as colunas e tabelas de eventos até o PR06, mas nenhum fluxo operacional alterado neste PR pode depender delas.
- Cada operador pode possuir no máximo um caixa `open`; após fechar, pode abrir outro no mesmo dia.
- Operadores diferentes podem manter caixas abertos simultaneamente.
- O navegador não escolhe nem envia `cashSessionId`; a sessão é localizada no servidor.
- A RPC de venda recebe a sessão exata localizada pelo servidor e deve rejeitá-la se tiver sido fechada, sem transferir silenciosamente a venda para uma sessão reaberta.
- Operador só lê, vende e fecha no próprio caixa; administrador ativo pode listar e fechar caixas alheios, com `closed_by = auth.uid()`.
- Toda regra crítica permanece validada no servidor e no banco, com RLS e funções `security definer` de `search_path` controlado.
- As alterações parciais já presentes no working tree devem ser preservadas, auditadas e corrigidas; não devem ser tratadas como implementação aprovada sem teste.
- Commits devem ser assinados, seguir Conventional Commits e permanecer na branch `feature/store-cash-and-pdv-operator-flow`.

## Review Focus

- Fechar A e abrir B enquanto uma venda está em preparação deve rejeitar a venda de A, nunca registrá-la silenciosamente em B; coberto na Task 3.
- Falha de leitura após uma abertura persistida não pode induzir o usuário a abrir novamente um caixa já criado; coberto na Task 2 com retorno integral da RPC.
- Usuário banido, inclusive administrador, não pode abrir, vender ou fechar caixa; coberto na Task 1.
- Um operador com ID adulterado não pode ler ou fechar caixa alheio; coberto nas Tasks 4 e 5.
- Duas vendas disputando o último item não podem produzir estoque negativo; coberto na Task 6.

---

### Task 1: Migration de corte e contratos transacionais

**Files:**

- Create: `supabase/migrations/20261003120000_cut_store_cash_operator_flow.sql`
- Modify: `supabase/tests/database/000_cash_session_foundation.test.sql`
- Modify: `scripts/test-store-database.mjs`

**Interfaces:**

- Produces: `open_cash_session_v3(p_opening_amount_in_cents integer) returns public.cash_sessions`.
- Produces: `finalize_sale_v3(p_sale_id uuid, p_cash_session_id uuid, p_items jsonb, p_payment jsonb) returns uuid`.
- Preserves: `close_cash_session(uuid, integer, timestamptz, text) returns uuid`, agora exigindo usuário ativo e usando `current_user_is_admin()`.
- Revokes: `authenticated` não executa `open_cash_session_v2`, `finalize_sale_v2`, `finalize_sale` nem `INSERT` direto em `cash_sessions`.

- [ ] **Step 1: Atualizar os testes estruturais para o contrato definitivo**

Adicionar asserções de existência, `security definer`, `search_path`, argumentos e grants das RPCs V3; afirmar a revogação das RPCs/insert legados e manter `event_id` apenas como coluna nullable de transição.

- [ ] **Step 2: Atualizar o teste de integração para falhar no corte**

Em `scripts/test-store-database.mjs`, trocar os caminhos operacionais para V3 e afirmar: retorno completo da abertura, uma abertura concorrente por operador, reabertura no mesmo dia, sessão exata na venda, fechamento cruzado negado, fechamento administrativo auditado e usuários banidos rejeitados.

- [ ] **Step 3: Executar o gate de banco e confirmar a falha esperada**

Run: `npm run test:db`

Expected: FAIL porque a migration V3 e as revogações ainda não existem.

- [ ] **Step 4: Criar a migration aditiva**

Implementar as duas RPCs V3 sem `event_id`; `finalize_sale_v3` deve selecionar `p_cash_session_id` com `operator_id = auth.uid()` e `status = 'open' FOR UPDATE`. Reutilizar a validação/idempotência/locks de produto da V2, exigir `current_user_is_active()` em abertura, venda e fechamento, e manter o índice parcial `cash_sessions_one_open_per_operator_idx` como autoridade de unicidade.

- [ ] **Step 5: Fechar caminhos legados graváveis**

Revogar os privilégios listados nas Interfaces, remover a policy de insert legado de `cash_sessions` e garantir que serviço administrativo/migrations continuem operando. Não remover tabelas, FKs ou colunas de evento neste PR.

- [ ] **Step 6: Executar o gate de banco**

Run: `npm run test:db`

Expected: PASS nos testes pgTAP e de integração.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261003120000_cut_store_cash_operator_flow.sql supabase/tests/database/000_cash_session_foundation.test.sql scripts/test-store-database.mjs
git commit -S -m "feat(db): cut cash operations to operator sessions"
```

### Task 2: Domínio, abertura e repositório de caixa sem evento

**Files:**

- Modify: `src/modules/cash/domain/cash-session.ts`
- Modify: `src/modules/cash/domain/cash-session.test.ts`
- Modify: `src/modules/cash/application/cash-session-repository.ts`
- Modify: `src/modules/cash/application/cash-session-validation.ts`
- Modify: `src/modules/cash/application/open-cash-session-use-case.ts`
- Modify: `src/modules/cash/application/open-cash-session-use-case.test.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-repository.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-repository.test.ts`
- Modify: `src/modules/cash/presentation/open-cash-session-form-data.ts`
- Modify: `src/modules/cash/presentation/open-cash-session-form-data.test.ts`
- Modify: `src/modules/cash/presentation/open-cash-session-form.tsx`
- Modify: `src/modules/cash/presentation/open-cash-session-form.test.tsx`
- Modify: `src/modules/cash/presentation/open-cash-session-action-service.test.ts`
- Modify: `src/app/cash/open/page.tsx`
- Modify: `src/app/cash/open/page.test.tsx`

**Interfaces:**

- Produces: `CashSession` sem `eventId`.
- Produces: `CashSessionRepository.open(input: { openingAmountInReais: number }): Promise<SaveCashSessionResult>`.
- Produces: `CashSessionRepository.findOpenByOperator(operatorId: string): Promise<FindOpenCashSessionResult>`.
- Removes: `save(session)`, `findOpenByEventAndOperator`, gerador de ID/data da abertura e opções de evento do formulário.

- [ ] **Step 1: Ajustar primeiro os testes de domínio, use case, formulário e repositório**

Cobrir valor inicial válido/inválido, autenticação, caixa já aberto, conflito atômico `23505`, payload V3 somente com centavos e mapeamento da linha completa devolvida pela RPC. Remover fixtures/assertivas de evento.

- [ ] **Step 2: Executar os testes direcionados e confirmar a falha**

Run: `npm test -- src/modules/cash/domain/cash-session.test.ts src/modules/cash/application/open-cash-session-use-case.test.ts src/modules/cash/infra/supabase-cash-session-repository.test.ts src/modules/cash/presentation/open-cash-session-form-data.test.ts src/modules/cash/presentation/open-cash-session-form.test.tsx src/app/cash/open/page.test.tsx`

Expected: FAIL nos contratos antigos e na RPC V2.

- [ ] **Step 3: Implementar o contrato mínimo de abertura**

Validar a entrada com Zod, identificar o usuário, consultar `findOpenByOperator` apenas para feedback rápido e chamar `repository.open`. O repositório deve consumir diretamente a linha retornada por `open_cash_session_v3`, eliminando a segunda leitura pós-abertura.

- [ ] **Step 4: Remover evento da apresentação de abertura**

Deixar a página e o formulário com somente `openingAmountInReais`, feedback de caixa já aberto e links para PDV/fechamento.

- [ ] **Step 5: Executar os testes direcionados**

Run: `npm test -- src/modules/cash/domain/cash-session.test.ts src/modules/cash/application/open-cash-session-use-case.test.ts src/modules/cash/infra/supabase-cash-session-repository.test.ts src/modules/cash/presentation/open-cash-session-form-data.test.ts src/modules/cash/presentation/open-cash-session-form.test.tsx src/app/cash/open/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/cash src/app/cash/open
git commit -S -m "feat(cash): open operator cash without events"
```

### Task 3: PDV vinculado automaticamente ao caixa atual

**Files:**

- Modify: `src/modules/sales/application/sale-validation.ts`
- Modify: `src/modules/sales/application/create-sale-use-case.ts`
- Modify: `src/modules/sales/application/create-sale-use-case.test.ts`
- Modify: `src/modules/sales/domain/sale.ts`
- Modify: `src/modules/sales/domain/sale.test.ts`
- Modify: `src/modules/sales/infra/supabase-sale-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-repository.test.ts`
- Modify: `src/modules/sales/presentation/sale-form-data.ts`
- Modify: `src/modules/sales/presentation/sale-form-data.test.ts`
- Modify: `src/modules/sales/presentation/create-sale-action-service.test.ts`
- Modify: `src/modules/sales/presentation/pdv-cart.tsx`
- Modify: `src/modules/sales/presentation/pdv-cart.test.tsx`
- Modify: `src/modules/cash/presentation/pdv-cash-status.tsx`
- Modify: `src/modules/cash/presentation/pdv-cash-status.test.tsx`
- Modify: `src/app/pdv/page.tsx`
- Modify: `src/app/pdv/page.test.tsx`

**Interfaces:**

- Browser input: `{ items, payment }`, sem `cashSessionId` e sem seletor.
- Server/domain: `createSale` ainda recebe o `cashSessionId` confiável obtido no servidor para compor `Sale`.
- Persistence: `finalize_sale_v3` recebe `p_cash_session_id` vindo do use case, nunca do formulário.

- [ ] **Step 1: Escrever/ajustar testes do fluxo automático**

Cobrir: parser ignora campo adulterado `cashSessionId`; use case busca `findOpenByOperator(profile.id)`; sem caixa retorna erro antes de carregar produtos; venda usa a sessão encontrada; repositório envia exatamente a sessão para V3; PDV sem caixa não renderiza carrinho; PDV com caixa não renderiza `<select>` nem input de sessão.

- [ ] **Step 2: Adicionar o teste da corrida fechar/reabrir**

No repositório/use case, simular sessão A localizada e erro da RPC porque A foi fechada; afirmar erro de registro e ausência de nova tentativa na sessão B.

- [ ] **Step 3: Executar os testes direcionados e confirmar a falha**

Run: `npm test -- src/modules/sales/application/create-sale-use-case.test.ts src/modules/sales/infra/supabase-sale-repository.test.ts src/modules/sales/presentation/sale-form-data.test.ts src/modules/sales/presentation/pdv-cart.test.tsx src/modules/cash/presentation/pdv-cash-status.test.tsx src/app/pdv/page.test.tsx`

Expected: FAIL porque formulário/use case ainda aceitam escolha manual e a persistência ainda usa V2.

- [ ] **Step 4: Implementar a sessão automática no servidor**

Remover `cashSessionId` do schema e parser de entrada; localizar a sessão no use case após autenticação; criar a venda com o ID confiável; persistir via V3. Mapear fechamento concorrente para mensagem operacional pedindo reabertura/repetição, sem retry automático.

- [ ] **Step 5: Bloquear a UI sem caixa e remover seletores**

Na página, renderizar estado bloqueado com ação “Abrir caixa” quando não houver sessão; montar produtos e `PdvCart` somente quando houver exatamente a sessão atual. Exibir abertura, valor inicial e identificação curta da sessão.

- [ ] **Step 6: Executar os testes direcionados**

Run: `npm test -- src/modules/sales/application/create-sale-use-case.test.ts src/modules/sales/infra/supabase-sale-repository.test.ts src/modules/sales/presentation/sale-form-data.test.ts src/modules/sales/presentation/create-sale-action-service.test.ts src/modules/sales/presentation/pdv-cart.test.tsx src/modules/cash/presentation/pdv-cash-status.test.tsx src/app/pdv/page.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/sales src/modules/cash/presentation/pdv-cash-status.tsx src/modules/cash/presentation/pdv-cash-status.test.tsx src/app/pdv
git commit -S -m "feat(pdv): bind sales to the current operator cash"
```

### Task 4: Read model e dashboard Meu caixa/Caixas abertos

**Files:**

- Create: `src/modules/cash/application/open-cash-session-overview-repository.ts`
- Create: `src/modules/cash/application/list-open-cash-session-overviews-use-case.ts`
- Create: `src/modules/cash/application/list-open-cash-session-overviews-use-case.test.ts`
- Create: `src/modules/cash/infra/supabase-open-cash-session-overview-repository.ts`
- Create: `src/modules/cash/infra/supabase-open-cash-session-overview-repository.test.ts`
- Create: `src/modules/cash/presentation/open-cash-sessions-panel.tsx`
- Create: `src/modules/cash/presentation/open-cash-sessions-panel.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`

**Interfaces:**

- Produces: `OpenCashSessionOverview { id, operatorId, operatorName, openedAt, openingAmountInReais }`.
- Produces: `listOpenCashSessionOverviewsUseCase` retorna a própria sessão para operador e todas as sessões visíveis para admin, respeitando RLS.
- Consumes: `CurrentUserProfileRepository.getCurrent()` e join somente leitura `cash_sessions -> profiles`.

- [ ] **Step 1: Escrever testes do read model e dashboard**

Cobrir mapeamento de nome completo/email/fallback de operador; operador com e sem “Meu caixa”; admin com “Meu caixa” e painel “Caixas abertos”; linhas com vendedor, horário e ID curto; ausência de consultas, títulos e links de evento na operação diária.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test -- src/modules/cash/application/list-open-cash-session-overviews-use-case.test.ts src/modules/cash/infra/supabase-open-cash-session-overview-repository.test.ts src/modules/cash/presentation/open-cash-sessions-panel.test.tsx src/app/page.test.tsx`

Expected: FAIL porque o read model/painel não existem e a home ainda depende de eventos.

- [ ] **Step 3: Implementar o read model autorizado**

Consultar somente sessões `open`, ordenadas por `opened_at desc`; o use case deve filtrar explicitamente pelo operador para perfil comum e permitir a coleção visível apenas para admin. RLS continua sendo a barreira definitiva.

- [ ] **Step 4: Reestruturar a home**

Substituir “Operação do dia/Evento ativo” por “Meu caixa”, com ações de abrir, vender ou fechar conforme estado. Para admin, renderizar “Caixas abertos” sem misturar os totais financeiros de vendedores.

- [ ] **Step 5: Executar os testes direcionados**

Run: `npm test -- src/modules/cash/application/list-open-cash-session-overviews-use-case.test.ts src/modules/cash/infra/supabase-open-cash-session-overview-repository.test.ts src/modules/cash/presentation/open-cash-sessions-panel.test.tsx src/app/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/cash/application src/modules/cash/infra src/modules/cash/presentation src/app/page.tsx src/app/page.test.tsx
git commit -S -m "feat(dashboard): show operator and admin cash sessions"
```

### Task 5: Fechamento próprio e administrativo auditado

**Files:**

- Modify: `src/modules/cash/application/cash-session-repository.ts`
- Modify: `src/modules/cash/application/close-cash-session-use-case.ts`
- Modify: `src/modules/cash/application/close-cash-session-use-case.test.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-repository.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-repository.test.ts`
- Modify: `src/modules/cash/presentation/close-cash-session-action-service.test.ts`
- Modify: `src/modules/cash/presentation/close-cash-session-form.tsx`
- Modify: `src/modules/cash/presentation/close-cash-session-form.test.tsx`
- Modify: `src/app/cash/close/page.tsx`
- Modify: `src/app/cash/close/page.test.tsx`

**Interfaces:**

- Produces: `CashSessionRepository.findOpenById(cashSessionId: string)` sujeito a RLS.
- Consumes: `OpenCashSessionOverview` da Task 4 para rótulo `vendedor · abertura · sessão`.
- Preserves: `close_cash_session` como autoridade final de propriedade/admin e auditoria `closed_by`.

- [ ] **Step 1: Escrever testes de autorização e apresentação**

Cobrir operador fechando o próprio caixa, operador recebendo erro de autorização para caixa alheio, admin fechando caixa alheio, caixa já fechado, rótulos sem evento e manutenção da senha administrativa para falta de numerário.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test -- src/modules/cash/application/close-cash-session-use-case.test.ts src/modules/cash/infra/supabase-cash-session-repository.test.ts src/modules/cash/presentation/close-cash-session-action-service.test.ts src/modules/cash/presentation/close-cash-session-form.test.tsx src/app/cash/close/page.test.tsx`

Expected: FAIL porque o use case filtra sempre pelo operador e a página ainda carrega eventos.

- [ ] **Step 3: Implementar autorização explícita no use case**

Buscar a sessão pelo ID visível, permitir se `operatorId === profile.id` ou `profile.role === 'admin'`, rejeitar os demais antes de persistir e deixar a RPC repetir a autorização sob lock. Não aceitar identidade de operador pelo formulário.

- [ ] **Step 4: Remover evento da página de fechamento**

Usar o read model para listar os caixas permitidos e montar o rótulo por vendedor, abertura e sessão. Manter resumo financeiro e formulário separados por sessão.

- [ ] **Step 5: Executar os testes direcionados**

Run: `npm test -- src/modules/cash/application/close-cash-session-use-case.test.ts src/modules/cash/infra/supabase-cash-session-repository.test.ts src/modules/cash/presentation/close-cash-session-action-service.test.ts src/modules/cash/presentation/close-cash-session-form.test.tsx src/app/cash/close/page.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/cash src/app/cash/close
git commit -S -m "feat(cash): support audited administrative closing"
```

### Task 6: Concorrência, E2E do fluxo principal e regressão completa

**Files:**

- Modify: `scripts/test-store-database.mjs`
- Modify: `tests/e2e/cash-open.spec.ts`
- Modify: `tests/e2e/cash-close.spec.ts`
- Modify: `tests/e2e/sale-flow.spec.ts`
- Modify: outros testes/fixtures que ainda referenciem evento no fluxo de caixa/PDV, conforme `rg "eventId|Evento|evento"` nos arquivos tocados pelo PR05.

**Interfaces:**

- Consumes: RPCs V3, UI sem evento e caixa automático das Tasks 1-5.
- Produces: evidência automatizada dos sete critérios de aceite do PR05 sem antecipar o seed/browser multiusuário completo do PR07.

- [ ] **Step 1: Adicionar os testes de concorrência ainda ausentes**

No gate local de banco, executar duas vendas autenticadas disputando estoque unitário e afirmar um sucesso, uma falha e saldo final zero. Executar venda e fechamento concorrentes e afirmar serialização: ou a venda entra no esperado antes do fechamento, ou é rejeitada sem persistência.

- [ ] **Step 2: Atualizar E2E do usuário corrente**

Remover seleção/criação de evento dos cenários de caixa/PDV; cobrir abrir somente com valor, segunda abertura bloqueada, venda associada automaticamente, fechamento, reabertura no mesmo dia e PDV bloqueado sem caixa. Deixar multi-contexto de dois vendedores para o PR07.

- [ ] **Step 3: Executar os testes alterados e confirmar falhas antes dos últimos ajustes**

Run, separadamente: `npm test`, `npm run test:db` e `npm run test:e2e:required`.

Expected: qualquer falha deve apontar uma regressão real ou fixture legada ainda dependente de evento; corrigir uma por vez, mantendo as assertivas comportamentais.

- [ ] **Step 4: Varrer dependências operacionais remanescentes**

Run: `rg -n "eventId|event_id|Evento|evento" src/app/page.tsx src/app/pdv src/app/cash src/modules/cash src/modules/sales/presentation/pdv-cart.tsx src/modules/sales/presentation/sale-form-data.ts src/modules/sales/application/create-sale-use-case.ts src/modules/sales/infra/supabase-sale-repository.ts`

Expected: nenhuma dependência de evento nos fluxos alterados; referências de compatibilidade de schema/migration ficam documentadas e isoladas para o PR06.

- [ ] **Step 5: Executar todos os gates obrigatórios**

Run, separadamente, e exigir exit code 0:

```bash
npm run format:check
npm run lint
npm run type-check
npm run test
npm run test:db
npm run build
npm run test:e2e:required
```

- [ ] **Step 6: Verificar segredo e diff final**

Run: `git diff --check`, inspeção de `git status --short`, varredura por chaves reais e revisão independente do branch inteiro. Não imprimir valores de `.env*`.

- [ ] **Step 7: Commit de regressão**

```bash
git add scripts/test-store-database.mjs tests/e2e src
git commit -S -m "test: cover operator cash and pdv flow"
```

- [ ] **Step 8: Publicar o PR**

Fazer push da branch, abrir PR para `develop`, aguardar Quality/E2E/Vercel e só considerar merge após todos os checks obrigatórios verdes e revisão aprovada.
