# Uppercase Product SKU Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que todo SKU de produto seja normalizado e persistido em maiúsculas, preservando unicidade e rejeitando gravações diretas fora do formato canônico.

**Architecture:** Uma função pura no domínio define o SKU canônico e é reutilizada pela validação e pela apresentação, enquanto `createProduct` repete a normalização como defesa da entidade. Uma migration aditiva normaliza dados legados, interrompe diante de colisões e adiciona uma constraint; os testes de upgrade e pgTAP comprovam a transição e a proteção final.

**Tech Stack:** Next.js 16, TypeScript, Zod 4, Vitest, Playwright, Supabase/PostgreSQL, pgTAP

**Spec:** `docs/superpowers/specs/2026-10-13-pdv-sku-discounts-stock-search-design.md`

## Global Constraints

- Trabalhar somente na branch `feature/sku-uppercase`, baseada em `develop`.
- Não reescrever migrations aplicadas; criar uma migration aditiva.
- O SKU permanece opcional e limitado a 64 caracteres depois da normalização.
- A forma canônica é `trim` seguido de `toUpperCase`; texto vazio vira ausência de SKU.
- A aplicação normaliza e o banco rejeita valores não canônicos; não criar trigger de mutação silenciosa.
- Uma colisão gerada pela normalização deve abortar a migration sem mesclar produtos.
- Código e nomes técnicos em inglês; textos do produto em português.
- Usar TDD, commits assinados e mensagens Conventional Commits.

## Review Focus

- Entrada com espaços e letras minúsculas deve chegar ao repositório e ao banco como `RM-CAMISA-01`; cobrir na Task 1 e Task 3.
- SKU vazio deve continuar sendo `null`/ausente, nunca uma string vazia; cobrir na Task 1.
- Uma transformação Unicode que aumente o tamanho deve ser validada depois do uppercase e rejeitada acima de 64 caracteres; cobrir na Task 1.
- Dois SKUs legados que colidam apenas depois de `upper(trim(...))` devem abortar o upgrade com diagnóstico estável; cobrir na Task 2.
- Escrita SQL direta com SKU minúsculo deve falhar, enquanto o upgrade de uma linha legada deve preservar o produto e normalizar seu SKU; cobrir na Task 2.

---

### Task 1: Canonicalização Do SKU Nas Camadas Da Aplicação

**Files:**

- Modify: `src/modules/products/domain/product.ts`
- Modify: `src/modules/products/domain/product.test.ts`
- Modify: `src/modules/products/application/product-validation.ts`
- Modify: `src/modules/products/application/create-product-use-case.test.ts`
- Modify: `src/modules/products/application/update-product-use-case.test.ts`
- Modify: `src/modules/products/presentation/product-form-data.ts`
- Modify: `src/modules/products/presentation/product-form-data.test.ts`

**Interfaces:**

- Produces: `normalizeProductSku(sku: string | null | undefined): string | undefined` em `domain/product.ts`.
- Produces: `createProductSchema` com saída `sku?: string` já canônica e limite aplicado depois da transformação.
- Consumes: `parseCreateProductFormData(formData)` e `getProductFormValues(formData)` reutilizam `normalizeProductSku` sem criar uma segunda regra.

- [ ] **Step 1: Escrever testes de domínio que falham**

Em `product.test.ts`, alterar a entrada do teste principal para `" rm-camisa-01 "` e esperar `"RM-CAMISA-01"`. Adicionar casos com SKU somente em espaços, esperando propriedade ausente, e com `"ß".repeat(33)`, esperando erro de tamanho depois de virar 66 caracteres.

- [ ] **Step 2: Executar o teste de domínio e confirmar a falha**

Run: `npm test -- src/modules/products/domain/product.test.ts`

Expected: FAIL porque o SKU minúsculo ainda é preservado e a expansão Unicode ainda é validada antes do uppercase.

- [ ] **Step 3: Implementar a função canônica no domínio**

Exportar `normalizeProductSku(sku: string | null | undefined): string | undefined` usando `sku?.trim().toUpperCase()` e mantendo `undefined` para vazio. Fazer `createProduct` usar essa função antes de validar o limite de 64 caracteres.

- [ ] **Step 4: Executar o teste de domínio e confirmar sucesso**

