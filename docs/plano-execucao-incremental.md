# Plano De Execucao Incremental - Roberto Multimarcas PDV

## Estado Atual

O sistema opera integralmente em produção com a versão `v2.1.0`.
Todas as entregas incrementais planejadas (Entregas 1 a 9), incluindo o
provisionamento de staging isolado (PR08), o corte de produção preservando dados
operacionais (PR09), os pagamentos divididos com reconciliação financeira (v2.0.0)
e a adição de estoque inicial no cadastro de produtos (v2.1.0), foram
concluídas e homologadas com sucesso.

O detalhamento de tarefas e criterios esta no
[plano de reestruturacao](plano-reestruturacao-loja-fisica.md). A decisao
arquitetural esta no
[ADR 0001](adr/0001-loja-fisica-caixas-por-operador.md).

As entregas antigas permanecem no historico do Git. Este documento substitui a
ordem anterior para impedir novas implementacoes baseadas em eventos.

## Principios De Execucao

- Manter o runtime funcional depois de cada merge.
- Fazer mudancas de banco aditivas antes de remover o legado.
- Nao reescrever migrations aplicadas.
- Separar staging e producao.
- Testar autorizacao no banco, nao apenas mocks.
- Testar concorrencia com clientes autenticados independentes.
- Atualizar documentos operacionais junto da funcionalidade implantada.
- Nao executar operacoes destrutivas remotas sem confirmacao do ambiente.
- Promover `develop` para `main` somente com Quality e E2E aprovados.

## Entrega 1 - Contrato E Arquitetura

Objetivo: eliminar contradicoes antes das alteracoes funcionais.

Escopo:

- plano de desenvolvimento alvo;
- plano de reestruturacao por PR;
- ADR de caixas por operador;
- instrucoes de agentes;
- README e referencias oficiais;
- estrategia de ambientes novos e rollback.

Criterio de pronto:

- nenhum documento normativo exige evento no modelo alvo;
- documentos do runtime atual permanecem identificados como transitorios;
- nenhuma alteracao de aplicacao ou banco;
- links e formatacao aprovados.

## Entrega 2 - Banco Compativel

Objetivo: aceitar o modelo novo sem interromper a versao implantada.

Escopo:

- `business_date` em sessoes de caixa;
- colunas legadas temporariamente opcionais;
- indices por operador, data e sessao;
- RPCs novas com identidade e timestamps definidos no servidor;
- RLS e grants revisados;
- caminho de migration para banco vazio e banco atualizado.

Criterio de pronto:

- runtime legado continua funcional;
- banco bloqueia segunda sessao aberta do mesmo operador;
- operadores diferentes abrem sessoes simultaneamente;
- testes reais de RLS, RPC e concorrencia passam.

## Entrega 3 - Relatorios Sem Eventos

Objetivo: consultar a operacao por periodo, operador e caixa.

Escopo:

- relatorio por data operacional;
- consolidado diario;
- detalhamento por vendedor e sessao;
- pagamentos, cancelamentos e divergencias;
- CSV equivalente a interface.

Criterio de pronto:

- totais permanecem consistentes entre tela, banco e CSV;
- caixas simultaneos nao misturam valores;
- consultas usam indices adequados.

## Entrega 4 - Historico De Vendas Sem Eventos

Objetivo: desacoplar lista, detalhe e cancelamento.

Escopo:

- contratos de venda sem `eventId`;
- filtros por data, operador, caixa e status;
- detalhe auditavel;
- cancelamento e devolucao de estoque.

Criterio de pronto:

- nenhuma consulta ativa de vendas precisa carregar `events`;
- cancelamentos continuam seguros e idempotentes;
- registros legados continuam legiveis durante a transicao.

## Entrega 5 - Caixa E PDV Por Operador

Status: concluida e integrada (PR05), incluindo tarefas e criterios de aceite.

Objetivo: ativar a operacao diaria da loja.

Escopo:

- abertura sem evento;
- um caixa aberto por operador;
- varias sessoes no mesmo dia depois de cada fechamento;
- PDV usando automaticamente o caixa do usuario;
- dashboard de caixas abertos;
- fechamento proprio e administrativo auditado;
- finalizacao de venda pela nova RPC.

