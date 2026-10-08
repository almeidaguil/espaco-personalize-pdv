import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createVercelManagementClient } from "./vercel-management-client.mjs";
import {
  createSafeLogger,
  loadRemoteEnvironmentManifest,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

const allowedPhases = new Set([
  "configure-staging",
  "deploy-staging",
  "verify-staging",
]);
const variables = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", type: "encrypted" },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", type: "encrypted" },
  { key: "SUPABASE_SECRET_KEY", type: "sensitive" },
];

export async function runVercelProvisioning({
  args,
  environment,
  log,
  manifest,
  vercelClient,
  wait = waitForPolling,
}) {
  const options = parseArguments(args);
  const target = manifest.vercel;
  const baseResult = {
    environment: target.environment,
    orgId: target.orgId,
    projectId: target.projectId,
    projectName: target.projectName,
    siteUrl: target.siteUrl,
  };

  if (!options.execute) {
    const result = {
      ...baseResult,
      mode: "dry-run",
      nextAction: `rerun with --execute --confirm-project ${target.projectId}`,
      phase: options.phase,
    };
    log(result);
    return result;
  }

  assertDedicatedStagingTarget(target);
  authorizeMutation(manifest, options.confirmation);
  if (!vercelClient) throw new Error("VERCEL_TOKEN is required.");

  const project = await vercelClient.getProject(target.projectId, target.orgId);
  assertProject(project, target);
  await assertReservedProductionProjectIsEmpty(vercelClient, target);
  await assertExpectedStagingDeployments(vercelClient, target);

  const sensitiveValues = variables
    .map(({ key }) => environment[key])
    .filter(Boolean);
  const safeLog = createSafeLogger({ log, sensitiveValues });

  if (options.phase === "configure-staging") {
    const currentEntries = await readStagingEnvironmentVariables(
      vercelClient,
      target,
    );
    if (currentEntries.length !== 0) {
      assertStagingEnvironmentVariableEntries(currentEntries, target);
    }
    const values = readStagingVariables(environment, manifest);
    for (const variable of variables) {
      await vercelClient.upsertProjectEnvironmentVariable({
        key: variable.key,
        orgId: target.orgId,
        projectId: target.projectId,
        targetEnvironment: target.environment,
        type: variable.type,
        value: values[variable.key],
      });
    }
    await assertStagingEnvironmentVariables(vercelClient, target);
    const result = {
      ...baseResult,
      configuredVariables: variables.map(({ key, type }) => ({ key, type })),
      mode: "executed",
      phase: options.phase,
    };
    safeLog(result);
    return result;
  }

  await assertStagingEnvironmentVariables(vercelClient, target);

  if (options.phase === "verify-staging") {
    const deployment = await readAndValidatePersistedDeployment(
      vercelClient,
      target,
    );
    const result = deploymentResult(baseResult, deployment, options.phase);
    safeLog(result);
    return result;
  }

  if (target.deploymentId) {
    throw new Error(
      "A staging deployment is already persisted in the manifest.",
    );
  }
  const created = await vercelClient.createStagingDeployment({
    branch: target.sourceRef,
    orgId: target.orgId,
    projectId: target.projectId,
    projectName: target.projectName,
    repositoryId: target.repositoryId,
  });
  const createdId = created?.id ?? created?.uid;
  if (!createdId) throw new Error("Vercel returned no deployment id.");
  if (created.target !== "production") {
    throw new Error("Vercel did not create the dedicated staging deployment.");
  }
  const deployment = await pollStagingDeployment({
    deploymentId: createdId,
    orgId: target.orgId,
    vercelClient,
    wait,
  });
  assertStagingDeployment(deployment, target);

  const result = deploymentResult(baseResult, deployment, options.phase);
  safeLog(result);
  return result;
}

function parseArguments(args) {
  const phase = readOption(args, "--phase");
  if (!phase || !allowedPhases.has(phase)) {
    throw new Error(
      "--phase must be configure-staging, deploy-staging or verify-staging.",
    );
  }
  return {
    confirmation: readOption(args, "--confirm-project"),
    execute: args.includes("--execute"),
    phase,
  };
}

