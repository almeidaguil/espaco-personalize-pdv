# Supabase CLI

Este projeto usa Supabase CLI para controlar configuracoes locais, migrations e fluxo de banco.

O CLI `2.105.0` esta fixado como dependencia de desenvolvimento do projeto. Use
`npx.cmd supabase` ou o binario local instalado pelo npm, evitando uma versao
global diferente da usada pelo restante da equipe.

## Variaveis Publicas Do App

Use `.env.local` para desenvolvimento local:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

O arquivo `.env.local` nao deve ser versionado.

`SUPABASE_SECRET_KEY` e exclusiva do servidor. Nunca use o prefixo
`NEXT_PUBLIC_` nessa variavel e nunca a acesse em componentes de cliente.

## Projetos Remotos

| Ambiente                     | Project ref            | Estado                                  |
| ---------------------------- | ---------------------- | --------------------------------------- |
| Staging Roberto Multimarcas  | `otsxpchqtfypxgzjzrxs` | ativo; promoções coordenadas            |
| Staging legado               | `gpywbeoqcovjrfnmbdqx` | pausado; não usar para novas validações |
| Produção legada              | `ciixpfquwmlsvzleattv` | preservada; não alterar                 |
| Produção Roberto Multimarcas | `wjuzwjbvctbyfvgmprmd` | ativa; dados operacionais preservados   |

Nunca compartilhe banco, usuarios ou chaves entre os dois ambientes.

Para vincular o projeto remoto via CLI, sera necessario autenticar a CLI:

```txt
npx supabase login
npx supabase link --project-ref PROJECT_REF_CONFIRMADO
```

Nao versionar tokens, senha do banco, service role key ou arquivos locais criados pelo link.
Confirme o project ref antes de qualquer comando remoto e nunca execute
`db reset` fora do ambiente local.

Para promover migrations em staging, use o fluxo versionado
[Promoção para staging](vercel-cli.md#promover-uma-vers%C3%A3o-para-staging).
Para releases de produção, use a sequência protegida em
[Promoção para produção](vercel-cli.md#promover-uma-vers%C3%A3o-para-produ%C3%A7%C3%A3o).
Não execute `supabase db push` diretamente contra os ambientes remotos: o fluxo
limita cada fase ao bundle de migrations aprovado, valida o projeto de destino,
exige backup recente e respeita a ordem foundation → deployment → cutover.

## Comandos Uteis

```txt
npx supabase --version
npx supabase status
npx supabase migration new nome_da_migration
npx supabase db reset
```

No PowerShell deste projeto, prefira os comandos compativeis com Windows:

```powershell
npx.cmd supabase start
npx.cmd supabase status
npx.cmd supabase db reset
npx.cmd supabase db lint --local
npx.cmd supabase stop
```

## Servicos Locais

Com a stack iniciada:

```txt
API: http://127.0.0.1:54321
Banco: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio: http://127.0.0.1:54323
Mailpit: http://127.0.0.1:54324
```

Consulte as chaves locais atuais sem copia-las para arquivos versionados:

```powershell
npx.cmd supabase status
```

As chaves locais sao credenciais de desenvolvimento compartilhadas pela stack
do Supabase CLI e nunca devem ser reutilizadas em producao.
