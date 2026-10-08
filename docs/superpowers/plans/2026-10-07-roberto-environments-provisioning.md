# Roberto Multimarcas Environments Provisioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar no PR08 um staging vazio e exclusivo da Roberto Multimarcas no Supabase Free, vinculado somente a deployments Vercel Preview, com automação fail-closed, bootstrap de um único administrador e evidências sem segredos.

**Architecture:** Um manifesto versionado define todos os alvos permitidos, enquanto uma política pura valida leitura, mutação, ambiente e confirmação antes de qualquer cliente remoto. Adaptadores pequenos encapsulam Supabase Management API, Supabase CLI e Vercel CLI/API; os orquestradores usam dry-run por padrão, recebem dependências injetáveis para testes e geram somente evidências redigidas. A execução remota é sequencial: inventariar e pausar apenas o staging legado, criar e migrar o staging novo, bootstrap, preparar o projeto Vercel sem Production, configurar Preview e executar smoke remoto.

**Tech Stack:** Node.js 22.23.2, TypeScript, Vitest 4, Supabase CLI 2.105.0, Supabase JS 2.108.1, Vercel CLI 62.7.0, Vercel API, Zod 4, Playwright 1.60, Git/GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-10-07-roberto-environments-provisioning-design.md`

## Global Constraints

- Custo mensal base zero; não habilitar cobrança automática nem contratar plano.
- Manter no máximo dois projetos Supabase Free ativos.
- Preservar saudável e sem alterações o legado de produção `ciixpfquwmlsvzleattv` durante todo o PR08.
- Inventariar e pausar somente o staging legado `gpywbeoqcovjrfnmbdqx`, sempre após confirmação literal e revalidação remota imediata.
- Criar somente `roberto-multimarcas-pdv-staging` em `sa-east-1`; produção nova pertence ao PR09.
- Não excluir projeto Supabase/Vercel, não resetar banco remoto e não migrar dados da Espaço Personalize.
- Toda mutação usa dry-run por padrão e exige `--execute` mais confirmação literal do alvo.
- Segredos entram somente por variáveis do processo ou pelo armazenamento autenticado da CLI; nunca aparecem em Git, arquivos de evidência, saída, erros ou comandos registrados.
- O novo projeto Vercel usa `roberto-multimarcas-pdv`, preset Next.js, Node 22.x,
  repositório `almeidaguil/espaco-personalize-pdv` e apenas Preview/staging no
  PR08.
- Nenhuma variável, alias ou deployment de Production é criado no projeto novo;
  nenhum comando recebe `--prod` e a branch `main` não é publicada neste PR.
- Commits assinados e Conventional Commits na branch `feature/provision-roberto-environments`; integração apenas por PR para `develop`.

## Review Focus

- Manifesto adulterado ou alvo remoto divergente deve falhar antes de qualquer chamada mutável; cobrir na Task 1.
- Saída de CLI/API contendo token, chave, e-mail ou caminho de Storage deve ser redigida inclusive em erros; cobrir nas Tasks 2 e 3.
- Falha depois de pausar o staging legado não pode tocar a produção nem excluir automaticamente o projeto novo; cobrir na Task 4.
- Bootstrap repetido deve reconciliar o mesmo admin, mas recusar usuários extras, senha de teste ou perfil incompatível; cobrir na Task 5.
- Configuração Vercel deve impedir Production, isolar Preview em staging e recusar repositório, projeto ou conta divergentes; cobrir na Task 6.

---

### Task 1: Manifesto de ambientes e política fail-closed

**Files:**

- Create: `config/remote-environments.json`
- Create: `scripts/remote-environment-policy.mjs`
- Create: `scripts/remote-environment-policy.test.ts`
- Create: `scripts/verify-remote-target.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**

- Produces: `loadRemoteEnvironmentManifest(filePath): Promise<RemoteEnvironmentManifest>`.
- Produces: `validateRemoteOperation({ manifest, provider, environment, operation, target, execute, confirmation }): ValidatedRemoteOperation`.
- Produces: `redactSensitiveText(value, sensitiveValues): string` e `createSafeLogger({ log, sensitiveValues })`.
- Produces: CLI `npm run ops:verify-target -- --provider <provider> --environment <environment> --operation <operation> [--execute --confirm <literal>]`.