function authorizeMutation(manifest, confirmation) {
  if (confirmation !== manifest.vercel.projectId) {
    throw new Error("Remote mutation requires confirmação literal do projeto.");
  }
  validateRemoteOperation({
    confirmation,
    environment: "staging",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "vercel",
    target: {
      orgId: manifest.vercel.orgId,
      projectId: manifest.vercel.projectId,
      projectName: manifest.vercel.projectName,
    },
  });
}

function assertDedicatedStagingTarget(target) {
  if (
    target.dedicatedStaging !== true ||
    target.environment !== "production" ||
    !target.projectName.endsWith("-staging") ||
    target.projectId === target.reservedProductionProjectId
  ) {
    throw new Error(
      "Vercel target is not the approved dedicated staging project.",
    );
  }
}

function assertProject(project, target) {
  const checks = [
    ["id", project?.id, target.projectId],
    ["name", project?.name, target.projectName],
    ["framework", project?.framework, target.framework],
    ["Node.js version", project?.nodeVersion, target.nodeVersion],
  ];
  const divergent = checks.find(([, actual, expected]) => actual !== expected);
  if (divergent)
    throw new Error(`Vercel project ${divergent[0]} is divergent.`);
  if (project?.link) {
    throw new Error("Integração Git é proibida durante o PR08.");
  }
  if (project?.ssoProtection?.deploymentType !== "all_except_custom_domains") {
    throw new Error("Vercel Authentication protection is divergent.");
  }
  if (Object.keys(project?.protectionBypass ?? {}).length !== 0) {
    throw new Error("A temporary Vercel protection bypass is still active.");
  }
}

async function assertReservedProductionProjectIsEmpty(client, target) {
  const project = await client.getProject(
    target.reservedProductionProjectId,
    target.orgId,
  );
  if (
    project?.id !== target.reservedProductionProjectId ||
    project?.name !== target.reservedProductionProjectName ||
    project?.link
  ) {
    throw new Error("The reserved production project identity is divergent.");
  }

  const [deploymentResponse, environmentResponse, domainResponse] =
    await Promise.all([
      client.listProjectDeployments(
        target.reservedProductionProjectId,
        target.orgId,
      ),
      client.listProjectEnvironmentVariables(
        target.reservedProductionProjectId,
        target.orgId,
      ),
      client.listProjectDomains(
        target.reservedProductionProjectId,
        target.orgId,
      ),
    ]);
  if (
    (deploymentResponse?.deployments ?? []).length !== 0 ||
    (environmentResponse?.envs ?? []).length !== 0 ||
    !hasOnlyDefaultVercelDomain(
      domainResponse?.domains ?? [],
      target.reservedProductionProjectName,
    )
  ) {
    throw new Error("The reserved production project is not empty.");
  }
}

function hasOnlyDefaultVercelDomain(domains, projectName) {
  return (
    domains.length === 1 && domains[0]?.name === `${projectName}.vercel.app`
  );
}

async function assertExpectedStagingDeployments(client, target) {
  const response = await client.listProjectDeployments(
    target.projectId,
    target.orgId,
  );
  const deployments = response?.deployments ?? [];
  if (!target.deploymentId && deployments.length !== 0) {
    throw new Error("An unregistered staging deployment already exists.");
  }
  if (
    target.deploymentId &&
    (deployments.length !== 1 ||
      (deployments[0].uid ?? deployments[0].id) !== target.deploymentId)
  ) {
    throw new Error("The persisted staging deployment list is divergent.");
  }
}

async function assertStagingEnvironmentVariables(client, target) {
  const entries = await readStagingEnvironmentVariables(client, target);
  assertStagingEnvironmentVariableEntries(entries, target);
}

async function readStagingEnvironmentVariables(client, target) {
  const response = await client.listProjectEnvironmentVariables(
    target.projectId,
    target.orgId,
  );
  return response?.envs ?? [];
}