Run: `npm test -- src/modules/products/domain/product.test.ts`

Expected: PASS.

- [ ] **Step 5: Escrever testes dos casos de uso e formulário que falham**

Em `create-product-use-case.test.ts` e `update-product-use-case.test.ts`, fornecer SKUs minúsculos com espaços e afirmar que o produto enviado ao repositório contém o valor maiúsculo. No teste de criação, enviar também um SKU cuja expansão ultrapasse 64 caracteres e esperar o erro de campo. Em `product-form-data.test.ts`, afirmar que parsing e valores de reexibição transformam `" rm-camisa-01 "` em `"RM-CAMISA-01"` e preservam SKU vazio como `null` no comando e `""` no formulário.

- [ ] **Step 6: Executar os testes focados e confirmar a falha**

Run: `npm test -- src/modules/products/application/create-product-use-case.test.ts src/modules/products/application/update-product-use-case.test.ts src/modules/products/presentation/product-form-data.test.ts`

Expected: FAIL nas expectativas de uppercase e na validação posterior à transformação.

- [ ] **Step 7: Reutilizar a canonicalização na validação e apresentação**

Em `product-validation.ts`, transformar `string | null | undefined` com `normalizeProductSku` antes de aplicar o limite de 64 caracteres, mantendo a mensagem `O SKU deve ter no maximo 64 caracteres.`. Em `product-form-data.ts`, usar a mesma função para o comando e para valores reexibidos, convertendo `undefined` respectivamente para `null` e `""`.

- [ ] **Step 8: Executar toda a suíte do módulo de produtos**

Run: `npm test -- src/modules/products`

Expected: PASS, sem alteração no contrato de preço, ativação ou persistência.

- [ ] **Step 9: Executar verificações estáticas do incremento**

Run: `npm run type-check`

Expected: PASS.

Run: `npm run lint -- src/modules/products`

Expected: PASS.

- [ ] **Step 10: Criar commit assinado da aplicação**

```bash
git add src/modules/products/domain/product.ts src/modules/products/domain/product.test.ts src/modules/products/application/product-validation.ts src/modules/products/application/create-product-use-case.test.ts src/modules/products/application/update-product-use-case.test.ts src/modules/products/presentation/product-form-data.ts src/modules/products/presentation/product-form-data.test.ts
git commit -S -m "feat(products): normalize sku to uppercase"
```

### Task 2: Invariante E Upgrade Seguro No Banco

**Files:**

- Create: `supabase/migrations/20261013190000_enforce_uppercase_product_sku.sql`
- Create: `supabase/tests/database/003_product_sku_uppercase.test.sql`
- Create: `scripts/test-product-sku-upgrade.mjs`
- Modify: `scripts/run-database-gate.mjs`

**Interfaces:**

- Produces: constraint `products_sku_canonical` com `sku is null or (sku = upper(btrim(sku)) and length(sku) between 1 and 64)`.
- Produces: CLI local `node scripts/test-product-sku-upgrade.mjs <seed-normalization|verify-normalization|seed-collision>`.
- Consumes: `DATABASE_TEST_SUPABASE_URL` e `DATABASE_TEST_SUPABASE_SECRET_KEY`, recusando hosts não locais como os outros gates de banco.

- [ ] **Step 1: Escrever o contrato pgTAP que falha**

Criar `003_product_sku_uppercase.test.sql` com transação e rollback. Verificar que a constraint nomeada existe, que um insert com `sku = 'RM-VALIDO-01'` funciona, que `sku = 'rm-invalido-01'` falha com `23514`, que `sku = ' RM-INVALIDO-02 '` falha e que `sku = null` continua permitido.

- [ ] **Step 2: Confirmar que o contrato falha no schema atual**

Run: `npm run test:db`

Expected: FAIL porque `products_sku_canonical` e a migration ainda não existem.

- [ ] **Step 3: Criar a migration aditiva**

Em `20261013190000_enforce_uppercase_product_sku.sql`, antes de qualquer update, detectar grupos não nulos com o mesmo `upper(btrim(sku))` e lançar exceção contendo `Product SKU normalization collision`. Depois atualizar somente linhas divergentes para `upper(btrim(sku))` e adicionar `products_sku_canonical`. Não remover nem recriar `products_sku_unique_idx`.

