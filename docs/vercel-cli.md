# Vercel CLI

Runbook do staging Vercel da Roberto Multimarcas. O proprietário declarou uso
pessoal e não comercial no plano Hobby.

## Versão E Autenticação

Use Vercel CLI `62.7.0` com Node.js `22.23.2`:

```powershell
npx.cmd --yes vercel@62.7.0 --version
npx.cmd --yes vercel@62.7.0 whoami --scope guilherme-a-s-projects
```

A sessão fica no perfil local. Tokens nunca entram em arquivos versionados,
documentação, PRs ou logs.

## Alvos Autorizados

| Uso                  | Projeto                           | Project ID                         | Regra                                               |
| -------------------- | --------------------------------- | ---------------------------------- | --------------------------------------------------- |
| Staging PR08         | `roberto-multimarcas-pdv-staging` | `prj_fb7pug2hcbCGI1XIMLz5VuMr4S79` | `Production` deste projeto representa staging       |
| Produção futura PR09 | `roberto-multimarcas-pdv`         | `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq` | deve permanecer sem variáveis e deployments no PR08 |

Org ID: `team_jstETBWBHJi0hsir3a3bAkbK`. Supabase de staging:
`otsxpchqtfypxgzjzrxs`.

O manifesto `config/remote-environments.json` é a allowlist. Toda mutação deve
confirmar literalmente o project ID do staging dedicado. O provisionador falha
se o nome não terminar em `-staging`, se `dedicatedStaging` não for verdadeiro
ou se o project ID coincidir com o projeto reservado.

## Configuração Do Staging

O projeto dedicado usa preset Next.js, Node 22.x e exatamente estas variáveis no
seu ambiente `Production`:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` é sensível. Valores entram somente pela API HTTPS ou pelo
stdin do CLI e não são lidos de volta. Preview do projeto dedicado fica vazio.

Sequência inicial fail-closed, antes de persistir um deployment no manifesto:

```powershell
npm.cmd run ops:provision-vercel -- --phase configure-staging
npm.cmd run ops:provision-vercel -- --phase deploy-staging
npm.cmd run ops:provision-vercel -- --phase verify-staging
```

Depois que o deployment está registrado, use somente a verificação idempotente:

```powershell
npm.cmd run ops:provision-vercel -- --phase verify-staging
```

Na execução remota, acrescente `--execute --confirm-project
prj_fb7pug2hcbCGI1XIMLz5VuMr4S79` e forneça o token somente no processo.

## Deployment E Proteção

Deployment validado:

- ID `dpl_3oB2HRYi5KBaHzQAk7Y6cnZvfdqD`;
- URL imutável
  `https://roberto-multimarcas-pdv-staging-6emhr7cxk.vercel.app`;
- URL estável `https://roberto-multimarcas-pdv-staging.vercel.app`;
- estado `READY`, target `Production` e metadados
  `roberto_environment=staging`, `dedicated_staging=true`, `pr08=true`.

Vercel Authentication continua habilitada. O Playwright usa um bypass de
automação temporário pelos cabeçalhos oficiais
`x-vercel-protection-bypass` e `x-vercel-set-bypass-cookie`; o segredo vive
somente no processo e é revogado em um bloco de limpeza, inclusive se o teste
falhar. A criação e a revogação usam a API HTTPS autenticada; o segredo não é
enviado como argumento de processo. O comando
`npm.cmd run test:e2e:staging-smoke` é dry-run por padrão. A execução exige
`--execute --confirm-project prj_fb7pug2hcbCGI1XIMLz5VuMr4S79`, recusa bypass
preexistente e confirma contagem final zero. O token Vercel não é propagado ao
Playwright. Traces ficam desativados nesse smoke para que o header temporário
não seja serializado em artefatos. Nunca desative SSO para executar E2E.

## Evidência Da Mudança De Arquitetura

