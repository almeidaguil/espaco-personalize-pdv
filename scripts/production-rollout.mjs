import { createHash } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { z } from "zod";

import { createProductionEnvironmentFingerprint } from "./production-environment-fingerprint.mjs";
import { loadProductionCutoverState } from "./production-cutover-state.mjs";
import {
  loadRemoteEnvironmentManifest,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { runCliCommand } from "./run-cli-command.mjs";
import { createSupabaseManagementClient } from "./supabase-management-client.mjs";
import { createVercelManagementClient } from "./vercel-management-client.mjs";
import { hasActiveVercelProtectionBypass } from "./vercel-protection-bypass.mjs";

const foundationMigration =
  "20261018120000_add_split_payments_and_cash_reconciliation.sql";
const cutoverMigration = "20261018180000_disable_legacy_cash_close.sql";
const stagingGateConfirmation = "STAGING_RELEASE_GATE_PASSED";
const backupVerificationConfirmation = "PRODUCTION_BACKUP_VERIFIED";
const migrationFilePattern = /^\d{14}_.+\.sql$/;
const commitShaPattern = /^[a-f0-9]{40}$/;
const deploymentIdPattern = /^dpl_[A-Za-z0-9]+$/;
const phases = new Set(["apply-foundation", "apply-cutover"]);
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const productionEnvironmentKeys = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
];
const backupEvidenceSchema = z
  .object({
    capturedAtUtc: z.iso.datetime(),
    dataEncryptedBytes: z.number().int().positive(),
    dataFile: z
      .string()
      .regex(/^roberto-production-\d{8}T\d{6}Z-public-data\.sql\.dpapi$/),
    dataSha256: z.string().regex(/^[a-f0-9]{64}$/),
    encryption: z.literal("Windows DPAPI CurrentUser"),
    plaintextRemoved: z.literal(true),
    projectRef: z.string().regex(/^[a-z]{20}$/),
    schemaEncryptedBytes: z.number().int().positive(),
    schemaFile: z
      .string()
      .regex(/^roberto-production-\d{8}T\d{6}Z-public-schema\.sql\.dpapi$/),
    schemaSha256: z.string().regex(/^[a-f0-9]{64}$/),
    scope: z.literal("public schema and application data"),
  })
  .strict();

