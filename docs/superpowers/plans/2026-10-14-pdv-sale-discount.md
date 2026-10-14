# PDV Sale Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir desconto por venda em reais para Admin e Operador, preservando subtotal, desconto, total líquido e autoria em toda a auditoria financeira.

**Architecture:** Valores da venda passam a circular em centavos inteiros desde o formulário até a RPC. Uma migration aditiva cria as invariantes e a `finalize_sale_v4`, preserva a `finalize_sale_v3` com desconto zero e evolui o JSON do relatório sem quebrar sua assinatura. Leitura, PDV, histórico, detalhes, caixa e relatórios usam o total líquido persistido, enquanto subtotal e desconto permanecem visíveis.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Supabase/PostgreSQL, Vitest, Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-pdv-sku-discounts-stock-search-design.md`

## Global Constraints

- Desconto é por venda, em reais, com mínimo concedido de R$ 0,01 e zero significando ausência de desconto.
- `0 <= discount_in_cents < subtotal_in_cents` e `total_in_cents = subtotal_in_cents - discount_in_cents`, com total mínimo de R$ 0,01.
- Preços, subtotal, desconto máximo, total, pagamento, estoque, caixa e operador são recalculados ou validados no servidor/banco.
- O frontend nunca envia o operador; `operator_id` vem de `auth.uid()` e também identifica quem concedeu o desconto.
- Dinheiro aceita valor recebido maior ou igual ao total líquido e calcula troco; Pix/crédito/débito exigem exatamente o total líquido.
- `finalize_sale_v3` continua funcional apenas com desconto zero; `finalize_sale_v4` inclui o desconto no fingerprint de idempotência.
- Itens preservam preço unitário e total bruto; o desconto não é rateado por item.
- Cancelamento preserva os valores originais, devolve estoque e não apaga a venda.
- Migrations existentes não serão reescritas; nenhuma credencial será versionada; nenhuma migration remota será aplicada sem confirmar o projeto alvo.
- Cada tarefa usa TDD: teste falha pelo motivo esperado antes do código de produção e a suíte completa é executada antes de concluir a tarefa.

## Review Focus

- Entrada monetária `0,01`, milhares, espaços, prefixo `R$`, valor vazio, texto, negativo e mais de duas casas deve produzir centavos exatos ou erro, nunca arredondamento silencioso (Task 1).
- Alterar item/quantidade depois de preencher desconto ou dinheiro deve recalcular limite, total, valor não monetário e troco sem permitir estado obsoleto (Task 4).
- Retry com mesmo ID e desconto idêntico deve ser idempotente; mudar apenas o desconto deve falhar sem nova baixa, pagamento ou venda (Task 2).
- Venda concorrente com mudança de preço/estoque/fechamento deve usar snapshot bloqueado e realizar tudo ou nada (Task 2).
- Cancelamento antes/depois do fechamento deve preservar bruto/desconto/líquido e manter caixa, relatório e CSV reconciliados pelo líquido (Tasks 3 e 6).

---

### Task 1: Contrato monetário e domínio da venda em centavos

**Files:**

- Create: `src/shared/utils/brl-currency.ts`
- Create: `src/shared/utils/brl-currency.test.ts`
- Modify: `src/modules/sales/domain/sale.ts`
- Modify: `src/modules/sales/domain/sale.test.ts`
- Modify: `src/modules/sales/application/sale-validation.ts`
- Modify: `src/modules/sales/presentation/sale-form-data.ts`
- Modify: `src/modules/sales/presentation/sale-form-data.test.ts`
- Modify: `src/modules/sales/presentation/sale-action-state.ts`

**Interfaces:**

- Produces: `parseBrlCurrencyToCents(value: string): number`, `formatBrlCentsForInput(cents: number): string`.
- Produces: `Sale` e entradas com `subtotalInCents`, `discountInCents`, `totalInCents`, itens `unitPriceInCents/totalInCents` e pagamento `amountInCents/changeInCents`.
- Produces: formulário `{ items, discountInCents, payment: { amountInCents, method } }`.

- [ ] **Step 1: Escrever testes RED do parser monetário** para `0,01 -> 1`, `1.234,56 -> 123456`, `R$ 10,00 -> 1000`, zero, vazio, texto, negativo e três casas sem arredondamento.
- [ ] **Step 2: Executar** `npm test -- --run src/shared/utils/brl-currency.test.ts` e confirmar falha por módulo ausente.
- [ ] **Step 3: Implementar o parser/formatador** sem usar `parseFloat` nem multiplicar entrada decimal por 100.
- [ ] **Step 4: Escrever testes RED do domínio** para venda sem desconto, desconto de R$ 0,01, desconto máximo válido, desconto igual/maior ao subtotal, subtotal zero, dinheiro e pagamentos exatos não monetários.
- [ ] **Step 5: Executar** `npm test -- --run src/modules/sales/domain/sale.test.ts` e confirmar falha pelos campos/regras ausentes.
- [ ] **Step 6: Migrar domínio, Zod e FormData para centavos**, incluindo `fieldErrors.discountInCents`, mantendo mensagens de produto em português na apresentação.
- [ ] **Step 7: Executar testes focados e `npm test`**; resultado esperado: todos verdes.
- [ ] **Step 8: Commit assinado** `feat(sales): model sale discounts in cents`.

### Task 2: Schema financeiro e RPC transacional versionada

**Files:**

- Create: `supabase/migrations/20261014120000_add_sale_discounts.sql`
- Create: `supabase/tests/database/004_sale_discounts.test.sql`
- Create: `scripts/test-sale-discount-upgrade.mjs`
- Modify: `scripts/run-database-gate.mjs`
- Modify: `scripts/test-store-database.mjs`
- Modify: `supabase/tests/database/000_cash_session_foundation.test.sql`
- Modify: `supabase/tests/database/002_remove_events_legacy.test.sql`

**Interfaces:**

- Produces: colunas `sales.subtotal_in_cents integer not null` e `sales.discount_in_cents integer not null`.
- Produces: `finalize_sale_v4(p_sale_id uuid, p_cash_session_id uuid, p_items jsonb, p_payment jsonb, p_discount_in_cents integer) returns uuid`.
- Preserves: `finalize_sale_v3(uuid,uuid,jsonb,jsonb)` com fingerprint legado e desconto zero.

- [ ] **Step 1: Escrever pgTAP RED** para colunas, backfill, constraints, assinatura, `SECURITY DEFINER`, `search_path`, grants v3/v4 e helper interno não executável por `anon/authenticated`.
- [ ] **Step 2: Escrever integração RED** para venda v4 com desconto/dinheiro, Pix, autoria, rollback, pagamento inválido, desconto inválido, retry idêntico e ID reutilizado com desconto diferente.
- [ ] **Step 3: Executar** `npm run test:db` e confirmar falha por migration/RPC ausentes.
- [ ] **Step 4: Implementar migration aditiva** com preflight explícito para histórico não positivo, backfill `subtotal=total`, `discount=0`, constraints nomeadas e helper transacional compartilhado pelos wrappers v3/v4.
- [ ] **Step 5: Bloquear sessão e produtos em ordem estável**, recalcular preços/estoque, incluir desconto no fingerprint v4 e persistir venda/itens/pagamento/movimentos na mesma transação.
- [ ] **Step 6: Atualizar gate de upgrade** para semear e verificar venda legada válida e abortar migration diante de histórico incompatível, sem alterar dados automaticamente.
- [ ] **Step 7: Executar `npm run test:db`**; esperado: upgrade, fresh reset, pgTAP, RLS, concorrência e integrações verdes.
- [ ] **Step 8: Commit assinado** `feat(database): add transactional sale discounts`.

### Task 3: Relatório SQL com bruto, desconto e líquido

**Files:**

- Modify: `supabase/migrations/20261014120000_add_sale_discounts.sql`
- Modify: `supabase/tests/database/001_store_sales_report.test.sql`
- Modify: `scripts/test-sales-report-database.mjs`

**Interfaces:**

- Extends: retorno JSON de `get_store_sales_report_v2` com `completed_subtotal_in_cents`, `completed_discount_in_cents` e equivalentes por sessão, mantendo `completed_total_in_cents` líquido.
- Preserves: assinatura, filtros, paginação, RLS, ajustes pós-fechamento e resumo por pagamento.

- [ ] **Step 1: Escrever testes RED** com venda descontada concluída e cancelada antes/depois do fechamento, provando bruto, desconto, líquido, pagamentos e reconciliação.
- [ ] **Step 2: Executar testes de relatório do banco** e confirmar ausência dos novos campos/totais.
- [ ] **Step 3: Evoluir `get_store_sales_report_v2` na mesma migration**, somando subtotal/desconto sobre os mesmos conjuntos usados para o líquido e sem mudar semântica dos ajustes pós-fechamento.
- [ ] **Step 4: Executar `npm run test:db`** e confirmar todos os cenários verdes.
- [ ] **Step 5: Commit assinado** `feat(reports): expose gross sales and discounts`.

### Task 4: Aplicação e persistência usando `finalize_sale_v4`

**Files:**

- Modify: `src/modules/sales/application/create-sale-use-case.ts`
- Modify: `src/modules/sales/application/create-sale-use-case.test.ts`
- Modify: `src/modules/sales/application/sale-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-repository.test.ts`
- Modify: `src/modules/sales/presentation/create-sale-action-service.test.ts`

**Interfaces:**

- Consumes: contrato em centavos da Task 1 e RPC v4 da Task 2.
- Produces: payload v4 com `p_discount_in_cents`; nenhum preço/subtotal/operador é enviado pelo frontend.

- [ ] **Step 1: Escrever testes RED** do use case para desconto válido, inválido após preço vigente, estoque/caixa e erro da RPC sem persistência parcial.
- [ ] **Step 2: Escrever testes RED do adapter** exigindo exatamente `finalize_sale_v4` e seus cinco parâmetros em centavos.
- [ ] **Step 3: Executar testes focados** e confirmar falha pela antiga modelagem/v3.
- [ ] **Step 4: Implementar use case e adapter**, usando `product.price.toCents()` e preservando tratamento de caixa fechado.
- [ ] **Step 5: Executar testes focados e `npm test`**; esperado: todos verdes.
- [ ] **Step 6: Commit assinado** `feat(sales): finalize discounted sales through v4`.

### Task 5: PDV mobile first com desconto em reais

**Files:**

- Modify: `src/modules/sales/presentation/pdv-cart.tsx`
- Modify: `src/modules/sales/presentation/pdv-cart.test.tsx`
- Modify: `src/modules/sales/presentation/cart-items.tsx`
- Modify: `src/modules/sales/presentation/product-picker.tsx`
- Modify: `src/app/pdv/page.tsx`
- Modify: `src/app/pdv/page.test.tsx`

**Interfaces:**

- Consumes: `priceInCents`, parser/formatador BRL e action da Task 4.
- Produces: campos `discountInReais` e `amountReceivedInReais`, resumo Subtotal/Desconto/Total e intenção em centavos via parser do servidor.

- [ ] **Step 1: Escrever testes RED** para renderização, R$ 0,01, máximo válido, negativo, igual ao subtotal, alteração do carrinho, dinheiro/troco, Pix/cartões e reset completo após sucesso.
- [ ] **Step 2: Executar** `npm test -- --run src/modules/sales/presentation/pdv-cart.test.tsx` e confirmar falha pela ausência do campo/resumo.
- [ ] **Step 3: Implementar cálculos inteiros e interface acessível**, com mensagens associadas ao campo, total em destaque e botão bloqueado em estado inválido.
- [ ] **Step 4: Garantir que alteração de itens recalcula total/troco** e que pagamentos não monetários seguem automaticamente o total líquido.
- [ ] **Step 5: Executar testes focados, axe existente e `npm test`**.
- [ ] **Step 6: Commit assinado** `feat(pdv): add sale discount input`.

### Task 6: Histórico, detalhe e auditoria do desconto

**Files:**

- Modify: `src/modules/sales/application/sale-summary-repository.ts`
- Modify: `src/modules/sales/application/sale-detail-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sales-read-model.ts`
- Modify: `src/modules/sales/infra/supabase-sale-summary-repository.test.ts`
- Modify: `src/modules/sales/infra/supabase-sale-detail-repository.ts`
- Modify: `src/modules/sales/infra/supabase-sale-detail-repository.test.ts`
- Modify: `src/modules/sales/presentation/sales-list.tsx`
- Modify: `src/modules/sales/presentation/sales-list.test.tsx`
- Modify: `src/modules/sales/presentation/sale-detail-card.tsx`
- Modify: `src/modules/sales/presentation/sale-detail-card.test.tsx`
- Modify: `src/modules/sales/testing/sale-summary-fixture.ts`
- Modify: consumers/tests de `SaleSummary` e `SaleDetail` encontrados por `rg`.

**Interfaces:**

- Produces: resumos/detalhes com `subtotalInCents`, `discountInCents`, `totalInCents` e valores de itens/pagamento em centavos.
- Produces: autoria visual `Desconto concedido por <operatorName>` apenas quando desconto > 0.

- [ ] **Step 1: Escrever testes RED** de mapeamento e UI para venda com/sem desconto e venda cancelada.
- [ ] **Step 2: Executar testes focados** e confirmar falha pelas colunas/cópias ausentes.
- [ ] **Step 3: Atualizar schemas Zod, selects, DTOs, fixtures e componentes**, exibindo sempre subtotal/desconto/total líquido no histórico e detalhe.
- [ ] **Step 4: Executar `npm test` e `npm run type-check`**.
- [ ] **Step 5: Commit assinado** `feat(sales): audit discounts in sale history`.

### Task 7: Relatórios e CSV reconciliados

**Files:**

- Modify: `src/modules/reports/application/sales-report-repository.ts`
- Modify: `src/modules/reports/infra/supabase-sales-report-repository.ts`
- Modify: `src/modules/reports/infra/supabase-sales-report-repository.test.ts`
- Modify: `src/modules/reports/presentation/sales-report.tsx`
- Modify: `src/modules/reports/presentation/sales-report.test.tsx`
- Modify: `src/modules/reports/application/export-sales-report-csv-use-case.ts`
- Modify: `src/modules/reports/application/export-sales-report-csv-use-case.test.ts`
- Modify: `src/modules/reports/testing/sales-report-fixture.ts`
- Modify: `src/modules/cash/infra/supabase-cash-session-closing-summary-repository.test.ts`

**Interfaces:**

- Consumes: JSON estendido da Task 3.
- Produces: `completedSubtotalInCents`, `completedDiscountInCents`, `completedTotalInCents` globais e por sessão; CSV com linhas bruto/desconto/líquido.

- [ ] **Step 1: Escrever testes RED** do mapper, cards e CSV com bruto R$ 100,00, desconto R$ 10,00 e líquido R$ 90,00.
- [ ] **Step 2: Escrever regressão de fechamento** provando que apenas pagamento líquido em dinheiro entra no valor esperado.
- [ ] **Step 3: Executar testes focados** e confirmar ausência dos novos contratos.
- [ ] **Step 4: Implementar tipos, Zod, mapper, UI e CSV**, preservando neutralização de fórmulas e paginação.
- [ ] **Step 5: Executar testes focados e `npm test`**.
- [ ] **Step 6: Commit assinado** `feat(reports): show sale discounts and gross totals`.

### Task 8: Gates E2E, verificação operacional e documentação

**Files:**

- Modify: `tests/e2e/support/store.ts`
- Modify: `tests/e2e/sale-flow.spec.ts`
- Modify: `tests/e2e/reports.spec.ts`
- Modify: `tests/e2e/financial-security.spec.ts`
- Modify: `scripts/verify-remote-environment.mjs`
- Modify: `scripts/verify-remote-environment.test.ts`
- Modify: `scripts/verify-remote-staging.test.ts`
- Modify: `scripts/verify-remote-production.test.ts`
- Modify: `docs/plano-execucao-incremental.md`
- Modify: `docs/plano-reestruturacao-loja-fisica.md` quando houver checklist correspondente.

**Interfaces:**

- Consumes: fluxo completo Tasks 1-7.
- Produces: helper E2E v4 com `discountInCents?: number`, inventário remoto exigindo v3 e v4, e evidência operacional versionada.

- [ ] **Step 1: Escrever E2E RED** para venda sem desconto, dinheiro com desconto/troco, Pix com desconto, autoria, histórico/detalhe, cancelamento, fechamento e relatório/CSV.
- [ ] **Step 2: Atualizar helper e segurança E2E**, mantendo caso explícito de compatibilidade v3 com desconto zero e bloqueio anônimo da v4.
- [ ] **Step 3: Atualizar verificadores/documentação** para refletir o runtime com v4, sem registrar credenciais.
- [ ] **Step 4: Executar gates locais completos:** `format:check`, `lint`, `type-check`, `test`, `test:no-event-legacy`, `build`, `test:db`, `test:e2e:local-reset`.
- [ ] **Step 5: Fazer revisão independente completa**, corrigir achados Critical/Important com TDD e repetir gates afetados.
- [ ] **Step 6: Commit assinado** `test(sales): cover discounted sale flow` (ou commits convencionais separados para docs/testes).
- [ ] **Step 7: Publicar branch e abrir PR para `develop`**, acompanhar Quality, Database contract, Playwright e Vercel; não fazer merge com gate pendente/falho.

## Self-Review

- Cobertura da spec: modelo financeiro, v4/v3, PDV, auditoria, relatórios, cancelamento, caixa, segurança, erros e testes estão ligados às Tasks 1-8.
- Consistência: todas as interfaces monetárias novas usam `integer`/`number` em centavos; conversão para reais ocorre apenas na formatação visual.
- Compatibilidade: v3 mantém fingerprint legado; v4 possui fingerprint com desconto; assinatura do relatório v2 permanece estável.
- Reversibilidade: cada commit deixa contratos dependentes cobertos; migration é aditiva e aborta histórico incompatível em vez de alterá-lo silenciosamente.
- Fora de escopo preservado: sem percentual, item, cupom, venda zero, escolha de operador ou limite por função.
