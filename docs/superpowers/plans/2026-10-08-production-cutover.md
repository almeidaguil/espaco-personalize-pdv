# PR09 Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preparar, validar e executar com segurança o corte da produção legada para os ambientes Roberto Multimarcas, deixando a nova produção vazia, com somente um administrador, e publicar o commit aprovado em Vercel sem expor segredos.

**Architecture:** Evoluir o manifesto para alvos independentes de staging e produção, concentrar autorização fail-closed numa política compartilhada e implementar comandos pequenos, idempotentes e retomáveis. Separar a implementação sem mutação remota do checkpoint operacional; o checkpoint preserva a produção legada pausada como rollback e nunca automatiza exclusão ou restauração.

**Tech Stack:** Node.js 22, JavaScript ESM, TypeScript, Zod, Vitest, Supabase CLI/Management API, Vercel API, Playwright, Next.js 16 e GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-08-production-cutover-design.md`

## Global Constraints

- Trabalhar somente em `feature/production-cutover`, no worktree isolado `.worktrees/production-cutover`; nunca commitar diretamente em `develop` ou `main`.
- Aplicar TDD em cada alteração: teste falhando, implementação mínima, teste passando e commit assinado no padrão Conventional Commits.
- Preservar todos os comandos e contratos de staging enquanto o manifesto evolui.
- Executar em dry-run por padrão. Toda mutação exige `--execute`, alvo exato e confirmação literal não ambígua.
- Nunca colocar token, chave, senha ou e-mail completo em argumentos, Git, arquivos de evidência, logs ou mensagens de erro.
- Aceitar segredos somente por ambiente temporário, stdin ou Windows Credential Manager; redigir segredos nas fronteiras dos clientes HTTP e processos filhos.
- Não implementar operações automáticas de exclusão, reset remoto ou restauração. A ausência dessas operações deve ser testada.
- Não reescrever migrations aplicadas. Usar `supabase db push --linked --dry-run` antes de qualquer push remoto.
- Não executar o checkpoint remoto da Tarefa 9 sem nova confirmação literal do usuário imediatamente antes da pausa de `ciixpfquwmlsvzleattv`.
- Tratar qualquer resposta remota incompleta, divergência de identidade ou falha de monitoramento como estado desconhecido e interromper.
- Manter `.provisioning/` ignorado e registrar ali somente estado e evidências não sensíveis.
- Antes de cada commit: `npm.cmd exec prettier -- --check <arquivos>` e testes direcionados. Antes do PR: todos os gates globais da Tarefa 8.

## File Responsibility Map

| Responsabilidade                   | Arquivo proprietário                         | Consumidores principais                   |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------- |
| Schema e autorização de alvos      | `scripts/remote-environment-policy.mjs`      | Todos os comandos remotos                 |
| Configuração pública dos ambientes | `config/remote-environments.json`            | Política, provisionadores e verificadores |
| Cliente Supabase Management API    | `scripts/supabase-management-client.mjs`     | Inventário e provisionamento Supabase     |
| Cliente Vercel API                 | `scripts/vercel-management-client.mjs`       | Provisionamento e verificação Vercel      |
| Evidência pré-corte                | `scripts/production-backup-evidence.mjs`     | Provisionador Supabase de produção        |
| Estado retomável                   | `scripts/production-cutover-state.mjs`       | Todos os passos mutáveis do corte         |
| Inventário de produção legada      | `scripts/inventory-production.mjs`           | Evidência e preflight                     |
| Criação/configuração Supabase      | `scripts/provision-supabase-production.mjs`  | CLI operacional PR09-A                    |
| Bootstrap do administrador         | `scripts/bootstrap-remote-admin.mjs`         | Wrappers staging e produção               |
| Configuração/deploy Vercel         | `scripts/provision-vercel-production.mjs`    | CLI operacional PR09-A/PR09-B             |
| Contrato remoto de produção        | `scripts/verify-remote-production.mjs`       | Gates PR09-A/PR09-B                       |
| Smoke autenticado somente leitura  | `scripts/run-remote-production-smoke.mjs`    | Gates PR09-A/PR09-B                       |
| Procedimento humano e rollback     | `docs/runbook-operacional.md`                | Operação do corte                         |
| Evidência versionada sem segredos  | `docs/evidencias/pr09-production-cutover.md` | Revisão e auditoria                       |

## Review Focus

1. **Confusão de alvo:** cada cliente e CLI deve provar organização, nome, ref/ID, região, hostname e ambiente lógico antes de ler ou mutar. Testes proprietários: Tarefas 1, 4 e 6.
2. **Mutação prematura:** nenhuma pausa, criação, migration, variável ou deploy pode ocorrer sem evidência recente, `--execute`, confirmação literal e fase válida. Testes proprietários: Tarefas 2, 3, 4 e 6.
3. **Vazamento de segredo ou PII:** erros HTTP, processos filhos, evidências e estado não podem conter credenciais nem e-mail completo. Testes proprietários: Tarefas 2, 5, 6 e 7.
4. **Retomada incorreta:** uma execução parcial deve consultar novamente os provedores, rejeitar regressão de fase e jamais duplicar projeto, usuário, variável ou deploy. Testes proprietários: Tarefas 3, 4, 5 e 6.
5. **Rollback inviável na cota gratuita:** a produção legada deve estar pausada antes da criação, continuar preservada, e nenhuma exclusão/restauração automática pode existir. Testes e runbook proprietários: Tarefas 4, 8 e 9.

---

## Task 1: Evolve the Remote Environment Manifest to V2

**Files:**

- Modify: `config/remote-environments.json`
- Modify: `scripts/remote-environment-policy.mjs`
- Modify: `scripts/remote-environment-policy.test.ts`
- Modify: `scripts/provision-vercel-project.mjs`
- Modify: `scripts/provision-vercel-project.test.ts`
- Modify: `scripts/remote-staging-smoke-environment.mjs`
- Modify: `scripts/remote-staging-smoke-environment.test.ts`
- Modify: `scripts/run-remote-staging-smoke.mjs`
- Modify: `scripts/run-remote-staging-smoke.test.ts`
- Modify: `playwright.remote-staging.config.ts`
- Modify: `.env.production.example`
- Modify: `.env.staging.example`

**Interfaces:**

- `parseRemoteEnvironmentManifest(value)` consumes unknown JSON and returns manifest v2.
- Add `resolveRemoteTarget(manifest, { provider, environment })`; it produces a normalized, immutable target descriptor.
- `validateRemoteOperation({ manifest, provider, environment, mode, target, confirmation })` consumes the normalized descriptor and returns the exact authorized target.
- Manifest v2 keeps common Vercel metadata at `vercel` and introduces `vercel.targets.staging` and `vercel.targets.production`.
- Production begins with Supabase `projectRef`/`hostname` null and Vercel deployment fields null; the reserved Vercel project ID is already fixed.

**Steps:**

- [ ] Add failing policy tests for v2 parsing, both complete Vercel targets, nullable pre-provisioning production fields and `resolveRemoteTarget`.
- [ ] Add failing allowlist tests that reject legacy production as new production, staging as production, production as staging, wrong Vercel org/project and mutation without an exact confirmation.
- [ ] Add compatibility tests proving the existing staging provisioner and staging smoke resolve the same project, deployment and URLs after the shape change.
- [ ] Run `npm.cmd test -- scripts/remote-environment-policy.test.ts scripts/provision-vercel-project.test.ts scripts/remote-staging-smoke-environment.test.ts scripts/run-remote-staging-smoke.test.ts` and confirm RED.
- [ ] Implement the manifest v2 schemas and `resolveRemoteTarget`; keep sensitive values prohibited by schema and preserve strict object validation.
- [ ] Move current staging Vercel fields under `targets.staging`; create `targets.production` for `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`, URL `https://roberto-multimarcas-pdv.vercel.app`, no Vercel Authentication and allowed release refs `feature/production-cutover` and `main`.
- [ ] Adapt staging consumers to resolve their target through the policy instead of reading `manifest.vercel` directly.
- [ ] Correct both environment examples so each names its dedicated project and contains placeholders only.
- [ ] Run the directed tests again and confirm GREEN; also run `npm.cmd run test:e2e:staging-smoke -- --help` or the CLI's non-mutating validation path to detect broken imports without contacting providers.
- [ ] Commit signed: `feat(ops): model production remote targets`

