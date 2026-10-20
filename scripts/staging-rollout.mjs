import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createSupabaseManagementClient } from "./supabase-management-client.mjs";
import {
  loadRemoteEnvironmentManifest,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { runCliCommand } from "./run-cli-command.mjs";
import { createVercelManagementClient } from "./vercel-management-client.mjs";

const foundationMigration =
  "20261018120000_add_split_payments_and_cash_reconciliation.sql";
const cutoverMigration = "20261018180000_disable_legacy_cash_close.sql";
const migrationVersionPattern = /^\d{14}$/;
const commitShaPattern = /^[a-f0-9]{40}$/;
const deploymentIdPattern = /^dpl_[A-Za-z0-9]+$/;
const environmentVariables = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", type: "encrypted" },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", type: "encrypted" },
  { key: "SUPABASE_SECRET_KEY", type: "sensitive" },
];
const phases = new Set([
  "apply-foundation",
  "apply-cutover",
  "deploy",
  "verify",
]);
const stableSmokeConfirmation = "STAGING_FINANCIAL_SMOKE_PASSED";
const command = process.platform === "win32" ? "npx.cmd" : "npx";

export async function runStagingRollout({
  args,
  environment,
  manifest,
  managementClient,
  repoRoot = process.cwd(),
  resolveSourceCommit = (sourceRef) =>
    resolveRemoteSourceCommit(sourceRef, runCommand),
  runCommand = runCliCommand,
  tempRoot = () => mkdtemp(join(tmpdir(), "pdv-staging-rollout-")),
  vercelClient,
  wait = waitForPolling,
}) {
  const options = parseArguments(args);
  const supabaseTarget = resolveRemoteTarget(manifest, {
    environment: "staging",
    provider: "supabase",
  });
  const vercelTarget = resolveRemoteTarget(manifest, {
    environment: "staging",
    provider: "vercel",
  });
  const productionVercelTarget = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "vercel",
  });

  if (!options.execute && options.phase !== "verify") {
    const confirmationTarget =
      options.phase === "apply-foundation"
        ? supabaseTarget.projectRef
        : vercelTarget.projectId;
    return {
      mode: "dry-run",
      nextAction: `rerun with --execute --confirm-project ${confirmationTarget}`,
      phase: options.phase,
      projectId: vercelTarget.projectId,
      projectRef: supabaseTarget.projectRef,
    };
  }

  const needsDatabase =
    options.phase === "apply-foundation" || options.phase === "apply-cutover";
  if (needsDatabase) {
    requireEnvironmentVariables(environment, [
      "SUPABASE_ACCESS_TOKEN",
      "SUPABASE_DB_PASSWORD",
    ]);
  }
  if (options.phase !== "apply-foundation") {
    requireEnvironmentVariables(environment, ["VERCEL_TOKEN"]);
  }

  const databaseClient =
    managementClient ??
    (environment.SUPABASE_ACCESS_TOKEN
      ? createSupabaseManagementClient({
          accessToken: environment.SUPABASE_ACCESS_TOKEN,
        })
      : undefined);
  const deploymentClient =
    vercelClient ??
    (environment.VERCEL_TOKEN
      ? createVercelManagementClient({ authToken: environment.VERCEL_TOKEN })
      : undefined);

  if (needsDatabase && !databaseClient) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  }
  if (options.phase !== "apply-foundation" && !deploymentClient) {
    throw new Error("VERCEL_TOKEN is required.");
  }

  if (options.phase === "apply-foundation") {
    authorizeMutation({
      confirmation: options.confirmation,
      environment: "staging",
      execute: options.execute,
      manifest,
      provider: "supabase",
      target: supabaseTarget,
    });
    return applyFoundationMigration({
      databaseClient,
      environment,
      repoRoot,
      runCommand,
      supabaseTarget,
      tempRoot,
    });
  }

  if (options.phase === "verify") {
    const source = await resolveDeploymentSource(options, resolveSourceCommit);
    const deployment = await verifyDeployment({
      client: deploymentClient,
      deploymentId: options.deploymentId,
      productionTarget: productionVercelTarget,
      source,
      target: vercelTarget,
    });
    return deploymentResult({
      deployment,
      mode: "verified",
      project: { id: vercelTarget.projectId },
      source,
      target: vercelTarget,
    });
  }

  authorizeMutation({
    confirmation: options.confirmation,
    environment: "staging",
    execute: options.execute,
    manifest,
    provider: "vercel",
    target: vercelTarget,
  });

  if (options.phase === "deploy") {
    const source = await resolveDeploymentSource(options, resolveSourceCommit);
    const project = await verifyVercelProject({
      client: deploymentClient,
      productionTarget: productionVercelTarget,
      target: vercelTarget,
    });
    assertProjectDeployments(
      await listDeployments(deploymentClient, vercelTarget),
      vercelTarget,
    );
    assertEnvironmentVariables(
      await listEnvironmentVariables(deploymentClient, vercelTarget),
      vercelTarget,
    );

    const matches = await findExistingDeployment({
      client: deploymentClient,
      source,
      target: vercelTarget,
    });
    const deployment =
      matches ??
      (await createAndPollDeployment({
        client: deploymentClient,
        source,
        target: vercelTarget,
        wait,
      }));
    assertStagingDeployment(deployment, source, vercelTarget);
    return deploymentResult({
      deployment,
      mode: matches ? "already-deployed" : "deployed",
      project,
      source,
      target: vercelTarget,
    });
  }

  requireEnvironmentVariables(environment, ["SUPABASE_DB_PASSWORD"]);
  if (options.confirmSmokePassed !== stableSmokeConfirmation) {
    throw new Error(
      `Cutover requires --confirm-smoke-passed ${stableSmokeConfirmation}.`,
    );
  }
  if (options.confirmCutover !== cutoverMigration) {
    throw new Error(`Cutover requires --confirm-cutover ${cutoverMigration}.`);
  }
  authorizeMutation({
    confirmation: options.databaseConfirmation,
    environment: "staging",
    execute: options.execute,
    manifest,
    provider: "supabase",
    target: supabaseTarget,
  });
  const source = await resolveDeploymentSource(options, resolveSourceCommit);
  const deployment = await verifyDeployment({
    client: deploymentClient,
    deploymentId: options.deploymentId,
    productionTarget: productionVercelTarget,
    source,
    target: vercelTarget,
  });
  await applyCutoverMigration({
    databaseClient,
    deployment,
    environment,
    repoRoot,
    runCommand,
    source,
    supabaseTarget,
    tempRoot,
    vercelTarget,
  });
  return {
    commitSha: source.commitSha,
    deploymentId: deployment.uid ?? deployment.id,
    mode: "executed",
    phase: "apply-cutover",
    projectId: vercelTarget.projectId,
    projectRef: supabaseTarget.projectRef,
  };
}

