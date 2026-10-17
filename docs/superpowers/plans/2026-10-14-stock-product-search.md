# Stock Adjustment Product Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o administrador localize e selecione com rapidez um produto ativo por nome, trecho ou SKU antes de registrar um ajuste de estoque.

**Architecture:** Um combobox controlado na camada de apresentação filtra localmente as opções ativas já carregadas pela página. O componente mantém texto, opção ativa e seleção como estados distintos; somente uma seleção válida alimenta o campo oculto `productId`, preservando integralmente a action e o caso de uso existentes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind, Testing Library, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-10-13-pdv-sku-discounts-stock-search-design.md`

## Global Constraints

- Trabalhar somente na branch `feature/stock-product-search`, baseada no `develop` após o PR de SKU.
- Filtrar apenas os produtos ativos recebidos da página; não criar busca remota, paginação ou migration.
- Reutilizar `normalizeSearchTerm` para ignorar caixa e acentos.
- Digitação não equivale a seleção: `productId` só pode ser enviado após escolha explícita.
- Preservar validação definitiva do servidor para produto inexistente ou inativo.
- Interface mobile first, utilizável por toque e teclado, com estados ARIA coerentes.
- Código em inglês, textos do produto em português, TDD e commits assinados.

## Review Focus

- Nome completo, trecho, SKU, caixa e acentos devem produzir os resultados corretos.
- Alterar o texto após uma seleção deve remover imediatamente o `productId` anterior.
- Enter só seleciona a opção ativa; texto parecido sem seleção não habilita o envio.
- Setas, Escape, foco, `aria-expanded`, `aria-activedescendant`, listbox e option devem permanecer coerentes.
- Limpar/trocar deve remover a seleção e devolver o foco ao campo de busca.
- O helper E2E compartilhado deve deixar de depender do `<select>` removido.

---

### Task 1: Componente De Busca Acessível

**Files:**

- Create: `src/modules/stock/presentation/stock-product-combobox.tsx`
- Create: `src/modules/stock/presentation/stock-product-combobox.test.tsx`
- Modify: `src/modules/stock/presentation/stock-adjustment-form.tsx`
- Modify: `src/modules/stock/presentation/stock-adjustment-form.test.tsx`

**Interfaces:**

- Produces: `StockAdjustmentProductOption = { id: string; name: string; sku?: string }`.
- Produces: `StockProductCombobox` com `products`, `invalid` e `errorId`.
- Produces: campo oculto `productId`, vazio até uma seleção explícita.
- Consumes: `normalizeSearchTerm` de `src/shared/utils/search.ts`.

- [ ] Escrever testes que falham para busca por nome completo, trecho, SKU, caixa e acentos.
- [ ] Cobrir seleção por toque/clique, valor oculto, resumo selecionado, troca e texto sem seleção.
- [ ] Cobrir ArrowDown/ArrowUp/Enter/Escape, atributos ARIA e ausência de resultados.
- [ ] Executar `npm test -- src/modules/stock/presentation/stock-product-combobox.test.tsx` e confirmar RED.
- [ ] Implementar o combobox controlado com input, listbox, opções e foco preservado.
- [ ] Substituir o `<select>` do formulário, mantendo `FieldError`, demais campos e action.
- [ ] Atualizar testes do formulário para exigir seleção antes de habilitar o submit.
- [ ] Executar `npm test -- src/modules/stock/presentation` e confirmar GREEN.
- [ ] Executar lint e type-check focados.
- [ ] Criar commit assinado `feat(stock): add searchable product selector`.

### Task 2: Integração Da Página E Regressão E2E

**Files:**

- Modify: `src/app/stock/page.tsx`
- Modify: `src/app/stock/page.test.tsx`
- Modify: `tests/e2e/support/store.ts`
- Create: `tests/e2e/stock-product-search.spec.ts`

**Interfaces:**

- A página entrega somente produtos ativos como `{ id, name, sku }`.
- O helper E2E seleciona o resultado do combobox e lê o `productId` oculto.
- O cenário E2E comprova busca sem acento, troca, busca por SKU e ajuste concluído.

- [ ] Atualizar primeiro os testes da página para o novo contrato estruturado e confirmar RED.
- [ ] Adaptar `toActiveProductOptions` sem mudar repositórios ou casos de uso.
- [ ] Atualizar o helper E2E compartilhado para abandonar seletores do `<select>` legado.
- [ ] Criar cenário E2E explícito de busca, seleção, troca e submissão do ajuste.
- [ ] Executar testes da página e do módulo de estoque.
- [ ] Executar `npm run test:e2e:local-reset` e confirmar toda a regressão.
- [ ] Criar commit assinado `test(stock): cover searchable stock adjustment`.

### Task 3: Gates E Entrega

- [ ] Executar `npm run format:check`.
- [ ] Executar `npm run lint`.
- [ ] Executar `npm run type-check`.
- [ ] Executar `npm test`.
- [ ] Executar `npm run test:no-event-legacy`.
- [ ] Executar build de produção com ambiente válido.
- [ ] Executar `npm run test:db` para regressão do contrato persistido.
- [ ] Repetir `npm run test:e2e:local-reset` no HEAD final.
- [ ] Executar `git diff --check origin/develop...HEAD` e confirmar worktree limpo.
- [ ] Solicitar revisão independente do diff completo e corrigir achados com TDD.
- [ ] Publicar `feature/stock-product-search`, abrir PR para `develop`, aguardar todos os checks e integrar somente após o gate verde.