Criterio de pronto:

- dois vendedores operam simultaneamente;
- um vendedor nao usa caixa alheio;
- fechar um caixa nao interrompe outro;
- estoque permanece correto sob concorrencia.

## Entrega 6 - Remocao Do Legado De Eventos

Status: concluida e integrada (PR06, 2026-10-06).

Objetivo: eliminar codigo e schema sem uso.

Escopo:

- rotas e navegacao;
- modulo de eventos;
- campos `event_id`;
- tabela, policies, indices e RPCs legadas;
- testes e fixtures antigas;
- documentos operacionais afetados.

Criterio de pronto:

- nenhuma dependencia de runtime referencia eventos;
- banco vazio e atualizado resultam no mesmo schema;
- todas as rotas e fluxos alvo passam.

Evidencia final: `npm.cmd run format:check`, `npm.cmd run lint`,
`npm.cmd run type-check`, `npm.cmd test`, `npm.cmd run test:no-event-legacy`,
`npm.cmd run test:db`, `npm.cmd run build` e `npm.cmd run test:e2e:required`,
nessa ordem, todos com exit code `0`. Foram aprovados 369 testes unitarios,
111 asserts pgTAP em cada caminho de upgrade/reset, integracoes financeiras
e 42 testes E2E sem skips. Nenhum ambiente remoto foi acessado ou alterado.

## Evolucao Atual - Desconto No PDV

Status: implementacao em branch de funcionalidade; promocao remota depende dos
gates e do pull request para `develop`.

Escopo:

- desconto em Reais aplicado a venda inteira por admin ou operador;
- `subtotal_in_cents`, `discount_in_cents` e `total_in_cents` persistidos e
  validados no servidor;
- `finalize_sale_v4` como contrato funcional, mantendo `finalize_sale_v3`
  apenas para compatibilidade de vendas sem desconto;
- operador do desconto derivado da sessao autenticada e visivel no historico;
- PDV, detalhes, relatorio e CSV distinguindo bruto, desconto e liquido;
- pagamento, troco, fechamento e reconciliacao sempre pelo valor liquido.

Criterio de pronto:

- desconto minimo de R$ 0,01 e total final minimo de R$ 0,01;
- banco recalcula preco, subtotal, desconto, total e pagamento atomicamente;
- chamada anonima da v4 e escrita financeira direta permanecem bloqueadas;
- cancelamento preserva bruto, desconto, liquido e autoria;
- verificador remoto exige colunas financeiras, v3/v4 e grants corretos sem
  registrar credenciais;
- gates locais financeiros e E2E passam antes da publicacao do PR.

## Evolucao Atual - Pagamentos Divididos E Conferencia Por Metodo

Status: aplicacao e corte funcional implementados na segunda branch de
funcionalidade; promocao remota depende dos gates completos e do pull request
para `develop`.

Runtime desta entrega:

- `payments.installment_count`, com credito em 1x, 2x ou 3x e compatibilidade
  de credito historico como 1x;
- ate dois metodos distintos por venda, com contribuicao liquida minima de um
  centavo e troco calculado no servidor somente para dinheiro;
- `finalize_sale_v5` atomica usada pela aplicacao, mantendo v3/v4 somente para
  compatibilidade de vendas;
- `close_cash_session_v2` com conferencia independente de dinheiro, Pix,
  credito e debito;
- quatro linhas auditaveis em `cash_session_reconciliations`, enquanto os
  campos escalares do caixa continuam representando somente dinheiro fisico;
- relatorio SQL compativel com pagamentos divididos, parcelas e reconciliacoes;
- PDV com `payments[]`, divisao em dois metodos e credito em ate 3x;
- detalhes e historico com todos os pagamentos;
- fechamento com quatro valores inicialmente vazios e autorizacao para qualquer
  divergencia;
- relatorio e CSV com contagem distinta por metodo, parcelas e reconciliacoes;
- fechamento legado preservado no schema para historico, mas sem `execute` para
  `public`, `anon` ou `authenticated`;
