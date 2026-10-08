# Evidências Do Provisionamento De Staging — PR08

Registro redigido do provisionamento controlado dos ambientes da Roberto
Multimarcas. Tokens, chaves, senhas, e-mails, IDs pessoais e caminhos de objetos
não são registrados neste documento.

## Preflight

- Inventário capturado em: `2026-10-07T09:40:37.484Z`.
- Organização Supabase validada: `wcqoluxxlvglqtebcucz`.
- Staging legado validado: `espaco-personalize-pdv-staging`, ref
  `gpywbeoqcovjrfnmbdqx`, região `us-west-2`, estado `ACTIVE_HEALTHY`.
- Produção legada validada: ref `ciixpfquwmlsvzleattv`, região `us-west-2`,
  estado `ACTIVE_HEALTHY`.
- Região do novo staging validada: `sa-east-1` disponível.
- Novo staging Supabase: `roberto-multimarcas-pdv-staging`, ref
  `otsxpchqtfypxgzjzrxs`, região `sa-east-1`, estado `ACTIVE_HEALTHY`.
- SHA-256 da evidência privada ignorada pelo Git:
  `f23dbd663770a8ca3a9d44b7a24042c5c24b06ad365891717378c8eec252c3b1`.

## Contagens Do Staging Legado

| Tabela            | Registros |
| ----------------- | --------: |
| `profiles`        |         2 |
| `categories`      |         0 |
| `products`        |        34 |
| `stock_movements` |        49 |
| `cash_sessions`   |        41 |
| `sales`           |        24 |
| `sale_items`      |        24 |
| `payments`        |        24 |

## Tentativa Netlify Descartada

Validação concluída em `2026-10-07T11:14:28.6376212Z`.

- Conta: `6ac5be70c558d25c9b304db5`.
- Plano: Free, 300 créditos mensais, uso observado 0 e recarga automática
  desativada.
- Site: `roberto-multimarcas-pdv`.
- Site ID: `cf55faf1-cf67-4120-a2f4-23eb5600e6c7`.
- URL: `https://roberto-multimarcas-pdv.netlify.app`.
- Repositório: `almeidaguil/espaco-personalize-pdv`.
- Branch não produtiva autorizada: `develop`.
- Branch produtiva bloqueada: `netlify-production-disabled-pr09`.
- Comando de build: `npm run build`.
- Deploys produtivos fora do Git: bloqueados.
- Deploy executado: nenhum nesta etapa.

Esse site deixou de ser o alvo do PR08 antes da configuração de variáveis ou
de qualquer deploy. O registro acima é preservado como evidência histórica; ele
não descreve o runtime alvo atual. Nenhuma exclusão remota foi autorizada.

Durante a primeira tentativa, a API criou o shell e recusou ativar a proteção
antes do vínculo ao repositório. O shell foi preservado, identificado pelo ID
acima e recuperado somente após validação de conta, nome, ausência de vínculo e
confirmação literal do ID. A automação passou a ordenar criação, vínculo e
proteção, com cobertura automatizada para recuperação explícita.

## Pivot Para Vercel Hobby

O proprietário declarou uso pessoal/não comercial e aprovou o Vercel Hobby. No
projeto inicialmente reservado `roberto-multimarcas-pdv`
(`prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`), quatro tentativas pela CLI e uma pela API
foram classificadas como Production mesmo sem `--prod`/`target`. Todas falharam
antes de publicar, foram removidas por ID exato e reproduziram a
[ocorrência Vercel #17069](https://github.com/vercel/vercel/issues/17069).

Em seguida o proprietário autorizou explicitamente criar o projeto dedicado
`roberto-multimarcas-pdv-staging` e enviar as três variáveis do Supabase
`otsxpchqtfypxgzjzrxs` ao ambiente Production desse projeto, usado
exclusivamente como staging.

Estado Vercel validado:

- org ID `team_jstETBWBHJi0hsir3a3bAkbK`;
- staging project ID `prj_fb7pug2hcbCGI1XIMLz5VuMr4S79`;
- framework Next.js e Node 22.x;
- duas variáveis Config e uma Secret somente em Production do projeto dedicado;
- deployment `dpl_3oB2HRYi5KBaHzQAk7Y6cnZvfdqD`, estado `READY`;
- URL estável `https://roberto-multimarcas-pdv-staging.vercel.app`;
- metadados `roberto_environment=staging`, `dedicated_staging=true`, `pr08=true`;
- snapshot inicial vindo de `feature/provision-roberto-environments`; o mesmo
  commit passa a compor `develop` no merge, sem promessa de deploy contínuo no
  PR08;
- Vercel Authentication ativa e zero bypasses após o smoke;
- projeto reservado `roberto-multimarcas-pdv` com identidade confirmada, zero
  variáveis, zero deployments de qualquer target e somente o domínio padrão
  `roberto-multimarcas-pdv.vercel.app`, sem domínio customizado, após remover as
  três cópias Preview obsoletas.

## Estado Final Do Provisionamento

- Inventário redigido e dry-runs: aprovados.
- Site Netlify histórico: preservado sem deploy ou variáveis; não é alvo.
- Staging legado Supabase: pausado, estado `INACTIVE`.
- Produção legada Supabase: ativa, saudável e inalterada.
- Novo staging Supabase: `ACTIVE_HEALTHY`, `sa-east-1`, migrations alinhadas.
- Auth: signup público/anônimo desativados, senha mínima 14, `site_url` e
  allowlist na URL estável Vercel. HaveIBeenPwned indisponível no Free (`402`),
  com fallback permitido.
- Bootstrap: exatamente um usuário/perfil `admin`, sem e-mail ou credencial na
  evidência.
- Verificação remota: link local preso ao ref exato, migrations, lint, schema,
  Auth, RLS/policies nas oito tabelas, exatamente um usuário/admin, banco vazio
  e grants financeiros aprovados.
- Smoke Playwright somente leitura: 1/1 aprovado em 20,9 s, cobrindo rota
  protegida, login, dashboard e navegação operacional.
- Vercel Authentication permaneceu ativa. O bypass temporário usado pelo smoke
  foi revogado; contagem final de bypasses: zero. A automação versionada recusa
  bypass preexistente, cria e revoga pela API HTTPS sem segredo em argumentos,
  limpa em `finally`, não propaga o token Vercel ao navegador e não gera trace
  com o header secreto.

Durante a retomada, o Node 22 no Windows recusou executar `npx.cmd` diretamente
com `spawnSync` e retornou `EINVAL`. O verificador passou a reutilizar o executor
Windows testado; a correção tem teste de regressão. Nenhum segredo foi
versionado. Um bypass temporário apareceu em um diagnóstico intermediário e foi
imediatamente tratado como exposto, revogado e substituído antes do smoke final.

## Reconciliação Final De 2026-10-08

Em `2026-10-08T13:37:29-03:00`, a árvore final foi reconciliada novamente:

- Vercel: projeto dedicado, deployment persistido, exatamente três variáveis,
  Vercel Authentication ativa e zero bypasses aprovados;
- projeto Vercel reservado: identidade exata, zero variáveis, zero deployments
  de qualquer target e somente o domínio padrão `.vercel.app`;
- smoke remoto gerenciado: aprovado, com `bypassesAfter=0` e trace desativado;
- Supabase remoto: migrations, lint, schema, Auth, admin, banco operacional vazio
  e grants financeiros aprovados;
- Vitest: 112 arquivos e 538 testes aprovados;
- Playwright local: 48/48 cenários aprovados após reset e aplicação das 24
  migrations;
- `format:check`, ESLint, TypeScript, remoção do legado de eventos e build
  Next.js: aprovados.
