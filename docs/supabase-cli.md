# Supabase CLI

Este projeto usa Supabase CLI para controlar configuracoes locais, migrations e fluxo de banco.

## Variaveis Publicas Do App

Use `.env.local` para desenvolvimento local:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

O arquivo `.env.local` nao deve ser versionado.

## Projeto Remoto

Projeto Supabase:

```txt
ciixpfquwmlsvzleattv
```

Para vincular o projeto remoto via CLI, sera necessario autenticar a CLI:

```txt
npx supabase login
npx supabase link --project-ref ciixpfquwmlsvzleattv
```

Nao versionar tokens, senha do banco, service role key ou arquivos locais criados pelo link.

## Comandos Uteis

```txt
npx supabase --version
npx supabase status
npx supabase migration new nome_da_migration
npx supabase db reset
```