- [ ] **Step 1: Escrever os testes falhando da política**

Cobrir manifesto válido, formato inválido de ref/site ID, mutação sem `--execute`, confirmação diferente, organização/hostname/ref divergente, ref de produção em operação de staging, ref legado em alvo novo e redação recursiva de sentinelas em mensagens/objetos.

- [ ] **Step 2: Confirmar a falha inicial**

Run: `npm.cmd test -- scripts/remote-environment-policy.test.ts`

Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Criar o manifesto não sensível**

Fixar organização Supabase `wcqoluxxlvglqtebcucz`, refs legados, região `sa-east-1`, alvos novos inicialmente sem ref, repositório GitHub, branches e projeto Vercel inicialmente sem `projectId`/`orgId`. Não incluir URL assinada, chave ou senha.

- [ ] **Step 4: Implementar a política pura e a CLI de verificação**

Operações `read` não exigem confirmação; operações `mutate` exigem `execute === true` e confirmação exatamente igual ao identificador autorizado. A saída estruturada contém apenas provedor, ambiente, operação, nome, ref/ID não secreto e resultado.

- [ ] **Step 5: Ignorar estado local das ferramentas**

Adicionar `/.vercel/` e `/.provisioning/` ao `.gitignore`, sem ampliar padrões para arquivos versionados. Adicionar `ops:verify-target` ao `package.json`.

- [ ] **Step 6: Verificar testes e formato**

Run: `npm.cmd test -- scripts/remote-environment-policy.test.ts`

Expected: PASS.

Run: `npm.cmd run format:check`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add config/remote-environments.json scripts/remote-environment-policy.mjs scripts/remote-environment-policy.test.ts scripts/verify-remote-target.mjs .gitignore package.json
git commit -S -m "feat(ops): add remote target safety policy"
```

### Task 2: Adaptadores autenticados de Supabase e Vercel

**Files:**

- Create: `scripts/supabase-management-client.mjs`
- Create: `scripts/supabase-management-client.test.ts`
- Create: `scripts/vercel-management-client.mjs`
- Create: `scripts/vercel-management-client.test.ts`

**Interfaces:**

- Consumes: `redactSensitiveText` e `createSafeLogger` da Task 1.
- Produces: `createSupabaseManagementClient({ accessToken, fetch, baseUrl })` com `listProjects`, `getProject`, `createProject`, `pauseProject`, `getAuthConfig`, `updateAuthConfig` e `getApiKeys`.
- Produces: `parseSupabaseApiKeys(keys): { publishableKey: string; secretKey: string }`, preferindo tipos modernos e aceitando fallback legado.
- Produces: `createVercelManagementClient({ authToken, fetch, baseUrl })` com leitura da conta, projeto, deployments, variáveis por ambiente e configuração fail-closed de Preview.
- Produces: `buildSupabaseUrl(projectRef): string`.

- [ ] **Step 1: Escrever testes falhando dos clientes HTTP**

Usar `fetch` falso para fixar métodos, URLs, headers, corpos e tratamento de erro. Cobrir respostas não JSON, timeout/abort, chaves modernas e legadas, projeto/conta divergente, variável sensível em Preview, ausência de variáveis Production e zero Production Deployments.

- [ ] **Step 2: Confirmar a falha inicial**

Run: `npm.cmd test -- scripts/supabase-management-client.test.ts scripts/vercel-management-client.test.ts`

Expected: FAIL porque os módulos ainda não existem.

- [ ] **Step 3: Implementar o cliente Supabase**

Usar `Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}`, `AbortSignal.timeout`, erros redigidos e nunca serializar `db_pass` ou chaves na saída. A criação recebe `dbPass` em memória e omite tamanho pago, solicitando o menor tamanho gratuito disponível.

- [ ] **Step 4: Implementar o cliente Vercel**

Usar `Authorization: Bearer ${VERCEL_TOKEN}`. Enviar variáveis pelo corpo HTTPS da API oficial ou pela entrada padrão da CLI, nunca por arquivo `.env` ou argumento; limitar ao ambiente Preview, marcar somente a chave de servidor como sensível e não retornar valores depois da gravação.

- [ ] **Step 5: Verificar os adaptadores**

Run: `npm.cmd test -- scripts/supabase-management-client.test.ts scripts/vercel-management-client.test.ts`

Expected: PASS sem imprimir sentinelas de segredo.

- [ ] **Step 6: Commit**

```powershell
git add scripts/supabase-management-client.mjs scripts/supabase-management-client.test.ts scripts/vercel-management-client.mjs scripts/vercel-management-client.test.ts
git commit -S -m "feat(ops): add remote provider adapters"
```

### Task 3: Inventário redigido do staging legado

**Files:**

- Create: `scripts/inventory-supabase-project.mjs`
- Create: `scripts/inventory-supabase-project.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: manifesto/política da Task 1 e cliente Supabase da Task 2.
- Produces: `collectSupabaseInventory({ project, managementClient, databaseReader, authReader, storageReader, now }): Promise<RedactedSupabaseInventory>`.
- Produces: `collectDeploymentDependencies({ githubReader, vercelReader }): Promise<RedactedDeploymentDependencies>` com somente nomes, branches, URLs públicas e IDs não sensíveis.
- Produces: `writeInventoryEvidence({ inventory, privateDirectory, publicFile }): Promise<{ sha256: string; capturedAt: string }>`.
- Produces: CLI `npm run ops:inventory-staging -- [--output <path>]` somente leitura.

