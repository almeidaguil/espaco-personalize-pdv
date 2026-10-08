# Checklist De Go-Live

Checklist para liberar a operação da loja física Roberto Multimarcas.
Documenta o runtime atual e o gate multioperador do PR07. PR05 e PR06 foram
integrados; o provisionamento dos novos ambientes (PR08) está em execução e a
release (PR09) continua pendente.

## Regra De Release

1. Concluir a alteração em `feature/*`, com commits assinados.
2. Integrar em `develop` por PR com checks aprovados.
3. Executar o gate E2E em ambiente isolado e o smoke do
   [Runbook operacional](runbook-operacional.md).
4. Conferir banco, acessos, configuração de ambientes e segredos.
5. Abrir PR de release de `develop` para `main` e revisar o diff.
6. Publicar somente após aprovação dos gates e da preparação operacional.
7. Conferir produção e registrar a release.

## 1. Qualidade E Banco Local

Na raiz do repositório, com dependências instaladas:

O build exige `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` na sessão. Para validação sem credenciais,
usar a configuração pública de formato do workflow Quality: URL local
`http://127.0.0.1:54321` e placeholder `ci-publishable-key`.

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run type-check
npm.cmd run format:check
npm.cmd run test:no-event-legacy
npm.cmd run build
```

No Supabase local isolado, confirmar o alvo local antes do reset. O comando
apaga os dados locais de teste e reaplica migrations e seed:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local
npx.cmd supabase db lint --local
npm.cmd run test:db
```

Conferir também:

- `Quality checks` e `Database contract` aprovados;
- ausência de conflitos e pendências críticas;
- constraints, RLS e grants financeiros validados;
- RPCs `open_cash_session_v3`, `finalize_sale_v3`, `cancel_sale` e
  `close_cash_session` disponíveis;
- operador derivado da sessão autenticada; escritas financeiras diretas bloqueadas.

## 2. Gate E2E E Smoke Funcional

Preparar a stack local isolada seguindo o
[Gate E2E de release](e2e-release-gate.md) e executar:

```powershell
npm.cmd run test:e2e:local-reset
```

O comando destrutivo apaga exclusivamente a base local de testes, reaplica
migrations e executa seed idempotente de admin, operador A e operador B com
credenciais efêmeras. Recusa alvos remotos e project ref. Não usa secrets no
workflow, que executa em PRs para `develop` e `main` com Supabase local efêmero.

Conferir o resultado automatizado e registrar o smoke manual:

- login, cadastro de produto e saldo inicial;
- abertura do próprio caixa e associação automática no PDV;
- recusa de segunda abertura simultânea para o mesmo usuário;
- venda em dinheiro com troco e venda em Pix ou cartão;
- baixa de estoque, cancelamento e reposição;
- fechamento e reabertura no mesmo dia;
- caixas simultâneos de usuários diferentes, com financeiro separado;
- fechamento de um caixa preservando a operação do outro;
- consulta do operador restrita aos próprios dados e contingência pelo admin;
- relatório por período, vendedor e sessão, com CSV equivalente;
- divergências e ajustes após fechamento conciliados.

O PR07 automatiza caixas independentes, abertura concorrente, isolamento,
contingência administrativa, disputa da última unidade e relatórios/CSV reais.
Exigir execução sem skips autenticados. O smoke manual após deploy complementa
a suíte. Em falha E2E no CI, os traces e relatórios são publicados por três dias;
tratar os artefatos como sensíveis. A stack é parada mesmo em falha.

## 3. Preparação Do Banco De Entrega

Antes de aplicar migrations remotamente, identificar o ambiente e validar o
project ref, o backup e a sequência de promoção conforme
[Ambientes](ambientes.md) e [Supabase CLI](supabase-cli.md).

- Aplicar primeiro em staging e validar o schema e as RPCs.
- Confirmar banco alinhado às migrations da versão aprovada.
- Manter RLS nas tabelas operacionais e validar isolamento por operador.
- Manter migrations históricas imutáveis.
- Não executar reset remoto como parte do teste local.

Qualquer reset remoto exige confirmação explícita do ambiente e validação do
project ref imediatamente antes da execução. O bootstrap dos ambientes novos
continua no PR08; o corte de produção continua no PR09.

## 4. Acessos E Segredos

Antes de produzir, conferir:

