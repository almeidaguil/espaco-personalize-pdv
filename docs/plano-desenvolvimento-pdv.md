# Plano De Desenvolvimento - Sistema PDV Para Loja De Impressao 3D

## 1. Objetivo

Criar um sistema online, mobile first, privado, para controlar vendas presenciais em eventos, estoque, formas de pagamento, caixa e relatorios da loja de impressao 3D.

Nome do projeto: **Espaco Personalize PDV**.

## 2. Arquitetura Geral

```txt
Usuario
->
Celular / MacBook / Windows
->
Sistema Web/PWA
->
Vercel
->
Next.js
->
Supabase
->
Banco de dados + Login + Seguranca
```

## 3. Tecnologias

- Frontend: Next.js, React e TypeScript.
- Estilo visual: Tailwind CSS.
- Banco de dados: Supabase Postgres.
- Login: Supabase Auth com e-mail e senha.
- Hospedagem: Vercel.
- Repositorio: GitHub privado.
- App no celular: PWA instalavel.

## 4. Modulos

### Login E Usuarios

Funcoes:
- Login.
- Logout.
- Recuperacao de senha.
- Perfis de acesso.

Perfis:
- Admin: controla tudo.
- Operador: faz vendas, abre e fecha caixa, visualiza produtos.

### Dashboard

Resumo inicial:
- Vendas do dia.
- Vendas do evento atual.
- Total em dinheiro.
- Total em Pix.
- Total em cartao.
- Produtos mais vendidos.
- Estoque baixo.

### Produtos

Campos:
- Nome.
- Categoria.
- Preco de venda.
- Custo.
- Lucro estimado.
- Estoque.
- SKU/codigo.
- Foto.
- Ativo/inativo.

### Categorias

Categorias iniciais:
- Chaveiros.
- Vasos.
- Decoracao.
- Utilidades.
- Personalizados.
- Brinquedos.
- Brindes.
- Outros.

### Eventos

Cada venda deve ser vinculada a um evento.

Exemplos:
- Feira Junho 2026.
- Congresso de Psicologia.
- Loja online.
- Venda avulsa.

Campos:
- Nome.
- Data.
- Local.
- Status.
- Observacoes.

### PDV

Tela principal de operacao.

Funcoes:
- Selecionar evento ativo.
- Buscar produto.
- Adicionar ao carrinho.
- Alterar quantidade.
- Remover item.
- Aplicar desconto.
- Escolher forma de pagamento.
- Calcular troco.
- Finalizar venda.
- Baixar estoque automaticamente.

Formas de pagamento:
- Pix.
- Dinheiro.
- Cartao de credito.
- Cartao de debito.
- Misto.
- Cortesia.

### Caixa

Controle de caixa por evento/turno.

Funcoes:
- Abrir caixa.
- Informar valor inicial.
- Registrar vendas.
- Fechar caixa.
- Comparar valores esperados.
- Adicionar observacoes.

No fechamento:
- Dinheiro esperado.
- Pix recebido.
- Cartao recebido.
- Total vendido.
- Descontos.
- Divergencia.
- Observacoes.

### Vendas

Cada venda salva:
- Numero da venda.
- Data e hora.
- Operador.
- Evento.
- Produtos.
- Quantidades.
- Subtotal.
- Desconto.
- Total.
- Forma de pagamento.
- Valor recebido.
- Troco.
- Status.

Status:
- Concluida.
- Cancelada.

Ao cancelar uma venda:
- O estoque volta automaticamente.
- A venda continua registrada como cancelada.

### Estoque

O estoque deve ser controlado por movimentacoes.

Tipos:
- Entrada manual.
- Saida por venda.
- Ajuste.
- Devolucao por cancelamento.

Regra central: produto nunca altera estoque diretamente. Todo ajuste gera movimentacao.

### Relatorios

