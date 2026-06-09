# Plano De Execucao Incremental - Espaco Personalize PDV

Este plano quebra o desenvolvimento em entregas menores, coesas e testaveis. Cada etapa deve terminar com algo utilizavel ou validavel, evitando construir muitos modulos pela metade.

## Principios De Execucao

- Priorizar o MVP antes de melhorias.
- Entregar em fatias pequenas com criterio de pronto claro.
- Validar regras criticas no servidor.
- Usar Supabase com RLS desde o inicio.
- Manter mobile first em todas as telas.
- Evitar features fora do escopo inicial.

## Entrega 0 - Preparacao Do Projeto

Objetivo: deixar o projeto pronto para desenvolvimento.

Tarefas:
- Criar projeto Next.js com TypeScript.
- Configurar Tailwind CSS.
- Criar estrutura inicial de pastas.
- Configurar variaveis de ambiente.
- Criar projeto Supabase.
- Conectar app ao Supabase.
- Preparar repositorio GitHub privado.
- Configurar deploy inicial na Vercel.

Criterio de pronto:
- App abre localmente.
- App abre na Vercel.
- Tailwind funciona.
- Variaveis do Supabase estao configuradas sem expor secrets.

## Entrega 1 - Layout Base E Navegacao

Objetivo: criar a estrutura visual minima do sistema.

Tarefas:
- Criar layout autenticado.
- Criar navegacao principal.
- Criar tela inicial temporaria.
- Criar componentes base de botao, input, card simples e feedback.
- Aplicar paleta `#1e3275`, `#f5c313`, `#ffffff`.
- Garantir responsividade mobile first.

Criterio de pronto:
- Usuario consegue navegar entre rotas principais simuladas.
- Interface funciona bem em tela pequena.
- Componentes base estao reutilizaveis.

## Entrega 2 - Banco Inicial E Perfis

Objetivo: criar a base de dados para usuarios e permissoes.

Tarefas:
- Criar tabela `profiles`.
- Definir enum ou constraint de perfil: `admin`, `operator`.
- Criar trigger para gerar profile ao criar usuario.
- Ativar RLS em `profiles`.
- Criar policies para leitura e atualizacao segura.
- Criar tipos TypeScript basicos do dominio.

Criterio de pronto:
- Usuario autenticado possui profile.
- Admin e operador podem ser diferenciados.
- RLS esta ativa.

## Entrega 3 - Login

Objetivo: permitir acesso privado ao sistema.

Tarefas:
- Criar tela `/login`.
- Implementar login com e-mail e senha.
- Implementar logout.
- Proteger rotas autenticadas.
- Redirecionar usuario logado para `/dashboard`.
- Exibir erros de login em portugues.

Criterio de pronto:
- Usuario consegue entrar e sair.
- Rotas privadas bloqueiam acesso anonimo.
- Sessao persiste ao recarregar.

## Entrega 4 - Categorias

Objetivo: permitir organizacao simples dos produtos.

Tarefas:
- Criar tabela `categories`.
- Criar migration com campos principais.
- Ativar RLS.
- Criar tela `/categories` ou gerenciar categorias em `/settings`.
- Criar cadastro, edicao e inativacao.
- Popular categorias iniciais: chaveiros, vasos, decoracao, utilidades, personalizados, brinquedos, brindes, outros.

Criterio de pronto:
- Admin consegue cadastrar e editar categorias.
- Produtos poderao usar categorias.

## Entrega 5 - Produtos

Objetivo: cadastrar produtos vendaveis.

Tarefas:
- Criar tabela `products`.
- Criar campos: nome, categoria, SKU, preco, custo, estoque, estoque minimo, foto, ativo.
- Ativar RLS.
- Criar tela `/products`.
- Criar tela `/products/new`.
- Criar edicao de produto.
- Criar listagem com busca.
- Criar indicador de estoque baixo.

Criterio de pronto:
- Admin cadastra, edita e inativa produtos.
- Operador visualiza produtos ativos.
- Produto aparece pronto para venda no PDV.

## Entrega 6 - Eventos