- [ ] **Step 1: Escrever testes falhando do inventário**

Cobrir as oito tabelas operacionais, migrations, usuários agrupados apenas por papel, buckets com quantidade/tamanho agregados, Auth sem segredos, dependências conhecidas do repositório GitHub/projeto Vercel e evidência com SHA-256. Inserir sentinelas de e-mail, UUID, API key e caminho de objeto e afirmar que nenhuma aparece no resumo, erro ou logger.

- [ ] **Step 2: Confirmar a falha inicial**

Run: `npm.cmd test -- scripts/inventory-supabase-project.test.ts`

Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Implementar coleta e persistência segura**

Consultar somente `profiles`, `categories`, `products`, `stock_movements`, `cash_sessions`, `sales`, `sale_items` e `payments`. Gravar detalhes locais potencialmente sensíveis em `.provisioning/inventory/`; o artefato versionável contém somente contagens, configurações permitidas, horário e hash.

- [ ] **Step 4: Adicionar comando e verificar**

Adicionar `ops:inventory-staging` ao `package.json`.

Run: `npm.cmd test -- scripts/inventory-supabase-project.test.ts`

Expected: PASS.

Run: `npm.cmd run ops:inventory-staging -- --help`

Expected: exit 0, identificação do ref legado e nenhuma conexão mutável.

- [ ] **Step 5: Commit**

```powershell
git add scripts/inventory-supabase-project.mjs scripts/inventory-supabase-project.test.ts package.json
git commit -S -m "feat(ops): add redacted staging inventory"
```

### Task 4: Orquestrador seguro do staging Supabase

**Files:**