Relatorios essenciais:
- Vendas por dia.
- Vendas por evento.
- Vendas por produto.
- Vendas por forma de pagamento.
- Lucro estimado.
- Estoque baixo.
- Produtos mais vendidos.

Exportacoes:
- CSV de vendas.
- CSV de produtos.
- CSV de estoque.
- CSV do evento.

## 5. Banco De Dados

Tabelas principais:
- `profiles`
- `products`
- `categories`
- `events`
- `cash_sessions`
- `sales`
- `sale_items`
- `payments`
- `stock_movements`

### products

```txt
id
name
category_id
sku
price
cost
stock_quantity
min_stock
image_url
active
created_at
```

### sales

```txt
id
event_id
operator_id
cash_session_id
subtotal
discount
total
status
created_at
```

### sale_items

```txt
id
sale_id
product_id
quantity
unit_price
total
```

### payments

```txt
id
sale_id
method
amount
received_amount
change_amount
```

### stock_movements

```txt
id
product_id
type
quantity
reason
sale_id
created_at
```

## 6. Seguranca

Medidas obrigatorias:
- Login obrigatorio.
- Permissoes por perfil.
- Row Level Security no banco.
- Usuarios comuns nao acessam dados diretamente.
- Registro de cancelamentos.
- Backup/exportacao.
- Variaveis secretas protegidas na Vercel.

## 7. Fases De Desenvolvimento

### Fase 1 - Base Do Projeto

Criar:
- Projeto Next.js.
- Tailwind.
- Conexao com Supabase.
- GitHub privado.
- Deploy na Vercel.
- Layout base.
- Login.

Resultado: sistema online com login funcionando.

### Fase 2 - Cadastros

Criar:
- Produtos.
- Categorias.
- Eventos.
- Usuarios/perfis.

Resultado: cadastro de produtos e preparacao de evento.

### Fase 3 - PDV

Criar:
- Tela de venda.
- Carrinho.
- Desconto.
- Pagamento.
- Troco.
- Finalizacao.
- Baixa automatica de estoque.

Resultado: sistema pronto para vender em evento.

### Fase 4 - Caixa

Criar:
- Abertura de caixa.
- Fechamento de caixa.
- Resumo por forma de pagamento.
- Conferencia de valores.

Resultado: controle financeiro basico do evento.

### Fase 5 - Estoque

Criar:
- Historico de movimentacoes.
- Entrada manual.
- Ajuste.
- Estoque minimo.
- Alerta de estoque baixo.

Resultado: controle real dos produtos.

### Fase 6 - Relatorios

Criar:
- Relatorio diario.
- Relatorio por evento.
- Relatorio por produto.
- Relatorio por pagamento.
- Exportacao CSV.

Resultado: analise do evento depois da venda.

### Fase 7 - PWA

Criar:
- Instalacao no celular.
- Icone.
- Tela inicial.
- Otimizacao mobile.

Resultado: sistema com experiencia de app.

## 8. Telas Principais

```txt
/login
/dashboard
/products
/products/new
/events
/events/new
/pdv
/sales
/sales/[id]
/cash/open
/cash/close
/stock
/reports
/settings
```

## 9. MVP Ideal

A primeira versao util deve ter:
- Login.
- Cadastro de produtos.
- Cadastro de eventos.
- PDV.
- Pagamento.
- Troco.
- Baixa de estoque.
- Vendas registradas.
- Relatorio por evento.
- Exportacao CSV.

## 10. Fora Do Escopo Inicial

Nao fazer na primeira versao:
- Nota fiscal.
- Integracao com maquininha.
- Pagamento online.
- App nativo.
- Sistema multi-loja complexo.
- Controle financeiro avancado.
- Impressao de recibo.
- Leitor de codigo de barras.

## Resumo Da Arquitetura

```txt
Next.js
TypeScript
Tailwind
Supabase Auth
Supabase Postgres
Supabase Storage
Vercel
GitHub privado
PWA
CSV Export
```
