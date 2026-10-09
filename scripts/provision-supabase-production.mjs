import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadProductionCutoverState,
  recordProductionCutoverPhase,
} from "./production-cutover-state.mjs";
import {
  readAndValidateProductionBackupEvidence,
  validateProductionBackupEvidence,
} from "./production-backup-evidence.mjs";
import {
  loadRemoteEnvironmentManifest,
  parseRemoteEnvironmentManifest,
  redactSensitiveText,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { runCliCommand } from "./run-cli-command.mjs";
import { createSupabaseManagementClient } from "./supabase-management-client.mjs";

const evidenceMaximumAgeMs = 60 * 60 * 1_000;
const pollingAttempts = 20;
const pollingIntervalMs = 15_000;
const stateFilePath = ".provisioning/production-cutover-state.json";

const phaseOrder = [
  "preflight",
  "backup-recorded",
  "legacy-paused",
  "production-created",
  "database-ready",
  "admin-ready",
  "vercel-configured",
  "deployment-ready",
  "verified",
];

export async function runSupabaseProductionProvisioning({
  commandRunner,
  environment,
  evidence,
  gitIdentity,
  log = () => {},
  managementClient,
  manifest: providedManifest,
  migrationHead,
  now = () => new Date(),
  options = {},
  recordPhase,
  state = /** @type {any} */ (null),
  wait = defaultWait,
}) {
  const manifest = parseRemoteEnvironmentManifest(providedManifest);
  const currentTime = now();
  const validatedEvidence = validateProductionBackupEvidence({
    evidence,
    manifest,
    maximumAgeMs: evidenceMaximumAgeMs,
    now: currentTime,
  });

  if (!managementClient) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required for production audit.");
  }

  const target = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "supabase",
  });
  const regions = await managementClient.listAvailableRegions(
    target.organizationId,
  );
  if (!containsRegion(regions, target.region)) {
    throw new Error(`${target.region} is unavailable for project creation.`);
  }

  let topology = validateProductionTopology(
    await managementClient.listProjects(),
    manifest,
  );

  if (!options.execute) {
    const result = {
      legacyProductionState: topology.legacyProduction.status,
      mode: "dry-run",
      newProductionState: topology.production?.status ?? "absent",
      region: target.region,
      stagingState: topology.staging.status,
      ...(topology.production
        ? { targetRef: projectRef(topology.production) }
        : {}),
    };
    log(result);
    return result;
  }

  if (!environment?.SUPABASE_DB_PASSWORD?.trim()) {
    throw new Error("SUPABASE_DB_PASSWORD is required for execution.");
  }
  if (typeof recordPhase !== "function") {
    throw new Error("A cutover state recorder is required for execution.");
  }

  let currentState = state;
  assertResumeTopology(currentState, topology);
  const advance = async (phase, facts) => {
    if (phaseIndex(currentState?.phase) >= phaseIndex(phase)) return;
    currentState = await recordPhase({
      facts,
      phase,
      previousState: currentState,
    });
  };

  if (phaseIndex(currentState?.phase) < phaseIndex("preflight")) {
    assertGitIdentity(gitIdentity);
    await advance("preflight", {
      commitSha: gitIdentity.commitSha,
      manifestVersion: manifest.version,
      sourceRef: gitIdentity.sourceRef,
    });
  }
  await advance("backup-recorded", {
    capturedAt: validatedEvidence.capturedAt,
    evidenceSha256: validatedEvidence.sha256,
    sourceProjectRef: validatedEvidence.source.projectRef,
  });

  if (!topology.production) {
    authorizeInitialCutover(manifest, options);

    if (topology.legacyProduction.status !== "INACTIVE") {
      if (topology.legacyProduction.status !== "ACTIVE_HEALTHY") {
        throw new Error("Legacy production is not healthy.");
      }
      await managementClient.pauseProject(
        projectRef(topology.legacyProduction),
      );
      await pollProject({
        acceptedState: "INACTIVE",
        managementClient,
        projectRef: projectRef(topology.legacyProduction),
        wait,
      });
    }

    topology = validateProductionTopology(
      await managementClient.listProjects(),
      manifest,
    );
    if (topology.legacyProduction.status !== "INACTIVE") {
      throw new Error("Legacy production did not reach INACTIVE.");
    }
    if (topology.production) {
      throw new Error("Production topology changed during legacy pause.");
    }
    await advance("legacy-paused", {
      projectRef: projectRef(topology.legacyProduction),
      status: "INACTIVE",
    });

    const created = await managementClient.createProject({
      dbPass: environment.SUPABASE_DB_PASSWORD,
      name: target.name,
      organizationSlug: target.organizationId,
      region: target.region,
    });
    const createdRef = projectRef(created);
    let production = await pollProject({
      acceptedState: "ACTIVE_HEALTHY",
      managementClient,
      projectRef: createdRef,
      wait,
    });
    production = assertProductionIdentity(production, manifest, createdRef);

    await advance("production-created", productionFacts(production, manifest));
    const result = {
      legacyProductionState: "INACTIVE",
      mode: "executed",
      nextAction: "persist-production-target",
      targetRef: createdRef,
      targetState: production.status,
    };
    log(result);
    return result;
  }

  const productionRef = projectRef(topology.production);
  assertProductionStateIdentity(currentState, topology.production, manifest);

  if (!target.projectRef || !target.hostname) {
    const result = {
      legacyProductionState: topology.legacyProduction.status,
      mode: "executed",
      nextAction: "persist-production-target",
      targetRef: productionRef,
      targetState: topology.production.status,
    };
    log(result);
    return result;
  }

  authorizePersistedTarget(
    manifest,
    options.confirmTargetRef,
    topology.production,
  );
  if (topology.legacyProduction.status !== "INACTIVE") {
    throw new Error("Legacy production must remain INACTIVE during resume.");
  }
  if (topology.production.status !== "ACTIVE_HEALTHY") {
    throw new Error("New production is not healthy.");
  }
  if (phaseIndex(currentState?.phase) < phaseIndex("production-created")) {
    throw new Error("Production cutover state is missing production-created.");
  }
  if (phaseIndex(currentState?.phase) >= phaseIndex("database-ready")) {
    const result = {
      mode: "executed",
      nextAction: "bootstrap-production-admin",
      phase: "database-ready",
      targetRef: productionRef,
    };
    log(result);
    return result;
  }

  const commandEnvironment = {
    ...environment,
    SUPABASE_DB_PASSWORD: environment.SUPABASE_DB_PASSWORD,
  };
  await runSupabaseCommand(
    commandRunner,
    ["supabase", "link", "--project-ref", productionRef],
    commandEnvironment,
    "Supabase project link failed.",
  );
  await runSupabaseCommand(
    commandRunner,
    ["supabase", "db", "push", "--linked", "--dry-run"],
    commandEnvironment,
    "Supabase migration dry-run failed.",
  );
  await runSupabaseCommand(
    commandRunner,
    ["supabase", "db", "push", "--linked"],
    commandEnvironment,
    "Supabase migration push failed.",
  );

  const vercelTarget = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "vercel",
  });
  if (!vercelTarget.siteUrl) {
    throw new Error("Production Vercel site URL is missing.");
  }
  const siteUrl = vercelTarget.siteUrl.replace(/\/$/, "");
  const authConfiguration = {
    disable_signup: true,
    external_anonymous_users_enabled: false,
    external_email_enabled: true,
    password_hibp_enabled: true,
    password_min_length: 14,
    site_url: siteUrl,
    uri_allow_list: `${siteUrl}/**`,
  };
  await managementClient.updateAuthConfig(productionRef, authConfiguration);
  const persistedAuth = await managementClient.getAuthConfig(productionRef);
  assertExactAuthConfiguration(persistedAuth, authConfiguration);

  assertMigrationHead(migrationHead);
  await advance("database-ready", {
    authVerified: true,
    migrationHead,
    projectRef: productionRef,
  });
  const result = {
    mode: "executed",
    nextAction: "bootstrap-production-admin",
    phase: "database-ready",
    targetRef: productionRef,
  };
  log(result);
  return result;
}