Objetivo: preparar eventos para vincular vendas.

Tarefas:
- Criar tabela `events`.
- Criar campos: nome, data, local, status, observacoes.
- Ativar RLS.
- Criar tela `/events`.
- Criar tela `/events/new`.
- Criar edicao e alteracao de status.
- Definir evento ativo.

Criterio de pronto:
- Admin cadastra eventos.
- Sistema consegue identificar o evento ativo.
- Venda futura podera ser vinculada a um evento.

## Entrega 7 - Caixa Aberto

Objetivo: controlar inicio de turno/evento antes de vender.

Tarefas:
- Criar tabela `cash_sessions`.
- Criar status: aberto, fechado.
- Criar rota `/cash/open`.
- Permitir abrir caixa com evento, operador e valor inicial.
- Impedir dois caixas abertos conflitantes para o mesmo operador/evento quando necessario.
- Exibir caixa aberto no dashboard.

Criterio de pronto:
- Operador abre caixa.
- Sistema sabe qual caixa esta ativo.
- PDV pode exigir caixa aberto antes da venda.

## Entrega 8 - PDV Basico Com Carrinho

Objetivo: montar venda antes de salvar.

Tarefas:
- Criar tela `/pdv`.
- Selecionar evento ativo.
- Verificar caixa aberto.
- Buscar produtos ativos.
- Adicionar produto ao carrinho.
- Alterar quantidade.
- Remover item.
- Calcular subtotal.
- Bloquear quantidade maior que estoque disponivel.

Criterio de pronto:
- Operador monta carrinho completo no celular.
- Totais sao calculados corretamente.
- Ainda nao precisa finalizar venda.

## Entrega 9 - Finalizacao De Venda

Objetivo: registrar venda completa com pagamento.

Tarefas:
- Criar tabelas `sales`, `sale_items` e `payments`.
- Criar fluxo de finalizacao no servidor.
- Salvar venda, itens e pagamentos em transacao.
- Suportar pagamento por Pix, dinheiro, credito, debito, misto e cortesia.
- Calcular troco para dinheiro.
- Criar numero de venda.
- Exibir confirmacao de venda.

Criterio de pronto:
- Venda finalizada aparece em `/sales`.
- Venda possui itens e pagamento.
- Troco e total ficam corretos.

## Entrega 10 - Movimentacao De Estoque Por Venda

Objetivo: baixar estoque automaticamente com historico.

Tarefas:
- Criar tabela `stock_movements`.
- Criar tipos: entrada manual, saida por venda, ajuste, devolucao por cancelamento.
- Ao finalizar venda, criar movimentacao de saida.
- Atualizar estoque a partir da movimentacao.
- Impedir estoque negativo.
- Registrar operador, produto, venda e evento quando aplicavel.

Criterio de pronto:
- Toda venda reduz estoque.
- Toda reducao tem historico.
- Produto nao altera estoque diretamente fora do fluxo controlado.

## Entrega 11 - Lista E Detalhe De Vendas

Objetivo: consultar o que foi vendido.

Tarefas:
- Criar tela `/sales`.
- Criar tela `/sales/[id]`.
- Listar vendas por data, evento e status.
- Mostrar itens, pagamentos, operador e caixa.
- Criar resumo simples de total da venda.

Criterio de pronto:
- Admin e operador consultam vendas.
- Detalhe da venda permite auditoria basica.

## Entrega 12 - Cancelamento De Venda

Objetivo: cancelar sem apagar historico.

Tarefas:
- Criar acao de cancelamento no servidor.
- Alterar status da venda para cancelada.
- Criar movimentacao de devolucao por cancelamento.
- Devolver estoque.
- Registrar motivo e operador.
- Bloquear cancelamento duplicado.

Criterio de pronto:
- Venda cancelada continua visivel.
- Estoque volta corretamente.
- Historico de movimentacao fica completo.

## Entrega 13 - Fechamento De Caixa

Objetivo: conferir valores do turno/evento.

