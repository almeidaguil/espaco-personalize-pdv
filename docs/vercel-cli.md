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

| Uso           | Projeto                           | Project ID                         | Regra                                                |
| ------------- | --------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| Staging PR08  | `roberto-multimarcas-pdv-staging` | `prj_fb7pug2hcbCGI1XIMLz5VuMr4S79` | `Production` representa staging; sem integração Git  |
| Produção PR09 | `roberto-multimarcas-pdv`         | `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq` | ativa; dados operacionais existentes são preservados |

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
stdin do CLI e não são lidos de volta. O ambiente `Preview` contém somente
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; a chave
sensível não pode ser configurada para Preview.

Sequência inicial fail-closed, antes de persistir um deployment no manifesto:

```powershell
npm.cmd run ops:provision-vercel -- --phase configure-staging
npm.cmd run ops:provision-vercel -- --phase deploy-staging
npm.cmd run ops:provision-vercel -- --phase verify-staging
```

Essa sequência é exclusiva do bootstrap inicial e pressupõe os estados vazios
descritos pelo provisionador. O projeto atual já tem histórico de promoções;
não execute novamente `configure-staging`, `deploy-staging` ou
`verify-staging`. Para novas versões e verificações, use `ops:rollout-staging`
na seção abaixo.

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
Vercel não revoga a chave no Supabase.

### Reconciliação Remota Em 20/10/2026

Auditoria somente leitura confirmou que o projeto dedicado estava conectado ao
repositório na branch `main`, além de ter recebido deployments automáticos de
branches. Com autorização explícita, a conexão Git do projeto de staging foi
desvinculada pela Vercel CLI. O histórico e as variáveis foram preservados; a
operação não criou nem removeu deployments e não alterou a produção.

Estado observado após a desvinculação:

- staging: 41 deployments preservados (35 Preview `READY`, 5 Production
  `READY` e 1 Preview `ERROR`); 3 variáveis Production e 2 Preview;
- staging Preview contém somente os dois nomes públicos documentados acima;
  nenhum valor de variável foi lido;
- Vercel Authentication ativa e zero bypasses de automação;
- produção reservada: 4 deployments Production `READY` e 3 variáveis
  Production; nenhum valor foi lido e nenhum recurso foi alterado;
- no momento da auditoria, o deployment Production mais recente do staging
  apontava para o SHA `e5bdc9c`, diferente do HEAD `e4bc41d` de `develop`.

O projeto reservado de produção não está vazio. A verificação de staging valida
somente sua identidade e mantém os alvos isolados; o fluxo de staging não lista,
altera nem remove deployments, domínios ou variáveis desse projeto. A promoção
de produção permanece bloqueada até que o PR09 tenha um plano específico para
inventariar e reconciliar o estado existente.

## Verificação E Retomada

Confirme por metadados:

- projeto dedicado com identidade exata, sem conexão Git, Vercel Authentication
  ativa e zero bypasses;
- as três variáveis esperadas em `Production` e somente as duas variáveis
  públicas esperadas em `Preview`; não leia nem registre valores;
- histórico legado de Preview e Production preservado; valide o deployment
  específico da promoção pelo SHA, estado `READY` e alias estável em vez de
  exigir que o histórico inteiro esteja vazio ou tenha metadados novos;
- projeto reservado com identidade exata e ID distinto; não exija que esteja
  vazio e não o altere durante operações de staging;
- Auth do Supabase apontando para a URL estável;
- zero bypasses de automação após o smoke;
- produção legada Vercel/Supabase intacta.

O deployment inicial usa o `sourceRef` de bootstrap
`feature/provision-roberto-environments`; esse commit passou a compor `develop`
quando o PR foi integrado. O provisionador do PR08 é uma operação de bootstrap
com precondições de projeto vazio e não deve ser reutilizado após o rollout ou
para verificar deployments posteriores. Promoções usam exclusivamente o fluxo
versionado `ops:rollout-staging`, que cria deployments pela API para o SHA exato
de `develop`, com a integração Git desconectada.

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
   Authentication e valida as variáveis e a identidade dos projetos. O histórico
   remoto existente é preservado; o fluxo verifica o deployment exato e o alias
   estável sem exigir que o projeto reservado de produção esteja vazio. Ela não
   altera variáveis, proteção, histórico ou a conexão Git.

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
reset remoto e não altere o projeto de produção fora do fluxo da release.

Em divergência, pare sem promover, excluir projeto ou alterar `main`. Preserve
evidências redigidas e retome apenas a etapa idempotente correspondente.

## Promover Uma Versão Para Produção