## Task 2: Build Tamper-Evident Production Backup Evidence

**Files:**

- Create: `scripts/production-backup-evidence.mjs`
- Create: `scripts/production-backup-evidence.test.ts`
- Create: `scripts/inventory-production.mjs`
- Create: `scripts/inventory-production.test.ts`
- Modify: `scripts/inventory-supabase-project.mjs`
- Modify: `scripts/inventory-supabase-project.test.ts`
- Modify: `package.json`

**Interfaces:**

- `createProductionBackupEvidence({ capturedAt, source, database, auth, storage, recovery })` returns a PII-free payload plus canonical SHA-256.
- `writeProductionBackupEvidence({ evidence, outputPath })` writes only below `.provisioning/production-backup/` using restrictive local permissions and returns path/hash.
- `readAndValidateProductionBackupEvidence({ filePath, manifest, now, maximumAgeMs })` returns validated evidence; the production maximum age is one hour.
- `collectSupabaseInventory(...)` becomes target-agnostic; existing staging CLI behavior remains unchanged.
- `runInventoryProductionCli(argv, dependencies)` produces the evidence file and a redacted console summary.

**Steps:**

- [ ] Add failing tests for canonical hashing, single-byte tampering, timestamps in the future, age greater than one hour, wrong source ref/name/org and paths outside `.provisioning/production-backup/`.
- [ ] Add failing tests proving evidence contains table counts, migration IDs, schema/extensions, role counts and bucket/object counts but rejects row contents, emails, password hashes, tokens and keys.
- [ ] Add failing inventory tests for exact legacy production identity and for aborting when Supabase reports an unexpected state or hostname.
- [ ] Run `npm.cmd test -- scripts/production-backup-evidence.test.ts scripts/inventory-production.test.ts scripts/inventory-supabase-project.test.ts` and confirm RED.
- [ ] Extract only target-neutral inventory primitives from `inventory-supabase-project.mjs`; keep its current exports and staging CLI stable.
- [ ] Implement canonical serialization and SHA-256 with `node:crypto`; validate inputs and output with Zod before writing.
- [ ] Implement atomic evidence writing via a temporary file in the same authorized directory followed by rename; do not include a full row dump.
- [ ] Implement `ops:inventory-production` and ensure output contains only IDs, counts, states, timestamp and hash.
- [ ] Run the directed tests and confirm GREEN.
- [ ] Commit signed: `feat(ops): record production backup evidence`