- Create: `scripts/provision-supabase-staging.mjs`
- Create: `scripts/provision-supabase-staging.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: política da Task 1, cliente Supabase da Task 2 e evidência da Task 3.
- Produces: `runSupabaseStagingProvisioning({ args, manifest, environment, managementClient, commandRunner, wait, log }): Promise<ProvisioningResult>`.
- Produces: CLI `npm run ops:provision-staging -- [--execute --confirm-legacy-ref <ref>]`.
- Produces: resultado não sensível `{ mode, legacyState, productionState, targetState, targetRef?, region, nextAction }`.

- [ ] **Step 1: Escrever testes falhando do dry-run e da máquina de estados**

Cobrir: dry-run sem mutação; inventário ausente/desatualizado; dois projetos ativos; staging/produção divergentes; região indisponível; confirmação errada; pausa seguida de polling limitado; criação sem tamanho pago; senha forte somente em memória; `db push --dry-run` antes do push; migration falhando interrompe Auth/bootstrap; falha parcial preserva o projeto e nunca chama delete/restauração/produção.

- [ ] **Step 2: Confirmar a falha inicial**

Run: `npm.cmd test -- scripts/provision-supabase-staging.test.ts`

Expected: FAIL porque o orquestrador ainda não existe.

- [ ] **Step 3: Implementar preflight e dry-run**

Reconsultar a organização e os três alvos imediatamente antes de cada mutação. Exigir produção legada saudável, alvo novo ausente e inventário válido. Gerar um plano estruturado, sem token/senha, quando `--execute` não estiver presente.

- [ ] **Step 4: Implementar pausa, criação e polling limitado**

Em execução, pausar somente `gpywbeoqcovjrfnmbdqx`, aguardar a vaga, revalidar `ciixpfquwmlsvzleattv`, gerar `dbPass` criptograficamente e criar `roberto-multimarcas-pdv-staging` em `sa-east-1`. Não implementar delete ou criação de produção.

- [ ] **Step 5: Implementar migrations e Auth**

Vincular temporariamente o projeto novo, executar `supabase db push --linked --dry-run` e somente depois `supabase db push --linked`; nunca usar `db reset`. Desabilitar signup público/anônimo e habilitar proteção de senha vazada quando suportada. Configurar `site_url`/allowlist com a URL Vercel Preview exata somente depois de o deployment ter sido criado e validado.

- [ ] **Step 6: Adicionar comando e verificar**

Adicionar `ops:provision-staging` ao `package.json`.

Run: `npm.cmd test -- scripts/provision-supabase-staging.test.ts`

Expected: PASS.

Run: `npm.cmd run ops:provision-staging`

Expected: exit 0 em dry-run, nenhuma mutação e aviso de checkpoints faltantes.

- [ ] **Step 7: Commit**

```powershell
git add scripts/provision-supabase-staging.mjs scripts/provision-supabase-staging.test.ts package.json
git commit -S -m "feat(ops): automate safe staging provisioning"
```

### Task 5: Bootstrap idempotente e verificação remota

**Files:**

- Create: `scripts/bootstrap-staging-admin.mjs`
- Create: `scripts/bootstrap-staging-admin.test.ts`
- Create: `scripts/verify-remote-staging.mjs`
- Create: `scripts/verify-remote-staging.test.ts`
- Create: `scripts/remote-staging-smoke-environment.mjs`
- Create: `scripts/remote-staging-smoke-environment.test.ts`
- Create: `playwright.remote-staging.config.ts`
- Create: `tests/e2e/remote-staging-smoke.spec.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: política da Task 1, parser de chaves da Task 2 e ref novo persistido no manifesto.
- Produces: `bootstrapStagingAdmin({ environment, manifest, supabaseAdmin, email, password, fullName, execute, confirmation, log }): Promise<BootstrapResult>`.
- Produces: `verifyRemoteStaging({ manifest, managementClient, anonymousClient, authenticatedClient, commandRunner }): Promise<RemoteVerificationReport>`.
- Produces: `resolveRemoteStagingSmokeEnvironment(environment, manifest): RemoteStagingSmokeEnvironment`.
- Produces: CLIs `npm run ops:bootstrap-staging-admin`, `npm run ops:verify-staging` e `npm run test:e2e:staging-smoke`.

- [ ] **Step 1: Escrever testes falhando do bootstrap**

Cobrir senha com menos de 14 caracteres, credenciais E2E conhecidas, ausência de variáveis, dry-run, criação única, segunda execução idempotente, perfil não admin, e-mail diferente, usuário extra e redação do e-mail/senha/token.

- [ ] **Step 2: Escrever testes falhando da verificação**

Cobrir ref/hostname divergente, migrations desalinhadas, signup habilitado, tabela/RPC ausente, escrita financeira direta aceita, dados operacionais inesperados e relatório redigido de sucesso.

