# Netlify CLI

Runbook de autenticação e uso do Netlify no provisionamento dos ambientes da
Roberto Multimarcas. O PR08 permite apenas site, previews e deploys da branch
`develop`; produção permanece bloqueada até o PR09.

## Pré-requisitos

- Node.js `22.23.2` e npm `10.9.8`;
- acesso autorizado à conta Netlify Free;
- repositório público `almeidaguil/espaco-personalize-pdv`;
- token pessoal Netlify e ID da conta mantidos somente na sessão;
- manifesto `config/remote-environments.json` revisado.

O projeto fixa `netlify-cli@27.11.2` via `npx`, sem instalação global:

```powershell
npx.cmd --yes netlify-cli@27.11.2 --version
```

## Autenticação

Crie um token pessoal no Netlify e injete-o apenas no processo atual. Não cole
o valor em arquivo versionado, documentação, issue, PR ou comando que possa ser
registrado no histórico.

```powershell
$env:NETLIFY_AUTH_TOKEN = '<token-temporario>'
$env:NETLIFY_ACCOUNT_ID = '<account-id>'
npx.cmd --yes netlify-cli@27.11.2 status
```

Ao terminar, remova as variáveis e revogue ou rotacione o token se ele tiver
sido criado exclusivamente para o provisionamento:

```powershell
Remove-Item Env:NETLIFY_AUTH_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:NETLIFY_ACCOUNT_ID -ErrorAction SilentlyContinue
npx.cmd --yes netlify-cli@27.11.2 logout
```

O token deve ter somente o acesso necessário à conta e ao site. Variáveis
Supabase são enviadas pela API HTTPS e nunca persistidas pelo script em arquivos.

## Configuração De Build

`netlify.toml` fixa `npm run build`, Node.js `22.23.2` e npm `10.9.8`. O adaptador
Next.js do Netlify gerencia o diretório de publicação; não configure `publish`
manualmente. O arquivo não contém credenciais.

O site aprovado é `roberto-multimarcas-pdv`, conectado ao repositório público
aprovado. Enquanto o PR08 estiver ativo:

- branch produtiva: `netlify-production-disabled-pr09`;
- única branch de staging permitida: `develop`;
- `prevent_non_git_prod_deploys`: habilitado;
- proibidos: `--prod`, `--prod-if-unlocked` e variáveis no contexto `production`.

## Comandos Seguros

Planejar a criação sem autenticação e sem mutação:

```powershell
npm.cmd run ops:provision-netlify -- --phase site
```

Criar e vincular o site após a aprovação operacional:

```powershell
npm.cmd run ops:provision-netlify -- --phase site --execute --confirm-site roberto-multimarcas-pdv
```

Depois de registrar `accountId` e `siteId` no manifesto e obter as chaves do
novo staging Supabase apenas em memória, conferir o plano:

```powershell
npm.cmd run ops:provision-netlify -- --phase configure-staging
```

Configurar staging e disparar somente um deploy draft/branch:

```powershell
npm.cmd run ops:provision-netlify -- --phase configure-staging --execute --confirm-site roberto-multimarcas-pdv
```

As únicas variáveis aceitas são:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

Cada uma é marcada como secreta e limitada a `deploy-preview`,
`branch-deploy` e à branch `develop`. A configuração falha se o site, conta,
repositório, URL, branches ou projeto Supabase divergirem do manifesto.

## Falhas E Recuperação

- Nome indisponível: não escolha outro nome; interrompa e obtenha nova aprovação.
- Site parcial: preserve-o, registre o ID e retome idempotentemente; não exclua.
- Repositório não vinculado: não faça deploy; corrija o vínculo e repita a
  verificação de `build_settings`.
- Produção não comprovadamente bloqueada: interrompa antes de enviar variáveis.
- Deploy com falha: mantenha o site sem publicação produtiva; a produção Vercel
  legada continua sendo o runtime de rollback.
- Limite Free próximo de 300 créditos mensais: suspenda deploys não essenciais
  e revise o consumo antes de nova execução.

Nunca use exclusão automática para recuperar o fluxo. Nunca coloque tokens ou
chaves em argumentos de CLI, pois eles podem aparecer na lista de processos.