## Task 3: Add a Monotonic, Resumable Cutover State Machine

**Files:**

- Create: `scripts/production-cutover-state.mjs`
- Create: `scripts/production-cutover-state.test.ts`

**Interfaces:**

- `loadProductionCutoverState({ filePath })` returns null or a validated state.
- `recordProductionCutoverPhase({ filePath, previousState, phase, facts, now })` atomically persists non-sensitive facts.
- Ordered phases: `preflight`, `backup-recorded`, `legacy-paused`, `production-created`, `database-ready`, `admin-ready`, `vercel-configured`, `deployment-ready`, `verified`.
- State facts may contain refs, IDs, commit SHA, evidence hash, timestamps and check summaries; no secret or user identifier.

**Steps:**

- [ ] Add failing tests for initial state, each legal forward transition, idempotent replay of the same phase and rejection of skipped or regressed phases.
- [ ] Add failing tests for malformed/tampered JSON, path outside `.provisioning/production-cutover-state.json`, secret-like keys and email-like values.
- [ ] Add a test proving state alone does not expose an authorization boolean or mutation credential.
- [ ] Run `npm.cmd test -- scripts/production-cutover-state.test.ts` and confirm RED.
- [ ] Implement a strict Zod discriminated union for phases and phase-specific facts.
- [ ] Implement atomic write and restrictive file permissions; re-read and validate after rename.
- [ ] Make idempotent replay compare all facts exactly, so a changed remote identity fails closed.
- [ ] Run the directed test and confirm GREEN.
- [ ] Commit signed: `feat(ops): persist production cutover state`

## Task 4: Implement Fail-Closed Supabase Production Provisioning

**Files:**

- Modify: `scripts/supabase-management-client.mjs`
- Modify: `scripts/supabase-management-client.test.ts`
- Create: `scripts/provision-supabase-production.mjs`
- Create: `scripts/provision-supabase-production.test.ts`
- Modify: `package.json`

**Interfaces:**

