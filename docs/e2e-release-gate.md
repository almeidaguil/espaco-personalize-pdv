# Gate E2E De Release

Este projeto usa Playwright como validacao final antes de uma release estavel.

## Quando Rodar

Rode o gate E2E antes de promover `develop` para `main` ou antes de entregar uma versao para uso real em evento.

O workflow normal de PR continua executando lint, type-check, testes unitarios e
build. O E2E usa Supabase real, usuario real e pode criar dados operacionais;
por isso ele roda automaticamente apenas em PRs para `main` e tambem pode ser
acionado manualmente.

## Secrets Necessarios No GitHub

Configure estes secrets no repositorio:

- `E2E_USER_EMAIL`
- `E2E_USER_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

O usuario E2E deve ser admin, porque os fluxos cobrem produtos, eventos, caixa, venda e cancelamento.

Use uma base de homologacao/staging para este workflow. O setup E2E fecha caixas abertos apenas de eventos com `e2e` no nome para limpar residuos de execucoes anteriores.

O workflow fixa o project ref esperado de staging e encerra antes dos testes se
`NEXT_PUBLIC_SUPABASE_URL` apontar para outro projeto. Essa trava impede que o
gate altere dados de producao por configuracao incorreta de secrets.

## Como Rodar No GitHub

Em um PR de `develop` para `main`, o gate inicia automaticamente e deve ser um
check obrigatorio da branch `main`.

Para uma execucao manual:

1. Abra `Actions`.
2. Selecione `E2E Release Gate`.
3. Clique em `Run workflow`.
4. Opcionalmente informe `base_url` para testar uma URL ja publicada.
5. Aguarde o resultado de `Playwright E2E`.

Se `base_url` ficar vazio, o Playwright inicia o servidor Next.js local do runner.

## Como Rodar Localmente

Configure as variaveis na sessao atual ou em `.env.e2e.local`:

```powershell
$env:E2E_USER_EMAIL="admin@example.com"
$env:E2E_USER_PASSWORD="senha-do-admin"
$env:NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica"
$env:SUPABASE_SECRET_KEY="sua-chave-secreta"
```

Depois execute:

```powershell
npm.cmd run e2e:seed-local
npm.cmd run test:e2e:required
```

O comando `e2e:seed-local` cria ou atualiza o administrador E2E usando as
credenciais locais. Ele recusa URLs que nao sejam `localhost` ou `127.0.0.1`,
portanto nunca deve ser usado para preparar staging ou producao. Execute-o
novamente depois de `supabase db reset`.

Use `npm.cmd run test:e2e` apenas durante desenvolvimento local, quando aceitar que testes sejam pulados por falta de credenciais.

## Criterio De Release

Uma release so deve ser promovida quando:

- `Quality checks` estiver verde no PR;
- `E2E Release Gate` passar;
- nao houver dados de teste misturados na base de entrega final;
- credenciais sensiveis expostas durante desenvolvimento tiverem sido rotacionadas.
