import { randomBytes } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadRemoteEnvironmentManifest,
  redactSensitiveText,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { createSupabaseManagementClient } from "./supabase-management-client.mjs";
import { runCliCommand } from "./run-cli-command.mjs";

const inventoryMaximumAgeMs = 24 * 60 * 60 * 1_000;
const pollingAttempts = 20;
const pollingIntervalMs = 15_000;

export async function runSupabaseStagingProvisioning({
  args,
  commandRunner,
  environment,
  generatePassword = createDatabasePassword,
  inventoryReader = readInventoryEvidence,
  log,
  managementClient = /** @type {any} */ (undefined),
  manifest,
  now = () => new Date(),
  wait,
}) {
  const options = parseArguments(args);
  const inventoryPath = resolveInventoryEvidencePath(options.inventoryPath);
  const target = manifest.supabase.targets.staging;

  if (!managementClient) {
    if (options.execute) {
      throw new Error("SUPABASE_ACCESS_TOKEN is required for execution.");
    }

    const planOnlyResult = {
      legacyState: "unknown",
      mode: "dry-run",
      nextAction:
        "provide SUPABASE_ACCESS_TOKEN and a fresh inventory evidence",
      productionState: "unknown",
      region: target.region,
      targetState: "pending",
    };
    log(planOnlyResult);
    return planOnlyResult;
  }

  const inventory = await inventoryReader(inventoryPath);
  validateInventoryEvidence(inventory, manifest, now());

  const regions = await managementClient.listAvailableRegions(
    manifest.supabase.organization.id,
  );
  if (!containsRegion(regions, target.region)) {
    throw new Error(`${target.region} is unavailable for project creation.`);
  }

  const initialProjects = await managementClient.listProjects();
  const initialState = validateProjectTopology(initialProjects, manifest);

  if (!options.execute) {
    const nextAction = initialState.target
      ? target.projectRef
        ? `rerun with --execute --confirm-target-ref ${target.projectRef}`
        : `persist target ref ${initialState.target.id ?? initialState.target.ref} before resuming`
      : `rerun with --execute --confirm-legacy-ref ${initialState.legacy.id} --confirm-target-name ${target.name}`;
    const dryRunResult = {
      legacyState: initialState.legacy.status,
      mode: "dry-run",
      nextAction,
      productionState: initialState.production.status,
      region: target.region,
      targetState: initialState.target?.status ?? "absent",
      ...(initialState.target
        ? { targetRef: initialState.target.id ?? initialState.target.ref }
        : {}),
    };
    log(dryRunResult);
    return dryRunResult;
  }

  let legacy = initialState.legacy;
  let targetProject = initialState.target;
  let databasePassword = environment.SUPABASE_DB_PASSWORD;

  if (!targetProject) {
    authorizePendingTargetMutation(manifest, options.confirmTargetName);
    if (legacy.status !== "INACTIVE") {
      authorizeLegacyStagingMutation(manifest, options.confirmLegacyRef);
      await managementClient.pauseProject(legacy.id ?? legacy.ref);
      legacy = await pollProject({
        acceptedStates: ["INACTIVE"],
        managementClient,
        projectRef: legacy.id ?? legacy.ref,
        wait,
      });
    }

    const afterPause = validateProjectTopology(
      await managementClient.listProjects(),
      manifest,
      { allowInactiveLegacy: true },
    );
    if (afterPause.production.status !== "ACTIVE_HEALTHY") {
      throw new Error("Legacy production is not healthy after staging pause.");
    }

    databasePassword = generatePassword();
    const createdProject = await managementClient.createProject({
      dbPass: databasePassword,
      name: target.name,
      organizationSlug: manifest.supabase.organization.id,
      region: target.region,
    });
    const createdRef = createdProject.id ?? createdProject.ref;
    targetProject = await pollProject({
      acceptedStates: ["ACTIVE_HEALTHY"],
      managementClient,
      projectRef: createdRef,
      wait,
    });
  } else {
    authorizePersistedTargetMutation(
      manifest,
      options.confirmTargetRef,
      targetProject,
    );
    if (targetProject.status !== "ACTIVE_HEALTHY") {
      targetProject = await pollProject({
        acceptedStates: ["ACTIVE_HEALTHY"],
        managementClient,
        projectRef: targetProject.id ?? targetProject.ref,
        wait,
      });
    }
  }

  const targetRef = targetProject.id ?? targetProject.ref;
  if (
    !matchesTargetProject(
      targetProject,
      manifest,
      manifest.supabase.organization.id,
    )
  ) {
    throw new Error("Roberto staging identity is divergent.");
  }
  if (!databasePassword) {
    databasePassword = generatePassword();
    await managementClient.updateDatabasePassword(targetRef, databasePassword);
  }
  const commandEnvironment = {
    ...environment,
    ...(databasePassword ? { SUPABASE_DB_PASSWORD: databasePassword } : {}),
  };

  await runSupabaseCommand(
    commandRunner,
    ["supabase", "link", "--project-ref", targetRef],
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
    environment: "staging",
    provider: "vercel",
  });
  if (!vercelTarget.siteUrl) {
    throw new Error(
      "The Vercel staging URL must be persisted before configuring Auth.",
    );
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
  try {
    await managementClient.updateAuthConfig(targetRef, authConfiguration);
  } catch (error) {
    if (!isUnsupportedLeakedPasswordProtection(error)) throw error;
    const freePlanConfiguration = { ...authConfiguration };
    delete freePlanConfiguration.password_hibp_enabled;
    await managementClient.updateAuthConfig(targetRef, freePlanConfiguration);
  }

  const finalProjects = await managementClient.listProjects();
  const production = findProjectByRef(
    finalProjects,
    manifest.supabase.legacy.production.projectRef,
  );
  if (!production || production.status !== "ACTIVE_HEALTHY") {
    throw new Error("Legacy production is not healthy after provisioning.");
  }

  const result = {
    legacyState: legacy.status,
    mode: "executed",
    nextAction: "persist the target ref and run the staging bootstrap",
    productionState: production.status,
    region: target.region,
    targetRef,
    targetState: targetProject.status,
  };
  log(result);
  return result;
}

