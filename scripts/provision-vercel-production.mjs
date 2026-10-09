import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadProductionCutoverState,
  recordProductionCutoverPhase,
} from "./production-cutover-state.mjs";
import {
  createSafeLogger,
  loadRemoteEnvironmentManifest,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { createProductionEnvironmentFingerprint } from "./production-environment-fingerprint.mjs";
import { createVercelManagementClient } from "./vercel-management-client.mjs";
import { runCliCommand } from "./run-cli-command.mjs";

const authorizedOrgId = "team_jstETBWBHJi0hsir3a3bAkbK";
const authorizedProjectId = "prj_oBs2uc7uxsHMc7ssHFKczfi52LMq";
const authorizedProjectName = "roberto-multimarcas-pdv";
const authorizedSiteUrl = "https://roberto-multimarcas-pdv.vercel.app";
const stateFilePath = ".provisioning/production-cutover-state.json";
const phases = new Set(["audit", "configure", "deploy", "verify"]);
const variables = Object.freeze([
  { key: "NEXT_PUBLIC_SUPABASE_URL", type: "encrypted" },
  { key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", type: "encrypted" },
  { key: "SUPABASE_SECRET_KEY", type: "sensitive" },
]);

export async function runVercelProductionProvisioning({
  client,
  environment,
  logger,
  manifest,
  options,
  recordPhase,
  resolveSourceCommit,
  state,
  wait = waitForPolling,
}) {
  const target = resolveRemoteTarget(manifest, {
    environment: "production",
    provider: "vercel",
  });
  assertReservedTarget(target);
  assertPhase(options?.phase);

  const baseResult = {
    environment: target.deploymentEnvironment,
    projectId: target.projectId,
    projectName: target.projectName,
    siteUrl: target.siteUrl,
  };
  const sensitiveValues = [
    environment?.VERCEL_TOKEN,
    ...variables.map(({ key }) => environment?.[key]),
  ].filter(Boolean);
  const safeLog = createSafeLogger({
    log: logger ?? (() => {}),
    sensitiveValues,
  });

  if (!client) throw new Error("VERCEL_TOKEN is required.");

  if (options.phase === "audit") {
    assertStatePhase(state, [
      "admin-ready",
      "vercel-configured",
      "deployment-ready",
      "verified",
    ]);
    assertCutoverStateTarget(state, manifest, target);
    const entries = await auditReservedProject(client, target, {
      requireFirstUse: state.phase === "admin-ready",
    });
    if (state.phase !== "admin-ready") {
      assertVariableEntries(entries, {
        allowMissing: false,
        deploymentEnvironment: target.deploymentEnvironment,
      });
    }
    if (["deployment-ready", "verified"].includes(state.phase)) {
      await assertPersistedDeployment(client, target, state);
    }
    const result = { ...baseResult, mode: "audited", phase: "audit" };
    safeLog(result);
    return result;
  }

  if (options.phase === "configure") {
    assertStatePhase(state, ["admin-ready", "vercel-configured"]);
    assertCutoverStateTarget(state, manifest, target);
    const entries = await auditReservedProject(client, target, {
      requireFirstUse: false,
      requireNoDeployments: true,
    });
    const configuredState = state.phase === "vercel-configured";
    assertVariableEntries(entries, {
      allowMissing: !configuredState,
      deploymentEnvironment: target.deploymentEnvironment,
    });
    const values = readProductionVariables(environment, manifest);
    if (!options.execute) {
      return logDryRun(baseResult, options.phase, target, safeLog);
    }
    authorizeMutation(manifest, target, options.confirmation);

    for (const variable of variables) {
      await client.upsertProjectEnvironmentVariable({
        key: variable.key,
        orgId: target.orgId,
        projectId: target.projectId,
        targetEnvironment: target.deploymentEnvironment,
        type: variable.type,
        value: values[variable.key],
      });
    }

    const verifiedEntries = await readEnvironmentVariables(client, target);
    assertVariableEntries(verifiedEntries, {
      allowMissing: false,
      deploymentEnvironment: target.deploymentEnvironment,
    });
    const variableNames = variables.map(({ key }) => key);
    if (!configuredState) {
      await recordPhase({
        facts: { projectId: target.projectId, variableNames },
        phase: "vercel-configured",
        previousState: state,
      });
    }
    const result = {
      ...baseResult,
      configuredVariables: variableNames,
      mode: configuredState ? "already-configured" : "configured",
      phase: "configure",
    };
    safeLog(result);
    return result;
  }

  if (options.phase === "deploy") {
    assertStatePhase(state, ["vercel-configured", "verified"]);
    assertCutoverStateTarget(state, manifest, target);
    const baseSource = await assertDeploymentSource(
      options,
      target,
      resolveSourceCommit,
    );
    const productionValues = readProductionVariables(environment, manifest);
    const source = {
      ...baseSource,
      environmentFingerprint:
        createProductionEnvironmentFingerprint(productionValues),
    };
    await auditReservedProject(client, target, {
      requireFirstUse: false,
      requireNoDeployments: false,
    });
    const entries = await readEnvironmentVariables(client, target);
    assertVariableEntries(entries, {
      allowMissing: false,
      deploymentEnvironment: target.deploymentEnvironment,
    });
    if (!options.execute) {
      return logDryRun(baseResult, options.phase, target, safeLog);
    }
    authorizeMutation(manifest, target, options.confirmation);

    let deployment = await findExistingDeployment(client, target, source);
    if (!deployment) {
      const listed = await listDeployments(client, target);
      if (state.phase === "verified") {
        const prior = readStateFacts(state, "deployment-ready");
        const priorDeployments = listed.filter(
          (candidate) => (candidate.uid ?? candidate.id) === prior.deploymentId,
        );
        if (
          source.sourceRef !== "main" ||
          listed.length !== 1 ||
          priorDeployments.length !== 1
        ) {
          throw new Error(
            "Production release deployment history is divergent.",
          );
        }
      } else if (listed.length !== 0) {
        throw new Error("An unrelated production deployment already exists.");
      }
      for (const variable of variables) {
        await client.upsertProjectEnvironmentVariable({
          key: variable.key,
          orgId: target.orgId,
          projectId: target.projectId,
          targetEnvironment: target.deploymentEnvironment,
          type: variable.type,
          value: productionValues[variable.key],
        });
      }
      const created = await client.createGitDeployment({
        environment: target.deploymentEnvironment,
        metadata: deploymentMetadata(source),
        orgId: target.orgId,
        projectId: target.projectId,
        ref: source.commitSha,
        repositoryId: target.repositoryId,
      });
      const deploymentId = created?.id ?? created?.uid;
      if (!deploymentId) throw new Error("Vercel returned no deployment id.");
      deployment = await pollDeployment({
        client,
        deploymentId,
        orgId: target.orgId,
        wait,
      });
    }
    assertProductionDeployment(deployment, target, source);
    const result = deploymentResult(baseResult, deployment, source, "deployed");
    if (state.phase === "vercel-configured") {
      await recordPhase({
        facts: {
          commitSha: result.commitSha,
          deploymentId: result.deploymentId,
          deploymentUrl: result.deploymentUrl,
          projectId: result.projectId,
          siteUrl: result.siteUrl,
          sourceRef: result.sourceRef,
        },
        phase: "deployment-ready",
        previousState: state,
      });
    }
    safeLog(result);
    return result;
  }

  assertStatePhase(state, ["deployment-ready", "verified"]);
  assertCutoverStateTarget(state, manifest, target);
  await auditReservedProject(client, target, {
    requireFirstUse: false,
    requireNoDeployments: false,
  });
  const entries = await readEnvironmentVariables(client, target);
  assertVariableEntries(entries, {
    allowMissing: false,
    deploymentEnvironment: target.deploymentEnvironment,
  });
  const facts = readStateFacts(state, "deployment-ready");
  const baseSource =
    state.phase === "verified" && options.sourceRef && options.commitSha
      ? await assertDeploymentSource(options, target, resolveSourceCommit)
      : { commitSha: facts.commitSha, sourceRef: facts.sourceRef };
  const source = {
    ...baseSource,
    environmentFingerprint: createProductionEnvironmentFingerprint(
      readProductionVariables(environment, manifest),
    ),
  };
  const deployment =
    state.phase === "verified" && options.sourceRef && options.commitSha
      ? await findExistingDeployment(client, target, source)
      : await client.getDeployment(facts.deploymentId, target.orgId);
  if (!deployment)
    throw new Error("Verified production deployment is missing.");
  assertProductionDeployment(deployment, target, source);
  const result = deploymentResult(baseResult, deployment, source, "verified");
  if (
    state.phase !== "verified" &&
    (result.deploymentId !== facts.deploymentId ||
      result.deploymentUrl !== facts.deploymentUrl ||
      facts.projectId !== target.projectId ||
      facts.siteUrl !== target.siteUrl)
  ) {
    throw new Error("The persisted production deployment is divergent.");
  }
  safeLog(result);
  return result;
}

function assertPhase(phase) {
  if (!phases.has(phase)) {
    throw new Error("Phase must be audit, configure, deploy or verify.");
  }
}

function assertReservedTarget(target) {
  if (
    target.orgId !== authorizedOrgId ||
    target.projectId !== authorizedProjectId ||
    target.projectName !== authorizedProjectName ||
    target.siteUrl !== authorizedSiteUrl ||
    target.framework !== "nextjs" ||
    target.nodeVersion !== "22.x" ||
    target.deploymentEnvironment !== "production" ||
    target.dedicatedStaging !== false ||
    target.deploymentProtection !== "application-auth"
  ) {
    throw new Error(
      "Vercel target is not the exact reserved production project.",
    );
  }
}

function assertStatePhase(state, expected) {
  if (!state || !expected.includes(state.phase)) {
    throw new Error(
      `Vercel production phase requires ${expected.join(" or ")} state.`,
    );
  }
}

function assertCutoverStateTarget(state, manifest, target) {
  const productionRef = manifest.supabase.targets.production.projectRef;
  if (!productionRef) {
    throw new Error("Production Supabase target is not persisted.");
  }
  for (const phase of ["production-created", "database-ready"]) {
    const facts = readStateFacts(state, phase);
    if (facts.projectRef !== productionRef) {
      throw new Error("Production cutover state target is divergent.");
    }
  }

  if (
    ["vercel-configured", "deployment-ready", "verified"].includes(state.phase)
  ) {
    const facts = readStateFacts(state, "vercel-configured");
    const names = [...(facts.variableNames ?? [])].sort();
    const expectedNames = variables.map(({ key }) => key).sort();
    if (
      facts.projectId !== target.projectId ||
      JSON.stringify(names) !== JSON.stringify(expectedNames)
    ) {
      throw new Error("Vercel configured state target is divergent.");
    }
  }
  if (["deployment-ready", "verified"].includes(state.phase)) {
    const facts = readStateFacts(state, "deployment-ready");
    if (
      facts.projectId !== target.projectId ||
      facts.siteUrl !== target.siteUrl
    ) {
      throw new Error("Vercel deployment state target is divergent.");
    }
  }
}

async function assertPersistedDeployment(client, target, state) {
  const facts = readStateFacts(state, "deployment-ready");
  const source = { commitSha: facts.commitSha, sourceRef: facts.sourceRef };
  const deployment = await client.getDeployment(
    facts.deploymentId,
    target.orgId,
  );
  assertProductionDeployment(deployment, target, source);
  if (
    (deployment.uid ?? deployment.id) !== facts.deploymentId ||
    normalizeUrl(deployment.url) !== facts.deploymentUrl
  ) {
    throw new Error("The persisted production deployment is divergent.");
  }
}

function authorizeMutation(manifest, target, confirmation) {
  validateRemoteOperation({
    confirmation,
    environment: "production",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "vercel",
    target: {
      orgId: target.orgId,
      projectId: target.projectId,
      projectName: target.projectName,
    },
  });
}

async function auditReservedProject(
  client,
  target,
  { requireFirstUse, requireNoDeployments = requireFirstUse },
) {
  const project = await client.getProject(target.projectId, target.orgId);
  const divergent = [
    ["id", project?.id, target.projectId],
    ["name", project?.name, target.projectName],
    ["framework", project?.framework, "nextjs"],
    ["Node.js version", project?.nodeVersion, "22.x"],
  ].find(([, actual, expected]) => actual !== expected);
  if (divergent) {
    throw new Error(
      `Reserved production project ${divergent[0]} is divergent.`,
    );
  }
  if (project?.link) {
    throw new Error(
      "Reserved production project Git integration is divergent.",
    );
  }
  if (
    project?.ssoProtection &&
    project.ssoProtection.deploymentType !== "none"
  ) {
    throw new Error("Production has incompatible deployment protection.");
  }
  if (Object.keys(project?.protectionBypass ?? {}).length !== 0) {
    throw new Error("Production has an active protection bypass.");
  }

  const [deployments, entries, domains] = await Promise.all([
    listDeployments(client, target),
    readEnvironmentVariables(client, target),
    client.listProjectDomains(target.projectId, target.orgId),
  ]);
  const domainEntries = domains?.domains ?? [];
  if (
    domainEntries.length !== 1 ||
    domainEntries[0]?.name !== new URL(target.siteUrl).hostname
  ) {
    throw new Error("Production must have only its default Vercel domain.");
  }
  if (requireNoDeployments && deployments.length !== 0) {
    throw new Error("Reserved production project is not empty for first-use.");
  }
  if (requireFirstUse && entries.length !== 0) {
    throw new Error("Reserved production project is not empty for first-use.");
  }
  return entries;
}

async function readEnvironmentVariables(client, target) {
  const response = await client.listProjectEnvironmentVariables(
    target.projectId,
    target.orgId,
  );
  return response?.envs ?? [];
}

function assertVariableEntries(
  entries,
  { allowMissing, deploymentEnvironment },
) {
  const expectedKeys = new Set(variables.map(({ key }) => key));
  if (entries.some((entry) => !expectedKeys.has(entry.key))) {
    throw new Error(
      "Production must contain exactly the three approved variables.",
    );
  }
  if (!allowMissing && entries.length !== variables.length) {
    throw new Error("Production must contain exactly three variables.");
  }
  for (const expected of variables) {
    const matches = entries.filter((entry) => entry.key === expected.key);
    if (matches.length > 1 || (!allowMissing && matches.length !== 1)) {
      throw new Error(
        `Vercel variable ${expected.key} is missing or duplicated.`,
      );
    }
    if (matches.length === 0) continue;
    const entry = matches[0];
    if (
      entry.type !== expected.type ||
      !Array.isArray(entry.target) ||
      entry.target.length !== 1 ||
      entry.target[0] !== deploymentEnvironment ||
      entry.gitBranch
    ) {
      throw new Error(
        `Vercel variable ${expected.key} has divergent target or sensitive type.`,
      );
    }
  }
}

function readProductionVariables(environment, manifest) {
  const missing = variables.filter(({ key }) => !environment?.[key]?.trim());
  if (missing.length !== 0) {
    throw new Error("All three production variables are required in memory.");
  }
  const projectRef = manifest.supabase.targets.production.projectRef;
  const hostname = manifest.supabase.targets.production.hostname;
  if (!projectRef || hostname !== `${projectRef}.supabase.co`) {
    throw new Error("The production Supabase target is not persisted.");
  }
  if (environment.NEXT_PUBLIC_SUPABASE_URL !== `https://${hostname}`) {
    throw new Error("The production Supabase URL is divergent.");
  }
  return Object.fromEntries(
    variables.map(({ key }) => [key, environment[key]]),
  );
}

async function assertDeploymentSource(options, target, resolveSourceCommit) {
  if (!target.allowedSourceRefs.includes(options.sourceRef)) {
    throw new Error("Production source ref is not explicitly allowed.");
  }
  if (!/^[a-f0-9]{40}$/.test(options.commitSha ?? "")) {
    throw new Error("Production deployment requires an exact commit SHA.");
  }
  if (typeof resolveSourceCommit !== "function") {
    throw new Error("Production source ref resolver is required.");
  }
  const resolvedCommitSha = await resolveSourceCommit(options.sourceRef);
  if (resolvedCommitSha !== options.commitSha) {
    throw new Error(
      "Production source ref does not resolve to the requested commit.",
    );
  }
  return { commitSha: options.commitSha, sourceRef: options.sourceRef };
}

function logDryRun(baseResult, phase, target, safeLog) {
  const result = {
    ...baseResult,
    mode: "dry-run",
    nextAction: `rerun with --execute --confirm-project ${target.projectId}`,
    phase,
  };
  safeLog(result);
  return result;
}

function deploymentMetadata(source) {
  return {
    pr09: "true",
    roberto_commit_sha: source.commitSha,
    roberto_environment: "production",
    roberto_environment_fingerprint: source.environmentFingerprint,
    roberto_source_ref: source.sourceRef,
  };
}

async function listDeployments(client, target) {
  const response = await client.listProjectDeployments(
    target.projectId,
    target.orgId,
  );
  return response?.deployments ?? [];
}

async function findExistingDeployment(client, target, source) {
  const deployments = await listDeployments(client, target);
  const matches = deployments.filter((deployment) =>
    deploymentMatchesSource(deployment, source, target),
  );
  if (matches.length > 1) {
    throw new Error(
      "Multiple deployments match the requested production commit.",
    );
  }
  if (matches.length === 0) return null;
  const deploymentId = matches[0].uid ?? matches[0].id;
  if (!deploymentId)
    throw new Error("Existing production deployment has no id.");
  return client.getDeployment(deploymentId, target.orgId);
}

function deploymentMatchesSource(deployment, source, target) {
  const metadata = deployment?.meta ?? {};
  const gitSource = deployment?.gitSource ?? {};
  return (
    metadata.roberto_source_ref === source.sourceRef &&
    metadata.roberto_commit_sha === source.commitSha &&
    (!source.environmentFingerprint ||
      metadata.roberto_environment_fingerprint ===
        source.environmentFingerprint) &&
    gitSource.ref === source.commitSha &&
    gitSource.sha === source.commitSha &&
    gitSource.repoId === target.repositoryId
  );
}

async function pollDeployment({ client, deploymentId, orgId, wait }) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const deployment = await client.getDeployment(deploymentId, orgId);
    if (deployment?.readyState === "READY") return deployment;
    if (deployment?.readyState === "ERROR") {
      throw new Error("Vercel production build failed.");
    }
    if (attempt < 59) await wait(5_000);
  }
  throw new Error("Vercel production deployment did not reach READY in time.");
}