export async function runProductionMigrationRollout({
  args,
  backupReader = readAndValidateProductionReleaseBackup,
  cutoverState,
  environment = process.env,
  loadState = loadProductionCutoverState,
  managementClient = undefined,
  manifest,
  now = () => new Date(),
  readLocalCommit = (runCommand, currentEnvironment) =>
    resolveLocalCommit(runCommand, currentEnvironment),
  readSourceCommit = (sourceRef, runCommand, currentEnvironment) =>
    resolveRemoteSourceCommit(sourceRef, runCommand, currentEnvironment),
  repoRoot = process.cwd(),
  runCommand = runCliCommand,
  tempRoot = () => mkdtemp(join(tmpdir(), "pdv-production-rollout-")),
  vercelClient = undefined,
}) {
  const options = parseArguments(args);
  const supabaseTarget = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "supabase",
  });
  const vercelTarget = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "vercel",
  });
  const migration =
    options.phase === "apply-foundation"
      ? foundationMigration
      : cutoverMigration;
  const migrationVersion = migration.slice(0, 14);

  const state =
    cutoverState ??
    (await loadState({
      filePath: resolve(".provisioning/production-cutover-state.json"),
    }));
  assertVerifiedCutoverState(state, supabaseTarget.projectRef);

  const backupEvidence = await backupReader({
    filePath: options.backupEvidencePath,
    now: now(),
    projectRef: supabaseTarget.projectRef,
  });
  if (
    options.execute &&
    options.backupConfirmation !== backupVerificationConfirmation
  ) {
    throw new Error(
      `Production migration requires --confirm-backup-verified ${backupVerificationConfirmation}.`,
    );
  }
  const source = await resolveReleaseSource({
    options,
    readLocalCommit,
    readSourceCommit,
    runCommand,
    environment,
  });

  validateRemoteOperation({
    confirmation: options.databaseConfirmation,
    environment: "production",
    execute: options.execute,
    manifest,
    operation: options.execute ? "mutate" : "read",
    provider: "supabase",
    target: {
      hostname: supabaseTarget.hostname,
      name: supabaseTarget.name,
      organizationId: supabaseTarget.organizationId,
      projectRef: supabaseTarget.projectRef,
    },
  });

  requireEnvironmentVariables(environment, [
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
  ]);
  const database =
    managementClient ??
    createSupabaseManagementClient({
      accessToken: environment.SUPABASE_ACCESS_TOKEN,
    });
  await assertHealthySupabaseProject(database, supabaseTarget);

  if (options.phase === "apply-cutover") {
    requireEnvironmentVariables(environment, [
      "VERCEL_TOKEN",
      ...productionEnvironmentKeys,
    ]);
    if (
      options.stagingConfirmation !== stagingGateConfirmation ||
      options.migrationConfirmation !== cutoverMigration
    ) {
      throw new Error(
        `Production cutover requires --confirm-staging-gates ${stagingGateConfirmation} and --confirm-migration ${cutoverMigration}.`,
      );
    }
    validateRemoteOperation({
      confirmation: options.projectConfirmation,
      environment: "production",
      execute: options.execute,
      manifest,
      operation: options.execute ? "mutate" : "read",
      provider: "vercel",
      target: {
        orgId: vercelTarget.orgId,
        projectId: vercelTarget.projectId,
        projectName: vercelTarget.projectName,
      },
    });
  } else if (
    options.execute &&
    (options.stagingConfirmation !== stagingGateConfirmation ||
      options.migrationConfirmation !== foundationMigration)
  ) {
    throw new Error(
      `Foundation migration requires --confirm-staging-gates ${stagingGateConfirmation} and --confirm-migration ${foundationMigration}.`,
    );
  }

  function assertFoundationPrivileges(response) {
    const rows = normalizeRows(response);
    if (
      rows.length !== 1 ||
      rows[0].legacy_close_executable !== true ||
      rows[0].v2_close_executable !== true
    ) {
      throw new Error(
        "Production foundation must retain legacy close and grant close_cash_session_v2.",
      );
    }
  }

  let deployment;
  if (options.phase === "apply-cutover") {
    const client =
      vercelClient ??
      createVercelManagementClient({ authToken: environment.VERCEL_TOKEN });
    deployment = await verifyProductionDeployment({
      client,
      environment,
      manifest,
      source,
      target: vercelTarget,
    });
  }

  const appliedVersions = await readMigrationVersions(
    database,
    supabaseTarget.projectRef,
  );
  await assertMigrationHistory({
    appliedVersions,
    migrationVersion,
    repoRoot,
  });

  if (appliedVersions.includes(migrationVersion)) {
    if (options.phase === "apply-foundation") {
      if (appliedVersions.includes(cutoverMigration.slice(0, 14))) {
        throw new Error("The production cutover migration is already applied.");
      }
      assertFoundationPrivileges(
        await database.runReadOnlyQuery(supabaseTarget.projectRef, {
          query: cutoverPrivilegeQuery,
        }),
      );
    } else {
      assertCutoverPrivileges(
        await database.runReadOnlyQuery(supabaseTarget.projectRef, {
          query: cutoverPrivilegeQuery,
        }),
      );
    }
    return {
      backupCapturedAtUtc: backupEvidence.capturedAtUtc,
      backupEvidenceSha256: backupEvidence.evidenceSha256,
      commitSha: source.commitSha,
      mode: "already-applied",
      phase: options.phase,
      projectRef: supabaseTarget.projectRef,
      ...(deployment ? { deploymentId: deployment.uid ?? deployment.id } : {}),
    };
  }

  const bundle = await createMigrationBundle({
    repoRoot,
    supabaseProjectRef: supabaseTarget.projectRef,
    tempRoot,
    throughVersion: migrationVersion,
  });
  try {
    const dryRun = runSupabasePush({
      bundleRoot: bundle,
      environment,
      runCommand,
      dryRun: true,
    });
    assertMigrationPlan(dryRun, [migration]);
    if (!options.execute) {
      return {
        backupCapturedAtUtc: backupEvidence.capturedAtUtc,
        backupEvidenceSha256: backupEvidence.evidenceSha256,
        commitSha: source.commitSha,
        migration,
        mode: "dry-run",
        phase: options.phase,
        projectRef: supabaseTarget.projectRef,
      };
    }

    const applied = runSupabasePush({
      bundleRoot: bundle,
      environment,
      runCommand,
      dryRun: false,
    });
    assertCommandSucceeded(applied, "Production migration application failed.");

    const finalVersions = await readMigrationVersions(
      database,
      supabaseTarget.projectRef,
    );
    if (!finalVersions.includes(migrationVersion)) {
      throw new Error("The requested production migration was not recorded.");
    }
    if (
      options.phase === "apply-foundation" &&
      finalVersions.includes(cutoverMigration.slice(0, 14))
    ) {
      throw new Error("Production cutover ran before deployment and smoke.");
    }
    if (options.phase === "apply-foundation") {
      assertFoundationPrivileges(
        await database.runReadOnlyQuery(supabaseTarget.projectRef, {
          query: cutoverPrivilegeQuery,
        }),
      );
    } else {
      assertCutoverPrivileges(
        await database.runReadOnlyQuery(supabaseTarget.projectRef, {
          query: cutoverPrivilegeQuery,
        }),
      );
    }

    return {
      backupCapturedAtUtc: backupEvidence.capturedAtUtc,
      backupEvidenceSha256: backupEvidence.evidenceSha256,
      commitSha: source.commitSha,
      migration,
      mode: "executed",
      phase: options.phase,
      projectRef: supabaseTarget.projectRef,
      ...(deployment ? { deploymentId: deployment.uid ?? deployment.id } : {}),
    };
  } finally {
    await rm(bundle, { force: true, recursive: true });
  }
}

