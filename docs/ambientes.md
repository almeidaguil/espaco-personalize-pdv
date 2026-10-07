# Ambientes

Banco, autenticação, chaves e dados são isolados entre local, staging e
produção. O PR08 substitui apenas o staging; o corte de produção pertence ao
PR09.

## Matriz Durante O PR08

| Ambiente        | Branch      | Aplicação             | Supabase                                                       | Estado                       |
| --------------- | ----------- | --------------------- | -------------------------------------------------------------- | ---------------------------- |
| Local           | `feature/*` | Next.js local         | Supabase CLI local                                             | ativo                        |
| Staging legado  | —           | Vercel legado         | `gpywbeoqcovjrfnmbdqx`                                         | ativo até a pausa confirmada |
| Staging novo    | `develop`   | Netlify não produtivo | `roberto-multimarcas-pdv-staging`, ref registrado após criação | alvo do PR08                 |
| Produção legada | `main`      | Vercel legado         | `ciixpfquwmlsvzleattv`                                         | preservado e saudável        |
| Produção nova   | `main`      | Netlify               | `roberto-multimarcas-pdv`                                      | proibida no PR08; PR09       |

O site Netlify aprovado é `roberto-multimarcas-pdv`, sujeito à disponibilidade.
A branch produtiva fica deliberadamente apontada para
`netlify-production-disabled-pr09`; somente `develop`, `deploy-preview` e
`branch-deploy` recebem credenciais de staging.

## Manifesto E Arquivos Locais

`config/remote-environments.json` é a allowlist versionada de nomes, refs, IDs,
hosts, conta, organização, repositório e branches. O manifesto nunca contém
tokens, senhas ou chaves. Depois de cada criação remota, apenas IDs e URLs não
sensíveis comprovados são persistidos.

Arquivos `*.local` e `.provisioning/` são ignorados pelo Git. Os arquivos
`.env.staging.example` e `.env.production.example` contêm apenas o contrato e
placeholders.

## Variáveis Obrigatórias

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

`SUPABASE_SECRET_KEY` é exclusiva do servidor. Nunca use o prefixo
`NEXT_PUBLIC_`, componentes cliente, logs ou artefatos de CI para essa chave.
No PR08 os três valores são enviados ao Netlify somente para os contextos não
produtivos permitidos.

Credenciais operacionais temporárias:

```txt
SUPABASE_ACCESS_TOKEN=
NETLIFY_AUTH_TOKEN=
NETLIFY_ACCOUNT_ID=
STAGING_ADMIN_EMAIL=
STAGING_ADMIN_FULL_NAME=
STAGING_ADMIN_PASSWORD=
```

Esses valores existem somente na sessão do terminal ou em cofre privado. Não
os grave no repositório, em documentação, issue ou PR.

## Sequência PR08

1. Executar todos os comandos `ops:*` primeiro em dry-run.
2. Confirmar organização Supabase `wcqoluxxlvglqtebcucz`, limite gratuito,
   região `sa-east-1` e produção legada `ciixpfquwmlsvzleattv` saudável.
3. Inventariar o staging legado em `.provisioning/` e registrar somente resumo
   redigido.
4. Imediatamente antes da mutação, confirmar literalmente a pausa de
   `espaco-personalize-pdv-staging` (`gpywbeoqcovjrfnmbdqx`).
5. Pausar apenas esse staging e reconfirmar a produção legada saudável.
6. Criar `roberto-multimarcas-pdv-staging` em `sa-east-1`, sem tamanho pago
   explícito, e aplicar migrations sem `db reset` remoto.
7. Registrar o novo ref no manifesto, criar somente o admin de homologação e
   validar migrations, schema, Auth, RLS, grants, RPCs e banco vazio.
8. Criar/vincular o site Netlify, registrar conta/site e manter produção
   bloqueada.
9. Configurar as três variáveis de staging em memória, fazer deploy não
   produtivo e executar smoke remoto somente leitura.
10. Remover tokens da sessão e registrar evidências redigidas.

Os comandos completos estão em [Supabase CLI](supabase-cli.md),
[Netlify CLI](netlify-cli.md) e [Runbook operacional](runbook-operacional.md).

## Supabase E Rollback

Migrations seguem local → staging → produção. Nunca use `db reset` em ambiente
remoto e nunca reescreva migration aplicada. Todo comando mutável exige
`--execute`, allowlist e confirmação literal.

Se o novo staging falhar após a troca:

1. preserve o projeto parcial e as evidências;
2. se for necessário restaurar o legado, pause primeiro o novo staging para
   manter no máximo dois projetos gratuitos ativos;
3. restaure `gpywbeoqcovjrfnmbdqx` somente após nova confirmação explícita;
4. não exclua projeto automaticamente.

A produção legada não é pausada, alterada ou excluída no PR08.

## Netlify E Limite Gratuito

O `netlify.toml` fixa Node/npm e o build oficial. O provisionador usa
`netlify-cli@27.11.2` por `npx`, recusa flags de produção e valida conta, site,
repositório e branches após a alteração. Se o nome aprovado estiver
indisponível, o fluxo para e exige nova aprovação.

O plano Free possui orçamento mensal compartilhado. Ao se aproximar de 300
créditos, suspenda deploys não essenciais antes de consumir o limite. O Vercel
legado permanece intacto até o PR09.

## Fluxo Git E Release

1. Criar `feature/*` a partir de `develop` atualizado.
2. Usar commits assinados e Conventional Commits.
3. Integrar `feature/*` em `develop` somente por PR e checks.
4. Validar staging Netlify e o gate E2E aplicável.
5. Abrir PR de release `develop` → `main` somente no PR09.
6. Nunca fazer push direto ou force push em `develop`/`main`.