function assertProductionDeployment(deployment, target, source) {
  const deploymentId = deployment?.uid ?? deployment?.id;
  if (!deploymentId) throw new Error("Production deployment id is missing.");
  if (
    deployment.name !== target.projectName ||
    deployment.target !== target.deploymentEnvironment ||
    deployment.readyState !== "READY"
  ) {
    throw new Error(
      "Production deployment identity or READY state is divergent.",
    );
  }
  if (!deploymentMatchesSource(deployment, source, target)) {
    throw new Error("Production deployment commit or source ref is divergent.");
  }
  const metadata = deployment.meta ?? {};
  if (
    metadata.pr09 !== "true" ||
    metadata.roberto_environment !== "production" ||
    (source.environmentFingerprint &&
      metadata.roberto_environment_fingerprint !==
        source.environmentFingerprint)
  ) {
    throw new Error("Production deployment metadata is divergent.");
  }
  const aliases = deployment.alias ?? deployment.aliases ?? [];
  if (!aliases.includes(new URL(target.siteUrl).hostname)) {
    throw new Error("Production deployment is missing the stable alias.");
  }
  const url = normalizeUrl(deployment.url);
  if (
    !url ||
    !new URL(url).hostname.endsWith(".vercel.app") ||
    new URL(url).hostname === new URL(target.siteUrl).hostname
  ) {
    throw new Error("Production deployment URL is not a Vercel URL.");
  }
}

