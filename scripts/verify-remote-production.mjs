import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { createProductionEnvironmentFingerprint } from "./production-environment-fingerprint.mjs";
import {
  loadRemoteEnvironmentManifest,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { runCliCommand } from "./run-cli-command.mjs";
import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";
import { createVercelManagementClient } from "./vercel-management-client.mjs";
import { verifyRemoteEnvironment } from "./verify-remote-environment.mjs";

const expectedVariables = new Map([
  ["NEXT_PUBLIC_SUPABASE_URL", "encrypted"],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "encrypted"],
  ["SUPABASE_SECRET_KEY", "sensitive"],
]);

export async function verifyRemoteProduction({
  anonymousClient,
  authenticatedClient,
  commandRunner,
  deploymentTarget = /** @type {any} */ (null),
  expectedVercelEnvironment,
  linkedProjectRef,
  localMigrations,
  logger = () => {},
  managementClient,
  manifest,
  resolveSourceCommit = /** @type {any} */ (null),
  vercelClient,
}) {
  const databaseReport = await verifyRemoteEnvironment({
    environment: "production",
    manifest,
    runCommand: commandRunner,
    supabase: {
      anonymousClient,
      authenticatedClient,
      linkedProjectRef,
      localMigrations,
      managementClient,
    },
  });
  const target = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "vercel",
  });
  validateRemoteOperation({
    environment: "production",
    execute: false,
    manifest,
    operation: "read",
    provider: "vercel",
    target: {
      orgId: target.orgId,
      projectId: target.projectId,
      projectName: target.projectName,
    },
  });
  const selectedDeployment = await resolveVerificationDeployment({
    deploymentTarget,
    resolveSourceCommit,
    target,
  });
  if (!selectedDeployment.deploymentId || !selectedDeployment.deploymentUrl) {
    throw new Error("Production deployment identity is not registered.");
  }
  assertExpectedVercelEnvironment(expectedVercelEnvironment, manifest);

  const project = await vercelClient.getProject(target.projectId, target.orgId);
  if (
    project?.id !== target.projectId ||
    project?.name !== target.projectName
  ) {
    throw new Error("Production Vercel project identity is divergent.");
  }
  assertNoVercelProtection(project);

  const variableResponse = await vercelClient.listProjectEnvironmentVariables(
    target.projectId,
    target.orgId,
  );
  const variables = Array.isArray(variableResponse)
    ? variableResponse
    : variableResponse?.envs;
  if (
    !Array.isArray(variables) ||
    variables.length !== expectedVariables.size ||
    new Set(variables.map((entry) => entry.key)).size !==
      expectedVariables.size ||
    variables.some(
      (entry) =>
        expectedVariables.get(entry.key) !== entry.type ||
        !Array.isArray(entry.target) ||
        entry.target.length !== 1 ||
        entry.target[0] !== "production",
    )
  ) {
    throw new Error("Production must have exactly three approved variables.");
  }

  const deployment = await vercelClient.getDeployment(
    selectedDeployment.deploymentId,
    target.orgId,
  );
  if (
    (deployment?.uid ?? deployment?.id) !== selectedDeployment.deploymentId ||
    deployment?.name !== target.projectName ||
    deployment?.target !== "production" ||
    deployment?.readyState !== "READY"
  ) {
    throw new Error(
      "Production deployment is not READY or has divergent identity.",
    );
  }
  if (
    normalizeUrl(deployment.url) !==
    normalizeUrl(selectedDeployment.deploymentUrl)
  ) {
    throw new Error("Production immutable deployment URL is divergent.");
  }
  const stableHostname = new URL(target.siteUrl).hostname;
  if (!(deployment.alias ?? []).includes(stableHostname)) {
    throw new Error("Production deployment is missing the stable alias.");
  }
  const commitSha = deployment.gitSource?.sha;
  if (
    !/^[a-f0-9]{40}$/.test(commitSha ?? "") ||
    deployment.gitSource?.ref !== commitSha ||
    deployment.gitSource?.repoId !== target.repositoryId ||
    (selectedDeployment.commitSha && commitSha !== selectedDeployment.commitSha)
  ) {
    throw new Error("Production deployment Git source is divergent.");
  }
  const sourceRef =
    selectedDeployment.sourceRef ?? deployment.meta?.roberto_source_ref;
  if (
    !target.allowedSourceRefs.includes(sourceRef) ||
    deployment.meta?.pr09 !== "true" ||
    deployment.meta?.roberto_environment !== "production" ||
    deployment.meta?.roberto_commit_sha !== commitSha ||
    deployment.meta?.roberto_source_ref !== sourceRef ||
    deployment.meta?.roberto_environment_fingerprint !==
      createProductionEnvironmentFingerprint(expectedVercelEnvironment)
  ) {
    throw new Error(
      "Production deployment source or environment values fingerprint is divergent.",
    );
  }

  const report = {
    checks: [
      ...databaseReport.checks,
      "vercel-variables",
      "deployment-ready",
      "stable-alias",
      "no-vercel-protection",
    ],
    commitSha,
    deploymentId: selectedDeployment.deploymentId,
    deploymentUrl: normalizeUrl(selectedDeployment.deploymentUrl),
    environment: "production",
    projectRef: databaseReport.projectRef,
    sourceRef,
    status: "passed",
  };
  logger(report);
  return report;
}

