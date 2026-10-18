# Split Payments, Installments And Cash Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir vendas com até dois métodos, crédito à vista ou em até 3x e fechamento com conferência independente de dinheiro, Pix, crédito e débito.

**Architecture:** O PR 1 adiciona schema, RPCs versionadas e leituras compatíveis sem mudar o runtime atual. Depois de integrado em `develop`, o PR 2 migra domínio, PDV, fechamento e relatórios para os contratos novos e revoga a execução do fechamento legado no corte controlado. Valores financeiros permanecem em centavos inteiros, e banco/servidor recalculam pagamentos, troco, valores esperados e divergências.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase/PostgreSQL, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-18-split-payments-installments-cash-reconciliation-design.md`

## Global Constraints

- Uma venda contém um ou dois métodos distintos; cada contribuição líquida é de pelo menos R$ 0,01.
- Somente dinheiro gera troco; `sum(amount_in_cents - change_in_cents) = sales.total_in_cents`.
- Crédito exige `installment_count` 1, 2 ou 3; outros métodos exigem `null`; não há juros, taxas ou recebíveis por parcela.
- Mais de um cartão físico do mesmo tipo é consolidado em um único método.
- Identidade, preços, desconto, estoque, troco, valores esperados, diferenças e horário de fechamento são validados ou definidos no servidor/banco.
- O fechamento exige quatro valores conferidos, inicialmente vazios na UI; qualquer diferença por método exige senha administrativa, inclusive para administradores.
- `cash_sessions.expected_amount_in_cents`, `counted_amount_in_cents` e `difference_amount_in_cents` continuam representando somente dinheiro físico; a nova auditoria por método vive em `cash_session_reconciliations`.
- `finalize_sale_v4` permanece compatível com pagamento único e trata crédito legado como 1x; `close_cash_session` só permanece executável até o corte do PR 2.
- Migrations existentes não serão reescritas; nenhuma credencial será versionada; nenhuma migration remota será aplicada sem confirmar ambiente e project ref.
- Cada tarefa usa TDD: teste falha pelo motivo esperado antes do código de produção, e os testes afetados passam antes do commit assinado.

## Review Focus

- Divisão em que o excedente do dinheiro reduz sua contribuição líquida a zero deve ser rejeitada, mesmo que a soma bruta cubra a venda (Tasks 2, 6 e 7).
- Retry com os mesmos pagamentos em ordem diferente deve ser idempotente; mudar valor, método ou parcela deve gerar conflito sem nova baixa (Tasks 2 e 6).
- Duas diferenças opostas, como dinheiro +R$ 10 e crédito −R$ 10, não podem se compensar para dispensar senha administrativa (Tasks 3, 9 e 10).
- Campos vazios, texto, negativos, mais de duas casas e valores acima de `Number.MAX_SAFE_INTEGER` devem falhar sem arredondamento ou fechamento parcial (Tasks 7, 9 e 10).
- Venda dividida cancelada antes ou depois do fechamento deve preservar pagamentos, reverter estoque uma vez e não duplicar total geral, contagens ou ajustes (Tasks 4, 8, 11 e 12).

---

## PR 1 — Fundação Aditiva No Banco

### Task 1: Schema de pagamentos e reconciliação

**Files:**

- Create: `supabase/migrations/20261018120000_add_split_payments_and_cash_reconciliation.sql`
- Create: `supabase/tests/database/005_split_payments_cash_reconciliation.test.sql`
- Create: `scripts/test-split-payments-upgrade.mjs`
- Modify: `scripts/run-database-gate.mjs`
- Modify: `supabase/tests/database/000_cash_session_foundation.test.sql`
- Modify: `supabase/tests/database/004_sale_discounts.test.sql`

**Interfaces:**

- Produces: `payments.installment_count smallint` e unicidade `(sale_id, method)`.
- Produces: constraints para valor bruto positivo, troco exclusivo de dinheiro, contribuição líquida positiva e parcela coerente com o método.
- Produces: `cash_session_reconciliations(cash_session_id, method, expected_amount_in_cents, counted_amount_in_cents, difference_amount_in_cents, created_at)` com chave `(cash_session_id, method)`.
- Preserves: linhas existentes; crédito histórico recebe `installment_count = 1` e demais métodos recebem `null`.

- [ ] **Step 1: Escrever pgTAP RED** para coluna, backfill, unicidade, checks nomeados, tabela, chave estrangeira, RLS, grants e escrita direta bloqueada.
- [ ] **Step 2: Escrever upgrade RED** que prova migração válida e aborto explícito para método duplicado, pagamento sem contribuição líquida ou histórico incompatível.
- [ ] **Step 3: Executar `npm run test:db`** e confirmar falha porque schema e migration ainda não existem.
- [ ] **Step 4: Implementar o preflight e o schema aditivo**, sem trigger que corrija entrada inválida silenciosamente.
- [ ] **Step 5: Implementar políticas de leitura** equivalentes às permissões de `cash_sessions`, mantendo insert/update/delete disponíveis somente às RPCs protegidas.
- [ ] **Step 6: Conectar o script de upgrade ao gate** e executar `npm run test:db`; esperado: fresh reset, upgrade e pgTAP verdes.
- [ ] **Step 7: Commit assinado** `feat(database): add payment and reconciliation schema`.

### Task 2: Finalização transacional com múltiplos pagamentos

**Files:**

- Modify: `supabase/migrations/20261018120000_add_split_payments_and_cash_reconciliation.sql`
- Modify: `supabase/tests/database/005_split_payments_cash_reconciliation.test.sql`
- Create: `scripts/test-split-payments-database.mjs`
- Modify: `scripts/run-database-gate.mjs`
- Modify: `scripts/test-sale-discount-database.mjs`

**Interfaces:**

- Produces: `finalize_sale_v5(p_sale_id uuid, p_cash_session_id uuid, p_items jsonb, p_payments jsonb, p_discount_in_cents integer) returns uuid`.
- Produces: helper privado `finalize_sale_payments_transaction(uuid,uuid,jsonb,jsonb,integer,text) returns uuid`.
- Preserves: `finalize_sale_transaction(...)`, `finalize_sale_v3(...)` e `finalize_sale_v4(...)`; o helper legado delega crédito único como `installment_count = 1` e valida o troco enviado pelo cliente antigo.
- Input v5: array de `{ method, amount_in_cents, installment_count? }`; cliente não escolhe `change_in_cents`.

- [ ] **Step 1: Escrever pgTAP RED** para assinatura, `SECURITY DEFINER`, `search_path`, grants de v5, helpers não executáveis e compatibilidade v3/v4.
- [ ] **Step 2: Escrever integração RED** para um método, dois métodos, dinheiro com troco, crédito 1x/2x/3x, desconto e persistência de todas as linhas.
- [ ] **Step 3: Acrescentar casos RED de rejeição** para zero/três pagamentos, repetição, valor líquido menor que um centavo, soma incorreta, troco sem dinheiro e parcela inválida.
- [ ] **Step 4: Acrescentar idempotência RED** para ordem invertida, retry idêntico e conflito alterando somente valor, método ou parcela.
- [ ] **Step 5: Executar o teste de integração** e confirmar falhas por v5/helper ausentes.
- [ ] **Step 6: Implementar normalização canônica por método**, cálculo de troco no servidor, locks estáveis de caixa/produtos e persistência atômica de venda, itens, pagamentos e estoque.
- [ ] **Step 7: Adaptar o caminho legado** sem mudar os fingerprints v3/v4 e provar que crédito legado é persistido como 1x.
- [ ] **Step 8: Executar `npm run test:db`**; esperado: compatibilidade, concorrência, rollback e novos cenários verdes.
- [ ] **Step 9: Commit assinado** `feat(database): finalize sales with split payments`.

### Task 3: Fechamento transacional por método

**Files:**

- Modify: `supabase/migrations/20261018120000_add_split_payments_and_cash_reconciliation.sql`
- Modify: `supabase/tests/database/005_split_payments_cash_reconciliation.test.sql`
- Modify: `scripts/test-split-payments-database.mjs`
- Modify: `scripts/test-store-database.mjs`

**Interfaces:**

- Produces: `close_cash_session_v2(p_cash_session_id uuid, p_reconciliations jsonb, p_admin_password text default null) returns uuid`.
- Input: exatamente uma entrada `{ method, counted_amount_in_cents }` para cada método conhecido.
- Persists: quatro linhas de reconciliação e campos legados da sessão espelhando somente dinheiro.
- Preserves: `close_cash_session(uuid,integer,timestamptz,text)` executável no PR 1 para o runtime atual.

- [ ] **Step 1: Escrever pgTAP RED** para assinatura, segurança, grants, chave/constraints e permanência temporária do contrato legado.
- [ ] **Step 2: Escrever integração RED** com abertura zero e venda de R$ 200,00 em crédito, esperando dinheiro zero e crédito 20.000 centavos.
- [ ] **Step 3: Acrescentar casos RED** para dinheiro com saldo inicial/troco, pagamento dividido, venda cancelada, array incompleto/duplicado e valor negativo.
- [ ] **Step 4: Acrescentar autorização RED** para falta, sobra e diferenças opostas; qualquer linha divergente deve exigir senha válida até para usuário admin.
- [ ] **Step 5: Acrescentar concorrência RED** provando que apenas uma transação fecha o caixa e que erro mantém sessão/reconciliações intactas.
- [ ] **Step 6: Executar os testes focados** e confirmar falha por RPC ausente.
- [ ] **Step 7: Implementar a RPC** com lock da sessão, relógio do servidor, cálculo por pagamentos concluídos e gravação integral na mesma transação.
- [ ] **Step 8: Executar `npm run test:db`**; esperado: contratos antigo e novo verdes, sem fechamento parcial.
- [ ] **Step 9: Commit assinado** `feat(database): reconcile cash sessions by payment method`.

### Task 4: Contrato SQL de relatórios compatível

**Files:**

- Modify: `supabase/migrations/20261018120000_add_split_payments_and_cash_reconciliation.sql`
- Modify: `supabase/tests/database/001_store_sales_report.test.sql`
- Modify: `supabase/tests/database/005_split_payments_cash_reconciliation.test.sql`
- Modify: `scripts/test-sales-report-database.mjs`

**Interfaces:**

- Extends: `get_store_sales_report_v2(...)` com `credit_installment_summary`, `reconciliation_shortage_total_in_cents`, `reconciliation_surplus_total_in_cents` e `reconciliation_difference_total_in_cents`.
- Extends: cada sessão retornada com `reconciliations`, contendo método, esperado, conferido e diferença.
- Preserves: assinatura, filtros, paginação, totais gerais, campos legados de dinheiro e clientes que ignoram os campos JSON novos.

- [ ] **Step 1: Escrever testes RED** provando que uma venda dividida conta uma vez no total geral e uma vez em cada método usado.
- [ ] **Step 2: Escrever testes RED** para crédito 1x/2x/3x, total líquido por parcela e contagem distinta por venda.
- [ ] **Step 3: Escrever testes RED** para reconciliações por sessão, totais globais e sessão legada sem linhas novas.
- [ ] **Step 4: Escrever regressão RED** para cancelamento antes/depois do fechamento, preservando pagamentos e ajuste pós-fechamento sem duplicidade.
- [ ] **Step 5: Executar o gate de relatório** e confirmar ausência dos novos campos.
- [ ] **Step 6: Evoluir a função SQL** usando contribuição líquida e `count(distinct sale_id)`, sem alterar a assinatura v2.
- [ ] **Step 7: Executar `npm run test:db`** e confirmar relatório, segurança e paginação verdes.
- [ ] **Step 8: Commit assinado** `feat(reports): expose split payments and reconciliations`.

### Task 5: Gate e PR da fundação

**Files:**

- Modify: `scripts/verify-remote-environment.mjs`
- Modify: `scripts/verify-remote-environment.test.ts`
- Modify: `scripts/verify-remote-staging.test.ts`
- Modify: `scripts/verify-remote-production.test.ts`
- Modify: `docs/plano-execucao-incremental.md`

**Interfaces:**

- Produces: inventário remoto exigindo tabela, coluna, `finalize_sale_v5` e `close_cash_session_v2`, enquanto confirma contratos legados ainda executáveis no PR 1.
- Produces: PR 1 revisável e funcional; o PR 2 só nasce da `develop` depois desse merge.

- [ ] **Step 1: Escrever testes RED dos verificadores** para objetos novos ausentes, assinaturas erradas e grants incompatíveis com a fase aditiva.
- [ ] **Step 2: Atualizar verificadores e documento incremental**, sem afirmar que a interface nova já está ativa.
- [ ] **Step 3: Executar gates locais completos:** `npm run format:check`, `npm run lint`, `npm run type-check`, `npm test`, `npm run test:no-event-legacy`, `npm run build`, `npm run test:db` e `npm run test:e2e:local-reset`.
- [ ] **Step 4: Fazer revisão independente da branch**, corrigir achados Critical/Important com TDD e repetir gates afetados.
- [ ] **Step 5: Commit assinado** `chore(database): prepare split payment rollout`.
- [ ] **Step 6: Publicar e abrir PR 1 para `develop`**, acompanhar Quality, Database contract, Playwright e Vercel; não fazer merge com gate pendente/falho ou sem a aprovação exigida pelo projeto.
- [ ] **Step 7: Após o merge**, atualizar `develop`, confirmar staging saudável e criar `feature/split-payments-reconciliation-app` em novo worktree isolado.

---

## PR 2 — Aplicação, Interface E Corte

### Task 6: Contrato compartilhado, domínio e adapter v5

**Files:**

- Create: `src/shared/types/payment-method.ts`
- Modify: `src/modules/sales/domain/sale.ts`
- Modify: `src/modules/sales/domain/sale.test.ts`
- Modify: `src/modules/sales/application/sale-validation.ts`
- Modify: `src/modules/sales/application/create-sale-use-case.ts`
- Modify: `src/modules/sales/application/create-sale-use-case.test.ts`
- Modify: `src/modules/sales/application/sale-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-repository.test.ts`
- Modify: `src/modules/sales/presentation/create-sale-action-service.test.ts`

**Interfaces:**

- Produces: `paymentMethods`, `PaymentMethod` e `InstallmentCount = 1 | 2 | 3` no módulo compartilhado.
- Produces: `CreateSaleInput.payments: CreatePaymentInput[]` e `Sale.payments: Payment[]`.
- Produces: `CreatePaymentInput` discriminado: crédito exige `installmentCount`; demais métodos não aceitam a propriedade.
- Produces: adapter `finalize_sale_v5` com `p_payments: Array<{ method; amount_in_cents; installment_count? }>` e sem `change_in_cents` enviado ao banco.

- [ ] **Step 1: Escrever domínio RED** para um/dois métodos, distinção, contribuição mínima, dinheiro com troco, crédito 1x/2x/3x e todos os casos do Review Focus.
- [ ] **Step 2: Executar teste de domínio** e confirmar falha pelo contrato singular atual.
- [ ] **Step 3: Implementar tipos compartilhados e cálculo inteiro**, atribuindo todo excedente ao troco da única entrada em dinheiro.
- [ ] **Step 4: Escrever aplicação/adapter RED** exigindo array, v5, payload sem troco e erros de caixa/RPC preservados.
- [ ] **Step 5: Migrar Zod, use case, repositório e mocks** para `payments`, sem aceitar operador, preço ou total do frontend.
- [ ] **Step 6: Executar testes focados e `npm test`**; esperado: todos verdes.
- [ ] **Step 7: Commit assinado** `feat(sales): model split payments and installments`.

### Task 7: FormData e PDV mobile first

**Files:**

- Create: `src/modules/sales/presentation/pdv-payment.ts`
- Create: `src/modules/sales/presentation/pdv-payment.test.ts`
- Create: `src/modules/sales/presentation/pdv-payment-section.tsx`
- Create: `src/modules/sales/presentation/pdv-payment-section.test.tsx`
- Modify: `src/modules/sales/presentation/sale-form-data.ts`
- Modify: `src/modules/sales/presentation/sale-form-data.test.ts`
- Modify: `src/modules/sales/presentation/pdv-cart.tsx`
- Modify: `src/modules/sales/presentation/pdv-cart.test.tsx`
- Modify: `src/modules/sales/presentation/sale-action-state.ts`
- Modify: `src/app/pdv/page.test.tsx`

**Interfaces:**

- Produces: `PaymentDraft { method: PaymentMethod; amountInput: string; installmentCount?: InstallmentCount }`.
- Produces: `summarizePaymentDrafts(drafts, totalInCents): PaymentDraftSummary`, retornando `grossAmountInCents`, `netAmountInCents`, `remainingInCents`, `changeInCents`, `isValid` e `error?`.
- Produces: `PdvPaymentSectionProps { drafts; errorMessage?; onChange(nextDrafts); totalInCents }` para componente controlado.
- Produces: campo oculto `paymentsJson` com `{ method, amountInReais, installmentCount? }[]`; o servidor converte cada string BRL para centavos.

- [ ] **Step 1: Escrever testes RED do resumo** para total, restante, troco, contribuição líquida zero, valores inválidos e mudança do total após editar carrinho/desconto.
- [ ] **Step 2: Implementar o helper de apresentação** sem `parseFloat`, mantendo a validação definitiva no domínio/servidor.
- [ ] **Step 3: Escrever componente RED** para adicionar/remover segunda forma, excluir método repetido, editar valores, selecionar 1x/2x/3x e mostrar parcela aproximada.
- [ ] **Step 4: Escrever FormData RED** para JSON válido, malformado, campos vazios, centavos, métodos e parcelas inválidos.
- [ ] **Step 5: Implementar seção mobile first e parser**, com rótulos acessíveis, estados associados, campos não monetários automáticos quando houver somente um método e valores editáveis na divisão.
- [ ] **Step 6: Integrar no `PdvCart`** e provar reset conjunto de carrinho, desconto, métodos, valores e parcela após sucesso.
- [ ] **Step 7: Executar testes focados, axe existente e `npm test`**.
- [ ] **Step 8: Commit assinado** `feat(pdv): accept split and installment payments`.

### Task 8: Detalhe e auditoria dos pagamentos

**Files:**

- Modify: `src/modules/sales/application/sale-summary-repository.ts`
- Modify: `src/modules/sales/application/sale-detail-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sales-read-model.ts`
- Modify: `src/modules/sales/infra/supabase-sale-summary-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-summary-repository.test.ts`
- Modify: `src/modules/sales/infra/supabase-sale-detail-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-detail-repository.test.ts`
- Modify: `src/modules/sales/presentation/sales-list.tsx`
- Modify: `src/modules/sales/presentation/sales-list.test.tsx`
- Modify: `src/modules/sales/presentation/sale-detail-card.tsx`
- Modify: `src/modules/sales/presentation/sale-detail-card.test.tsx`
- Modify: `src/modules/sales/testing/sale-summary-fixture.ts`
- Modify: `src/app/sales/page.test.tsx`
- Modify: `src/app/sales/[id]/page.test.tsx`

**Interfaces:**

- Produces: `SaleSummary.payments: Payment[]` e `SaleDetail.payments: Payment[]`, sem fallback que descarte linhas depois da primeira.
- Selects: `payments(method,amount_in_cents,change_in_cents,installment_count)`.
- Displays: métodos utilizados no histórico; no detalhe, valor bruto, contribuição líquida, troco em dinheiro e `À vista`/`2x`/`3x` para crédito.

- [ ] **Step 1: Escrever mapper/UI RED** do histórico e detalhe para um pagamento legado, divisão Pix + dinheiro, crédito 3x e venda cancelada.
- [ ] **Step 2: Executar testes focados** e confirmar falha porque o resumo não carrega pagamentos e o detalhe usa somente `payments[0]`.
- [ ] **Step 3: Migrar selects, schemas Zod, DTOs, fixtures e componentes** para todas as linhas, mantendo subtotal/desconto/total e autoria.
- [ ] **Step 4: Executar testes focados, `npm test` e `npm run type-check`**.
- [ ] **Step 5: Commit assinado** `feat(sales): audit every sale payment`.

### Task 9: Domínio, aplicação e adapter do fechamento v2

**Files:**

- Modify: `src/modules/cash/domain/cash-session.ts`
- Modify: `src/modules/cash/domain/cash-session.test.ts`
- Modify: `src/modules/cash/application/cash-session-validation.ts`
- Modify: `src/modules/cash/application/cash-session-repository.ts`
- Modify: `src/modules/cash/application/close-cash-session-use-case.ts`
- Modify: `src/modules/cash/application/close-cash-session-use-case.test.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-repository.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-repository.test.ts`
- Modify: `src/modules/cash/presentation/close-cash-session-action-service.test.ts`

**Interfaces:**

- Produces: `CashSessionReconciliation { method, expectedAmountInCents, countedAmountInCents, differenceAmountInCents }`.
- Produces: entrada de fechamento `{ cashSessionId, reconciliations: Array<{ method, countedAmountInCents }>, adminPassword? }`.
- Replaces: `CashSessionRepository.update(...)` por `close(input: { cashSessionId; reconciliations; adminPassword? }): Promise<SaveCashSessionResult>` usando `close_cash_session_v2` e carregando sessão/reconciliações persistidas.
- Preserves: autorização de operador sobre o próprio caixa e administrador sobre caixa alheio; senha divergente continua sendo validação separada.

- [ ] **Step 1: Escrever domínio/Zod RED** para exatamente quatro métodos, distinção, zero válido, negativos, ausências, duplicidades e inteiros seguros.
- [ ] **Step 2: Escrever use case RED** para operador, admin fechando caixa alheio, divergência, erro de senha e erro transacional.
- [ ] **Step 3: Escrever adapter RED** exigindo somente `p_cash_session_id`, `p_reconciliations` e `p_admin_password`, sem horário ou esperado do cliente.
- [ ] **Step 4: Executar testes focados** e confirmar falha pelo contrato legado.
- [ ] **Step 5: Implementar domínio, caso de uso e adapter v2**, mapeando qualquer divergência sem senha para mensagem neutra de autorização administrativa.
- [ ] **Step 6: Executar testes focados e `npm test`**.
- [ ] **Step 7: Commit assinado** `feat(cash): close sessions with method reconciliation`.

### Task 10: Resumo e interface de conferência do caixa

**Files:**

- Modify: `src/modules/cash/application/cash-session-closing-summary-repository.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-closing-summary-repository.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-closing-summary-repository.test.ts`
- Modify: `src/modules/cash/presentation/close-cash-session-form-data.ts`
- Modify: `src/modules/cash/presentation/close-cash-session-form-data.test.ts`
- Modify: `src/modules/cash/presentation/close-cash-session-form.tsx`
- Modify: `src/modules/cash/presentation/close-cash-session-form.test.tsx`
- Modify: `src/app/cash/close/page.tsx`
- Modify: `src/app/cash/close/page.test.tsx`

**Interfaces:**

- Produces: `CashSessionClosingSummary.expectedByMethodInCents: Record<PaymentMethod, number>` e totais de vendas/cancelamentos em centavos.
- Produces: campos `countedAmount_cash`, `countedAmount_pix`, `countedAmount_credit_card` e `countedAmount_debit_card`, todos obrigatórios e inicialmente vazios.
- Produces: diferença individual `counted - expected`; senha aparece quando qualquer diferença é diferente de zero.

- [ ] **Step 1: Escrever repositório RED** para dinheiro com saldo inicial/troco, Pix, crédito, débito, divisão e cancelamento excluído.
- [ ] **Step 2: Escrever parser RED** para quatro valores válidos, zero explícito, vazio, texto, negativo e precisão inválida.
- [ ] **Step 3: Escrever UI RED** reproduzindo o caso R$ 0,00 em dinheiro/R$ 200,00 em crédito e mostrando diferenças zero após conferência correta.
- [ ] **Step 4: Acrescentar UI RED** para sobra, falta e diferenças opostas, sempre exibindo senha e somente a diferença real de cada método.
- [ ] **Step 5: Implementar resumo, parser e formulário** em centavos, com cartões acessíveis por método e botão bloqueado até preencher os quatro campos.
- [ ] **Step 6: Executar testes focados, axe existente, `npm test` e `npm run type-check`**.
- [ ] **Step 7: Commit assinado** `feat(cash): reconcile every payment method on close`.

### Task 11: Relatórios, parcelas e CSV

**Files:**

- Modify: `src/modules/reports/application/sales-report-repository.ts`
- Modify: `src/modules/reports/infra/supabase-sales-report-repository.ts`
- Modify: `src/modules/reports/infra/supabase-sales-report-repository.test.ts`
- Modify: `src/modules/reports/presentation/sales-report.tsx`
- Modify: `src/modules/reports/presentation/sales-report.test.tsx`
- Modify: `src/modules/reports/application/export-sales-report-csv-use-case.ts`
- Modify: `src/modules/reports/application/export-sales-report-csv-use-case.test.ts`
- Modify: `src/modules/reports/testing/sales-report-fixture.ts`

**Interfaces:**

- Produces: `SalesReportCreditInstallmentSummaryItem { installmentCount: InstallmentCount; netTotalInCents: number; salesCount: number }`.
- Produces: reconciliações por sessão e totais globais de sobra, falta e diferença de todos os métodos.
- Preserves: `paymentSummary` por método com `salesCount` distinto; total geral e receita não duplicam vendas divididas.

- [ ] **Step 1: Escrever mapper RED** para JSON novo, sessão v2 e fallback de sessão legada usando somente os campos escalares de dinheiro.
- [ ] **Step 2: Escrever UI RED** para resumo por método, aviso de contagens não aditivas, crédito 1x/2x/3x e reconciliação detalhada da sessão.
- [ ] **Step 3: Escrever CSV RED** para pagamentos divididos, parcelas e quatro reconciliações, preservando neutralização de fórmulas.
- [ ] **Step 4: Executar testes focados** e confirmar ausência dos contratos novos.
- [ ] **Step 5: Implementar Zod, tipos, mapper, UI, fixtures e CSV** sem substituir os totais financeiros gerais por soma de contagens por método.
- [ ] **Step 6: Executar testes focados, `npm test` e `npm run type-check`**.
- [ ] **Step 7: Commit assinado** `feat(reports): show installments and payment reconciliation`.

### Task 12: Corte seguro, E2E, documentação e PR

**Files:**

- Create: `supabase/migrations/20261018180000_disable_legacy_cash_close.sql`
- Modify: `supabase/tests/database/000_cash_session_foundation.test.sql`
- Modify: `supabase/tests/database/005_split_payments_cash_reconciliation.test.sql`
- Modify: `scripts/test-sale-discount-database.mjs`
- Modify: `scripts/test-sales-report-database.mjs`
- Modify: `scripts/test-store-database.mjs`
- Modify: `tests/e2e/support/store.ts`
- Modify: `tests/e2e/support/cash.ts`
- Modify: `tests/e2e/sale-flow.spec.ts`
- Modify: `tests/e2e/cash-close.spec.ts`
- Modify: `tests/e2e/multi-operator-cash.spec.ts`
- Modify: `tests/e2e/multi-operator-sales.spec.ts`
- Modify: `tests/e2e/reports.spec.ts`
- Modify: `tests/e2e/financial-security.spec.ts`
- Modify: `scripts/verify-remote-environment.mjs`
- Modify: `scripts/verify-remote-environment.test.ts`
- Modify: `scripts/verify-remote-staging.test.ts`
- Modify: `scripts/verify-remote-production.test.ts`
- Modify: `docs/manual-usuario-final.md`
- Modify: `docs/runbook-operacional.md`
- Modify: `docs/e2e-release-gate.md`
- Modify: `docs/plano-execucao-incremental.md`

**Interfaces:**

- Produces: migration que revoga `execute` de `close_cash_session(uuid,integer,timestamptz,text)` para `public`, `anon` e `authenticated`, preservando sua definição histórica.
- Produces: helpers E2E v5/v2 e verificação remota que exige contratos novos e confirma o bloqueio do fechamento legado.
- Produces: documentação operacional correspondente ao runtime efetivamente implantado.

- [ ] **Step 1: Escrever pgTAP RED** provando que o fechamento legado não pode ser executado após o corte e v2 permanece disponível somente a autenticados.
- [ ] **Step 2: Escrever E2E RED de venda** para um método, Pix + dinheiro com troco, crédito 3x, desconto, estoque, detalhe e cancelamento único.
- [ ] **Step 3: Escrever E2E RED de fechamento** para os quatro valores vazios, conferência exata, sobra, falta, diferenças opostas, senha inválida/válida e operador/admin.
- [ ] **Step 4: Escrever E2E RED de relatório** para total geral único, contagem por método, parcelas, reconciliações e cancelamento pós-fechamento.
- [ ] **Step 5: Implementar migration de corte, helpers, verificadores e documentação**, sem registrar senhas, chaves ou valores de ambiente.
- [ ] **Step 6: Executar gates locais completos:** `npm run format:check`, `npm run lint`, `npm run type-check`, `npm test`, `npm run test:no-event-legacy`, `npm run build`, `npm run test:db` e `npm run test:e2e:local-reset`.
- [ ] **Step 7: Fazer revisão independente completa**, corrigir achados Critical/Important com TDD e repetir todos os gates afetados.
- [ ] **Step 8: Commit assinado** `test(pdv): cover split payments and reconciliation flow` (separar commits convencionais de migration/docs quando necessário).
- [ ] **Step 9: Publicar e abrir PR 2 para `develop`**, acompanhar Quality, Database contract, Playwright e Vercel sem fazer merge com gate pendente/falho.
- [ ] **Step 10: Validar o preview/staging** com venda dividida, crédito parcelado, fechamento por método e relatório; registrar evidência sem credenciais.
- [ ] **Step 11: Após aprovação e merge**, repetir smoke de staging e somente então preparar o PR de release `develop -> main` conforme o fluxo obrigatório.

## Self-Review

- Cobertura da spec: limites de pagamentos, troco, parcelas, idempotência, PDV, detalhe, fechamento, auditoria, relatórios, cancelamento, RLS, compatibilidade e corte estão ligados às Tasks 1-12.
- Consistência: `PaymentMethod` e `InstallmentCount` têm uma origem compartilhada; venda usa `payments`; fechamento usa `reconciliations`; todas as novas interfaces financeiras usam centavos inteiros.
- Compatibilidade: PR 1 preserva v3/v4 e fechamento atual; v4 converte crédito legado em 1x; somente o PR 2 revoga execução do fechamento antigo, depois que a aplicação usa v2.
- Segurança: o cliente nunca envia operador, preços, total, troco definitivo, esperado, diferença ou horário; helpers internos e tabelas financeiras não aceitam escrita direta autenticada.
- Review Focus: contribuição líquida zero, idempotência por ordem, divergências opostas, entradas monetárias hostis e cancelamentos divididos possuem testes nas tarefas responsáveis.
- Proporção: o plano fixa arquivos, contratos e resultados verificáveis, mas deixa os corpos das funções para a execução TDD.
- Fora de escopo preservado: sem terceiro método, método repetido, identificação de cartões, juros, mais de 3x, recebíveis, conciliação automática ou estorno parcial.
