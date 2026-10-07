# Plano De Execucao Incremental - Roberto Multimarcas PDV

## Estado Atual

O runtime atual opera como loja fisica, com caixas independentes por operador.
As entregas 1 a 6 estao concluidas e integradas, incluindo PR05 e PR06.
A entrega 6 removeu o modulo legado do runtime e do schema em 2026-10-06.
O PR07 entrega seed de tres identidades, concorrencia real e gate local/CI;
sua revisao, PR e integracao seguem com o controlador. Ambientes (PR08) e
release (PR09) continuam pendentes.

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

Status: pendente (PR08).

Objetivo: provisionar ambientes vazios e exclusivos.

Escopo:

- Supabase staging e producao;
- Vercel `roberto-multimarcas-pdv`;
- URL publica com a nova marca;
- variaveis por ambiente;
- bootstrap de admin e vendedores;
- runbook de validacao e rollback;
- preservacao temporaria dos projetos legados.

Criterio de pronto:

- quota e eventual custo aprovados;
- staging novo passa migrations, smoke e E2E;
- producao permanece desconectada ate a release;
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