export async function runProvisionSupabaseProductionCli(
  argv = process.argv.slice(2),
  dependencies = {},
) {
  const options = parseArguments(argv);
  const log = dependencies.log ?? console.log;
  if (options.help) {
    log(
      "Uso: npm run ops:provision-production -- --inventory <evidencia-json> [--execute --confirm-legacy-ref <ref> --confirm-target-name <nome> | --execute --confirm-target-ref <ref>]\nO comando executa dry-run por padrao; mutacoes exigem --execute e confirmacao literal.",
    );
    return;
  }

  if (!options.inventoryPath) {
    throw new Error("--inventory requires a value for production evidence.");
  }

  const environment = dependencies.environment ?? process.env;
  const now = dependencies.now ?? (() => new Date());
  const loadManifest =
    dependencies.loadManifest ?? loadRemoteEnvironmentManifest;
  const manifest = await loadManifest(
    resolve("config/remote-environments.json"),
  );
  const readEvidence =
    dependencies.readEvidence ?? readAndValidateProductionBackupEvidence;
  const evidence = await readEvidence({
    filePath: resolve(options.inventoryPath),
    manifest,
    maximumAgeMs: evidenceMaximumAgeMs,
    now: now(),
  });
  const loadState = dependencies.loadState ?? loadProductionCutoverState;
  const state = await loadState({ filePath: resolve(stateFilePath) });
  const managementClient =
    dependencies.managementClient ??
    (environment.SUPABASE_ACCESS_TOKEN
      ? createSupabaseManagementClient({
          accessToken: environment.SUPABASE_ACCESS_TOKEN,
        })
      : undefined);
  const commandRunner = dependencies.commandRunner ?? runCliCommand;
  const gitIdentity =
    dependencies.gitIdentity ??
    (options.execute
      ? readGitIdentity(commandRunner, environment)
      : { commitSha: "0".repeat(40), sourceRef: "feature/production-cutover" });
  const migrationHead =
    dependencies.migrationHead ?? (await readMigrationHead());
  const recordPhase =
    dependencies.recordPhase ??
    ((input) =>
      recordProductionCutoverPhase({
        ...input,
        filePath: resolve(stateFilePath),
        now: now(),
      }));

  return runSupabaseProductionProvisioning({
    commandRunner,
    environment,
    evidence,
    gitIdentity,
    log,
    managementClient,
    manifest,
    migrationHead,
    now,
    options,
    recordPhase,
    state,
    wait: dependencies.wait ?? defaultWait,
  });
}