- [ ] **Step 3: Escrever testes falhando do ambiente de smoke remoto**

Exigir `E2E_BASE_URL` HTTPS com hostname Vercel Preview exato autorizado no manifesto, credenciais do admin de staging no processo e ref Supabase igual ao manifesto. Recusar localhost, hostname de Production/legado, credenciais E2E locais e qualquer configuração que solicite criação/limpeza de dados.

- [ ] **Step 4: Confirmar a falha inicial**

Run: `npm.cmd test -- scripts/bootstrap-staging-admin.test.ts scripts/verify-remote-staging.test.ts scripts/remote-staging-smoke-environment.test.ts`

Expected: FAIL porque os módulos ainda não existem.

- [ ] **Step 5: Implementar bootstrap**

Consumir `STAGING_ADMIN_EMAIL`, `STAGING_ADMIN_PASSWORD` e `STAGING_ADMIN_FULL_NAME` apenas do ambiente. Criar/reconciliar exatamente um usuário e perfil `admin`; nunca criar operador, produto, caixa ou venda; recusar sobrescrita incompatível.

- [ ] **Step 6: Implementar verificador**

Comparar migrations locais/remotas, schema esperado, Auth, tabelas vazias e um único admin. Autenticar o admin e confirmar leitura permitida; tentar escrita financeira direta e exigir recusa por RLS/grants. Executar lint remoto somente leitura e reportar nomes de checks, sem dados.

- [ ] **Step 7: Implementar smoke Playwright somente leitura**

Criar configuração sem `webServer` que valide o ambiente antes de carregar testes. O cenário deve provar redirecionamento de rota protegida sem sessão, login do admin, dashboard e navegação por produtos, PDV, caixa, vendas, estoque e relatórios sem submeter formulários nem chamar seeds/limpezas.

- [ ] **Step 8: Adicionar comandos e verificar**

Run: `npm.cmd test -- scripts/bootstrap-staging-admin.test.ts scripts/verify-remote-staging.test.ts scripts/remote-staging-smoke-environment.test.ts`

Expected: PASS.

Run: `npm.cmd run ops:bootstrap-staging-admin -- --help`

Expected: exit 0 e nenhuma credencial impressa.

- [ ] **Step 9: Commit**

```powershell
git add scripts/bootstrap-staging-admin.mjs scripts/bootstrap-staging-admin.test.ts scripts/verify-remote-staging.mjs scripts/verify-remote-staging.test.ts scripts/remote-staging-smoke-environment.mjs scripts/remote-staging-smoke-environment.test.ts playwright.remote-staging.config.ts tests/e2e/remote-staging-smoke.spec.ts package.json
git commit -S -m "feat(ops): add staging bootstrap and verification"
```

### Task 6: Configuração Vercel somente Preview

**Files:**

- Create: `scripts/provision-vercel-project.mjs`
- Create: `scripts/provision-vercel-project.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: política da Task 1, cliente Vercel da Task 2 e chaves Supabase obtidas em memória.
- Produces: `runVercelProvisioning({ args, manifest, environment, vercelClient, log, wait }): Promise<VercelProvisioningResult>`.
- Produces: CLI `npm run ops:provision-vercel -- --phase <configure-preview|deploy-preview|verify-preview> [--execute --confirm-project <project-id>]`.
- Produces: estado não sensível `{ orgId, projectId, projectName, previewUrl?, repository, stagingBranch, productionDeployments }`.

- [ ] **Step 1: Escrever testes falhando da configuração**

Cobrir fase inválida, conta/projeto divergente, integração Git presente, dry-run, versão fixa do CLI, framework diferente de Next.js, Node diferente de 22.x, tentativa de `--prod`, variável fora de Preview, secret em saída/erro, Production Deployment existente e tentativa de configurar credenciais de Production. `configure-preview` exige projeto validado e as três variáveis em memória; `deploy-preview` e `verify-preview` exigem as variáveis já validadas.

- [ ] **Step 2: Confirmar a falha inicial**

Run: `npm.cmd test -- scripts/provision-vercel-project.test.ts`

Expected: FAIL porque o módulo ainda não existe.

- [ ] **Step 3: Fixar build Vercel**

Configurar preset Next.js, `npm run build`, Node 22.x e npm `10.9.8`. Qualquer configuração versionada de Git deve impedir deploy automático de `main` no PR08 e permitir somente o fluxo Preview aprovado.

- [ ] **Step 4: Implementar criação, vínculo e bloqueio de Production**

Executar Vercel CLI `62.7.0` somente para inspeção e configuração. Criar o Preview pela API a partir da referência Git aprovada, sem conectar a integração Git; remover e falhar imediatamente se a plataforma classificar a solicitação como Production. Interromper se não for possível provar zero variáveis, aliases e deployments de Production.

- [ ] **Step 5: Implementar variáveis e deployment Preview**

Enviar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` pela API HTTPS ou entrada padrão da CLI, limitadas a Preview. Marcar `SUPABASE_SECRET_KEY` como sensível, disparar somente deployment Preview e persistir a URL HTTPS exata para Auth e smoke.