- [ ] **Step 4: Implementar o fixture de upgrade local**

Criar `test-product-sku-upgrade.mjs` com os três modos definidos na interface. `seed-normalization` insere um produto de ID reservado com `sku = ' rm-camisa-01 '`, `verify-normalization` confirma o mesmo ID e `sku = 'RM-CAMISA-01'`, e `seed-collision` insere dois produtos reservados com `sku = 'sku-collision'` e `sku = 'SKU-COLLISION'`. Todo modo deve validar hostname local antes de conectar e nunca imprimir chaves.

- [ ] **Step 5: Integrar os cenários ao gate de banco**

Em `run-database-gate.mjs`, manter o upgrade PR05→head existente e adicionar o fixture de normalização antes/depois de `supabase migration up`. Acrescentar uma etapa isolada que reseta para `20261005143000`, semeia a colisão, exige falha de `supabase migration up --local` e exige a mensagem `Product SKU normalization collision`; em seguida executar o fresh reset já existente para recuperar um banco limpo.

- [ ] **Step 6: Executar o gate completo de banco**

Run: `npm run test:db`

Expected: PASS nos cenários de upgrade preservado, colisão recusada, fresh reset e contratos pgTAP/integrados existentes.

- [ ] **Step 7: Executar testes e lint dos scripts alterados**

Run: `npm test -- scripts`

Expected: PASS.

Run: `npm run lint -- scripts/test-product-sku-upgrade.mjs scripts/run-database-gate.mjs`

Expected: PASS.

- [ ] **Step 8: Criar commit assinado do banco**

```bash
git add supabase/migrations/20261013190000_enforce_uppercase_product_sku.sql supabase/tests/database/003_product_sku_uppercase.test.sql scripts/test-product-sku-upgrade.mjs scripts/run-database-gate.mjs
git commit -S -m "feat(database): enforce canonical product sku"
```

### Task 3: Prova E2E E Gate Final Do PR

**Files:**

- Modify: `tests/e2e/product-create.spec.ts`

**Interfaces:**

- Consumes: formulário de produto existente e `normalizeProductSku` por meio da action/caso de uso.
- Produces: cenário E2E que prova entrada minúscula e exibição persistida em maiúsculas.

- [ ] **Step 1: Escrever o cenário E2E de criação canônica**

Em `product-create.spec.ts`, gerar o SKU esperado em maiúsculas, preencher o formulário com a versão minúscula cercada por espaços e afirmar que a listagem mostra somente o valor esperado em maiúsculas depois do redirect. Manter as verificações de nome e preço.

- [ ] **Step 2: Executar o gate E2E local**

Run: `npm run test:e2e:local-reset`

Expected: PASS na suíte completa, com banco local recriado pelas migrations, produto salvo e listado com SKU canônico.

- [ ] **Step 3: Criar commit assinado da regressão E2E**

```bash
git add tests/e2e/product-create.spec.ts
git commit -S -m "test(products): cover uppercase sku persistence"
```

- [ ] **Step 4: Executar gates locais completos e registrar evidências**

Run, nesta ordem:

```bash
npm run format:check
npm run lint
npm run type-check
npm run test
npm run test:no-event-legacy
npm run build
npm run test:db
npm run test:e2e:local-reset
git diff --check origin/develop...HEAD
git status --short
```

Expected: todos os comandos PASS; `git diff --check` sem saída; worktree limpo.

- [ ] **Step 5: Solicitar revisão independente antes do PR**

Revisar o diff completo contra `origin/develop`, com foco na ordem de validação, compatibilidade do upgrade, recusa de colisões, constraint direta e ausência de regressões no formulário. Corrigir achados com TDD e repetir os gates afetados.

- [ ] **Step 6: Publicar a branch e abrir PR para `develop`**

```bash
git push -u origin feature/sku-uppercase
gh pr create --base develop --head feature/sku-uppercase --title "feat(products): padronizar SKU em maiúsculas" --body-file <arquivo-temporario-do-corpo>
```

O corpo deve resumir regra canônica, migration/rollback, testes executados e risco de colisão. Não fazer merge antes de todos os checks obrigatórios e do gate E2E aplicável.
