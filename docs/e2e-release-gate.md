# Gate E2E De Release

Playwright valida o runtime da loja física antes da promoção de `develop`
para `main`. A suíte escreve dados operacionais; execute em ambiente isolado,
com usuários exclusivos de homologação e o schema da versão sob teste.

## Cobertura E Estado Atual

A suíte atual cobre login, produto, abertura do próprio caixa, associação
automática no PDV, bloqueio de segunda abertura, venda, cancelamento, fechamento,
reabertura no mesmo dia, relatório e segurança financeira.

A conta E2E atual é admin para preparar produtos, estoque e autorizações.
O fluxo de venda sempre usa a sessão de caixa da conta autenticada; o servidor
deriva o operador da autenticação. Alguns setups fecham caixas visíveis ao admin
pela interface, por isso a base de testes não deve conter operação real.

A seed idempotente com admin e dois operadores, os contextos independentes e a
ampliação automatizada de concorrência e isolamento pertencem ao PR07.
Para esses cenários, registre também o smoke manual do
[Runbook operacional](runbook-operacional.md).

## Preparação Local

Use Docker e Supabase CLI na raiz do repositório. Confirme que o alvo é a stack
local de testes. O reset abaixo apaga dados locais e reaplica migrations e seed:

```powershell
npx.cmd supabase start
npx.cmd supabase db reset --local
npx.cmd supabase db lint --local
npm.cmd run test:db
```

Configure os arquivos locais não versionados `.env.local` e `.env.e2e.local`,
ou as variáveis da sessão, para a mesma stack local. A URL da API local padrão é
`http://127.0.0.1:54321`. Use as chaves fornecidas pela stack local e credenciais
exclusivas de teste. Não copie valores reais para documentação, logs ou commits.

Variáveis obrigatórias:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Os processos leem `.env.local` e `.env.e2e.local`; mantenha valores coerentes
entre os arquivos e as variáveis já definidas na sessão. Variáveis da sessão
têm precedência.

Depois execute:

```powershell
npm.cmd run e2e:seed-local
npm.cmd run test:e2e:required
```

`e2e:seed-local` cria ou atualiza somente o admin E2E atual. Recusa URLs fora
de `localhost` ou `127.0.0.1`; não é ferramenta de bootstrap remoto.
Reexecute após cada reset local.

Sem `E2E_BASE_URL`, Playwright inicia o Next.js em `http://localhost:3000`.
Se já houver servidor nessa URL, confira se ele usa o mesmo código e banco.
Com `E2E_BASE_URL`, a suíte usa a aplicação indicada; ela deve apontar para
o mesmo Supabase isolado configurado no teste.

Use `test:e2e:required` como gate: verifica as variáveis antes da suíte.
`test:e2e` isolado pode pular cenários autenticados e não comprova a release.

## Execução No GitHub

O workflow atual `E2E Release Gate`, em
[`.github/workflows/e2e-release.yml`](../.github/workflows/e2e-release.yml),
executa em PRs para `main` e por acionamento manual. O workflow `Quality`
executa checks de código e contrato de banco local em PRs para `develop` e `main`.

Configure os cinco secrets obrigatórios acima para uma base exclusiva de staging.
O workflow fixa `E2E_EXPECTED_SUPABASE_PROJECT_REF` e recusa URL de Supabase que
não corresponda a esse project ref. A trava não valida por si só o banco usado
por uma aplicação publicada informada em `base_url`; confira também essa ligação.

Os novos ambientes e a atualização de seus vínculos pertencem ao PR08.
Não usar produção para E2E e não executar reset remoto como preparo da suíte.

Para execução manual:

1. Abrir `Actions` e selecionar `E2E Release Gate`.
2. Clicar em `Run workflow`.
3. Informar `base_url` somente para uma aplicação isolada já conferida.
4. Deixar vazio para o Next.js iniciado pelo Playwright no runner.
5. Conferir o resultado de `Playwright E2E`.

## Critério De Aprovação

- `Quality checks` e `Database contract` aprovados.
- `test:e2e:required` concluído sem falhas ou cenários autenticados omitidos.
- Resultado local registrado no PR quando o gate remoto não executar nele.
- Smoke manual aplicável registrado, incluindo os cenários multioperador.
- Evidências de falhas tratadas sem expor senhas, cookies, tokens ou chaves.
- Dados de teste mantidos no ambiente isolado.

O Playwright atual retém traces em falhas. Trate esses arquivos como sensíveis,
pois podem conter sessões autenticadas; a publicação automatizada de artefatos
está prevista no PR07. A promoção de produção permanece no PR09.