- `runSupabaseProductionProvisioning({ manifest, options, evidence, state, client, runCommand, now, logger })` returns the last completed phase and verified target facts.
- `runProvisionSupabaseProductionCli(argv, dependencies)` defaults to dry-run.
- Required first-cut mutation inputs: `--execute`, `--confirm-legacy-ref ciixpfquwmlsvzleattv`, `--confirm-target-name roberto-multimarcas-pdv`, valid evidence path and database password through environment/credential provider.
- Resume after creation requires `--confirm-target-ref <new-ref>` and provider revalidation; state never substitutes confirmation.
- Add only read/update operations needed for explicit project state polling and Auth configuration; do not add delete, reset or restore methods.

**Steps:**

- [ ] Add failing client tests for redacted HTTP errors and exact request bodies for pause, create and Auth configuration.
- [ ] Add failing provisioner tests for dry-run, duplicated/missing CLI values, stale/tampered evidence, wrong topology, unhealthy legacy production, unhealthy staging and quota not released.
- [ ] Add failing tests proving no create occurs before legacy state is `INACTIVE`, no database push occurs before verified new identity, and no real push occurs after a failed dry-run.
- [ ] Add failing tests for configuration: project `roberto-multimarcas-pdv`, region `sa-east-1`, signup disabled, minimum password length 14, leaked-password protection requested and exact production site URL.
- [ ] Add table-driven failure-injection tests after every phase; rerun must inspect the provider and continue without a second pause, create or migration.
- [ ] Add static behavior tests proving the client/provisioner exposes no delete, reset or restore operation and never passes secrets in child-process argv.
- [ ] Run `npm.cmd test -- scripts/supabase-management-client.test.ts scripts/provision-supabase-production.test.ts` and confirm RED.
- [ ] Implement preflight and dry-run first; use the policy resolver for all four Supabase identities and enforce at most two active free projects.
- [ ] Implement the pause/poll/create/identity flow, recording each completed phase only after provider revalidation.
- [ ] Run `supabase link --project-ref <ref>` and `supabase db push --linked --dry-run` through injectable process execution; pass passwords only via environment. Execute real `db push` only after successful dry-run.
- [ ] Configure Auth and verify the configuration by reading it back. Treat unsupported paid leaked-password protection as a visible blocked state, not silent success.
- [ ] Add `ops:provision-production` and document its dry-run help text inside the CLI.
- [ ] Run the directed tests and confirm GREEN.
- [ ] Commit signed: `feat(ops): provision production Supabase safely`

## Task 5: Generalize the Idempotent Admin Bootstrap

**Files:**

- Create: `scripts/bootstrap-remote-admin.mjs`
- Create: `scripts/bootstrap-remote-admin.test.ts`
- Modify: `scripts/bootstrap-staging-admin.mjs`
- Modify: `scripts/bootstrap-staging-admin.test.ts`
- Create: `scripts/bootstrap-production-admin.mjs`
- Create: `scripts/bootstrap-production-admin.test.ts`
- Modify: `package.json`

**Interfaces:**

- `bootstrapRemoteAdmin({ environment, manifest, credentials, adminApi, logger })` returns only `{ environment, userId, role, created }`.
- `bootstrap-staging-admin.mjs` remains a thin compatible wrapper.
- `runBootstrapProductionAdminCli(argv, dependencies)` requires exact production target confirmation and reads credentials from injected environment/credential provider.
- Production postcondition: exactly one Auth user, exactly one `profiles` row with `admin`, zero operators and zero rows in operational tables.

**Steps:**

- [ ] Port current bootstrap behavior into failing shared tests before moving implementation.
- [ ] Add failing production tests for empty database, compatible idempotent replay, extra user, different e-mail, missing/divergent profile, operator role and non-empty operational table.
- [ ] Add failing redaction tests ensuring output, state, logs and thrown errors contain neither full e-mail nor password.
- [ ] Run `npm.cmd test -- scripts/bootstrap-remote-admin.test.ts scripts/bootstrap-staging-admin.test.ts scripts/bootstrap-production-admin.test.ts` and confirm RED.
- [ ] Extract target-neutral bootstrap logic; keep staging-specific anti-E2E credential checks in the staging wrapper.
- [ ] Implement the production wrapper with the cutover state requirement `database-ready`, exact target validation and postcondition re-read before recording `admin-ready`.
- [ ] Keep user creation idempotent; never modify or delete an incompatible existing user/profile.
- [ ] Add `ops:bootstrap-production-admin`.
- [ ] Run the directed tests and confirm GREEN.
- [ ] Commit signed: `feat(ops): bootstrap production administrator`

