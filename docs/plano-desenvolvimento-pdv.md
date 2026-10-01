# Plano De Desenvolvimento - Roberto Multimarcas PDV

> Este documento descreve a arquitetura alvo. Durante a transicao, o runtime
> ainda possui o fluxo legado de eventos; ele somente sera removido depois que
> banco, aplicacao e testes estiverem prontos.

## 1. Objetivo

Manter um sistema privado, mobile first e instalavel como PWA para a operacao
diaria da loja fisica Roberto Multimarcas.

O sistema controla:

- usuarios e permissoes;
- produtos e estoque;
- caixas independentes por vendedor;
- vendas e pagamentos;
- cancelamentos;
- reconciliacao financeira;
- relatorios por periodo, operador e sessao;
- exportacao CSV.

O produto nao utiliza eventos. A sessao de caixa do operador e o contexto
financeiro obrigatorio de cada venda.

## 2. Arquitetura Geral

```txt
Usuario autenticado
->
Aplicacao Web/PWA Next.js
->
Use cases no servidor
->
RPCs transacionais e repositorios
->
Supabase Auth + Postgres + RLS
```

Hospedagem e entrega:

```txt
feature/* -> PR para develop -> Vercel Preview/Staging
develop -> PR de release para main -> Vercel Production
```

## 3. Tecnologias

- Next.js e React.
- TypeScript forte.
- Tailwind CSS.
- Supabase Postgres e Auth.
- Zod.
- Vitest e Testing Library.
- Playwright.
- ESLint e Prettier.
- Husky e Commitlint.
- GitHub Actions.
- Vercel.

## 4. Perfis

### Administrador

- Gerencia usuarios e permissoes.
- Gerencia produtos e estoque.
- Consulta todos os caixas e vendas.
- Executa fechamento administrativo auditado.
- Cancela vendas conforme as regras de seguranca.
- Acessa relatorios e exportacoes.

### Operador

- Abre o proprio caixa.
- Usa somente o proprio caixa aberto no PDV.
- Registra vendas.
- Consulta as vendas permitidas pela politica de acesso.
- Fecha o proprio caixa.
- Visualiza produtos e estoque necessarios para vender.

## 5. Modulos

### Autenticacao E Usuarios

- Login e logout.
- Sessao persistente.
- Perfis `admin` e `operator`.
- Ativacao, inativacao e redefinicao de senha por administrador.
- Rotas e actions protegidas no servidor.

### Dashboard

Para o operador:

- status do proprio caixa;
- atalho para abrir, operar ou fechar;
- resumo das proprias vendas do dia.

Para o administrador:

- caixas abertos por vendedor;
- vendas e pagamentos do dia;
- divergencias de fechamento;
- produtos mais vendidos;
- alertas de estoque.

### Produtos

- Cadastro, edicao e inativacao.
- Nome, SKU, categoria, preco e imagem.
- Busca otimizada para o PDV.
- Estoque nunca e alterado diretamente pelo cadastro.

### Caixa

- Um caixa aberto por operador.
- Varios operadores com caixas simultaneos.
- Varias sessoes fechadas do mesmo operador no mesmo dia.
- Saldo inicial, data operacional e horario de abertura.
- Totais por forma de pagamento.
- Valor esperado, contado e diferenca.
- Fechamento proprio ou administrativo auditado.

### PDV

- Usa automaticamente o caixa aberto do usuario atual.
- Bloqueia vendas sem caixa aberto.
- Busca e selecao de produtos.
- Carrinho com quantidades e totais.
- Dinheiro, Pix, credito e debito.
- Calculo de troco.
- Finalizacao transacional.
- Baixa de estoque atomica.

### Vendas

Cada venda registra:

- identificador;
- sessao de caixa;
- operador;
- data e hora;
- itens, quantidades e precos historicos;
- total;
- pagamento e troco;
- status.

Cancelamentos preservam a venda, registram auditoria e devolvem o estoque.

### Estoque

O saldo e derivado de movimentacoes:

- entrada inicial;
- entrada manual;
- ajuste;
- saida por venda;
- devolucao por cancelamento.

Vendas concorrentes devem bloquear o estoque necessario e nunca permitir saldo
negativo.

### Relatorios

- Periodo e data operacional.
- Operador.
- Sessao de caixa.
- Forma de pagamento.
- Vendas concluidas e canceladas.
- Produtos e quantidades.
- Divergencias de caixa.
- Consolidado diario de todos os vendedores.
- Exportacao CSV com os mesmos filtros e totais da interface.