async function applyFoundationMigration({
  databaseClient,
  environment,
  repoRoot,
  runCommand,
  supabaseTarget,
  tempRoot,
}) {
  await assertHealthySupabaseProject(databaseClient, supabaseTarget);
  const initialVersions = await readMigrationVersions(
    databaseClient,
    supabaseTarget.projectRef,
  );
  if (initialVersions.includes(cutoverMigration.slice(0, 14))) {
    throw new Error("The legacy cash-close cutover is already applied.");
  }
  if (initialVersions.includes(foundationMigration.slice(0, 14))) {
    return {
      mode: "already-applied",
      phase: "apply-foundation",
      projectRef: supabaseTarget.projectRef,
    };
  }

  const bundle = await createMigrationBundle({
    repoRoot,
    supabaseProjectRef: supabaseTarget.projectRef,
    tempRoot,
    throughVersion: foundationMigration.slice(0, 14),
  });
  try {
    const dryRun = runSupabasePush({
      bundleRoot: bundle,
      environment,
      runCommand,
      dryRun: true,
    });
    assertMigrationPlan(dryRun, [foundationMigration]);

    const apply = runSupabasePush({
      bundleRoot: bundle,
      environment,
      runCommand,
      dryRun: false,
    });
    assertCommandSucceeded(apply, "Staging foundation migration failed.");

    const appliedVersions = await readMigrationVersions(
      databaseClient,
      supabaseTarget.projectRef,
    );
    if (!appliedVersions.includes(foundationMigration.slice(0, 14))) {
      throw new Error("The staging foundation migration was not recorded.");
    }
    if (appliedVersions.includes(cutoverMigration.slice(0, 14))) {
      throw new Error("The legacy cash-close cutover ran too early.");
    }
    return {
      mode: "executed",
      phase: "apply-foundation",
      projectRef: supabaseTarget.projectRef,
    };
  } finally {
    await rm(bundle, { force: true, recursive: true });
  }
}