function parseArguments(args) {
  const options = { execute: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--execute") {
      options.execute = true;
      continue;
    }
    if (argument === "--confirm-legacy-ref") {
      assertOptionValue(args, index, argument);
      options.confirmLegacyRef = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--confirm-target-ref") {
      assertOptionValue(args, index, argument);
      options.confirmTargetRef = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--confirm-target-name") {
      assertOptionValue(args, index, argument);
      options.confirmTargetName = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--inventory") {
      assertOptionValue(args, index, argument);
      options.inventoryPath = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    throw new Error(`Unexpected argument: ${argument}`);
  }
  return options;
}

function assertOptionValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a file path or literal value.`);
  }
}

function validateInventoryEvidence(inventory, manifest, currentTime) {
  const expected = manifest.supabase.legacy.staging;
  const capturedAt = inventory ? new Date(inventory.capturedAt) : null;
  const age = capturedAt ? currentTime.getTime() - capturedAt.getTime() : NaN;
  const valid =
    inventory &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= inventoryMaximumAgeMs &&
    inventory.project?.projectRef === expected.projectRef &&
    inventory.project?.name === expected.name &&
    inventory.project?.region === expected.region;

  if (!valid) {
    throw new Error(
      "A fresh inventory evidence for legacy staging is required.",
    );
  }
}

function containsRegion(regions, expectedRegion) {
  if (!regions || typeof regions !== "object") {
    return false;
  }

  if (Array.isArray(regions)) {
    return regions.some(
      (region) =>
        region === expectedRegion ||
        region?.code === expectedRegion ||
        region?.id === expectedRegion,
    );
  }

  return Object.values(regions ?? {}).some((value) =>
    containsRegion(value, expectedRegion),
  );
}

function validateProjectTopology(projects, manifest, options = {}) {
  const organizationId = manifest.supabase.organization.id;
  const organizationProjects = projects.filter(
    (project) =>
      (project.organization_id ?? project.organization_slug) === organizationId,
  );
  const activeProjects = organizationProjects.filter(
    (project) => project.status !== "INACTIVE",
  );

  if (activeProjects.length > 2) {
    throw new Error("More than two active Supabase projects were found.");
  }

  const legacy = findProjectByRef(
    organizationProjects,
    manifest.supabase.legacy.staging.projectRef,
  );
  const production = findProjectByRef(
    organizationProjects,
    manifest.supabase.legacy.production.projectRef,
  );

  if (
    !matchesProject(legacy, manifest.supabase.legacy.staging, organizationId)
  ) {
    throw new Error("Legacy staging identity is divergent.");
  }
  if (
    !matchesProject(
      production,
      manifest.supabase.legacy.production,
      organizationId,
    )
  ) {
    throw new Error("Legacy production identity is divergent.");
  }
  if (production.status !== "ACTIVE_HEALTHY") {
    throw new Error("Legacy production is not healthy.");
  }
  const target = findTargetProject(organizationProjects, manifest);
  if (manifest.supabase.targets.staging.projectRef && !target) {
    throw new Error("Roberto staging identity is divergent.");
  }
  if (target && !matchesTargetProject(target, manifest, organizationId)) {
    throw new Error("Roberto staging identity is divergent.");
  }
  if (!options.allowInactiveLegacy && legacy.status !== "ACTIVE_HEALTHY") {
    if (!target) {
      throw new Error(
        "Legacy staging is not healthy and the target is absent.",
      );
    }
  }

  return { legacy, production, target };
}

function findProjectByRef(projects, projectRef) {
  return projects.find((project) => (project.id ?? project.ref) === projectRef);
}

function findTargetProject(projects, manifest) {
  const expected = manifest.supabase.targets.staging;
  if (expected.projectRef) {
    return findProjectByRef(projects, expected.projectRef);
  }

  return projects.find((project) => project.name === expected.name);
}

function matchesProject(project, expected, organizationId) {
  return Boolean(
    project &&
    (project.id ?? project.ref) === expected.projectRef &&
    project.name === expected.name &&
    project.region === expected.region &&
    (project.organization_id ?? project.organization_slug) === organizationId,
  );
}

function matchesTargetProject(project, manifest, organizationId) {
  const expected = manifest.supabase.targets.staging;
  const projectRef = project.id ?? project.ref;
  const legacyRefs = [
    manifest.supabase.legacy.staging.projectRef,
    manifest.supabase.legacy.production.projectRef,
  ];
  return Boolean(
    /^[a-z]{20}$/.test(projectRef) &&
    !legacyRefs.includes(projectRef) &&
    (!expected.projectRef || projectRef === expected.projectRef) &&
    project.name === expected.name &&
    project.region === expected.region &&
    (project.organization_id ?? project.organization_slug) === organizationId,
  );
}

function authorizeLegacyStagingMutation(manifest, confirmation) {
  validateRemoteOperation({
    confirmation,
    environment: "legacy-staging",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "supabase",
    target: {
      hostname: manifest.supabase.legacy.staging.hostname,
      name: manifest.supabase.legacy.staging.name,
      organizationId: manifest.supabase.organization.id,
      projectRef: manifest.supabase.legacy.staging.projectRef,
    },
  });
}

function authorizePendingTargetMutation(manifest, confirmation) {
  const expected = manifest.supabase.targets.staging;
  if (expected.projectRef || expected.hostname) {
    throw new Error(
      "A persisted staging target must be confirmed by project ref.",
    );
  }
  validateRemoteOperation({
    confirmation,
    environment: "staging",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "supabase",
    target: {
      hostname: null,
      name: expected.name,
      organizationId: manifest.supabase.organization.id,
      projectRef: null,
    },
  });
}

function authorizePersistedTargetMutation(manifest, confirmation, project) {
  const expected = manifest.supabase.targets.staging;
  if (!expected.projectRef || !expected.hostname) {
    throw new Error(
      "The target ref must be persisted before resuming staging mutations.",
    );
  }

  validateRemoteOperation({
    confirmation,
    environment: "staging",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "supabase",
    target: {
      hostname: expected.hostname,
      name: project.name,
      organizationId:
        project.organization_id ?? project.organization_slug ?? null,
      projectRef: project.id ?? project.ref,
    },
  });
}

async function pollProject({
  acceptedStates,
  managementClient,
  projectRef,
  wait,
}) {
  for (let attempt = 0; attempt < pollingAttempts; attempt += 1) {
    const project = await managementClient.getProject(projectRef);
    if (acceptedStates.includes(project.status)) return project;
    if (attempt < pollingAttempts - 1) await wait(pollingIntervalMs);
  }
  throw new Error(`Project ${projectRef} did not reach the expected state.`);
}

async function runSupabaseCommand(
  commandRunner,
  args,
  environment,
  failureMessage,
) {
  const result = await commandRunner("npx.cmd", args, { environment });
  if (result.status !== 0) {
    const detail = redactSensitiveText(
      [result.stderr, result.stdout].filter(Boolean).join("\n").trim(),
      [environment.SUPABASE_ACCESS_TOKEN, environment.SUPABASE_DB_PASSWORD],
    );
    throw new Error(`${failureMessage}${detail ? ` ${detail}` : ""}`);
  }
}

function createDatabasePassword() {
  return `${randomBytes(32).toString("base64url")}Aa1!`;
}

function isUnsupportedLeakedPasswordProtection(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /\b402\b/.test(message) &&
    /HaveIBeenPwned|leaked password protection/i.test(message)
  );
}

function resolveInventoryEvidencePath(inventoryPath) {
  const authorizedDirectory = resolve(".provisioning/inventory");
  const candidate = resolve(
    inventoryPath ?? resolve(authorizedDirectory, "inventory.json"),
  );
  const relativePath = relative(authorizedDirectory, candidate);
  const isOutsideDirectory =
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
    isAbsolute(relativePath);

  if (isOutsideDirectory || extname(candidate).toLowerCase() !== ".json") {
    throw new Error(
      "Inventory evidence must be a JSON file inside the authorized inventory directory.",
    );
  }

  return candidate;
}

async function readInventoryEvidence(inventoryPath) {
  const authorizedDirectory = resolve(".provisioning/inventory");
  const authorizedPath = resolveInventoryEvidencePath(inventoryPath);
  try {
    const [realDirectory, realInventoryPath] = await Promise.all([
      realpath(authorizedDirectory),
      realpath(authorizedPath),
    ]);
    const relativePath = relative(realDirectory, realInventoryPath);
    if (
      relativePath === "" ||
      relativePath === ".." ||
      relativePath.startsWith(
        `..${process.platform === "win32" ? "\\" : "/"}`,
      ) ||
      isAbsolute(relativePath)
    ) {
      throw new Error(
        "Inventory evidence must resolve inside the authorized inventory directory.",
      );
    }
    return JSON.parse(await readFile(realInventoryPath, "utf8"));
  } catch (error) {
    if (
      error instanceof Error &&
      /authorized inventory directory/.test(error.message)
    ) {
      throw error;
    }
    return null;
  }
}

async function wait(delayMs) {
  await new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
}

export async function runProvisionSupabaseStagingCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );

  if (argv.includes("--help")) {
    console.log(
      `Uso: npm run ops:provision-staging -- [--inventory <arquivo-json>] [--execute --confirm-legacy-ref ${manifest.supabase.legacy.staging.projectRef} --confirm-target-name ${manifest.supabase.targets.staging.name}] | [--execute --confirm-target-ref <novo-staging-ref>]`,
    );
    return;
  }

  const managementClient = environment.SUPABASE_ACCESS_TOKEN
    ? createSupabaseManagementClient({
        accessToken: environment.SUPABASE_ACCESS_TOKEN,
      })
    : undefined;
  const result = await runSupabaseStagingProvisioning({
    args: argv,
    commandRunner: runCliCommand,
    environment,
    log: (value) => console.log(JSON.stringify(value, null, 2)),
    managementClient,
    manifest,
    wait,
  });
  return result;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runProvisionSupabaseStagingCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Staging provisioning failed.",
    );
    process.exitCode = 1;
  });
}