- [ ] **Step 6: Adicionar comando e verificar**

Run: `npm.cmd test -- scripts/provision-vercel-project.test.ts`

Expected: PASS.

Run: `npm.cmd run ops:provision-vercel -- --phase configure-preview`

Expected: exit 0 em dry-run, projeto/ambiente planejados e nenhuma mutação.

- [ ] **Step 7: Commit**

```powershell
git add scripts/provision-vercel-project.mjs scripts/provision-vercel-project.test.ts package.json
git commit -S -m "feat(ops): provision Vercel preview project"
```

### Task 7: Runbook e gate local antes de infraestrutura

**Files:**

- Modify: `docs/vercel-cli.md`
- Modify: `README.md`
- Modify: `docs/ambientes.md`
- Modify: `docs/runbook-operacional.md`
- Modify: `docs/checklist-go-live.md`
- Modify: `docs/observabilidade.md`
- Modify: `docs/plano-reestruturacao-loja-fisica.md`
- Modify: `.env.staging.example`

**Interfaces:**

- Consumes: comandos `ops:*` das Tasks 1–6.
- Produces: sequência operacional PR08, recuperação do staging e handoff explícito ao PR09.

- [ ] **Step 1: Documentar pré-requisitos e segredos**

Documentar Node/CLIs, autenticação Vercel, PAT Supabase mínimo, variáveis temporárias, armazenamento da CLI, logout/rotação e proibição de copiar tokens para documentação, issue ou PR.

- [ ] **Step 2: Documentar sequência e checkpoints**

Registrar dry-runs, inventário, confirmação literal `gpywbeoqcovjrfnmbdqx`, verificação contínua de `ciixpfquwmlsvzleattv`, criação do staging, bootstrap, Vercel Preview e smoke. Explicitar que Production/`--prod`, variáveis Production e alias produtivo são proibidos.

- [ ] **Step 3: Documentar falhas, rollback e limite gratuito**

Incluir retomada idempotente, projeto parcial preservado, ordem "pausar novo antes de restaurar legado", nenhum delete automático, limites do Vercel Hobby e bloqueio de deploys não essenciais perto do limite.

- [ ] **Step 4: Atualizar contratos e status sem antecipar conclusão**

Manter o projeto Vercel legado intacto, atualizar `.env.staging.example`, preservar a tentativa Netlify como evidência histórica e deixar itens remotos Vercel pendentes até a execução comprovada.

- [ ] **Step 5: Rodar o gate local completo**

Run: `npm.cmd run format:check`

Run: `npm.cmd run lint`

Run: `npm.cmd run type-check`

Run: `npm.cmd test`

Run: `npm.cmd run test:no-event-legacy`

Run: `npm.cmd run build`

Run: `npm.cmd run test:e2e:local-reset`

Expected: todos PASS; Supabase local parado ao final; nenhum acesso remoto mutável.

- [ ] **Step 6: Auditar segredos e produção fora de escopo**