async function applyCutoverMigration({
  databaseClient,
  deployment,
  environment,
  repoRoot,
  runCommand,
  source,
  supabaseTarget,
  tempRoot,
  vercelTarget,
}) {
  await assertHealthySupabaseProject(databaseClient, supabaseTarget);
  const versions = await readMigrationVersions(
    databaseClient,
    supabaseTarget.projectRef,
  );
  if (!versions.includes(foundationMigration.slice(0, 14))) {
    throw new Error("The staging foundation migration is not applied.");
  }
  if (versions.includes(cutoverMigration.slice(0, 14))) {
    throw new Error(
      "The staging legacy cash-close cutover is already applied.",
    );
  }
  assertStagingDeployment(deployment, source, vercelTarget);

  const bundle = await createMigrationBundle({
    repoRoot,
    supabaseProjectRef: supabaseTarget.projectRef,
    tempRoot,
    throughVersion: cutoverMigration.slice(0, 14),
  });
  try {
    const dryRun = runSupabasePush({
      bundleRoot: bundle,
      environment,
      runCommand,
      dryRun: true,
    });
    assertMigrationPlan(dryRun, [cutoverMigration]);

    const apply = runSupabasePush({
      bundleRoot: bundle,
      environment,
      runCommand,
      dryRun: false,
    });
    assertCommandSucceeded(apply, "Staging cutover migration failed.");

    const appliedVersions = await readMigrationVersions(
      databaseClient,
      supabaseTarget.projectRef,
    );
    if (!appliedVersions.includes(cutoverMigration.slice(0, 14))) {
      throw new Error("The staging cutover migration was not recorded.");
    }
    const privileges = normalizeRows(
      await databaseClient.runReadOnlyQuery(supabaseTarget.projectRef, {
        query:
          "select has_function_privilege('authenticated', 'public.close_cash_session(uuid, integer, timestamptz, text)', 'execute') as legacy_close_executable, has_function_privilege('authenticated', 'public.close_cash_session_v2(uuid, jsonb, text)', 'execute') as v2_close_executable",
      }),
    );
    if (
      privileges.length !== 1 ||
      privileges[0].legacy_close_executable !== false ||
      privileges[0].v2_close_executable !== true
    ) {
      throw new Error("The staging cash-close RPC privileges are divergent.");
    }
  } finally {
    await rm(bundle, { force: true, recursive: true });
  }
}

async function createMigrationBundle({
  repoRoot,
  supabaseProjectRef,
  tempRoot,
  throughVersion,
}) {
  if (!migrationVersionPattern.test(throughVersion)) {
    throw new Error("Invalid staging migration bundle version.");
  }
  const root = await tempRoot();
  const supabaseRoot = join(root, "supabase");
  const migrationsRoot = join(supabaseRoot, "migrations");
  await mkdir(migrationsRoot, { recursive: true });
  await mkdir(join(supabaseRoot, ".temp"), { recursive: true });
  await copyFile(
    join(repoRoot, "supabase", "config.toml"),
    join(supabaseRoot, "config.toml"),
  );
  await writeFile(
    join(supabaseRoot, ".temp", "project-ref"),
    supabaseProjectRef,
    "utf8",
  );

  const migrationFiles = (
    await readdir(join(repoRoot, "supabase", "migrations"))
  )
    .filter((fileName) => /^\d{14}_.+\.sql$/.test(fileName))
    .filter((fileName) => fileName.slice(0, 14) <= throughVersion)
    .sort();
  const requiredMigration =
    throughVersion === foundationMigration.slice(0, 14)
      ? foundationMigration
      : cutoverMigration;
  if (!migrationFiles.includes(requiredMigration)) {
    await rm(root, { force: true, recursive: true });
    throw new Error(
      "The requested staging migration is missing from the bundle.",
    );
  }

  for (const fileName of migrationFiles) {
    await copyFile(
      join(repoRoot, "supabase", "migrations", fileName),
      join(migrationsRoot, fileName),
    );
  }
  return root;
}