function parseArguments(argv) {
  if (argv.includes("--help")) {
    if (argv.length !== 1) throw new Error("--help cannot be combined.");
    return { execute: false, help: true };
  }

  const options = { execute: false };
  const valueOptions = new Map([
    ["--inventory", "inventoryPath"],
    ["--confirm-legacy-ref", "confirmLegacyRef"],
    ["--confirm-target-name", "confirmTargetName"],
    ["--confirm-target-ref", "confirmTargetRef"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
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
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function validateProductionTopology(projects, manifest) {
  if (!Array.isArray(projects)) {
    throw new Error("Production project topology is unknown.");
  }
  const organizationId = manifest.supabase.organization.id;
  const organizationProjects = projects.filter(
    (project) => projectOrganization(project) === organizationId,
  );
  const legacyStaging = findProject(
    organizationProjects,
    manifest.supabase.legacy.staging.projectRef,
  );
  const staging = findProject(
    organizationProjects,
    manifest.supabase.targets.staging.projectRef,
  );
  const legacyProduction = findProject(
    organizationProjects,
    manifest.supabase.legacy.production.projectRef,
  );
  assertKnownIdentity(
    legacyStaging,
    manifest.supabase.legacy.staging,
    organizationId,
    "Legacy staging",
  );
  assertKnownIdentity(
    staging,
    manifest.supabase.targets.staging,
    organizationId,
    "Roberto staging",
  );
  assertKnownIdentity(
    legacyProduction,
    manifest.supabase.legacy.production,
    organizationId,
    "Legacy production",
  );
  if (legacyStaging.status !== "INACTIVE") {
    throw new Error("Legacy staging must remain INACTIVE.");
  }
  if (staging.status !== "ACTIVE_HEALTHY") {
    throw new Error("Roberto staging is not healthy.");
  }

  const expectedTarget = manifest.supabase.targets.production;
  const production = expectedTarget.projectRef
    ? findProject(organizationProjects, expectedTarget.projectRef)
    : organizationProjects.find(
        (project) => project.name === expectedTarget.name,
      );
  if (expectedTarget.projectRef && !production) {
    throw new Error("Roberto production identity is divergent.");
  }
  if (production) assertProductionIdentity(production, manifest);

  const knownRefs = new Set(
    [legacyStaging, staging, legacyProduction, production]
      .filter(Boolean)
      .map(projectRef),
  );
  const unknownActive = organizationProjects.find(
    (project) =>
      project.status !== "INACTIVE" && !knownRefs.has(projectRef(project)),
  );
  if (unknownActive) {
    throw new Error("Production topology contains an unknown active project.");
  }
  const activeProjects = organizationProjects.filter(
    (project) => project.status !== "INACTIVE",
  );
  if (activeProjects.length > 2) {
    throw new Error("Production topology has more than two active projects.");
  }
  if (
    legacyProduction.status !== "ACTIVE_HEALTHY" &&
    legacyProduction.status !== "INACTIVE"
  ) {
    throw new Error("Legacy production is not in a supported state.");
  }
  if (
    production &&
    legacyProduction.status !== "INACTIVE" &&
    production.status !== "INACTIVE"
  ) {
    throw new Error("Legacy and new production cannot both be active.");
  }

  return { legacyProduction, production, staging };
}

function authorizeInitialCutover(manifest, options) {
  const legacy = resolveRemoteTarget(manifest, {
    environment: "legacy-production",
    provider: "supabase",
  });
  validateRemoteOperation({
    confirmation: options.confirmLegacyRef,
    environment: "legacy-production",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "supabase",
    target: targetIdentity(legacy),
  });
  const target = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "supabase",
  });
  if (target.projectRef || target.hostname) {
    throw new Error("Initial production target must not have a persisted ref.");
  }
  validateRemoteOperation({
    confirmation: options.confirmTargetName,
    environment: "production",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "supabase",
    target: targetIdentity(target),
  });
}

function assertResumeTopology(state, topology) {
  if (!state) return;
  const currentPhaseIndex = phaseIndex(state.phase);
  if (currentPhaseIndex < 0) {
    throw new Error("Production cutover state phase is invalid.");
  }
  if (
    currentPhaseIndex >= phaseIndex("legacy-paused") &&
    topology.legacyProduction.status !== "INACTIVE"
  ) {
    throw new Error("Recorded legacy pause diverges from provider topology.");
  }
  if (
    currentPhaseIndex >= phaseIndex("production-created") &&
    !topology.production
  ) {
    throw new Error(
      "Recorded production creation diverges from provider topology.",
    );
  }
}

function authorizePersistedTarget(manifest, confirmation, project) {
  const target = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "supabase",
  });
  validateRemoteOperation({
    confirmation,
    environment: "production",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "supabase",
    target: {
      hostname: target.hostname,
      name: project.name,
      organizationId: projectOrganization(project),
      projectRef: projectRef(project),
    },
  });
}