## Task 6: Configure and Deploy the Dedicated Production Vercel Project

**Files:**

- Modify: `scripts/vercel-management-client.mjs`
- Modify: `scripts/vercel-management-client.test.ts`
- Create: `scripts/provision-vercel-production.mjs`
- Create: `scripts/provision-vercel-production.test.ts`
- Modify: `package.json`

**Interfaces:**

- Add `createGitDeployment({ projectId, repositoryId, ref, environment, metadata })`; keep `createStagingDeployment` as a compatible wrapper.
- `runVercelProductionProvisioning({ manifest, options, state, client, environment, logger })` supports `audit`, `configure`, `deploy` and `verify` phases.
- Production variables are exactly `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and sensitive `SUPABASE_SECRET_KEY`, all targeted only to Vercel `production`.
- `sourceRef` must be an explicitly allowed ref and the deployment result must expose immutable deployment ID/URL plus stable alias.

**Steps:**

- [ ] Add failing client tests for generic git deployment payload, source ref, target environment and redaction of Vercel/Supabase secrets.
- [ ] Add failing audit tests for the exact reserved project, Next.js preset, Node 22, empty first-use deployments/env vars, default domain only and absence of incompatible protection/bypasses.
- [ ] Add failing mutation tests for wrong project/org/ref, extra or missing variable, mutation without confirmation and service key lacking the sensitive flag.
- [ ] Add failure-injection/idempotency tests after variable configuration and deployment creation; rerun must not duplicate values or deploy when a matching READY deployment already exists.
- [ ] Add tests proving staging and legacy projects are never sent to a mutating client method and production never creates an authentication bypass.
- [ ] Run `npm.cmd test -- scripts/vercel-management-client.test.ts scripts/provision-vercel-production.test.ts scripts/provision-vercel-project.test.ts` and confirm RED.
- [ ] Implement the generic client method and retain the staging wrapper behavior.
- [ ] Implement production audit/configure/deploy/verify with exact state-phase preconditions and provider revalidation.
- [ ] Send environment values in HTTPS bodies only; store only key names and redacted metadata in results/state.
- [ ] Require deployment `READY`, exact commit/ref and stable alias `roberto-multimarcas-pdv.vercel.app` before recording `deployment-ready`.
- [ ] Add `ops:provision-vercel-production`.
- [ ] Run the directed tests and confirm GREEN.
- [ ] Commit signed: `feat(ops): deploy dedicated production project`

## Task 7: Add Production Verification and Read-Only Smoke Tests

**Files:**

- Create: `scripts/verify-remote-environment.mjs`
- Create: `scripts/verify-remote-environment.test.ts`
- Modify: `scripts/verify-remote-staging.mjs`
- Modify: `scripts/verify-remote-staging.test.ts`
- Create: `scripts/verify-remote-production.mjs`
- Create: `scripts/verify-remote-production.test.ts`
- Create: `scripts/remote-production-smoke-environment.mjs`
- Create: `scripts/remote-production-smoke-environment.test.ts`
- Create: `scripts/run-remote-production-smoke.mjs`
- Create: `scripts/run-remote-production-smoke.test.ts`
- Create: `playwright.remote-production.config.ts`
- Create: `tests/e2e/remote-production-smoke.spec.ts`
- Modify: `package.json`

**Interfaces:**

- `verifyRemoteEnvironment({ environment, manifest, supabase, vercel, runCommand, logger })` produces a redacted check report.
- `verifyRemoteProduction(...)` adds production invariants: one admin, no other users, empty operational tables, exact Auth URL, three Vercel variables, READY deployment, stable alias and no bypass/protection.
- `resolveRemoteProductionSmokeEnvironment(environment, manifest)` returns base URL and in-memory credentials after exact target validation.
- `runManagedRemoteProductionSmoke({ manifest, environment, client, runPlaywright, logger })` runs only the production Playwright config and never creates a bypass.

**Steps:**

- [ ] Add failing shared verifier characterization tests for all current staging checks before extracting code.
- [ ] Add failing production tests for linked ref/migrations, schema/extensions, RLS/policies/grants, one admin, zero other users and empty operational tables.
- [ ] Add failing Vercel tests for variable count/names/targets, READY deployment, exact immutable/stable URLs and absence of bypass/protection.
- [ ] Add failing smoke environment tests for URL/ref mismatch, staging credentials, E2E credentials, missing password and redacted errors.
- [ ] Add a failing Playwright test proving unauthenticated redirect, admin login and read-only traversal of dashboard/products/PDV/cash/sales/stock/reports; assert no mutating request is sent.
- [ ] Run the six directed unit-test files and confirm RED.
- [ ] Extract target-neutral verification without weakening staging checks; keep current `ops:verify-staging` stable.
- [ ] Implement `ops:verify-production`, `test:e2e:production-smoke` and `test:e2e:production-smoke:raw`.
- [ ] Use the dedicated production config/spec; do not reuse `STAGING_*` variable names and do not invoke Vercel bypass APIs.
- [ ] Record `verified` only after both remote verification and smoke reports succeed for the same deployment/commit.
- [ ] Run directed tests and confirm GREEN; run production CLIs only in dry-run/help mode at this task.
- [ ] Commit signed: `test(ops): verify production cutover`

## Task 8: Document the Runbook and Pass All Local Gates

**Files:**

- Modify: `docs/ambientes.md`
- Modify: `docs/runbook-operacional.md`
- Modify: `docs/checklist-go-live.md`
- Modify: `docs/plano-reestruturacao-loja-fisica.md`
- Create: `docs/evidencias/pr09-production-cutover.md`
- Modify: `README.md`

**Interfaces:**

- Runbook separates `preflight`, explicit pause authorization, provision, verification, rollback-before-writes and reconciliation-after-writes.
- Evidence document contains commands, non-sensitive identifiers, commit SHAs, check URLs and results; initially marks remote steps pending.
- The literal confirmation requested from the owner immediately before pause is:
  `CONFIRMO PAUSAR A PRODUÇÃO LEGADA espaco-personalize-pdv DA ORGANIZAÇÃO wcqoluxxlvglqtebcucz, REF ciixpfquwmlsvzleattv`.

**Steps:**

- [ ] Update environment documentation for the two independent Supabase and Vercel targets, cost-zero topology and 30-day rollback window.
- [ ] Document exact dry-run and execution commands without embedding credentials; show Credential Manager/environment placeholders only.
- [ ] Document every stop condition, manual restoration procedure and the prohibition on automatic delete/restore/reset.
- [ ] Document PR09-A versus PR09-B, the post-cutover manual data setup and the later two-operator validation.
- [ ] Create the evidence template with all remote outcomes marked `PENDENTE`; never claim a command has run before capturing its output.
- [ ] Run `npm.cmd run format:check`.
- [ ] Run `npm.cmd run lint`.
- [ ] Run `npm.cmd run type-check`.
- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run test:no-event-legacy`.
- [ ] Run `npm.cmd run test:db`.
- [ ] Run `npm.cmd run build`.
- [ ] Run `npm.cmd run test:e2e:local-reset`.
- [ ] Scan tracked files with `git grep -n -I -E '(sb[_]secret_[A-Za-z0-9_-]{20,}|SUPABASE_ACCESS_TOKEN[=][^[:space:]]+|VERCEL_TOKEN[=][^[:space:]]+|[A-Za-z0-9._%+-]+@gmail[.]com)'` and confirm no secret or personal admin e-mail was added.
- [ ] Commit signed: `docs(ops): add production cutover runbook`