export async function readAndValidateProductionReleaseBackup({
  filePath,
  now = new Date(),
  projectRef,
}) {
  if (!filePath?.trim()) {
    throw new Error("--backup-evidence is required for production migrations.");
  }

  let contents;
  let evidence;
  try {
    contents = await readFile(resolve(filePath), "utf8");
    evidence = backupEvidenceSchema.parse(JSON.parse(contents));
  } catch {
    throw new Error("Production backup evidence is missing or invalid.");
  }

  if (evidence.projectRef !== projectRef) {
    throw new Error(
      "Production backup evidence belongs to a different project.",
    );
  }
  const schemaTimestamp = evidence.schemaFile.match(
    /^roberto-production-(\d{8}T\d{6}Z)-public-schema\.sql\.dpapi$/,
  )?.[1];
  const dataTimestamp = evidence.dataFile.match(
    /^roberto-production-(\d{8}T\d{6}Z)-public-data\.sql\.dpapi$/,
  )?.[1];
  if (
    !schemaTimestamp ||
    schemaTimestamp !== dataTimestamp ||
    basename(filePath) !== `roberto-production-${schemaTimestamp}-evidence.json`
  ) {
    throw new Error(
      "Production backup evidence files do not belong to one capture.",
    );
  }
  const capturedAt = Date.parse(evidence.capturedAtUtc);
  const age = now.getTime() - capturedAt;
  if (!Number.isFinite(age) || age < 0 || age > 60 * 60 * 1_000) {
    throw new Error(
      "Production backup evidence must be less than one hour old.",
    );
  }

  const directory = dirname(resolve(filePath));
  for (const [fileName, expectedBytes] of [
    [evidence.schemaFile, evidence.schemaEncryptedBytes],
    [evidence.dataFile, evidence.dataEncryptedBytes],
  ]) {
    const filePath = join(directory, basename(fileName));
    const file = await lstat(filePath).catch(() => null);
    if (
      !file?.isFile() ||
      file.isSymbolicLink() ||
      file.size !== expectedBytes
    ) {
      throw new Error(
        "Encrypted production backup files do not match evidence.",
      );
    }
  }

  return {
    capturedAtUtc: evidence.capturedAtUtc,
    evidenceSha256: createHash("sha256").update(contents).digest("hex"),
  };
}

