# Gate E2E De Release

Playwright valida o runtime da loja física Roberto Multimarcas em PRs para
`develop` e `main`. O PR07 entrega um gate contra Supabase local isolado;
provisionamento remoto e promoção de produção continuam nos PR08 e PR09.

## Cobertura E Identidades

A seed idempotente cria ou atualiza três identidades: `admin`, `operatorA` e
`operatorB`, com os perfis correspondentes. Cada identidade usa clientes
autenticados e contextos de navegador separados. O servidor deriva o operador
da sessão autenticada; a preparação financeira usa RPCs públicas, preservando
histórico, sem atualização ou exclusão financeira direta.

A suíte cobre login, produto, estoque, PDV, venda, cancelamento, fechamento,
reabertura no mesmo dia, relatórios e segurança financeira. A cobertura
multioperador automatizada inclui:

- duas tentativas de abertura do mesmo operador deixando uma única sessão;
- caixas simultâneos, isolamento de acesso e fechamento administrativo auditado;
- continuidade do caixa B depois do fechamento do caixa A;
- disputa pela última unidade com uma venda, uma rejeição e saldo final zero;
- serialização de venda e fechamento concorrentes;
- vendas vinculadas aos caixas corretos e relatório consolidado, por operador
  e sessão, com CSV equivalente.

O smoke do [Runbook operacional](runbook-operacional.md) complementa os testes
com a conferência da operação e dos dispositivos após deploy.

## Execução Local Com Reset

Use Docker e Supabase CLI na raiz do repositório. Confirme que a stack é local,
isolada e exclusiva de testes. O comando apaga os dados locais, reaplica
migrations, cria as três identidades efêmeras e executa a suíte obrigatória:

```powershell
npx.cmd supabase start
npm.cmd run test:e2e:local-reset
```

`test:e2e:local-reset` lê as chaves da stack local em memória e gera credenciais
efêmeras, sem exigir arquivos de credenciais. Executa `supabase db reset --local`,
seed e `test:e2e:required` no mesmo ambiente filho, propagando a primeira falha.
Recusa argumentos, project ref e URLs remotas; valida o alvo imediatamente antes
do reset. Não executa reset remoto nem provisiona ambientes.

Não imprima a saída de `supabase status -o env`: ela contém chaves. O gate redige
valores sensíveis dos subprocessos. Credenciais e arquivos `.env*` locais devem
permanecer fora do Git e não devem apontar para ambientes remotos neste comando.

O Playwright usa o Next.js em `http://localhost:3000`. Se houver servidor já
iniciado, confira se ele usa o código da branch e a mesma stack local.

## Seed E Suíte Separadas

Para executar separadamente em uma stack local já preparada, configure as
variáveis da sessão ou os arquivos não versionados `.env.local` e `.env.e2e.local`.
Variáveis da sessão têm precedência. Os nomes obrigatórios são:

- `E2E_USER_EMAIL` e `E2E_USER_PASSWORD` (admin);
- `E2E_OPERATOR_A_EMAIL` e `E2E_OPERATOR_A_PASSWORD`;
- `E2E_OPERATOR_B_EMAIL` e `E2E_OPERATOR_B_PASSWORD`;
- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SECRET_KEY`.

```powershell
npm.cmd run e2e:seed-local
npm.cmd run test:e2e:required
```

A seed aceita somente `localhost`, `127.0.0.1` ou loopback IPv6 e deve ser
reexecutada após reset local. Não serve para bootstrap remoto. O verificador
exige as três identidades antes do Playwright; `test:e2e` isolado pode pular
cenários autenticados e não comprova o gate.

## Execução No GitHub

O workflow [E2E Release Gate](../.github/workflows/e2e-release.yml) executa em
todos os PRs para `develop` e `main` e por `workflow_dispatch`, sem parâmetros.
Inicia Supabase local efêmero no runner, executa `test:e2e:local-reset` e para a
stack com `if: always()`. Não usa secrets do GitHub, project ref ou staging
remoto. Historicamente o gate usava staging legado; esse vínculo foi removido.

O workflow `Quality` inclui `test:no-event-legacy` e contrato de banco local.
Para execução manual, selecionar `E2E Release Gate` em `Actions`, clicar em
`Run workflow`, selecionar a branch e conferir `Playwright E2E`.

Somente em falha do passo E2E são publicados `playwright-report/` e
`test-results/`, com retenção de três dias. O HTML é habilitado no CI; traces
usam `retain-on-failure`. Artefatos podem conter sessões autenticadas efêmeras:
tratar como sensíveis e não reutilizar credenciais fora da stack local.

## Critério De Aprovação

- `Quality checks`, `Database contract` e `Playwright E2E` aprovados.
- `test:e2e:local-reset` completo, sem skips de testes autenticados.
- Smoke manual aplicável registrado e dados mantidos no ambiente isolado.
- Falhas analisadas sem expor senhas, cookies, tokens ou chaves.
- PR08 e PR09 validados nos respectivos gates antes da operação em produção.