## Task 9: Execute the PR09-A Remote Cutover Checkpoint

**Files:**

- Modify after verified creation: `config/remote-environments.json`
- Modify after verified deploy: `config/remote-environments.json`
- Modify as evidence is captured: `docs/evidencias/pr09-production-cutover.md`

**Interfaces:**

- Inputs: approved PR09-A implementation, green local gates, fresh credential sessions and the literal user confirmation from Task 8.
- Outputs: paused legacy production, new Supabase production, one admin, configured production Vercel project, verified provisional deployment and redacted evidence.
- This task is an operational checkpoint, not a batch command. Stop after every numbered phase and validate real provider state.

**Steps:**

- [ ] Push the feature branch, open PR09-A to `develop`, wait for Quality, Database contract and E2E Release Gate, and obtain independent code review focused on the five risks above.
- [ ] Run all production audit/dry-run commands and verify staging remains healthy, legacy production is active/healthy, reserved Vercel project is empty and no mutation occurred.
- [ ] Generate a fresh technical inventory/evidence under `.provisioning/production-backup/`; verify its hash, age and exact source identity.
- [ ] **STOP.** Present project name, organization, ref, region, active-project topology, evidence hash/age and rollback plan to the user. Request the exact literal phrase from Task 8. Do not infer approval from any earlier message.
- [ ] After fresh confirmation only, execute the legacy pause. Poll until Supabase reports `INACTIVE`; verify staging remains active and record `legacy-paused`.
- [ ] Re-read the project list to prove a free slot exists. Create only `roberto-multimarcas-pdv` in `sa-east-1`; immediately verify organization/name/ref/region/hostname and record `production-created`.
- [ ] Persist the verified new Supabase ref/hostname in the manifest, run directed tests and create a signed commit before proceeding.
- [ ] Execute migration dry-run, real push and Auth configuration; run remote database verification before recording `database-ready`.
- [ ] Bootstrap the sole administrator from in-memory credentials; verify exactly one admin, zero operators and empty operational tables.
- [ ] Audit then configure the reserved Vercel project with exactly three Production variables. Deploy the exact signed feature-branch commit.
- [ ] Verify READY state, immutable URL, stable alias and absence of Vercel Authentication/bypasses. Persist deployment metadata in the manifest and create a signed commit.
- [ ] Run `ops:verify-production` and authenticated read-only smoke. Observe logs/availability for the runbook window; a monitoring gap is failure.
- [ ] Update evidence with redacted results and immutable links. Repeat the full local gates affected by manifest/document changes.
- [ ] Push final commits, wait for PR09-A checks again, obtain final independent review, merge through the approved signed/linear-history GitHub flow and verify `origin/develop` contains the signed result.
- [ ] If any gate fails, stop and follow the matching runbook branch. Never delete either Supabase project and never promote `main` while state is unknown.

