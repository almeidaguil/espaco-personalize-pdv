# Plano De Execucao Incremental - Roberto Multimarcas PDV

## Estado Atual

O runtime atual opera como loja fisica, com caixas independentes por operador.
As entregas 1 a 6 estao concluidas e integradas, incluindo PR05 e PR06.
A entrega 6 removeu o modulo legado do runtime e do schema em 2026-10-06.
O PR07 entregou seed de tres identidades, concorrencia real e gate local/CI e ja
foi integrado. Ambientes (PR08) estao em execucao e a release (PR09) continua
pendente.

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

Status: fundacao aditiva do banco em branch de funcionalidade. A interface e o
corte funcional pertencem a um segundo PR, criado somente depois da integracao
desta fundacao em `develop`.

Escopo deste primeiro PR:

- `payments.installment_count`, com credito em 1x, 2x ou 3x e compatibilidade
  de credito historico como 1x;
- ate dois metodos distintos por venda, com contribuicao liquida minima de um
  centavo e troco calculado no servidor somente para dinheiro;
- `finalize_sale_v5` atomica, mantendo v3/v4 executaveis durante a transicao;
- `close_cash_session_v2` com conferencia independente de dinheiro, Pix,
  credito e debito, mantendo o fechamento legado executavel neste PR;
- quatro linhas auditaveis em `cash_session_reconciliations`, enquanto os
  campos escalares do caixa continuam representando somente dinheiro fisico;
- relatorio SQL compativel com pagamentos divididos, parcelas e reconciliacoes;
- verificacao remota dos objetos, assinaturas, RLS e grants da fase aditiva.

Fora do runtime deste primeiro PR:

- o PDV ainda nao envia `payments[]` nem exibe parcelamento;
- o formulario de fechamento ainda nao envia as quatro conferencias;
- a aplicacao ainda nao consome os novos campos do relatorio;
- o fechamento legado somente sera revogado no PR de corte, depois da migracao
  integral da aplicacao e do gate E2E correspondente.

Criterio de pronto da fundacao:

- migrations de upgrade e reset limpo produzem o mesmo contrato;
- V3, V4 e fechamento legado continuam funcionais;
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
- `roberto-multimarcas-pdv` reservado sem variaveis ou deployments para o PR09;
- URL estavel de staging validada para homologacao;
- variaveis por ambiente;
- bootstrap de admin e vendedores;
- runbook de validacao e rollback;
- preservacao temporaria dos projetos legados.

Criterio de pronto:

- quota e eventual custo aprovados;
- staging novo passa migrations, smoke e E2E;
- projeto dedicado tem somente as tres variaveis de staging e um deployment
  READY; o projeto reservado para producao permanece vazio;
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
