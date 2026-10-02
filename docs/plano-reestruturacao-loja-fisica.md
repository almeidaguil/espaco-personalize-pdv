# Plano De Reestruturacao Para Loja Fisica

## 1. Objetivo

Adaptar o Espaco Personalize PDV para a operacao permanente da Roberto
Multimarcas, removendo o conceito de eventos e adotando caixas independentes
por vendedor.

O resultado esperado e um PDV de loja fisica em que cada vendedor abre o
proprio caixa, realiza somente vendas vinculadas a esse caixa e o fecha com
reconciliacao financeira. Varios vendedores podem operar simultaneamente.

## 2. Decisoes Confirmadas

- O modulo de eventos sera removido integralmente da aplicacao.
- Os dados atuais podem ser descartados porque pertencem a outra operacao.
- A Roberto Multimarcas usara projetos novos e isolados na Vercel e no
  Supabase, sujeitos a validacao de quota e custo antes da criacao.
- Os projetos da Espaco Personalize permanecerao intactos ate o corte ser
  validado e o periodo de rollback terminar.
- Cada vendedor pode ter no maximo um caixa aberto por vez.
- Vendedores diferentes podem manter caixas abertos simultaneamente.
- Um vendedor pode abrir e fechar varias sessoes no mesmo dia.
- Cada venda pertence obrigatoriamente a uma sessao de caixa e ao operador
  autenticado.
- O PDV usa automaticamente o caixa aberto do usuario atual; nao existe selecao
  manual de evento ou de caixa de outro vendedor.
- Administradores podem consultar todos os caixas e executar fechamento
  administrativo, sempre com auditoria.
- Valores monetarios permanecem armazenados em centavos.
- A data operacional usa o fuso `America/Sao_Paulo`.

## 3. Glossario E Fluxo Alvo

- **Vendedor ou operador:** usuario autenticado responsavel por suas vendas e
  sessoes de caixa.
- **Sessao de caixa:** ciclo auditavel entre abertura e fechamento.
- **Caixa aberto:** unica sessao com status `open` para determinado operador.
- **Data operacional:** data da abertura calculada no servidor em
  `America/Sao_Paulo`.
- **Fechamento administrativo:** encerramento excepcional de caixa alheio por
  um administrador, com autoria registrada.
- **Ambiente legado:** projeto ainda associado a Espaco Personalize.
- **Ambiente Roberto:** projeto novo, vazio e exclusivo da Roberto Multimarcas.

```txt
Login do vendedor
->
Localizar o proprio caixa aberto
->
Abrir caixa, se necessario
->
Registrar vendas no proprio caixa
->
Fechar e reconciliar a sessao
->
Opcionalmente abrir outra sessao no mesmo dia
```

## 4. Regras De Negocio Alvo

### 4.1 Abertura De Caixa

- A abertura exige usuario autenticado e ativo.
- O operador informa somente o valor inicial.
- `operator_id`, `opened_at` e `business_date` sao definidos no servidor.
- Uma restricao unica parcial impede duas sessoes abertas para o mesmo
  operador.
- A restricao nao impede novas sessoes depois que a anterior for fechada,
  inclusive no mesmo dia.
- A operacao deve ser atomica para impedir duas aberturas concorrentes pelo
  mesmo operador.

### 4.2 Operacao Simultanea

- Cada operador enxerga e utiliza o proprio caixa aberto.
- Um operador nao pode registrar venda, alterar ou fechar o caixa de outro.
- Administradores enxergam todos os caixas abertos e seus responsaveis.
- Estoque continua compartilhado por toda a loja.
- Vendas concorrentes devem manter a protecao contra estoque negativo.

### 4.3 Venda

- Nao existe `event_id` na intencao de venda.
- A venda exige um caixa aberto pertencente ao usuario autenticado.
- O servidor deriva `operator_id` a partir de `auth.uid()`.
- O servidor valida caixa aberto, produtos, estoque, precos, total, pagamento e
  troco dentro da mesma transacao.
- Venda concluida gera pagamento e movimentacoes de estoque.
- Caixa fechado rejeita novas vendas.
- Cancelamento preserva o historico e devolve o estoque.