- admin oficial ativo e operadores reais cadastrados;
- signup público desabilitado conforme a política do projeto;
- `leaked password protection` habilitada no Supabase Auth;
- senha administrativa operacional conhecida somente pelos autorizadores;
- usuários temporários desativados quando não fizerem parte da operação;
- segredos e senhas expostos durante homologação rotacionados;
- secrets do GitHub e variáveis Vercel atualizados após a rotação;
- arquivos locais com credenciais fora do versionamento.

A `publishable key` é pública. `SUPABASE_SECRET_KEY`, senha do banco, tokens de
deploy e senhas operacionais são privados. Não usar valores de homologação como
segredos definitivos de produção.

## 5. Dados De Homologação E Dados Reais

- Executar QA em ambiente isolado; guardar evidências antes do reset local.
- Não levar produtos, vendas ou caixas de teste para a base de entrega.
- Preparar somente admin, operadores, produtos e saldo inicial reais no ambiente
  de produção, conforme o procedimento de bootstrap aprovado.
- Conferir ausência de caixas de teste abertos e usuários temporários ativos.
- Se uma operação de teste controlado ocorrer em produção, preservar o histórico
  e registrar a compensação por cancelamento quando aplicável.
- Não apagar vendas ou movimentações financeiras para limpar relatórios reais.

## 6. Vercel Preview E Promoção

Conferir no projeto que receberá a release:

- conta, projeto, URL Preview e ambiente identificados no manifesto;
- repositório conectado exatamente a `almeidaguil/espaco-personalize-pdv`;
- preset Next.js e Node 22.x confirmados no projeto novo;
- branch `main` impedida de gerar deployment no projeto novo durante o PR08;
- somente Preview e a branch `develop` autorizados para staging;
- nenhum uso de `--prod`, alias produtivo ou Production Deployment;
- variáveis públicas e privadas de staging restritas ao ambiente Preview;
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e
  `SUPABASE_SECRET_KEY` configuradas, com a chave de servidor sensível;
- zero variáveis configuradas no ambiente Production do projeto novo;
- smoke remoto somente leitura aprovado no deployment Preview;
- PR de `develop` para `main`, variáveis e deployment de Production continuam
  bloqueados até
  a janela do PR09;
- deployment Preview sem erros e consumo do plano Hobby revisado.

A produção Vercel legada e o Supabase `ciixpfquwmlsvzleattv` permanecem
intactos durante o PR08. O novo projeto Supabase de produção, variáveis de
produção e publicação em `main` pertencem exclusivamente ao PR09.

## 7. Smoke Manual Após Deploy

Com o responsável operacional, executar teste controlado e guardar evidências:

1. Fazer login e conferir painel e PWA.
2. Conferir produto real e saldo.
3. Abrir o próprio caixa e confirmar sua identificação no PDV.
4. Realizar uma venda e consultá-la em `/sales`.
5. Cancelar quando for teste controlado e conferir estoque e financeiro.
6. Fechar com dinheiro contado e conferir diferença.
7. Reabrir no mesmo dia para validar nova sessão e fechar novamente.
8. Conferir `/reports`, filtros e CSV.
9. Confirmar acesso aos logs de runtime.

Se algum passo falhar, bloquear a liberação operacional, corrigir em
`feature/*` a partir de `develop` e repetir a validação. O smoke completo e a
validação com usuários separados estão no
[Runbook operacional](runbook-operacional.md).

## 8. Primeiro Dia E Acompanhamento

- Definir admins, operadores e responsável pela conferência financeira.
- Entregar acessos por canal seguro e conferir login em celular e desktop.
- Instalar o PWA nos dispositivos e confirmar internet.
- Conferir estoque inicial e dinheiro de abertura por operador.
- Disponibilizar o [Manual do usuário final](manual-usuario-final.md) à equipe.
- No início do turno, cada operador abre ou continua seu próprio caixa.
- No encerramento, fechar cada sessão e consolidar o relatório.
- Monitorar `sale.create.failed`, `sale.cancel.failed` e `cash.close.failed`
  conforme [Observabilidade](observabilidade.md).
- Registrar incidentes com horário e IDs técnicos, sem credenciais.

## 9. Critério De Liberação

A operação só pode ser liberada após checks e gate E2E aprovados, ambiente correto,
acessos reais, estoque preparado, segredos revisados, smoke validado e responsável
operacional orientado. Pendências de ambiente e release precisam ser resolvidas
nos PRs correspondentes; este checklist não substitui esses gates.