No projeto reservado `roberto-multimarcas-pdv`, quatro tentativas pela CLI e uma
pela API foram classificadas como Production mesmo sem `--prod`/`target`. Todas
falharam antes de publicar, foram removidas por ID exato e deixaram zero
deployments. O comportamento coincide com a
[ocorrência Vercel #17069](https://github.com/vercel/vercel/issues/17069).

Após autorização explícita, foi criado o projeto dedicado de staging. As três
variáveis Preview obsoletas do projeto reservado foram removidas; removê-las da
Vercel não revoga a chave no Supabase, mas a mesma chave permanece autorizada
somente no staging dedicado.

## Verificação E Retomada

Confirme por metadados:

- projeto dedicado com exatamente três variáveis em `Production`, nenhuma em
  Preview, Vercel Authentication ativa, zero bypasses e um deployment `READY`
  entre todos os targets;
- projeto reservado com identidade exata, zero variáveis, zero deployments de
  qualquer target e somente o domínio padrão
  `roberto-multimarcas-pdv.vercel.app`, sem domínio customizado;
- Auth do Supabase apontando para a URL estável;
- zero bypasses de automação após o smoke;
- produção legada Vercel/Supabase intacta.

O deployment inicial usa o `sourceRef` de bootstrap
`feature/provision-roberto-environments`; esse commit passou a compor `develop`
quando o PR foi integrado. O provisionador do PR08 é deliberadamente imutável e
não substitui deployments persistidos. Promoções posteriores usam o fluxo
versionado `ops:rollout-staging`, que cria deployments pela API para o SHA exato
de `develop` sem habilitar a integração Git no projeto.

## Promover Uma Versão Para Staging

Execute o fluxo a partir do checkout do commit integrado em `develop`. Os
comandos são dry-run por padrão, exceto `verify`, que é somente leitura e
consulta os metadados remotos sem exigir `--execute`.

1. Conferir o plano e aplicar apenas a migration aditiva:

   ```powershell
   npm.cmd run ops:rollout-staging -- --phase apply-foundation
   npm.cmd run ops:rollout-staging -- --phase apply-foundation --execute --confirm-project otsxpchqtfypxgzjzrxs
   ```

   A etapa exige `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD` no ambiente do
   processo. Ela cria um bundle temporário contendo migrations somente até
   `20261018120000`, confirma que o dry-run planeja exclusivamente a migration
   aditiva e remove o bundle ao terminar. Não use `db push` direto: a migration
   de corte legado posterior não pode ser aplicada nesta fase.

2. Promover um SHA exato que ainda seja o HEAD remoto de `develop`:

   ```powershell
   npm.cmd run ops:rollout-staging -- --phase deploy --source-ref develop --commit-sha <sha>
   npm.cmd run ops:rollout-staging -- --phase deploy --source-ref develop --commit-sha <sha> --execute --confirm-project prj_fb7pug2hcbCGI1XIMLz5VuMr4S79
   ```

   A etapa exige `VERCEL_TOKEN` no ambiente do processo, mantém Vercel
   Authentication e valida as três variáveis de staging, o projeto reservado
   de produção vazio, o deployment `READY` e o alias estável. Ela não altera
   variáveis, proteção ou a conexão Git.

3. Fazer verificação somente leitura, fornecendo o SHA e o ID retornado pela
   promoção:

   ```powershell
   npm.cmd run ops:rollout-staging -- --phase verify --source-ref develop --commit-sha <sha> --deployment-id <deployment-id>
   ```

   Antes do corte, executar e aprovar o smoke financeiro no runtime novo,
   incluindo fechamento e reabertura do caixa de teste com a RPC nova. Não
   aplique a migration de corte antes desse checkpoint.

4. Depois do smoke aprovado, conferir o plano e autorizar separadamente os dois
   alvos antes de revogar o fechamento legado:

   ```powershell
   npm.cmd run ops:rollout-staging -- --phase apply-cutover --source-ref develop --commit-sha <sha> --deployment-id <deployment-id>
   npm.cmd run ops:rollout-staging -- --phase apply-cutover --source-ref develop --commit-sha <sha> --deployment-id <deployment-id> --execute --confirm-project prj_fb7pug2hcbCGI1XIMLz5VuMr4S79 --confirm-database-ref otsxpchqtfypxgzjzrxs --confirm-smoke-passed STAGING_FINANCIAL_SMOKE_PASSED --confirm-cutover 20261018180000_disable_legacy_cash_close.sql
   ```

   Essa fase confirma novamente que o deployment exato está `READY`, que o
   alias estável aponta para ele e que o smoke foi confirmado explicitamente.
   O dry-run deve planejar somente
   `20261018180000_disable_legacy_cash_close.sql`. Após a aplicação, a
   automação verifica que o RPC legado não é executável e que
   `close_cash_session_v2` permanece executável.

Não feche caixas de staging antes do smoke apenas para liberar a promoção: use
as sessões de teste existentes para validar o novo fechamento quando adequado.
Depois do smoke, reconcilie e encerre as sessões de teste pelo runtime novo. Em
qualquer divergência, interrompa a sequência; não execute SQL manual, não faça
reset remoto e não altere o projeto de produção reservado. Produção continua
dependente do PR de release e dos checkpoints do PR09.

Em divergência, pare sem promover, excluir projeto ou alterar `main`. Preserve
evidências redigidas e retome apenas a etapa idempotente correspondente.
