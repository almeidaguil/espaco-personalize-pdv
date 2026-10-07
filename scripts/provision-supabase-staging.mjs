import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import {
  loadRemoteEnvironmentManifest,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { createSupabaseManagementClient } from "./supabase-management-client.mjs";

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

  const inventory = await inventoryReader();
  validateInventoryEvidence(inventory, manifest, now());

  if (options.execute) {
    validateRemoteOperation({
      confirmation: options.confirmLegacyRef,
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

  const regions = await managementClient.listAvailableRegions(
    manifest.supabase.organization.id,
  );
  if (!containsRegion(regions, target.region)) {
    throw new Error(`${target.region} is unavailable for project creation.`);
  }

  const initialProjects = await managementClient.listProjects();
  const initialState = validateProjectTopology(initialProjects, manifest);

  if (!options.execute) {
    const dryRunResult = {
      legacyState: initialState.legacy.status,
      mode: "dry-run",
      nextAction: `rerun with --execute --confirm-legacy-ref ${initialState.legacy.id}`,
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
    if (legacy.status !== "INACTIVE") {
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
  } else if (targetProject.status !== "ACTIVE_HEALTHY") {
    targetProject = await pollProject({
      acceptedStates: ["ACTIVE_HEALTHY"],
      managementClient,
      projectRef: targetProject.id ?? targetProject.ref,
      wait,
    });
  }

  const targetRef = targetProject.id ?? targetProject.ref;
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

  const siteUrl = manifest.netlify.siteUrl.replace(/\/$/, "");
  await managementClient.updateAuthConfig(targetRef, {
    disable_signup: true,
    external_anonymous_users_enabled: false,
    external_email_enabled: true,
    password_hibp_enabled: true,
    password_min_length: 14,
    site_url: siteUrl,
    uri_allow_list: `${siteUrl}/**`,
  });

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
      options.confirmLegacyRef = args[index + 1];
      index += 1;
      continue;
    }
    if (argument === "--inventory") {
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
  if (!options.allowInactiveLegacy && legacy.status !== "ACTIVE_HEALTHY") {
    const existingTarget = findTargetProject(organizationProjects, manifest);
    if (!existingTarget) {
      throw new Error(
        "Legacy staging is not healthy and the target is absent.",
      );
    }
  }

  const target = findTargetProject(organizationProjects, manifest);
  if (target && !matchesTargetProject(target, manifest, organizationId)) {
    throw new Error("Roberto staging identity is divergent.");
  }

  return { legacy, production, target };
}

function findProjectByRef(projects, projectRef) {
  return projects.find((project) => (project.id ?? project.ref) === projectRef);
}

function findTargetProject(projects, manifest) {
  return projects.find(
    (project) => project.name === manifest.supabase.targets.staging.name,
  );
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
    project.name === expected.name &&
    project.region === expected.region &&
    (project.organization_id ?? project.organization_slug) === organizationId,
  );
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
    throw new Error(failureMessage);
  }
}

function createDatabasePassword() {
  return `${randomBytes(32).toString("base64url")}Aa1!`;
}

async function readInventoryEvidence() {
  try {
    return JSON.parse(
      await readFile(resolve(".provisioning/inventory/inventory.json"), "utf8"),
    );
  } catch {
    return null;
  }
}

function runCommand(command, args, { environment }) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: environment,
    shell: false,
  });
  return {
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
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
      `Uso: npm run ops:provision-staging -- [--execute --confirm-legacy-ref ${manifest.supabase.legacy.staging.projectRef}]`,
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
    commandRunner: runCommand,
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