function assertStagingEnvironmentVariableEntries(entries, target) {
  if (entries.length !== variables.length) {
    throw new Error(
      "The dedicated staging project must contain exactly three variables.",
    );
  }
  for (const expected of variables) {
    const matches = entries.filter((entry) => entry.key === expected.key);
    if (matches.length !== 1) {
      throw new Error(
        `Vercel variable ${expected.key} is missing or duplicated.`,
      );
    }
    const entry = matches[0];
    if (
      entry.type !== expected.type ||
      !Array.isArray(entry.target) ||
      entry.target.length !== 1 ||
      entry.target[0] !== target.environment ||
      entry.gitBranch
    ) {
      throw new Error(
        `Vercel variable ${expected.key} is outside dedicated staging.`,
      );
    }
  }
}

function readStagingVariables(environment, manifest) {
  const missing = variables.filter(({ key }) => !environment[key]?.trim());
  if (missing.length > 0) {
    throw new Error("All three staging variables are required in memory.");
  }
  const expectedUrl = `https://${manifest.supabase.targets.staging.projectRef}.supabase.co`;
  if (environment.NEXT_PUBLIC_SUPABASE_URL !== expectedUrl) {
    throw new Error("The staging Supabase URL is divergent.");
  }
  return Object.fromEntries(
    variables.map(({ key }) => [key, environment[key]]),
  );
}

async function readAndValidatePersistedDeployment(client, target) {
  if (!target.deploymentId || !target.deploymentUrl || !target.siteUrl) {
    throw new Error("The staging deployment is not persisted in the manifest.");
  }
  const deployment = await client.getDeployment(
    target.deploymentId,
    target.orgId,
  );
  assertStagingDeployment(deployment, target);
  if (normalizeUrl(deployment.url) !== target.deploymentUrl) {
    throw new Error("The staging deployment URL is divergent.");
  }
  return deployment;
}

function assertStagingDeployment(deployment, target) {
  if (!deployment?.uid && !deployment?.id) {
    throw new Error("The staging deployment id is missing.");
  }
  if (deployment?.name !== target.projectName) {
    throw new Error("The staging deployment belongs to another project.");
  }
  if (deployment?.target !== "production") {
    throw new Error("The dedicated staging deployment target is divergent.");
  }
  if (deployment?.readyState !== "READY") {
    throw new Error("The staging deployment is not READY.");
  }
  if (
    deployment?.meta?.roberto_environment !== "staging" ||
    deployment?.meta?.dedicated_staging !== "true" ||
    deployment?.meta?.pr08 !== "true"
  ) {
    throw new Error("The staging deployment metadata is divergent.");
  }
  const url = normalizeUrl(deployment?.url);
  if (!url || !new URL(url).hostname.endsWith(".vercel.app")) {
    throw new Error("The staging deployment URL is not a Vercel URL.");
  }
}

function deploymentResult(base, deployment, phase) {
  return {
    ...base,
    deploymentId: deployment.uid ?? deployment.id,
    deploymentUrl: normalizeUrl(deployment.url),
    mode: "executed",
    phase,
  };
}

async function pollStagingDeployment({
  deploymentId,
  orgId,
  vercelClient,
  wait,
}) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const deployment = await vercelClient.getDeployment(deploymentId, orgId);
    if (deployment?.target !== "production") {
      throw new Error(
        "Vercel returned a deployment outside dedicated staging.",
      );
    }
    if (deployment?.readyState === "READY") return deployment;
    if (deployment?.readyState === "ERROR") {
      throw new Error("Vercel staging build failed.");
    }
    if (attempt < 59) await wait(5_000);
  }
  throw new Error("Vercel staging did not reach READY in time.");
}

function normalizeUrl(value) {
  if (!value) return null;
  const url = value.startsWith("http") ? value : `https://${value}`;
  return url.replace(/\/$/, "");
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function waitForPolling(delayMs) {
  await new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
}

export async function runProvisionVercelCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    console.log(
      "Uso: npm run ops:provision-vercel -- --phase <configure-staging|deploy-staging|verify-staging> [--execute --confirm-project <project-id>]",
    );
    return;
  }
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const vercelClient = environment.VERCEL_TOKEN
    ? createVercelManagementClient({ authToken: environment.VERCEL_TOKEN })
    : undefined;
  return runVercelProvisioning({
    args: argv,
    environment,
    log: (value) => console.log(JSON.stringify(value, null, 2)),
    manifest,
    vercelClient,
  });
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runProvisionVercelCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Vercel provisioning failed.",
    );
    process.exitCode = 1;
  });
}