### 4.4 Fechamento De Caixa

- O operador pode fechar o proprio caixa.
- O administrador pode fechar o caixa de outro operador em contingencia.
- O fechamento registra responsavel, data, valor esperado, valor contado e
  diferenca.
- O valor esperado em dinheiro considera saldo inicial, pagamentos em dinheiro
  liquidos de troco e cancelamentos.
- Pix, credito e debito aparecem na conciliacao, mas nao compoem o dinheiro
  fisico esperado.
- Falta de caixa mantem a validacao administrativa ja adotada pelo sistema.
- O fechamento e idempotente: uma sessao fechada nao pode ser fechada outra vez.

### 4.5 Relatorios

- Os filtros principais passam a ser periodo, data operacional, operador,
  sessao de caixa, status e forma de pagamento.
- O relatorio diario consolida todos os caixas e tambem permite detalhamento
  individual.
- A exportacao CSV usa os mesmos filtros e totais exibidos na tela.
- Relatorios administrativos incluem vendas concluidas, canceladas, produtos,
  pagamentos e divergencias de caixa.

## 5. Modelo De Dados Alvo

### `cash_sessions`

- `id uuid primary key`
- `operator_id uuid not null`
- `business_date date not null`
- `opening_amount_in_cents integer not null`
- `status cash_session_status not null`
- `opened_at timestamptz not null`
- `closed_at timestamptz null`
- `counted_amount_in_cents integer null`
- `expected_amount_in_cents integer null`
- `difference_amount_in_cents integer null`
- `closed_by uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Restricao principal:

```sql
create unique index cash_sessions_one_open_per_operator_idx
  on public.cash_sessions(operator_id)
  where status = 'open';