async function resolveVerificationDeployment({
  deploymentTarget,
  resolveSourceCommit,
  target,
}) {
  if (!deploymentTarget) {
    return {
      deploymentId: target.deploymentId,
      deploymentUrl: target.deploymentUrl,
      sourceRef: target.sourceRef,
    };
  }
  const keys = Object.keys(deploymentTarget).sort();
  if (
    JSON.stringify(keys) !==
      JSON.stringify(
        ["commitSha", "deploymentId", "deploymentUrl", "sourceRef"].sort(),
      ) ||
    deploymentTarget.sourceRef !== "main" ||
    !target.allowedSourceRefs.includes(deploymentTarget.sourceRef) ||
    !/^dpl_[A-Za-z0-9]+$/.test(deploymentTarget.deploymentId ?? "") ||
    !/^[a-f0-9]{40}$/.test(deploymentTarget.commitSha ?? "") ||
    normalizeUrl(deploymentTarget.deploymentUrl) !==
      deploymentTarget.deploymentUrl
  ) {
    throw new Error("Explicit production release deployment is invalid.");
  }
  if (typeof resolveSourceCommit !== "function") {
    throw new Error("Production release source resolver is required.");
  }
  if (
    (await resolveSourceCommit(deploymentTarget.sourceRef)) !==
    deploymentTarget.commitSha
  ) {
    throw new Error("Production release ref does not resolve to its commit.");
  }
  return deploymentTarget;
}

function assertExpectedVercelEnvironment(values, manifest) {
  if (
    values?.NEXT_PUBLIC_SUPABASE_URL !==
    `https://${manifest.supabase.targets.production.hostname}`
  ) {
    throw new Error("Expected production Vercel environment is divergent.");
  }
  createProductionEnvironmentFingerprint(values);
}

function assertNoVercelProtection(project) {
  if (
    Object.keys(project?.protectionBypass ?? {}).length > 0 ||
    (project?.ssoProtection && project.ssoProtection.deploymentType !== "none")
  ) {
    throw new Error("Production cannot use a Vercel bypass or protection.");
  }
}

function normalizeUrl(value) {
  const text = String(value ?? "");
  return new URL(
    text.startsWith("http") ? text : `https://${text}`,
  ).href.replace(/\/$/, "");
}

async function readLocalLinkedProjectRef() {
  try {
    return (
      await readFile(resolve("supabase/.temp/project-ref"), "utf8")
    ).trim();
  } catch {
    throw new Error("Unable to read the local Supabase link metadata.");
  }
}

export async function runVerifyRemoteProductionCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    console.log(
      "Uso: npm run ops:verify-production -- --confirm-ref <production-ref> [--deployment-id <id> --deployment-url <url> --source-ref main --commit-sha <sha>]",
    );
    return;
  }
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const projectRef = manifest.supabase.targets.production.projectRef;
  if (!projectRef)
    throw new Error("The production project ref is not registered.");
  for (const name of [
    "SUPABASE_ACCESS_TOKEN",
    "VERCEL_TOKEN",
    "PRODUCTION_ADMIN_EMAIL",
    "PRODUCTION_ADMIN_PASSWORD",
  ]) {
    if (!environment[name]?.trim()) throw new Error(`${name} is required.`);
  }
  assertAllowedOptions(argv, [
    "--confirm-ref",
    "--deployment-id",
    "--deployment-url",
    "--source-ref",
    "--commit-sha",
  ]);
  if (readOption(argv, "--confirm-ref", true) !== projectRef) {
    throw new Error("The production project ref confirmation is divergent.");
  }
  const deploymentTarget = readProductionDeploymentTarget(argv);
  const managementClient = createSupabaseManagementClient({
    accessToken: environment.SUPABASE_ACCESS_TOKEN,
  });
  const keys = parseSupabaseApiKeys(
    await managementClient.getApiKeys(projectRef),
  );
  const supabase = createClient(
    buildSupabaseUrl(projectRef),
    keys.publishableKey,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
  const result = await verifyRemoteProduction({
    anonymousClient: {
      async authenticate() {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: environment.PRODUCTION_ADMIN_EMAIL,
          password: environment.PRODUCTION_ADMIN_PASSWORD,
        });
        if (error || !data.user)
          throw new Error("Production admin authentication failed.");
        return { userId: data.user.id };
      },
    },
    authenticatedClient: {
      async countRows(table) {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (error) throw new Error(`Unable to count ${table}.`);
        return count ?? 0;
      },
      async getOwnProfile() {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,role")
          .single();
        if (error) throw new Error("Unable to read the admin profile.");
        return data;
      },
    },
    commandRunner: (command, args, options = {}) =>
      runCliCommand(command, args, { environment, ...options }),
    linkedProjectRef: await readLocalLinkedProjectRef(),
    managementClient,
    manifest,
    deploymentTarget,
    expectedVercelEnvironment: {
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: keys.publishableKey,
      NEXT_PUBLIC_SUPABASE_URL: buildSupabaseUrl(projectRef),
      SUPABASE_SECRET_KEY: keys.secretKey,
    },
    resolveSourceCommit,
    vercelClient: createVercelManagementClient({
      authToken: environment.VERCEL_TOKEN,
    }),
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

export function readProductionDeploymentTarget(argv) {
  const names = [
    "--deployment-id",
    "--deployment-url",
    "--source-ref",
    "--commit-sha",
  ];
  const present = names.filter((name) => argv.includes(name));
  if (present.length === 0) return null;
  if (present.length !== names.length) {
    throw new Error(
      "Explicit production release requires all deployment options.",
    );
  }
  return {
    commitSha: readOption(argv, "--commit-sha", true),
    deploymentId: readOption(argv, "--deployment-id", true),
    deploymentUrl: readOption(argv, "--deployment-url", true),
    sourceRef: readOption(argv, "--source-ref", true),
  };
}

function assertAllowedOptions(argv, allowedNames) {
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowedNames.includes(argv[index]) || !argv[index + 1]) {
      throw new Error(`Unexpected or incomplete option: ${argv[index]}`);
    }
  }
}

function readOption(argv, name, required = false) {
  const indexes = argv.flatMap((value, index) =>
    value === name ? [index] : [],
  );
  if (indexes.length === 0 && !required) return undefined;
  if (
    indexes.length !== 1 ||
    !argv[indexes[0] + 1] ||
    argv[indexes[0] + 1].startsWith("--")
  ) {
    throw new Error(`${name} requires exactly one value.`);
  }
  return argv[indexes[0] + 1];
}

function resolveSourceCommit(sourceRef) {
  const gitRef =
    sourceRef === "main"
      ? "refs/remotes/origin/main^{commit}"
      : `refs/heads/${sourceRef}^{commit}`;
  const result = runCliCommand("git", ["rev-parse", "--verify", gitRef]);
  const commitSha = result.stdout?.trim();
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(commitSha ?? "")) {
    throw new Error("Unable to resolve the production release source ref.");
  }
  return commitSha;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runVerifyRemoteProductionCli().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Production verification failed.",
    );
    process.exitCode = 1;
  });
}
