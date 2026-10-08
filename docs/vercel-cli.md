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
`feature/provision-roberto-environments`; esse commit passa a compor `develop`
quando o PR for integrado. O provisionador do PR08 é deliberadamente imutável e
não substitui deployments persistidos. Como não há integração Git, promoções
futuras dependem de um fluxo posterior, versionado e auditado.

Em divergência, pare sem promover, excluir projeto ou alterar `main`. Preserve
evidências redigidas e retome apenas a etapa idempotente correspondente.