async function verifyProductionDeployment({
  client,
  environment,
  manifest,
  source,
  target,
}) {
  if (!deploymentIdPattern.test(source.deploymentId ?? "")) {
    throw new Error(
      "Cutover requires --deployment-id for the production release.",
    );
  }
  const project = await client.getProject(target.projectId, target.orgId);
  if (
    project?.id !== target.projectId ||
    project?.name !== target.projectName ||
    project?.framework !== manifest.vercel.framework ||
    project?.nodeVersion !== manifest.vercel.nodeVersion ||
    project?.link ||
    (project?.ssoProtection &&
      project.ssoProtection.deploymentType !== "none") ||
    hasActiveVercelProtectionBypass(project?.protectionBypass)
  ) {
    throw new Error(
      "Production Vercel project identity or protection is divergent.",
    );
  }
  const variableResponse = await client.listProjectEnvironmentVariables(
    target.projectId,
    target.orgId,
  );
  const variables = variableResponse?.envs ?? variableResponse;
  const expectedVariableTypes = new Map([
    ["NEXT_PUBLIC_SUPABASE_URL", "encrypted"],
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "encrypted"],
    ["SUPABASE_SECRET_KEY", "sensitive"],
  ]);
  if (
    !Array.isArray(variables) ||
    variables.length !== expectedVariableTypes.size ||
    new Set(variables.map((entry) => entry.key)).size !==
      expectedVariableTypes.size ||
    variables.some(
      (entry) =>
        expectedVariableTypes.get(entry.key) !== entry.type ||
        !Array.isArray(entry.target) ||
        entry.target.length !== 1 ||
        entry.target[0] !== "production",
    )
  ) {
    throw new Error(
      "Production Vercel environment variable inventory is divergent.",
    );
  }

  const deployment = await client.getDeployment(
    source.deploymentId,
    target.orgId,
  );
  const deploymentId = deployment?.uid ?? deployment?.id;
  const environmentValues = Object.fromEntries(
    productionEnvironmentKeys.map((key) => [key, environment[key]]),
  );
  const expectedFingerprint =
    createProductionEnvironmentFingerprint(environmentValues);
  const stableHostname = new URL(target.siteUrl).hostname;
  const hasStableAlias =
    Array.isArray(deployment?.alias) &&
    deployment.alias.includes(stableHostname);
  if (
    deploymentId !== source.deploymentId ||
    deployment?.name !== target.projectName ||
    deployment?.target !== "production" ||
    deployment?.readyState !== "READY" ||
    !deployment?.url ||
    !hasStableAlias ||
    deployment.gitSource?.sha !== source.commitSha ||
    deployment.gitSource?.ref !== source.commitSha ||
    deployment.gitSource?.repoId !== target.repositoryId ||
    deployment.meta?.pr09 !== "true" ||
    deployment.meta?.roberto_environment !== "production" ||
    deployment.meta?.roberto_source_ref !== "main" ||
    deployment.meta?.roberto_commit_sha !== source.commitSha ||
    deployment.meta?.roberto_environment_fingerprint !== expectedFingerprint
  ) {
    throw new Error(
      "The production deployment must be READY on the stable alias for the exact main commit and environment.",
    );
  }
  return deployment;
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
      "Production Supabase project identity or health is divergent.",
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