function runSupabasePush({ bundleRoot, environment, runCommand, dryRun }) {
  const args = [
    "--no-install",
    "supabase",
    "db",
    "push",
    "--linked",
    ...(dryRun ? ["--dry-run"] : ["--yes"]),
    "--workdir",
    bundleRoot,
  ];
  return runCommand(command, args, { environment });
}

function assertMigrationPlan(result, expectedFiles) {
  assertCommandSucceeded(result, "Staging migration dry-run failed.");
  const output = `${result.stdout}\n${result.stderr}`;
  const plannedFiles = [
    ...output.matchAll(
      /(?:Applying migration|Would apply migration)\s+([^\s]+)/g,
    ),
    ...output.matchAll(/^\s*[\u2022*-]\s+(\d{14}_[^\s]+\.sql)\s*$/gm),
  ].map((match) => basename(match[1]));
  const expected = [...expectedFiles].sort();
  const actual = [...new Set(plannedFiles)].sort();
  if (
    actual.length !== expected.length ||
    actual.some((fileName, index) => fileName !== expected[index])
  ) {
    throw new Error(
      `Unexpected migration plan. Expected only ${expected.join(", ")}.`,
    );
  }
}

function assertCommandSucceeded(result, message) {
  if (result.status !== 0) {
    throw new Error(message);
  }
}

async function assertHealthySupabaseProject(client, target) {
  const project = await client.getProject(target.projectRef);
  if (
    project?.id !== target.projectRef ||
    project?.name !== target.name ||
    project?.region !== target.region ||
    project?.status !== "ACTIVE_HEALTHY"
  ) {
    throw new Error(
      "Supabase staging project identity or health is divergent.",
    );
  }
}

async function readMigrationVersions(client, projectRef) {
  const response = await client.runReadOnlyQuery(projectRef, {
    query:
      "select version::text as version from supabase_migrations.schema_migrations order by version",
  });
  return normalizeRows(response).map(({ version }) => String(version));
}

function normalizeRows(response) {
  const rows = response?.result ?? response;
  return Array.isArray(rows) ? rows : [];
}

async function resolveDeploymentSource(options, resolveSourceCommit) {
  if (!options.sourceRef || !options.commitSha) {
    throw new Error(
      "Deployment requires --source-ref develop and --commit-sha.",
    );
  }
  if (options.sourceRef !== "develop") {
    throw new Error("Staging deployments must use the develop branch.");
  }
  if (!commitShaPattern.test(options.commitSha ?? "")) {
    throw new Error("Staging deployment requires an exact commit SHA.");
  }
  if (typeof resolveSourceCommit !== "function") {
    throw new Error("A source commit resolver is required.");
  }
  const resolvedCommitSha = await resolveSourceCommit(options.sourceRef);
  if (resolvedCommitSha !== options.commitSha) {
    throw new Error(
      "The develop source ref does not match the requested commit.",
    );
  }
  return { commitSha: options.commitSha, sourceRef: options.sourceRef };
}

async function resolveRemoteSourceCommit(sourceRef, runCommand) {
  const result = runCommand("git", [
    "ls-remote",
    "origin",
    `refs/heads/${sourceRef}`,
  ]);
  if (result.status !== 0) {
    throw new Error("Unable to resolve the remote develop commit.");
  }
  const [commitSha] = result.stdout.trim().split(/\s+/);
  return commitSha;
}

async function verifyVercelProject({ client, productionTarget, target }) {
  const project = await client.getProject(target.projectId, target.orgId);
  if (
    project?.id !== target.projectId ||
    project?.name !== target.projectName ||
    project?.framework !== target.framework ||
    project?.nodeVersion !== target.nodeVersion ||
    project?.link
  ) {
    throw new Error("Vercel staging project identity is divergent.");
  }
  if (project?.ssoProtection?.deploymentType !== "all_except_custom_domains") {
    throw new Error("Vercel Authentication protection must remain active.");
  }
  if (Object.keys(project?.protectionBypass ?? {}).length !== 0) {
    throw new Error("A Vercel protection bypass is active.");
  }
  const reserved = await client.getProject(
    productionTarget.projectId,
    target.orgId,
  );
  if (
    reserved?.id !== productionTarget.projectId ||
    reserved?.name !== productionTarget.projectName ||
    reserved?.link
  ) {
    throw new Error(
      "The reserved production Vercel project identity is divergent.",
    );
  }
  const [deployments, variables, domains] = await Promise.all([
    client.listProjectDeployments(productionTarget.projectId, target.orgId),
    client.listProjectEnvironmentVariables(
      productionTarget.projectId,
      target.orgId,
    ),
    client.listProjectDomains(productionTarget.projectId, target.orgId),
  ]);
  if (
    (deployments?.deployments ?? []).length !== 0 ||
    (variables?.envs ?? []).length !== 0 ||
    (domains?.domains ?? []).length !== 1 ||
    domains.domains[0]?.name !== `${productionTarget.projectName}.vercel.app`
  ) {
    throw new Error("The reserved production Vercel project is not empty.");
  }
  return project;
}