## Task 10: Release PR09-B from Develop to Main

**Files:**

- Inspect only: `config/remote-environments.json`
- Inspect only: `docs/evidencias/pr09-production-cutover.md`
- Inspect only: `docs/checklist-go-live.md`
- No repository write is permitted after the PR09-B merge; final dynamic deployment evidence belongs to the GitHub deployment/check records and the operational report. Any required versioned correction starts in a new `feature/*` branch and follows the complete PR flow.

**Interfaces:**

- Input: merged and green PR09-A on `origin/develop`, production provisional verification green and legacy production still paused.
- Output: signed `main` commit deployed to the production Vercel project, followed by green verification/smoke.

**Steps:**

- [ ] Create PR09-B from `develop` to `main`; confirm the diff contains only already-reviewed PR09-A changes.
- [ ] Require Quality, Database contract and E2E Release Gate; resolve no failure by bypassing a check.
- [ ] Merge using the repository's signed, linear-history-compatible method and verify the resulting commit signature on `origin/main`.
- [ ] Run Vercel production audit with allowed source ref `main`, then deploy the exact resulting `main` commit without changing the three environment variables.
- [ ] Verify the READY deployment, stable alias, exact main commit, Supabase contract, single admin, empty operational tables and absence of bypass/protection.
- [ ] Run authenticated read-only production smoke again and monitor for the documented window.
- [ ] Record final IDs, commit, URLs, checks and timestamps without secrets in the GitHub deployment/check evidence and operational report; keep legacy production paused for the full 30-day rollback window.
- [ ] Report that technical cutover is complete but the operational milestone remains pending until the owner manually creates sellers/products/stock and validates two simultaneous operators.

## Final Verification Checklist

- [ ] Every task's directed tests passed after its implementation.
- [ ] Full local gates from Task 8 passed on the final PR09-A commit.
- [ ] PR09-A and PR09-B required GitHub checks passed without bypass.
- [ ] Supabase legacy production is paused, preserved and identified by `ciixpfquwmlsvzleattv`.
- [ ] New Supabase production is in `sa-east-1`, fully identified in manifest and verified empty except for one admin.
- [ ] Production Vercel project is `prj_oBs2uc7uxsHMc7ssHFKczfi52LMq`, has exactly three Production variables and no incompatible protection/bypass.
- [ ] Stable URL serves the exact signed `main` commit and passes authenticated read-only smoke.
- [ ] Staging still passes its verifier/smoke and no legacy/non-target Vercel project changed.
- [ ] No secret, personal e-mail, local evidence or cutover state is tracked by Git.
- [ ] Rollback remains possible for 30 days and no deletion is scheduled.