async function pollProject({
  acceptedState,
  managementClient,
  projectRef: ref,
  wait,
}) {
  for (let attempt = 0; attempt < pollingAttempts; attempt += 1) {
    const project = await managementClient.getProject(ref);
    if (project?.status === acceptedState) return project;
    if (attempt < pollingAttempts - 1) await wait(pollingIntervalMs);
  }
  throw new Error(`Project ${ref} did not reach ${acceptedState}.`);
}

async function runSupabaseCommand(
  commandRunner,
  args,
  environment,
  failureMessage,
) {
  if (typeof commandRunner !== "function") {
    throw new Error("A command runner is required for database setup.");
  }
  const result = await commandRunner("npx.cmd", args, { environment });
  if (result.status !== 0) {
    const detail = redactSensitiveText(
      [result.stderr, result.stdout].filter(Boolean).join("\n").trim(),
      [environment.SUPABASE_ACCESS_TOKEN, environment.SUPABASE_DB_PASSWORD],
    );
    throw new Error(`${failureMessage}${detail ? ` ${detail}` : ""}`);
  }
}

function assertProductionIdentity(project, manifest, expectedRef) {
  const expected = manifest.supabase.targets.production;
  const ref = projectRef(project);
  const identityMatches =
    /^[a-z]{20}$/.test(ref ?? "") &&
    (!expectedRef || ref === expectedRef) &&
    (!expected.projectRef || ref === expected.projectRef) &&
    project?.name === expected.name &&
    project?.region === expected.region &&
    projectOrganization(project) === manifest.supabase.organization.id;
  if (!identityMatches) {
    throw new Error("Roberto production identity is divergent.");
  }
  return project;
}