async function listDeployments(client, target) {
  const response = await client.listProjectDeployments(
    target.projectId,
    target.orgId,
  );
  return response?.deployments ?? [];
}

function assertProjectDeployments(deployments, target) {
  const divergent = deployments.find((deployment) => {
    const metadata = deployment?.meta ?? {};
    return (
      deployment?.name !== target.projectName ||
      deployment?.target !== target.deploymentEnvironment ||
      metadata.roberto_environment !== "staging" ||
      metadata.dedicated_staging !== "true"
    );
  });
  if (divergent) {
    throw new Error("The dedicated staging deployment history is divergent.");
  }
}

async function listEnvironmentVariables(client, target) {
  const response = await client.listProjectEnvironmentVariables(
    target.projectId,
    target.orgId,
  );
  return response?.envs ?? [];
}

function assertEnvironmentVariables(entries, target) {
  if (entries.length !== environmentVariables.length) {
    throw new Error("Staging must contain exactly three Production variables.");
  }
  for (const expected of environmentVariables) {
    const matches = entries.filter((entry) => entry.key === expected.key);
    if (
      matches.length !== 1 ||
      matches[0].type !== expected.type ||
      matches[0].target?.length !== 1 ||
      matches[0].target[0] !== target.deploymentEnvironment ||
      matches[0].gitBranch
    ) {
      throw new Error(`Staging variable ${expected.key} is divergent.`);
    }
  }
}

async function findExistingDeployment({ client, source, target }) {
  const deployments = await listDeployments(client, target);
  const matching = deployments.filter((deployment) =>
    deploymentMatchesSource(deployment, source, target),
  );
  if (matching.length > 1) {
    throw new Error("Multiple staging deployments match the requested commit.");
  }
  if (matching.length === 0) return null;
  const deploymentId = matching[0].uid ?? matching[0].id;
  if (!deploymentId) throw new Error("Staging deployment id is missing.");
  return client.getDeployment(deploymentId, target.orgId);
}

function deploymentMatchesSource(deployment, source, target) {
  const metadata = deployment?.meta ?? {};
  const gitSource = deployment?.gitSource ?? {};
  return (
    metadata.roberto_environment === "staging" &&
    metadata.staging_rollout === "true" &&
    metadata.roberto_source_ref === source.sourceRef &&
    metadata.roberto_commit_sha === source.commitSha &&
    gitSource.ref === source.commitSha &&
    gitSource.sha === source.commitSha &&
    gitSource.repoId === target.repositoryId
  );
}

async function createAndPollDeployment({ client, source, target, wait }) {
  const created = await client.createGitDeployment({
    environment: target.deploymentEnvironment,
    metadata: {
      dedicated_staging: "true",
      pr08: "true",
      roberto_commit_sha: source.commitSha,
      roberto_environment: "staging",
      roberto_source_ref: source.sourceRef,
      staging_rollout: "true",
    },
    orgId: target.orgId,
    projectId: target.projectId,
    projectName: target.projectName,
    ref: source.commitSha,
    repositoryId: target.repositoryId,
  });
  const deploymentId = created?.id ?? created?.uid;
  if (!deploymentId)
    throw new Error("Vercel returned no staging deployment id.");
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const deployment = await client.getDeployment(deploymentId, target.orgId);
    if (deployment?.readyState === "READY") return deployment;
    if (deployment?.readyState === "ERROR") {
      throw new Error("Vercel staging deployment failed.");
    }
    if (attempt < 59) await wait(5_000);
  }
  throw new Error("Vercel staging deployment did not reach READY in time.");
}