Run: `git grep -n -E "(SUPABASE_ACCESS_TOKEN|VERCEL_TOKEN|STAGING_ADMIN_PASSWORD|service_role|sb_secret_)" -- ':!docs/superpowers/plans/2026-10-07-roberto-environments-provisioning.md'`

Expected: nenhuma credencial real; somente nomes de variáveis/fixtures deliberadas.

Run: `git diff --check origin/develop...HEAD`

Expected: sem erros.

- [ ] **Step 7: Commit**

```powershell
git add README.md docs/vercel-cli.md docs/ambientes.md docs/runbook-operacional.md docs/checklist-go-live.md docs/observabilidade.md docs/plano-reestruturacao-loja-fisica.md .env.staging.example
git commit -S -m "docs: add PR08 environment runbook"
```

### Task 8: Execução remota controlada e registro de evidências

**Files:**

- Modify: `config/remote-environments.json`
- Create: `docs/evidencias/pr08-staging-provisioning.md`
- Modify: `docs/ambientes.md`
- Modify: `docs/checklist-go-live.md`
- Modify: `docs/plano-reestruturacao-loja-fisica.md`

**Interfaces:**

- Consumes: toda a automação e runbook das Tasks 1–7.
- Produces: staging e projeto Vercel Preview efetivamente provisionados, manifesto com IDs não sensíveis e evidência redigida.

- [ ] **Step 1: Autenticar e executar preflights somente leitura**

Autorizar `vercel.cmd login` se necessário; disponibilizar `SUPABASE_ACCESS_TOKEN` e `VERCEL_TOKEN` somente no processo quando a sessão autenticada não for suficiente. Executar os dry-runs `ops:inventory-staging`, `ops:provision-vercel -- --phase configure-preview` e `ops:provision-staging`; confirmar conta pessoal, plano Hobby, declaração de uso pessoal/não comercial, organização, dois projetos Supabase ativos e região disponível.

- [ ] **Step 2: Preparar o projeto Vercel sem publicar Production**

O projeto `roberto-multimarcas-pdv` já foi criado e vinculado somente ao diretório local. Validar `projectId`, `orgId`, conta, preset Next.js e Node 22.x antes de qualquer deployment. Comprovar ausência de integração Git e zero Production Deployments, variáveis Production e aliases produtivos. Registrar os IDs não sensíveis no manifesto somente depois da validação.

- [ ] **Step 3: Inventariar o staging legado**

Gerar `.provisioning/inventory/*` ignorado e `docs/evidencias/pr08-staging-provisioning.md` redigido. Verificar que o hash corresponde e que nenhum e-mail, ID pessoal, caminho de objeto ou segredo foi incluído.

- [ ] **Step 4: Obter confirmação remota destrutiva específica**

Parar e solicitar ao proprietário a confirmação literal de que o ambiente é staging legado, nome `espaco-personalize-pdv-staging`, organização `wcqoluxxlvglqtebcucz` e ref `gpywbeoqcovjrfnmbdqx`. Não reutilizar aprovação genérica anterior para este checkpoint imediato.

- [ ] **Step 5: Pausar o legado e criar o staging novo**

Executar `npm.cmd run ops:provision-staging -- --execute --confirm-legacy-ref gpywbeoqcovjrfnmbdqx`. Confirmar no resultado que somente o legado staging foi pausado, a produção `ciixpfquwmlsvzleattv` continua saudável, o novo projeto está em `sa-east-1` e migrations/Auth concluíram.

- [ ] **Step 6: Registrar IDs não sensíveis**

Atualizar manifesto com ref do staging novo, `projectId`, `orgId` e URL Vercel Preview validados. Não registrar chave, token, senha ou e-mail.

- [ ] **Step 7: Bootstrap do administrador**

Receber `STAGING_ADMIN_EMAIL`, `STAGING_ADMIN_PASSWORD` e `STAGING_ADMIN_FULL_NAME` pelo processo, executar primeiro dry-run e então `--execute --confirm-ref <novo-ref>`. Verificar exatamente um admin e zero registros operacionais.

- [ ] **Step 8: Configurar staging Vercel e deployment Preview**