function assertProductionStateIdentity(state, project, manifest) {
  const entry = state?.history?.find(
    (item) => item.phase === "production-created",
  );
  if (!entry) {
    throw new Error("Production cutover state is missing production-created.");
  }
  const expectedFacts = productionFacts(project, manifest);
  if (
    Object.entries(expectedFacts).some(
      ([key, value]) => entry.facts?.[key] !== value,
    )
  ) {
    throw new Error(
      "Production provider identity diverges from cutover state.",
    );
  }
}

function productionFacts(project, manifest) {
  const ref = projectRef(project);
  return {
    hostname: `${ref}.supabase.co`,
    name: project.name,
    organizationId: projectOrganization(project),
    projectRef: ref,
    region: manifest.supabase.targets.production.region,
  };
}

function assertKnownIdentity(project, expected, organizationId, label) {
  if (
    !project ||
    projectRef(project) !== expected.projectRef ||
    project.name !== expected.name ||
    project.region !== expected.region ||
    projectOrganization(project) !== organizationId
  ) {
    throw new Error(`${label} identity is divergent.`);
  }
}

function assertExactAuthConfiguration(actual, expected) {
  const divergent = Object.entries(expected).find(
    ([key, value]) => actual?.[key] !== value,
  );
  if (divergent) {
    throw new Error(
      `Production Auth configuration is divergent at ${divergent[0]}.`,
    );
  }
}

function assertGitIdentity(identity) {
  if (
    !/^[a-f0-9]{40}$/.test(identity?.commitSha ?? "") ||
    !["feature/production-cutover", "main"].includes(identity?.sourceRef)
  ) {
    throw new Error("Invalid production cutover Git identity.");
  }
}

function assertMigrationHead(value) {
  if (!/^\d{14}$/.test(value ?? "")) {
    throw new Error("Invalid production migration head.");
  }
}

function containsRegion(regions, expectedRegion) {
  if (Array.isArray(regions)) {
    return regions.some(
      (region) =>
        region === expectedRegion ||
        region?.code === expectedRegion ||
        region?.id === expectedRegion,
    );
  }
  if (regions && typeof regions === "object") {
    return Object.values(regions).some((value) =>
      containsRegion(value, expectedRegion),
    );
  }
  return false;
}

function targetIdentity(target) {
  return {
    hostname: target.hostname,
    name: target.name,
    organizationId: target.organizationId,
    projectRef: target.projectRef,
  };
}

function projectRef(project) {
  return project?.id ?? project?.ref;
}

function projectOrganization(project) {
  return project?.organization_id ?? project?.organization_slug;
}

function findProject(projects, ref) {
  return projects.find((project) => projectRef(project) === ref);
}

function phaseIndex(phase) {
  return phase ? phaseOrder.indexOf(phase) : -1;
}

function readGitIdentity(commandRunner, environment) {
  const commit = commandRunner("git", ["rev-parse", "HEAD"], { environment });
  const branch = commandRunner("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    environment,
  });
  if (commit.status !== 0 || branch.status !== 0) {
    throw new Error("Unable to determine production cutover Git identity.");
  }
  return {
    commitSha: commit.stdout.trim(),
    sourceRef: branch.stdout.trim(),
  };
}

async function readMigrationHead() {
  const migrations = await readdir(resolve("supabase/migrations"));
  const heads = migrations
    .map((name) => name.match(/^(\d{14})/)?.[1])
    .filter(Boolean)
    .sort();
  const head = heads.at(-1);
  assertMigrationHead(head);
  return head;
}

async function defaultWait(delayMs) {
  await new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runProvisionSupabaseProductionCli().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Production Supabase provisioning failed.",
    );
    process.exitCode = 1;
  });
}
