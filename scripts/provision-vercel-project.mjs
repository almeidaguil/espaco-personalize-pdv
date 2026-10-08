import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createVercelManagementClient } from "./vercel-management-client.mjs";
import {
  createSafeLogger,
  loadRemoteEnvironmentManifest,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

const allowedPhases = new Set([
  "configure-preview",
  "deploy-preview",
  "verify-preview",
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

  authorizeMutation(manifest, options.confirmation);
  if (!vercelClient) throw new Error("VERCEL_TOKEN is required.");

  const project = await vercelClient.getProject(target.projectId, target.orgId);
  assertProject(project, target);
  await assertNoProductionDeployments(vercelClient, target);

  const sensitiveValues = variables
    .map(({ key }) => environment[key])
    .filter(Boolean);
  const safeLog = createSafeLogger({ log, sensitiveValues });

  if (options.phase === "configure-preview") {
    const values = readStagingVariables(environment, manifest);
    for (const variable of variables) {
      await vercelClient.upsertProjectEnvironmentVariable({
        key: variable.key,
        orgId: target.orgId,
        projectId: target.projectId,
        type: variable.type,
        value: values[variable.key],
      });
    }
    await assertPreviewEnvironmentVariables(vercelClient, target);
    const result = {
      ...baseResult,
      configuredVariables: variables.map(({ key, type }) => ({ key, type })),
      mode: "executed",
      phase: options.phase,
    };
    safeLog(result);
    return result;
  }

  await assertPreviewEnvironmentVariables(vercelClient, target);

  if (options.phase === "verify-preview") {
    const deployment = await readAndValidatePersistedDeployment(
      vercelClient,
      target,
    );
    const result = deploymentResult(baseResult, deployment, options.phase);
    safeLog(result);
    return result;
  }

  const created = await vercelClient.createPreviewDeployment({
    branch: target.previewSourceRef,
    orgId: target.orgId,
    projectId: target.projectId,
    projectName: target.projectName,
    repositoryId: target.repositoryId,
  });
  const createdId = created?.id ?? created?.uid;
  if (!createdId) throw new Error("Vercel returned no deployment id.");
  if (created.target === "production") {
    await vercelClient.deleteDeployment(createdId, target.orgId);
    throw new Error(
      "Vercel classified the requested Preview as Production; it was removed.",
    );
  }
  const deployment = await pollPreviewDeployment({
    deploymentId: createdId,
    orgId: target.orgId,
    vercelClient,
    wait,
  });
  assertPreviewDeployment(deployment, target);
  await assertNoProductionDeployments(vercelClient, target);

  const result = deploymentResult(baseResult, deployment, options.phase);
  safeLog(result);
  return result;
}

function parseArguments(args) {
  const phase = readOption(args, "--phase");
  if (!phase || !allowedPhases.has(phase)) {
    throw new Error(
      "--phase must be configure-preview, deploy-preview or verify-preview.",
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
}

async function assertNoProductionDeployments(client, target) {
  const response = await client.listProductionDeployments(
    target.projectId,
    target.orgId,
  );
  if ((response?.deployments ?? []).length !== 0) {
    throw new Error("Deploy de produção detectado no projeto de staging.");
  }
}

async function assertPreviewEnvironmentVariables(client, target) {
  const response = await client.listProjectEnvironmentVariables(
    target.projectId,
    target.orgId,
  );
  const entries = response?.envs ?? [];
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
      entry.target[0] !== "preview" ||
      entry.gitBranch
    ) {
      throw new Error(`Vercel variable ${expected.key} is outside Preview.`);
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
  if (!target.deploymentId || !target.deploymentUrl) {
    throw new Error("The Preview deployment is not persisted in the manifest.");
  }
  const deployment = await client.getDeployment(
    target.deploymentId,
    target.orgId,
  );
  assertPreviewDeployment(deployment, target);
  if (normalizeUrl(deployment.url) !== target.deploymentUrl) {
    throw new Error("The Preview deployment URL is divergent.");
  }
  return deployment;
}

function assertPreviewDeployment(deployment, target) {
  if (
    deployment?.uid !== deployment?.id &&
    !deployment?.uid &&
    !deployment?.id
  ) {
    throw new Error("The Preview deployment id is missing.");
  }
  if (deployment?.name !== target.projectName) {
    throw new Error("The Preview deployment belongs to another project.");
  }
  if (deployment?.target !== null && deployment?.target !== "preview") {
    throw new Error("A production deployment is forbidden in PR08.");
  }
  if (deployment?.readyState !== "READY") {
    throw new Error("The Preview deployment is not READY.");
  }
  if (
    deployment?.meta?.roberto_environment !== "staging" ||
    deployment?.meta?.pr08 !== "true"
  ) {
    throw new Error("The Preview deployment metadata is divergent.");
  }
  const url = normalizeUrl(deployment?.url);
  if (!url || new URL(url).hostname.endsWith(".vercel.app") !== true) {
    throw new Error("The Preview deployment URL is not a Vercel URL.");
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

async function pollPreviewDeployment({
  deploymentId,
  orgId,
  vercelClient,
  wait,
}) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const deployment = await vercelClient.getDeployment(deploymentId, orgId);
    if (deployment?.target === "production") {
      await vercelClient.deleteDeployment(deploymentId, orgId);
      throw new Error(
        "Vercel classified the requested Preview as Production; it was removed.",
      );
    }
    if (deployment?.readyState === "READY") return deployment;
    if (deployment?.readyState === "ERROR") {
      throw new Error("Vercel Preview build failed.");
    }
    if (attempt < 59) await wait(5_000);
  }
  throw new Error("Vercel Preview did not reach READY in time.");
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
      "Uso: npm run ops:provision-vercel -- --phase <configure-preview|deploy-preview|verify-preview> [--execute --confirm-project <project-id>]",
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
