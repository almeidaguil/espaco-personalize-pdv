import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadRemoteEnvironmentManifest,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import {
  loadProductionCutoverState,
  recordProductionCutoverPhase,
} from "./production-cutover-state.mjs";
import { resolveRemoteProductionSmokeEnvironment } from "./remote-production-smoke-environment.mjs";
import { runCliCommand } from "./run-cli-command.mjs";
import { createVercelManagementClient } from "./vercel-management-client.mjs";
import { readProductionDeploymentTarget } from "./verify-remote-production.mjs";

const statePath = resolve(".provisioning/production-cutover-state.json");

export async function runManagedRemoteProductionSmoke({
  client,
  deploymentTarget = /** @type {any} */ (null),
  environment,
  logger = () => {},
  manifest,
  recordPhase,
  runPlaywright,
  state,
  verificationReport,
}) {
  const smokeEnvironment = resolveRemoteProductionSmokeEnvironment(
    environment,
    manifest,
    deploymentTarget,
  );
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
  if (!state || !["deployment-ready", "verified"].includes(state.phase)) {
    throw new Error("Production smoke requires deployment-ready state.");
  }
  const deploymentFacts = readFacts(state, "deployment-ready");
  const releaseMode = deploymentTarget !== null;
  if (releaseMode && state.phase !== "verified") {
    throw new Error(
      "The provisional production deployment must be verified before main smoke.",
    );
  }
  if (
    !releaseMode &&
    (deploymentFacts.deploymentId !== target.deploymentId ||
      deploymentFacts.deploymentUrl !== target.deploymentUrl ||
      (deploymentFacts.projectId &&
        deploymentFacts.projectId !== target.projectId))
  ) {
    throw new Error("Production smoke state target is divergent.");
  }
  const expectedDeployment = deploymentTarget ?? deploymentFacts;
  if (
    verificationReport?.status !== "passed" ||
    verificationReport.deploymentId !== expectedDeployment.deploymentId ||
    verificationReport.deploymentUrl !== expectedDeployment.deploymentUrl ||
    verificationReport.commitSha !== expectedDeployment.commitSha ||
    (deploymentTarget &&
      verificationReport.sourceRef !== deploymentTarget.sourceRef)
  ) {
    throw new Error(
      "Verification and smoke must use the same deployment and commit.",
    );
  }

  const project = await client.getProject(target.projectId, target.orgId);
  if (
    Object.keys(project?.protectionBypass ?? {}).length > 0 ||
    (project?.ssoProtection && project.ssoProtection.deploymentType !== "none")
  ) {
    throw new Error(
      "Production cannot use Vercel protection or bypass during smoke.",
    );
  }

  const smoke = await runPlaywright({
    config: "playwright.remote-production.config.ts",
    environment: { ...environment, ...smokeEnvironment },
  });
  if (smoke?.status !== 0) {
    throw new Error("Remote production smoke failed.");
  }
  const facts = {
    checks: [...verificationReport.checks].sort(),
    commitSha: verificationReport.commitSha,
    deploymentId: verificationReport.deploymentId,
    smokeStatus: "passed",
  };
  if (!releaseMode && state.phase === "deployment-ready") {
    await recordPhase({ facts, phase: "verified", previousState: state });
  } else if (!releaseMode) {
    const persisted = readFacts(state, "verified");
    if (JSON.stringify(persisted) !== JSON.stringify(facts)) {
      throw new Error("Verified production state is divergent.");
    }
  }
  const result = {
    commitSha: verificationReport.commitSha,
    deploymentId: facts.deploymentId,
    deploymentUrl: verificationReport.deploymentUrl,
    smokeStatus: facts.smokeStatus,
  };
  logger(result);
  return result;
}

function readFacts(state, phase) {
  const facts = state.history?.find((entry) => entry.phase === phase)?.facts;
  if (!facts) throw new Error(`Production cutover state is missing ${phase}.`);
  return facts;
}

export async function runRemoteProductionSmokeCli(
  argv = process.argv.slice(2),
  environment = process.env,
  dependencies = {},
) {
  const {
    client: providedClient,
    loadManifest = () =>
      loadRemoteEnvironmentManifest(resolve("config/remote-environments.json")),
    loadState = () => loadProductionCutoverState({ filePath: statePath }),
    logger = console.log,
    recordPhase = (input) =>
      recordProductionCutoverPhase({
        ...input,
        filePath: statePath,
        now: new Date(),
      }),
    runPlaywright = defaultRunPlaywright,
    verifyProduction = runFreshProductionVerification,
  } = dependencies;
  if (argv.includes("--help")) {
    logger(
      "Uso: npm run test:e2e:production-smoke -- [--deployment-id <id> --deployment-url <url> --source-ref main --commit-sha <sha>]",
    );
    return;
  }
  assertSmokeOptions(argv);
  const deploymentTarget = readProductionDeploymentTarget(argv);
  const manifest = await loadManifest();
  const projectRef = manifest.supabase.targets.production.projectRef;
  if (!projectRef) {
    throw new Error("The production project ref is not registered.");
  }
  if (!providedClient && !environment.VERCEL_TOKEN?.trim())
    throw new Error("VERCEL_TOKEN is required.");
  const verificationReport = await verifyProduction({
    deploymentTarget,
    environment,
    projectRef,
  });
  const state = await loadState();
  const result = await runManagedRemoteProductionSmoke({
    client:
      providedClient ??
      createVercelManagementClient({ authToken: environment.VERCEL_TOKEN }),
    deploymentTarget,
    environment,
    manifest,
    recordPhase,
    runPlaywright,
    state,
    verificationReport,
  });
  logger(JSON.stringify(result));
  return result;
}

function defaultRunPlaywright({ environment }) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  return runCliCommand(npmCommand, ["run", "test:e2e:production-smoke:raw"], {
    environment,
  });
}

function runFreshProductionVerification({
  deploymentTarget,
  environment,
  projectRef,
}) {
  const releaseArguments = deploymentTarget
    ? [
        "--deployment-id",
        deploymentTarget.deploymentId,
        "--deployment-url",
        deploymentTarget.deploymentUrl,
        "--source-ref",
        deploymentTarget.sourceRef,
        "--commit-sha",
        deploymentTarget.commitSha,
      ]
    : [];
  const verification = runCliCommand(
    process.execPath,
    [
      resolve("scripts/verify-remote-production.mjs"),
      "--confirm-ref",
      projectRef,
      ...releaseArguments,
    ],
    { environment },
  );
  if (verification.status !== 0) {
    throw new Error("Production verification failed before smoke.");
  }
  try {
    return JSON.parse(verification.stdout);
  } catch {
    throw new Error("Production verification returned an invalid report.");
  }
}

function assertSmokeOptions(argv) {
  const allowed = new Set([
    "--deployment-id",
    "--deployment-url",
    "--source-ref",
    "--commit-sha",
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    if (!allowed.has(argv[index]) || !argv[index + 1]) {
      throw new Error(`Unexpected or incomplete option: ${argv[index]}`);
    }
  }
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runRemoteProductionSmokeCli().catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Remote production smoke failed.",
    );
    process.exitCode = 1;
  });
}