async function assertMigrationHistory({
  appliedVersions,
  migrationVersion,
  repoRoot,
}) {
  const migrationsDirectory = join(repoRoot, "supabase", "migrations");
  const files = (await readdir(migrationsDirectory))
    .filter((fileName) => migrationFilePattern.test(fileName))
    .sort();
  const localVersions = files.map((fileName) => fileName.slice(0, 14));
  if (new Set(localVersions).size !== localVersions.length) {
    throw new Error("Local migration versions are not unique.");
  }
  if (!localVersions.includes(migrationVersion)) {
    throw new Error("The requested migration is missing from the release.");
  }

  const applied = new Set(appliedVersions);
  if (appliedVersions.some((version) => !localVersions.includes(version))) {
    throw new Error(
      "Production has migration versions absent from the release.",
    );
  }
  if (appliedVersions.some((version) => version > migrationVersion)) {
    throw new Error("Production database is ahead of this release migration.");
  }
  const missingPredecessors = localVersions.filter(
    (version) => version < migrationVersion && !applied.has(version),
  );
  if (missingPredecessors.length > 0) {
    throw new Error(
      `Production is missing prerequisite migrations: ${missingPredecessors.join(", ")}.`,
    );
  }
}

async function createMigrationBundle({
  repoRoot,
  supabaseProjectRef,
  tempRoot,
  throughVersion,
}) {
  const root = await tempRoot();
  try {
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
      .filter((fileName) => migrationFilePattern.test(fileName))
      .filter((fileName) => fileName.slice(0, 14) <= throughVersion)
      .sort();
    const requiredMigration =
      throughVersion === foundationMigration.slice(0, 14)
        ? foundationMigration
        : cutoverMigration;
    if (!migrationFiles.includes(requiredMigration)) {
      throw new Error(
        "The requested production migration is missing from its bundle.",
      );
    }

    for (const fileName of migrationFiles) {
      await copyFile(
        join(repoRoot, "supabase", "migrations", fileName),
        join(migrationsRoot, fileName),
      );
    }
    return root;
  } catch (error) {
    await rm(root, { force: true, recursive: true });
    throw error;
  }
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
  assertCommandSucceeded(result, "Production migration dry-run failed.");
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
      `Unexpected production migration plan. Expected only ${expected.join(", ")}.`,
    );
  }
}

function assertCutoverPrivileges(response) {
  const rows = normalizeRows(response);
  if (
    rows.length !== 1 ||
    rows[0].legacy_close_executable !== false ||
    rows[0].v2_close_executable !== true
  ) {
    throw new Error("Production cash-close RPC privileges are divergent.");
  }
}

const cutoverPrivilegeQuery =
  "select has_function_privilege('authenticated', 'public.close_cash_session(uuid, integer, timestamptz, text)', 'execute') as legacy_close_executable, has_function_privilege('authenticated', 'public.close_cash_session_v2(uuid, jsonb, text)', 'execute') as v2_close_executable";

function assertVerifiedCutoverState(state, projectRef) {
  const created = state?.history?.find(
    (entry) => entry.phase === "production-created",
  );
  if (
    state?.phase !== "verified" ||
    created?.facts?.projectRef !== projectRef
  ) {
    throw new Error(
      "A verified production cutover state for the exact project is required.",
    );
  }
}

async function resolveReleaseSource({
  options,
  readLocalCommit,
  readSourceCommit,
  runCommand,
  environment,
}) {
  if (
    options.sourceRef !== "main" ||
    !commitShaPattern.test(options.commitSha ?? "")
  ) {
    throw new Error(
      "Production migration requires --source-ref main and an exact --commit-sha.",
    );
  }
  if (
    typeof readSourceCommit !== "function" ||
    typeof readLocalCommit !== "function"
  ) {
    throw new Error(
      "Production migration requires source and local commit resolvers.",
    );
  }
  const remoteCommit = await readSourceCommit(
    options.sourceRef,
    runCommand,
    environment,
  );
  const localCommit = await readLocalCommit(runCommand, environment);
  if (remoteCommit !== options.commitSha || localCommit !== options.commitSha) {
    throw new Error(
      "The local checkout and remote main ref must match the requested release commit.",
    );
  }
  return {
    commitSha: options.commitSha,
    deploymentId: options.deploymentId,
    sourceRef: options.sourceRef,
  };
}