```

Indices adicionais:

- `(business_date, opened_at desc)`
- `(operator_id, business_date, opened_at desc)`
- `(status, opened_at desc)`

### `sales`

- Remover `event_id`.
- Manter `cash_session_id` e `operator_id` obrigatorios.
- Garantir na RPC que venda, sessao e usuario autenticado representam o mesmo
  operador.
- Indexar `(completed_at desc)`, `(operator_id, completed_at desc)` e
  `(cash_session_id, completed_at desc)`.

### `events`

- Remover FKs e indices dependentes.
- Remover funcoes e policies exclusivas de eventos.
- Remover a tabela somente depois que a aplicacao nao possuir mais nenhuma
  dependencia de runtime.
- Manter migrations historicas imutaveis; a remocao ocorre em uma nova
  migration.

### RPCs Financeiras

As operacoes criticas devem ocorrer no banco, com validacao de autenticacao e
transacao:

- `open_cash_session`
- `close_cash_session`
- `finalize_sale`
- `cancel_sale`

As RPCs nao devem confiar em `operator_id`, datas ou totais enviados pelo
frontend quando esses valores puderem ser derivados no servidor.

## 6. Infraestrutura Alvo

Projetos propostos:

- Vercel: `roberto-multimarcas-pdv`.
- URL de producao esperada: `roberto-multimarcas-pdv.vercel.app`, sujeita a
  disponibilidade no momento da criacao.
- Supabase staging: `roberto-multimarcas-pdv-staging`.
- Supabase producao: `roberto-multimarcas-pdv`.

O endpoint do Supabase usa um project ref aleatorio e nao oferece uma URL de API
com o nome comercial. O link publico com a marca sera o dominio da aplicacao na
Vercel; um dominio personalizado podera ser configurado separadamente.

Politica de provisionamento:

- validar conta, organizacao, regiao, tamanho e eventual custo antes de criar;
- usar `sa-east-1` como regiao preferencial para novos bancos, salvo restricao
  tecnica ou comercial documentada;
- gerar senhas novas e nunca reutilizar credenciais da operacao anterior;
- manter staging e producao em projetos distintos;
- aplicar migrations primeiro em staging;
- conectar producao somente no PR de release;
- preservar os projetos antigos sem novas escritas durante a janela de
  rollback;
- desativar projetos antigos apenas em uma etapa posterior e explicitamente
  autorizada.

## 7. Estrategia De Entrega

A mudanca sera entregue de forma compativel e incremental. Primeiro entram as
estruturas aditivas; depois as consultas independentes de evento; em seguida o
fluxo operacional muda; por ultimo o legado e removido.

Cada PR deve:

- nascer de `develop` atualizado em uma branch `feature/*`;
- possuir escopo unico e reversivel;
- manter build e aplicacao funcionais;
- incluir testes do comportamento alterado;
- passar formatacao, lint, TypeScript, unitarios, build e E2E aplicavel;
- usar commits assinados e Conventional Commits;
- ser integrado em `develop` somente depois dos checks obrigatorios.

Dependencias:

```txt
PR 01
  -> PR 02
       -> PR 03
       -> PR 04
            -> PR 05
                 -> PR 06
                      -> PR 07
                           -> PR 08
                                -> PR 09
```

## 8. Plano Por Pull Request

### PR 01 - Contrato Da Reestruturacao

Objetivo: registrar as decisoes antes de alterar runtime ou banco.

Tarefas:

- [x] Aprovar este plano e as regras de negocio.
- [x] Criar ADR para a mudanca de eventos para sessoes por operador.
- [x] Atualizar o plano de desenvolvimento e o plano incremental.
- [x] Atualizar diagramas, rotas alvo e glossario.
- [x] Registrar a estrategia de provisionamento e rollback dos ambientes.
- [x] Atualizar README, instrucoes de agentes, ambientes e padroes tecnicos.

Testes e aceite:

- [x] Documentacao sem links quebrados.
- [x] Nenhuma alteracao funcional.
- [x] Dependencias e ordem dos proximos PRs explicitadas.

### PR 02 - Banco Aditivo E Compativel

Objetivo: preparar o banco para o novo modelo sem quebrar a versao atual.

Tarefas:

- [x] Adicionar `business_date` a `cash_sessions`, calculado no fuso da loja.
- [x] Permitir `event_id` nulo temporariamente em `cash_sessions` e `sales`.
- [x] Criar indices por data, operador e sessao.
- [x] Criar as novas versoes transacionais das RPCs de abertura e venda.
- [x] Fazer o servidor derivar usuario e timestamps.
- [x] Preservar temporariamente as RPCs antigas para compatibilidade.
- [x] Preparar a restricao de um caixa aberto por operador.
- [x] Revisar grants, RLS e `search_path` de todas as funcoes financeiras.

Testes e aceite:

- [x] `supabase db reset` aplica todas as migrations do zero.
- [x] A aplicacao atual continua operando durante a transicao.
- [x] Duas aberturas concorrentes para o mesmo operador resultam em uma unica
      sessao aberta.
- [x] Dois operadores diferentes conseguem abrir caixas simultaneamente.
- [x] Escritas financeiras diretas continuam bloqueadas.

Rollback:

- o rollback preferencial e logico: a aplicacao antiga continua usando as RPCs
  e colunas legadas preservadas;
- antes de remover as RPCs, triggers e indices novos, deve-se revogar sua
  execucao e confirmar que nenhum fluxo ativo depende deles;
- `event_id` so pode voltar a `not null` depois de associar ou remover
  explicitamente todas as sessoes e vendas sem evento;
- grants e policies anteriores so podem ser restaurados durante uma janela
  controlada, pois reabrem escritas e leituras que este PR restringe.

### PR 03 - Relatorios Por Periodo, Operador E Caixa

Objetivo: remover a dependencia de eventos do modulo de relatorios antes do
corte operacional.

Tarefas:

- [x] Criar repositorio e caso de uso de relatorio por periodo.
- [x] Adicionar filtros por `business_date`, operador e sessao.
- [x] Consolidar pagamentos, produtos, vendas e cancelamentos.
- [x] Exibir divergencias por caixa.
- [x] Substituir o CSV por exportacao baseada nos novos filtros.
- [x] Manter consultas paginadas e indices compativeis.
- [x] Remover nomes `SalesByEvent*` do codigo ativo.

Testes e aceite:

- [x] Totais da tela e CSV sao identicos.
- [x] Relatorio diario soma corretamente varios caixas simultaneos.
- [x] Relatorio individual nao mistura vendas entre operadores.
- [x] Cancelamentos sao exibidos sem inflar receita liquida.

### PR 04 - Vendas E Historico Sem Eventos

Objetivo: desacoplar listagem, detalhe e cancelamento de vendas do modulo de
eventos, ainda sem mudar a abertura de caixa no frontend.

Tarefas:

- [ ] Remover `eventId` dos contratos de dominio e aplicacao de vendas.
- [ ] Alterar repositorios para consultar por data, operador e caixa.
- [ ] Atualizar lista e detalhe de vendas.
- [ ] Atualizar cancelamento e reposicao de estoque.
- [ ] Remover textos e filtros de evento dessas telas.
- [ ] Manter compatibilidade de leitura com registros criados pelo fluxo antigo.

Testes e aceite:

- [ ] Lista e detalhe funcionam sem carregar `events`.
- [ ] Cancelamento continua exigindo autorizacao e devolvendo estoque.
- [ ] Venda permanece rastreavel ate operador e sessao de caixa.

### PR 05 - Corte Operacional Do Caixa E PDV

Objetivo: ativar o fluxo definitivo da Roberto Multimarcas.

Tarefas:

- [ ] Remover evento do dominio, validacao, formulario e repositorio de caixa.
- [ ] Abrir caixa apenas com valor inicial.
- [ ] Aplicar a restricao unica parcial por operador.
- [ ] Permitir nova abertura depois do fechamento, inclusive no mesmo dia.
- [ ] Fazer o PDV localizar automaticamente o caixa aberto do usuario.
- [ ] Bloquear o PDV quando o usuario nao possuir caixa aberto.
- [ ] Remover seletor de evento e seletor manual de caixa.
- [ ] Finalizar vendas pela nova RPC sem `event_id`.
- [ ] Atualizar dashboard com "Meu caixa" e, para admin, "Caixas abertos".
- [ ] Identificar cada caixa por vendedor, horario de abertura e sessao.
- [ ] Garantir que o operador nao use nem feche caixa alheio.
- [ ] Preservar fechamento administrativo auditado.

Testes e aceite:

- [ ] Mesmo operador nao consegue abrir dois caixas simultaneos.
- [ ] Mesmo operador fecha e reabre caixa no mesmo dia.
- [ ] Dois operadores abrem caixas e vendem simultaneamente.
- [ ] Cada venda fica no caixa correto.
- [ ] Fechar um caixa nao interrompe o caixa de outro operador.
- [ ] Tentativas cruzadas retornam erro de autorizacao.
- [ ] Estoque nao fica negativo em vendas concorrentes.

### PR 06 - Remocao Completa De Eventos

Objetivo: eliminar o legado depois que nenhum fluxo depender dele.

Tarefas:

- [ ] Remover `/events` e `/events/new`.
- [ ] Remover o modulo `src/modules/events`.
- [ ] Remover eventos da navegacao, dashboard e mensagens.
- [ ] Remover testes e fixtures exclusivas de eventos.
- [ ] Remover `event_id` de `cash_sessions` e `sales`.
- [ ] Remover FKs, indices, policies, RPCs e tipos legados.
- [ ] Remover a tabela `events`.
- [ ] Atualizar documentacao, manual e runbook.

Testes e aceite:

- [ ] Nenhuma dependencia de runtime referencia evento.
- [ ] URLs antigas retornam `404` controlado ou redirecionamento documentado.
- [ ] Banco novo e banco migrado chegam ao mesmo schema final.
- [ ] Build, testes unitarios e E2E passam sem fixtures de evento.

### PR 07 - E2E Multioperador E Concorrencia

Objetivo: provar os fluxos reais com usuarios independentes antes do reset
remoto.

Tarefas:

- [ ] Criar seed local idempotente com um admin e dois operadores.
- [ ] Usar contextos de navegador separados por usuario.
- [ ] Substituir a limpeza por update direto por preparacao via RPCs ou reset do
      ambiente isolado.
- [ ] Fazer o setup falhar explicitamente quando nao conseguir preparar dados.
- [ ] Cobrir abertura simultanea de caixas.
- [ ] Cobrir bloqueio da segunda abertura para o mesmo usuario.
- [ ] Cobrir fechamento e reabertura no mesmo dia.
- [ ] Cobrir vendas simultaneas no estoque compartilhado.
- [ ] Cobrir isolamento de caixa e fechamento administrativo.
- [ ] Cobrir relatorio diario consolidado e por operador.
- [ ] Atualizar o gate E2E de release.
- [ ] Publicar traces e relatorios como artefatos quando houver falha.

Testes e aceite:

- [ ] Suite completa passa localmente contra Supabase reinicializado.
- [ ] Gate remoto passa em ambiente isolado.
- [ ] Testes nao dependem de ordem nem de dados preexistentes.
- [ ] Falhas preservam traces sem registrar credenciais.

### PR 08 - Provisionamento E Bootstrap Roberto Multimarcas

Objetivo: criar os ambientes novos e preparar o bootstrap sem alterar os
projetos legados.

Tarefas:

- [ ] Validar quota, regiao, tamanho e custo com o responsavel.
- [ ] Criar projetos Supabase exclusivos de staging e producao.
- [ ] Criar projeto Vercel `roberto-multimarcas-pdv`.
- [ ] Validar a URL `roberto-multimarcas-pdv.vercel.app` ou definir alternativa.
- [ ] Vincular o repositorio GitHub ao novo projeto Vercel.
- [ ] Criar runbook de provisionamento, backup, validacao e rollback.
- [ ] Exigir identificacao explicita do projeto antes de qualquer operacao
      remota.
- [ ] Implementar modo `dry-run` para as validacoes previas.
- [ ] Inventariar dados, usuarios e storage que permanecerao nos projetos
      legados.
- [ ] Recriar somente o administrador inicial da Roberto Multimarcas.
- [ ] Definir o processo seguro para cadastrar vendedores.
- [ ] Preparar carga inicial de produtos e estoque separadamente.
- [ ] Validar RLS e RPCs depois do bootstrap.

Testes e aceite:

- [ ] Banco local reproduz o ambiente novo do zero.
- [ ] Staging novo e inicializado e aprovado antes de producao.
- [ ] O procedimento recusa project refs nao autorizados.
- [ ] Nenhuma credencial e gravada no repositorio ou em logs.

Observacao: criacao, alteracao de plano, exclusao ou desativacao de projeto e
uma etapa operacional que exige confirmacao explicita e verificacao de eventual
custo. Os projetos antigos nao serao excluidos neste PR.

### PR 09 - Release E Corte De Producao

Objetivo: publicar o novo modelo com verificacao ponta a ponta.

Tarefas:

- [ ] Congelar alteracoes concorrentes durante a janela de corte.
- [ ] Registrar backup tecnico dos projetos legados.
- [ ] Inicializar o novo staging e executar smoke, E2E e reconciliacao.
- [ ] Abrir PR de release de `develop` para `main`.
- [ ] Exigir Quality, E2E Release Gate e commits assinados.
- [ ] Inicializar a nova producao conforme o runbook aprovado.
- [ ] Criar admin e vendedores reais sem expor senhas.
- [ ] Cadastrar produtos e estoque inicial.
- [ ] Executar venda, cancelamento, fechamento e relatorio de verificacao.
- [ ] Monitorar logs e erros depois do corte.
- [ ] Manter o ambiente legado disponivel apenas para rollback durante o prazo
      aprovado.

Testes e aceite:

- [ ] Um operador abre, vende, fecha e reabre no mesmo dia.
- [ ] Dois vendedores operam caixas simultaneamente sem mistura financeira.
- [ ] Relatorio consolidado confere com as sessoes individuais.
- [ ] Estoque confere depois de venda e cancelamento.
- [ ] Quality e E2E permanecem verdes depois do deploy.

## 9. Matriz Minima De Testes

| Area         | Cenario obrigatorio                           | Nivel                      |
| ------------ | --------------------------------------------- | -------------------------- |
| Caixa        | primeira abertura do operador                 | Unitario, integracao e E2E |
| Caixa        | segunda abertura simultanea do mesmo operador | Banco e E2E                |
| Caixa        | caixas simultaneos de operadores diferentes   | Banco e E2E                |
| Caixa        | fechamento e reabertura no mesmo dia          | Unitario e E2E             |
| Caixa        | fechamento duplicado                          | Banco e unitario           |
| Seguranca    | operador acessa caixa alheio                  | RLS, RPC e E2E             |
| Venda        | venda sem caixa aberto                        | Unitario e E2E             |
| Venda        | venda vinculada ao caixa do usuario           | Banco e E2E                |
| Venda        | caixa fecha durante tentativa de venda        | Concorrencia               |
| Estoque      | dois vendedores disputam o ultimo item        | Concorrencia               |
| Cancelamento | estoque e financeiro sao compensados          | Integracao e E2E           |
| Relatorio    | consolidacao de varios caixas no dia          | Unitario e E2E             |
| Relatorio    | filtro por vendedor e sessao                  | Unitario e E2E             |
| CSV          | mesmos totais da interface                    | Integracao                 |
| Reset        | ambiente vazio recebe schema e seed           | Integracao                 |

## 10. Gates Obrigatorios Por PR

```text
npm run format:check
npm run lint
npm run type-check
npm run test
npm run test:db
npm run build
npm run test:e2e:required
```

PRs com migration tambem exigem:

- `supabase db reset` em ambiente local;
- validacao de constraints, indices, grants e RLS;
- smoke das RPCs com usuario admin e operador;
- verificacao de que nenhuma chave real foi versionada.

O workflow `Quality` inicia um Supabase local efemero e executa `npm run
test:db` para PRs destinados a `develop` ou `main`. O Playwright completo
permanece no gate de release; ate o PR 07 ampliar sua automacao, PRs 02 a 06
devem registrar no corpo do pull request a execucao local de `npm run
test:e2e:required`. O comando `npm run test:e2e` isolado nao e gate, porque pode
pular fluxos autenticados quando faltam credenciais.

## 11. Decisoes Aprovadas Para O PR 02

As definicoes abaixo foram aprovadas em 2 de outubro de 2026 e passam a compor
o contrato da reestruturacao:

1. O administrador pode abrir o proprio caixa e vender, sujeito a mesma regra
   de apenas um caixa aberto por usuario.
2. Uma sessao pode atravessar a meia-noite e permanece vinculada a
   `business_date` calculada no momento da abertura no fuso
   `America/Sao_Paulo`.
3. Cancelamento depois do fechamento gera um ajuste financeiro separado e nao
   reescreve o resumo historico do fechamento.
4. Operadores consultam apenas os proprios caixas e vendas; administradores
   podem consultar todos.
5. Dinheiro, Pix, credito e debito permanecem atribuidos individualmente a
   venda, ao operador e ao caixa, mesmo quando a conta ou terminal fisico e
   compartilhado pela loja.
6. Os projetos Supabase alvo devem usar `sa-east-1` e o menor tamanho
   disponivel. Nenhum recurso pago pode ser criado sem autorizacao especifica.
7. A URL inicial sera `roberto-multimarcas-pdv.vercel.app`; um dominio
   personalizado pode ser associado posteriormente.

## 12. Criterio De Conclusao Da Reestruturacao

A missao somente estara concluida quando:

- eventos nao existirem no runtime, navegacao ou schema final;
- cada operador tiver no maximo um caixa aberto;
- o mesmo operador puder ter varias sessoes fechadas no mesmo dia;
- varios operadores venderem simultaneamente em caixas isolados;
- estoque, pagamentos, cancelamentos e reconciliacao forem atomicos;
- relatorios funcionarem por periodo, operador e sessao;
- bancos estiverem reinicializados para a Roberto Multimarcas;
- toda a matriz de testes estiver automatizada e verde;
- a documentacao operacional refletir exclusivamente a loja fisica.
- a aplicacao publica usar URL e projetos exclusivos da Roberto Multimarcas.