async function verifyDeployment({
  client,
  deploymentId,
  productionTarget,
  source,
  target,
}) {
  if (!deploymentIdPattern.test(deploymentId ?? "")) {
    throw new Error("A valid --deployment-id is required.");
  }
  await verifyVercelProject({
    client,
    productionTarget,
    target,
  });
  assertProjectDeployments(await listDeployments(client, target), target);
  assertEnvironmentVariables(
    await listEnvironmentVariables(client, target),
    target,
  );
  const deployment = await client.getDeployment(deploymentId, target.orgId);
  assertStagingDeployment(deployment, source, target);
  return deployment;
}

function assertStagingDeployment(deployment, source, target) {
  const deploymentId = deployment?.uid ?? deployment?.id;
  if (
    !deploymentId ||
    deployment?.name !== target.projectName ||
    deployment?.target !== target.deploymentEnvironment ||
    deployment?.readyState !== "READY"
  ) {
    throw new Error(
      "Staging deployment is not READY for the dedicated project.",
    );
  }
  if (!deploymentMatchesSource(deployment, source, target)) {
    throw new Error("Staging deployment source ref or SHA is divergent.");
  }
  const aliases = deployment.alias ?? deployment.aliases ?? [];
  if (!aliases.includes(new URL(target.siteUrl).hostname)) {
    throw new Error("Staging deployment is missing the stable alias.");
  }
  const url = deployment.url?.startsWith("http")
    ? deployment.url
    : `https://${deployment.url}`;
  if (!new URL(url).hostname.endsWith(".vercel.app")) {
    throw new Error("Staging deployment URL is not a Vercel URL.");
  }
}

function deploymentResult({ deployment, mode, project, source, target }) {
  return {
    commitSha: source.commitSha,
    deploymentId: deployment.uid ?? deployment.id,
    deploymentUrl: deployment.url?.startsWith("http")
      ? deployment.url
      : `https://${deployment.url}`,
    mode,
    phase: mode === "verified" ? "verify" : "deploy",
    projectId: project.id,
    sourceRef: source.sourceRef,
    stableUrl: target.siteUrl,
  };
}

function authorizeMutation({
  confirmation,
  environment,
  execute,
  manifest,
  provider,
  target,
}) {
  validateRemoteOperation({
    confirmation,
    environment,
    execute,
    manifest,
    operation: "mutate",
    provider,
    target:
      provider === "supabase"
        ? {
            hostname: target.hostname,
            name: target.name,
            organizationId: target.organizationId,
            projectRef: target.projectRef,
          }
        : {
            orgId: target.orgId,
            projectId: target.projectId,
            projectName: target.projectName,
          },
  });
}

function parseArguments(args) {
  const phase = readOption(args, "--phase");
  if (!phases.has(phase)) {
    throw new Error(
      "--phase must be apply-foundation, deploy, verify or apply-cutover.",
    );
  }
  return {
    commitSha: readOption(args, "--commit-sha"),
    confirmCutover: readOption(args, "--confirm-cutover"),
    confirmSmokePassed: readOption(args, "--confirm-smoke-passed"),
    databaseConfirmation: readOption(args, "--confirm-database-ref"),
    confirmation: readOption(args, "--confirm-project"),
    deploymentId: readOption(args, "--deployment-id"),
    execute: args.includes("--execute"),
    phase,
    sourceRef: readOption(args, "--source-ref"),
  };
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function requireEnvironmentVariables(environment, names) {
  if (names.some((name) => !environment[name]?.trim())) {
    throw new Error(
      `${names.join(" and ")} must be available in the process environment.`,
    );
  }
}

async function waitForPolling(delayMs) {
  await new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
}

export async function runStagingRolloutCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    console.log(
      "Uso: npm run ops:rollout-staging -- --phase <apply-foundation|deploy|verify|apply-cutover> [--source-ref develop --commit-sha <sha> --deployment-id <id>] [--execute --confirm-project <ref-ou-project-id>] [--confirm-database-ref <supabase-ref> --confirm-smoke-passed STAGING_FINANCIAL_SMOKE_PASSED --confirm-cutover <migration>]",
    );
    return;
  }
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const result = await runStagingRollout({
    args: argv,
    environment,
    manifest,
  });
  console.log(JSON.stringify(result, null, 2));
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runStagingRolloutCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Staging rollout failed.",
    );
    process.exitCode = 1;
  });
}
