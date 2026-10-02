# Ambientes

O projeto usa ambientes isolados. Banco, autenticacao, chaves e dados nunca
devem ser compartilhados entre staging e producao.

## Matriz Atual Durante A Transicao

| Ambiente | Branch      | Vercel                 | Supabase               | Arquivo local opcional  |
| -------- | ----------- | ---------------------- | ---------------------- | ----------------------- |
| Local    | `feature/*` | Servidor Next.js local | Supabase CLI local     | `.env.local`            |
| Staging  | `develop`   | Preview                | `gpywbeoqcovjrfnmbdqx` | `.env.staging.local`    |
| Producao | `main`      | Production             | `ciixpfquwmlsvzleattv` | `.env.production.local` |

Os refs acima pertencem a operacao legada Espaco Personalize e permanecem em
uso somente enquanto a reestruturacao nao for promovida. Eles nao devem ser
renomeados, limpos ou removidos durante os PRs de desenvolvimento.

## Matriz Alvo Roberto Multimarcas

| Ambiente | Branch      | Vercel                    | Supabase                          |
| -------- | ----------- | ------------------------- | --------------------------------- |
| Local    | `feature/*` | Servidor Next.js local    | Supabase CLI local                |
| Staging  | `develop`   | Novo projeto/Preview      | `roberto-multimarcas-pdv-staging` |
| Producao | `main`      | `roberto-multimarcas-pdv` | `roberto-multimarcas-pdv`         |

Os project refs do Supabase alvo serao registrados depois do provisionamento.
O endpoint Supabase usa um ref aleatorio; a URL publica com a marca sera a da
aplicacao Vercel.

Os arquivos `*.local` sao ignorados pelo Git. Os arquivos
`.env.staging.example` e `.env.production.example` documentam somente o
contrato das variaveis e devem conter apenas placeholders.

## Variaveis Obrigatorias

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` e exclusiva do servidor. Nunca exponha essa chave com o
prefixo `NEXT_PUBLIC_`, em componentes de cliente, logs ou artefatos de CI.

## Vercel

Configure os valores reais diretamente nos ambientes da Vercel:

- `Production`: projeto Supabase de producao e branch `main`;
- `Preview` da branch `develop`: projeto Supabase de staging;
- `Development`: sem credenciais remotas; o fluxo local usa `.env.local` e o
  Supabase CLI local.

Depois de vincular o repositorio ao projeto Vercel, uma copia local temporaria
pode ser obtida com:

```powershell
vercel.cmd env pull .env.staging.local --environment preview --git-branch develop
vercel.cmd env pull .env.production.local --environment production
```

O ambiente de producao deve ser baixado apenas quando houver necessidade
operacional. Prefira validar staging na URL de Preview para reduzir o acesso
local a segredos de producao.

## Supabase

Cada ambiente remoto usa projeto, Auth, banco, Storage e chaves independentes.
Migrations devem seguir esta ordem:

1. desenvolver e validar no Supabase local;
2. aplicar e validar em staging;
3. executar o gate E2E em staging;
4. promover a mesma versao para producao mediante release aprovada.

Nunca use `db reset` em staging ou producao. Projetos remotos novos devem ser
inicializados pela cadeia normal de migrations. Antes de qualquer operacao
remota, confirme explicitamente o project ref selecionado.

## Provisionamento E Rollback

- Validar organizacao, quota, regiao, tamanho e eventual custo antes da criacao.
- Preferir `sa-east-1` para os bancos novos, sujeito a aprovacao.
- Gerar credenciais novas para a Roberto Multimarcas.
- Aplicar migrations e E2E primeiro no novo staging.
- Manter os projetos legados intactos durante a janela de rollback.
- Fazer backup tecnico antes do corte, mesmo com descarte de dados autorizado.
- Nao copiar usuarios, dados ou Storage da operacao anterior por padrao.
- Nao excluir ou desativar projeto remoto sem uma autorizacao especifica.
- Registrar os novos refs sem incluir chaves ou senhas na documentacao.

## Fluxo Git E Release

1. Crie `feature/nome-da-funcionalidade` a partir de `develop` atualizado.
2. Use commits assinados no padrao Conventional Commits.
3. Abra pull request da branch `feature/*` para `develop`.
4. Exija o workflow `Quality` aprovado antes do merge.
5. Valide a Preview de staging e execute o `E2E Release Gate`.
6. Abra pull request de release de `develop` para `main`.
7. Faça merge somente com revisao e todos os checks aprovados.

Commits e pushes diretos em `main` sao proibidos. Force push em `main` e
`develop` tambem e proibido.