## 6. Regras De Negocio

- Toda venda pertence ao caixa aberto do operador autenticado.
- O servidor deriva o operador da sessao autenticada.
- Cada operador possui no maximo um caixa aberto.
- Operadores diferentes podem trabalhar simultaneamente.
- O mesmo operador pode fechar e reabrir caixa no mesmo dia.
- Caixa fechado nao recebe vendas.
- Venda, itens, pagamento e baixa de estoque sao atomicos.
- Cancelamento mantem historico e devolve estoque.
- Produto nao altera estoque diretamente.
- Todo ajuste de estoque gera movimentacao.
- Fechamentos registram valores esperado, contado e divergencia.
- Operadores nao usam nem fecham caixas de outros operadores.
- Fechamentos administrativos registram o responsavel.
- Datas operacionais usam `America/Sao_Paulo`.

## 7. Banco De Dados Alvo

Tabelas principais:

- `profiles`
- `products`
- `categories`
- `cash_sessions`
- `sales`
- `sale_items`
- `payments`
- `stock_movements`

### `cash_sessions`

```txt
id
operator_id
business_date
opening_amount_in_cents
status
opened_at
closed_at
counted_amount_in_cents
expected_amount_in_cents
difference_amount_in_cents
closed_by
created_at
updated_at
```

Restricao central: indice unico parcial por `operator_id` quando o status for
`open`.

### `sales`

```txt
id
operator_id
cash_session_id
status
total_in_cents
completed_at
canceled_at
created_at
updated_at
```

### `sale_items`

```txt
id
sale_id
product_id
product_name
quantity
unit_price_in_cents
total_in_cents
created_at
```

### `payments`

```txt
id
sale_id
method
amount_in_cents
change_in_cents
created_at
```

### `stock_movements`

```txt
id
product_id
type
quantity_change
reason
sale_id
created_by
created_at
```

## 8. Seguranca

- Login obrigatorio.
- Autorizacao por perfil no servidor e no banco.
- RLS em todas as tabelas publicas.
- Escritas financeiras diretas bloqueadas.
- RPCs com `search_path` fixo e validacao de `auth.uid()`.
- Valores financeiros, identidade e timestamps recalculados ou derivados no
  servidor.
- Segredos somente em ambientes locais protegidos ou provedores autorizados.
- Nenhuma credencial em logs, commits, traces ou artefatos.
- Operacoes administrativas com auditoria.

## 9. Rotas Alvo

- `/login`
- `/dashboard`
- `/products`
- `/products/new`
- `/products/[id]/edit`
- `/pdv`
- `/sales`
- `/sales/[id]`
- `/cash/open`
- `/cash/close`
- `/stock`
- `/reports`
- `/settings`

As rotas `/events` e `/events/new` sao legadas e serao removidas no PR de
limpeza depois do corte funcional.

## 10. Estrategia De Evolucao

A reestruturacao segue o
[plano para loja fisica](plano-reestruturacao-loja-fisica.md) e o
[ADR 0001](adr/0001-loja-fisica-caixas-por-operador.md).

Ordem resumida:

1. formalizar contrato e arquitetura;
2. preparar banco compativel;
3. migrar relatorios;
4. desacoplar historico de vendas;
5. ativar caixa e PDV por operador;
6. remover eventos;
7. validar concorrencia e E2E multioperador;
8. reinicializar ambientes com protecoes;
9. promover a release.

Cada etapa deve manter o runtime funcional e passar os gates de qualidade.

## 11. Fora Do Escopo Atual

- Nota fiscal.
- Integracao direta com maquininha.
- Pagamento online.
- Aplicativo nativo.
- Sistema multi-loja.
- Controle contabil avancado.
- Impressao fiscal.
- Fechamento automatico de caixa sem conferencia humana.

## 12. Criterio De Produto Pronto

- Um operador abre, vende, fecha e reabre caixa no mesmo dia.
- Dois ou mais vendedores operam simultaneamente sem mistura financeira.
- O estoque permanece correto sob concorrencia.
- Cancelamentos mantem historico e compensam estoque.
- Relatorios consolidam e detalham caixas corretamente.
- O banco e a aplicacao nao dependem de eventos.
- Quality e E2E passam antes de cada promocao.