Tarefas:
- Criar rota `/cash/close`.
- Calcular totais esperados por forma de pagamento.
- Permitir informar valores conferidos.
- Calcular divergencia.
- Salvar observacoes.
- Fechar caixa.
- Bloquear novas vendas em caixa fechado.

Criterio de pronto:
- Operador fecha caixa.
- Sistema mostra esperado, informado e divergencia.
- Caixa fechado nao recebe novas vendas.

## Entrega 14 - Estoque Manual

Objetivo: permitir entradas e ajustes controlados.

Tarefas:
- Criar tela `/stock`.
- Listar produtos e quantidades.
- Mostrar historico de movimentacoes.
- Criar entrada manual.
- Criar ajuste de estoque.
- Exigir motivo para ajuste.
- Alertar estoque baixo.

Criterio de pronto:
- Admin ajusta estoque sem editar produto diretamente.
- Todo ajuste gera movimentacao.

## Entrega 15 - Dashboard MVP

Objetivo: mostrar resumo operacional util.

Tarefas:
- Criar tela `/dashboard`.
- Mostrar vendas do dia.
- Mostrar vendas do evento atual.
- Mostrar totais por forma de pagamento.
- Mostrar produtos mais vendidos.
- Mostrar estoque baixo.
- Mostrar caixa aberto/fechado.

Criterio de pronto:
- Dashboard ajuda a operar o evento.
- Dados batem com vendas e caixa.

## Entrega 16 - Relatorio Por Evento

Objetivo: entregar a primeira analise pos-evento.

Tarefas:
- Criar tela `/reports`.
- Filtrar por evento.
- Mostrar total vendido.
- Mostrar total por pagamento.
- Mostrar produtos vendidos.
- Mostrar lucro estimado.
- Exportar CSV do evento.

Criterio de pronto:
- Admin gera relatorio de evento.
- CSV pode ser baixado.

## Entrega 17 - PWA Basico

Objetivo: permitir uso com aparencia de app.

Tarefas:
- Criar manifest.
- Criar icones.
- Configurar nome e tema.
- Configurar tela inicial.
- Validar instalacao mobile.
- Ajustar metadados.

Criterio de pronto:
- Sistema pode ser instalado no celular.
- Visual mobile fica consistente.

## Entrega 18 - QA Do MVP

Objetivo: validar o fluxo completo antes de uso real.

Tarefas:
- Testar login e logout.
- Testar cadastro de produto.
- Testar cadastro de evento.
- Testar abertura de caixa.
- Testar venda com Pix.
- Testar venda com dinheiro e troco.
- Testar venda mista.
- Testar baixa de estoque.
- Testar cancelamento.
- Testar fechamento de caixa.
- Testar relatorio por evento.
- Testar exportacao CSV.

Criterio de pronto:
- Fluxo principal funciona de ponta a ponta.
- Erros criticos corrigidos.
- MVP esta pronto para primeiro evento real.

## Ordem Recomendada

1. Entrega 0 - Preparacao Do Projeto.
2. Entrega 1 - Layout Base E Navegacao.
3. Entrega 2 - Banco Inicial E Perfis.
4. Entrega 3 - Login.
5. Entrega 4 - Categorias.
6. Entrega 5 - Produtos.
7. Entrega 6 - Eventos.
8. Entrega 7 - Caixa Aberto.
9. Entrega 8 - PDV Basico Com Carrinho.
10. Entrega 9 - Finalizacao De Venda.
11. Entrega 10 - Movimentacao De Estoque Por Venda.
12. Entrega 11 - Lista E Detalhe De Vendas.
13. Entrega 12 - Cancelamento De Venda.
14. Entrega 13 - Fechamento De Caixa.
15. Entrega 14 - Estoque Manual.
16. Entrega 15 - Dashboard MVP.
17. Entrega 16 - Relatorio Por Evento.
18. Entrega 17 - PWA Basico.
19. Entrega 18 - QA Do MVP.

## Primeiro Marco Real

O primeiro marco deve ser:

```txt
Login + Produtos + Eventos + Caixa aberto + PDV basico + Venda finalizada + Baixa de estoque
```

Com isso, o sistema ja pode ser testado em uma venda simulada de evento.