async function resolveRemoteSourceCommit(sourceRef, runCommand, environment) {
  const result = runCommand(
    "git",
    ["ls-remote", "origin", `refs/heads/${sourceRef}`],
    { environment: cleanGitEnvironment(environment) },
  );
  if (result.status !== 0) {
    throw new Error("Unable to resolve the remote main commit.");
  }
  return result.stdout.trim().split(/\s+/)[0];
}

async function resolveLocalCommit(runCommand, environment) {
  const result = runCommand("git", ["rev-parse", "HEAD"], {
    environment: cleanGitEnvironment(environment),
  });
  if (result.status !== 0) {
    throw new Error("Unable to resolve the local production release commit.");
  }
  return result.stdout.trim();
}

function cleanGitEnvironment(environment) {
  const result = { ...environment };
  for (const name of [
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_SECRET_KEY",
    "VERCEL_OIDC_TOKEN",
    "VERCEL_TOKEN",
  ]) {
    delete result[name];
  }
  return result;
}

function requireEnvironmentVariables(environment, names) {
  if (names.some((name) => !environment?.[name]?.trim())) {
    throw new Error(
      `${names.join(" and ")} must be available in the process environment.`,
    );
  }
}

function assertCommandSucceeded(result, message) {
  if (result.status !== 0) {
    throw new Error(message);
  }
}

function normalizeRows(response) {
  const rows = response?.result ?? response;
  return Array.isArray(rows) ? rows : [];
}

function parseArguments(args) {
  const valueOptions = new Map([
    ["--phase", "phase"],
    ["--source-ref", "sourceRef"],
    ["--commit-sha", "commitSha"],
    ["--confirm-project", "projectConfirmation"],
    ["--confirm-database-ref", "databaseConfirmation"],
    ["--confirm-migration", "migrationConfirmation"],
    ["--confirm-staging-gates", "stagingConfirmation"],
    ["--confirm-backup-verified", "backupConfirmation"],
    ["--backup-evidence", "backupEvidencePath"],
    ["--deployment-id", "deploymentId"],
  ]);
  const options = { execute: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--execute") {
      if (options.execute) throw new Error("Duplicate --execute option.");
      options.execute = true;
      continue;
    }
    const key = valueOptions.get(argument);
    if (!key) throw new Error(`Unexpected argument: ${argument}`);
    if (options[key] !== undefined) {
      throw new Error(`Duplicate ${argument} option.`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[key] = value;
    index += 1;
  }
  if (!phases.has(options.phase)) {
    throw new Error("--phase must be apply-foundation or apply-cutover.");
  }
  if (!options.backupEvidencePath) {
    throw new Error("--backup-evidence is required.");
  }
  return options;
}

export async function runProductionMigrationRolloutCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    if (argv.length !== 1) {
      throw new Error("--help cannot be combined with other arguments.");
    }
    console.log(
      "Usage: npm run ops:rollout-production -- --phase <apply-foundation|apply-cutover> --source-ref main --commit-sha <sha> --backup-evidence <file> [--deployment-id <id>] [--confirm-backup-verified PRODUCTION_BACKUP_VERIFIED --confirm-staging-gates STAGING_RELEASE_GATE_PASSED --confirm-migration <migration> --execute --confirm-database-ref wjuzwjbvctbyfvgmprmd --confirm-project prj_oBs2uc7uxsHMc7ssHFKczfi52LMq]",
    );
    return;
  }
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const result = await runProductionMigrationRollout({
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
  runProductionMigrationRolloutCli().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Production migration rollout failed.",
    );
    process.exitCode = 1;
  });
}