Executar `ops:provision-vercel -- --phase configure-preview` para gravar as três variáveis de staging somente em Preview e depois `--phase deploy-preview` para criar o deployment sem `--prod`, sempre confirmando literalmente o project ID. Persistir ID/URL retornados e executar `--phase verify-preview`. Verificar por metadados que `SUPABASE_SECRET_KEY` é sensível, Production continua sem credenciais, aliases ou deployments e a produção legada permanece intacta.

Checkpoint de 2026-10-07: a Vercel classificou como Production o primeiro deployment solicitado pela CLI e pela API com referência Git. Todos os artefatos falhos foram removidos e o projeto voltou a zero deployments. A etapa permanece bloqueada até aprovação de um projeto dedicado de staging ou correção confirmada da plataforma.

- [ ] **Step 9: Executar verificação remota e smoke autenticado**

Run: `npm.cmd run ops:verify-staging -- --confirm-ref <novo-ref>`

Expected: migrations, schema, Auth, RLS/grants, tabelas vazias e admin PASS.

Run: `npm.cmd run test:e2e:staging-smoke`

Expected: login, dashboard e rotas protegidas PASS sem skips, sem seed local e sem criar operador/venda/caixa/produto.

- [ ] **Step 10: Atualizar evidência e commit operacional**

Registrar horário, IDs não sensíveis, estados, hashes, comandos/gates e resultado de smoke. Marcar como concluídos somente itens comprovados.

```powershell
git add config/remote-environments.json docs/evidencias/pr08-staging-provisioning.md docs/ambientes.md docs/checklist-go-live.md docs/plano-reestruturacao-loja-fisica.md
git commit -S -m "chore(ops): record Roberto staging provisioning"
```

### Task 9: Verificação final, revisão e pull request

**Files:**

- Modify if required by verified findings only: files already in this plan

**Interfaces:**

- Consumes: branch completa e ambientes provisionados.
- Produces: PR08 revisado para `develop`, sem merge automático.

- [ ] **Step 1: Reexecutar todos os gates a partir do estado final**

Run, separadamente: `npm.cmd run format:check`, `npm.cmd run lint`, `npm.cmd run type-check`, `npm.cmd test`, `npm.cmd run test:no-event-legacy`, `npm.cmd run build` e `npm.cmd run test:e2e:local-reset`.

Expected: cada comando retorna exit 0, Vitest/E2E sem skips inesperados e Supabase local parado.

- [ ] **Step 2: Reexecutar checks remotos somente leitura**

Confirmar staging novo saudável, produção legada saudável, staging legado pausado, dois projetos Supabase ativos, Vercel Hobby, deployment Preview aprovado, zero Production Deployments/vars/aliases no projeto novo e zero dados operacionais.

- [ ] **Step 3: Solicitar revisão independente**

Usar `superpowers:requesting-code-review` com foco em segurança de alvo, vazamento de segredos, idempotência, rollback/cota e diferença entre documentação e estado remoto. Corrigir somente achados reproduzidos e repetir gates afetados.

- [ ] **Step 4: Auditar branch e assinatura**

Run: `git status --short --branch`

Expected: clean e somente à frente de `origin/develop`.

Run: `git log --show-signature --oneline origin/develop..HEAD`

Expected: todos os commits assinados e convencionais.

Run: `git diff --check origin/develop...HEAD`

Expected: sem erros.

- [ ] **Step 5: Publicar branch e abrir PR**

```powershell
git push -u origin feature/provision-roberto-environments
gh pr create --base develop --head feature/provision-roberto-environments --title "feat(ops): provision Roberto Multimarcas staging" --body-file .provisioning/pr08-body.md
```

O corpo do PR contém escopo, riscos, rollback, refs/IDs não sensíveis, evidências dos gates e declara explicitamente: produção nova não criada, produção legada não alterada, nenhum projeto excluído.

- [ ] **Step 6: Aguardar checks e entregar para aprovação**

Run: `gh pr checks --watch`

Expected: Quality e E2E Release Gate PASS. Não fazer merge sem revisão/aprovação explícita do proprietário.