- verificacao remota dos objetos, assinaturas, RLS e grants apos o corte.

Criterio de pronto da fundacao:

- migrations de upgrade e reset limpo produzem o mesmo contrato;
- V3 e V4 permanecem compativeis; o fechamento legado fica bloqueado;
- V5 e fechamento V2 passam validacao, RLS, concorrencia, rollback e
  idempotencia;
- o verificador remoto exige tabela, coluna, RPCs e grants novos sem registrar
  credenciais;
- todos os gates locais e checks do PR para `develop` estao aprovados.

## Entrega 7 - QA Multioperador

Status: implementacao entregue no PR07; revisao, checks do PR e integracao
pendentes com o controlador.

Objetivo: provar isolamento, concorrencia e repetibilidade.

Escopo:

- seed idempotente com admin e dois operadores;
- contextos de navegador separados;
- testes de corrida diretamente contra o banco;
- traces e relatorios de falha;
- gate E2E em todos os PRs para `develop` e `main`, contra Supabase local efemero;
- `test:e2e:local-reset` destrutivo exclusivamente local, sem project ref remoto;
- nenhum secret no workflow, logs redigidos e stop do Supabase mesmo em falha;
- artefatos de falha E2E publicados somente por tres dias.

Criterio de pronto:

- E2E nao pula silenciosamente por falta de credenciais;
- testes nao dependem de dados compartilhados anteriores;
- falhas de concorrencia e autorizacao sao detectadas no CI.

## Entrega 8 - Infraestrutura Roberto Multimarcas

Status: em execucao (PR08).

Objetivo: provisionar ambientes vazios e exclusivos.

Escopo:

- Supabase somente de staging; producao nova pertence ao PR09;
- Vercel `roberto-multimarcas-pdv-staging` dedicado, usando seu ambiente
  Production exclusivamente como staging no PR08;
- `roberto-multimarcas-pdv` reservado exclusivamente para o PR09; recursos
  existentes devem ser inventariados e preservados, sem uso no staging;
- URL estavel de staging validada para homologacao;
- variaveis por ambiente;
- bootstrap de admin e vendedores;
- runbook de validacao e rollback;
- preservacao temporaria dos projetos legados.

Criterio de pronto:

- quota e eventual custo aprovados;
- staging novo passa migrations, smoke e E2E;
- projeto dedicado tem tres variaveis `Production`, duas variaveis publicas
  `Preview`, Git desconectado e deployment promovido validado por SHA/alias; o
  projeto reservado e validado por identidade e permanece fora do rollout;
- nenhuma credencial aparece no repositorio ou em logs.

## Entrega 9 - Release

Status: pendente (PR09).

Objetivo: promover o sistema aprovado para a nova producao.

Escopo:

- PR de `develop` para `main`;
- Quality e E2E Release Gate;
- migrations no projeto novo de producao;
- usuarios, produtos e estoque inicial;
- smoke financeiro completo;
- monitoramento e janela de rollback.

Criterio de pronto:

- venda, cancelamento, fechamento e relatorio conferidos;
- dois operadores trabalham simultaneamente;
- URL publica usa a marca Roberto Multimarcas;
- ambiente legado nao recebe novas escritas.

## Gates Por Tipo De Entrega

Todos os PRs:

```text
npm run format:check
npm run lint
npm run type-check
npm run test
npm run test:no-event-legacy
npm run build
```

PRs com banco ou regras financeiras:

```text
npm run test:db
npm run test:e2e:local-reset
```

O reset do gate e exclusivamente local e apaga dados da stack isolada de testes.
O workflow `E2E Release Gate` executa em todos os PRs para `develop` e `main`.

Tambem exigem testes reais de RLS/RPC e concorrencia quando aplicavel. Testes
unitarios com clientes mockados nao substituem essa validacao.

## Primeiro Marco Operacional

```txt
Login
+ Caixa proprio aberto
+ PDV sem evento
+ Venda transacional
+ Estoque compartilhado
+ Fechamento individual
+ Relatorio por operador e sessao
```

Esse marco deve ser validado com pelo menos dois operadores antes da remocao
definitiva do ambiente legado.