function deploymentResult(base, deployment, source, mode) {
  return {
    ...base,
    commitSha: source.commitSha,
    deploymentId: deployment.uid ?? deployment.id,
    deploymentUrl: normalizeUrl(deployment.url),
    mode,
    phase: mode === "verified" ? "verify" : "deploy",
    sourceRef: source.sourceRef,
  };
}

function readStateFacts(state, phase) {
  const entry = [...(state.history ?? [])]
    .reverse()
    .find((candidate) => candidate.phase === phase);
  if (!entry?.facts) {
    throw new Error(`Cutover state is missing ${phase} facts.`);
  }
  return entry.facts;
}

function normalizeUrl(value) {
  if (!value) return null;
  return (value.startsWith("http") ? value : `https://${value}`).replace(
    /\/$/,
    "",
  );
}

function parseArguments(argv) {
  if (argv.includes("--help")) {
    if (argv.length !== 1) throw new Error("--help cannot be combined.");
    return { help: true };
  }
  const options = { execute: false };
  const valueOptions = new Map([
    ["--phase", "phase"],
    ["--confirm-project", "confirmation"],
    ["--source-ref", "sourceRef"],
    ["--commit-sha", "commitSha"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") {
      if (options.execute) throw new Error("Duplicate --execute option.");
      options.execute = true;
      continue;
    }
    const property = valueOptions.get(argument);
    if (!property) throw new Error(`Unexpected argument: ${argument}`);
    if (options[property] !== undefined) {
      throw new Error(`Duplicate ${argument} option.`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    options[property] = value;
    index += 1;
  }
  assertPhase(options.phase);
  return options;
}

export async function runProvisionVercelProductionCli(
  argv = process.argv.slice(2),
  dependencies = {},
) {
  const options = parseArguments(argv);
  const logger = dependencies.logger ?? console.log;
  if (options.help) {
    logger(
      "Uso: npm run ops:provision-vercel-production -- --phase <audit|configure|deploy|verify> [--execute --confirm-project <project-id>] [--source-ref <ref> --commit-sha <sha>]",
    );
    return;
  }
  const environment = dependencies.environment ?? process.env;
  const loadManifest =
    dependencies.loadManifest ?? loadRemoteEnvironmentManifest;
  const manifest = await loadManifest(
    resolve("config/remote-environments.json"),
  );
  const loadState = dependencies.loadState ?? loadProductionCutoverState;
  const state = await loadState({ filePath: resolve(stateFilePath) });
  const client =
    dependencies.client ??
    (environment.VERCEL_TOKEN
      ? createVercelManagementClient({ authToken: environment.VERCEL_TOKEN })
      : undefined);
  const recordPhase =
    dependencies.recordPhase ??
    ((input) =>
      recordProductionCutoverPhase({
        ...input,
        filePath: resolve(stateFilePath),
        now: new Date(),
      }));
  return runVercelProductionProvisioning({
    client,
    environment,
    logger,
    manifest,
    options,
    recordPhase,
    resolveSourceCommit:
      dependencies.resolveSourceCommit ??
      ((sourceRef) => resolveGitSourceCommit(sourceRef, environment)),
    state,
  });
}

function resolveGitSourceCommit(sourceRef, environment) {
  const gitRef =
    sourceRef === "main"
      ? "refs/remotes/origin/main^{commit}"
      : `refs/heads/${sourceRef}^{commit}`;
  const result = runCliCommand("git", ["rev-parse", "--verify", gitRef], {
    environment,
  });
  if (result.status !== 0 || !/^[a-f0-9]{40}$/.test(result.stdout.trim())) {
    throw new Error("Unable to resolve the authorized production source ref.");
  }
  return result.stdout.trim();
}

async function waitForPolling(delayMs) {
  await new Promise((resolveWait) => setTimeout(resolveWait, delayMs));
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runProvisionVercelProductionCli().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Vercel production provisioning failed.",
    );
    process.exitCode = 1;
  });
}