Produção Roberto está ativa e contém contas, produtos, vendas, pagamentos,
movimentações de estoque e caixas históricos. Nunca exija banco vazio, cancele
operações para limpar dados ou use `db reset`. A promoção preserva todos os
registros. Faça primeiro os gates financeiros completos em staging; o corte de
produção segue a ordem foundation → deployment → cutover para não revogar a RPC
legada antes de o runtime novo estar no alias estável.

1. Gere um backup criptografado e verificado do projeto de produção e mantenha
   schema, dados e evidência fora do repositório. A evidência deve apontar para
   `wjuzwjbvctbyfvgmprmd`, incluir os dois arquivos `.dpapi` da mesma captura e
   declarar que o plaintext foi removido. Valide a descriptografia e os hashes
   antes de remover o plaintext. O runner recusa evidência com mais de uma hora,
   verifica os arquivos/captura e exige confirmação literal dessa validação.

2. No checkout local do SHA exato já integrado em `main`, confira o dry-run e
   aplique somente a migration aditiva:

   ```powershell
   npm.cmd run ops:rollout-production -- --phase apply-foundation --source-ref main --commit-sha <sha-main> --backup-evidence <caminho-da-evidencia>
   npm.cmd run ops:rollout-production -- --phase apply-foundation --source-ref main --commit-sha <sha-main> --backup-evidence <caminho-da-evidencia> --execute --confirm-backup-verified PRODUCTION_BACKUP_VERIFIED --confirm-database-ref wjuzwjbvctbyfvgmprmd --confirm-staging-gates STAGING_RELEASE_GATE_PASSED --confirm-migration 20261018120000_add_split_payments_and_cash_reconciliation.sql
   ```

   A etapa exige o estado de cutover `verified`, saúde e identidade exatas do
   banco, `main` remoto igual ao SHA pedido, checkout local no mesmo SHA e
   predecessor migrations completas. Ela cria um bundle temporário e só executa
   se o dry-run listar exatamente
   `20261018120000_add_split_payments_and_cash_reconciliation.sql`.

3. Implante esse mesmo SHA no projeto Vercel de produção:

   ```powershell
   npm.cmd run ops:provision-vercel-production -- --phase deploy --source-ref main --commit-sha <sha-main>
   npm.cmd run ops:provision-vercel-production -- --phase deploy --source-ref main --commit-sha <sha-main> --execute --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq
   ```

   Registre o `deployment-id` e a `deployment-url` retornados. Confirme que o
   deployment está `READY`, usa o SHA exato de `main` e está associado ao alias
   estável. Não altere variáveis, proteção, domínios ou histórico Vercel.

4. Depois de confirmar que o runtime novo está `READY` no alias, aplique
   separadamente a migration de cutover:

   ```powershell
   npm.cmd run ops:rollout-production -- --phase apply-cutover --source-ref main --commit-sha <sha-main> --deployment-id <deployment-id> --backup-evidence <backup-recente>
   npm.cmd run ops:rollout-production -- --phase apply-cutover --source-ref main --commit-sha <sha-main> --deployment-id <deployment-id> --backup-evidence <backup-recente> --execute --confirm-backup-verified PRODUCTION_BACKUP_VERIFIED --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq --confirm-database-ref wjuzwjbvctbyfvgmprmd --confirm-staging-gates STAGING_RELEASE_GATE_PASSED --confirm-migration 20261018180000_disable_legacy_cash_close.sql
   ```

   Esse gate valida o deployment de produção pelo projeto, estado `READY`, alias
   estável, SHA/ref GitHub, fingerprint do ambiente e metadados da release. O
   dry-run precisa listar exclusivamente
   `20261018180000_disable_legacy_cash_close.sql`; ao final, a automação confirma
   que a RPC legada não pode ser executada e que `close_cash_session_v2` continua
   autorizada. Se o backup tiver mais de uma hora, capture outro antes da fase.

5. Após o cutover, execute a verificação completa e o smoke de produção
   somente leitura com a mesma identidade de deployment:

   ```powershell
   npm.cmd run ops:verify-production -- --confirm-ref wjuzwjbvctbyfvgmprmd --deployment-id <deployment-id> --deployment-url <deployment-url> --source-ref main --commit-sha <sha-main>
   npm.cmd run test:e2e:production-smoke -- --deployment-id <deployment-id> --deployment-url <deployment-url> --source-ref main --commit-sha <sha-main>
   ```

   Preserve os dados de produção; não faça vendas, cancelamentos, ajustes de
   estoque nem fechamentos artificiais como smoke. Monitore os checks de saúde e
   erros por pelo menos 30 minutos. Só depois da verificação, smoke e janela de
   monitoramento aprovados publique a tag assinada `v2.0.0`.
