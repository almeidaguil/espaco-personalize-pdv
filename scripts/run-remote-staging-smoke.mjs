import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadRemoteEnvironmentManifest,
  parseRemoteEnvironmentManifest,
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import { resolveRemoteStagingSmokeEnvironment } from "./remote-staging-smoke-environment.mjs";
import { runCliCommand } from "./run-cli-command.mjs";
import { createVercelManagementClient } from "./vercel-management-client.mjs";

/**
 * @param {{
 *   args?: string[],
 *   environment: any,
 *   manifest: any,
 *   protectionClient?: any,
 *   runCommand?: (command: string, args: string[], options: { environment: any }) => { status: number, stderr: string, stdout: string },
 *   secretGenerator?: () => string,
 * }} parameters
 */
export async function runManagedRemoteStagingSmoke({
  args = [],
  environment,
  manifest,
  protectionClient,
  runCommand = runCliCommand,
  secretGenerator = () => randomBytes(16).toString("hex"),
}) {
  const parsedManifest = parseRemoteEnvironmentManifest(manifest);
  const target = resolveRemoteTarget(parsedManifest, {
    environment: "staging",
    provider: "vercel",
  });
  const options = parseArguments(args);
  if (!options.execute) {
    return {
      mode: "dry-run",
      nextAction: `rerun with --execute --confirm-project ${target.projectId}`,
      projectId: target.projectId,
    };
  }
  validateRemoteOperation({
    confirmation: options.confirmation,
    environment: "staging",
    execute: true,
    manifest: parsedManifest,
    operation: "mutate",
    provider: "vercel",
    target: {
      orgId: target.orgId,
      projectId: target.projectId,
      projectName: target.projectName,
    },
  });
  const smokeEnvironmentBase = { ...environment };
  delete smokeEnvironmentBase.VERCEL_AUTOMATION_BYPASS_SECRET;
  delete smokeEnvironmentBase.VERCEL_TOKEN;

  resolveRemoteStagingSmokeEnvironment(
    {
      ...smokeEnvironmentBase,
      VERCEL_AUTOMATION_BYPASS_SECRET: "preflight-placeholder",
    },
    parsedManifest,
  );

  const client =
    protectionClient ??
    createVercelManagementClient({ authToken: environment.VERCEL_TOKEN });
  const readProtection = () =>
    client.getProject(target.projectId, target.orgId);
  const initialProtection = await readProtection();
  assertVercelAuthentication(initialProtection);
  if (Object.keys(initialProtection?.protectionBypass ?? {}).length !== 0) {
    throw new Error("A Vercel automation bypass is already active.");
  }

  const bypassSecret = secretGenerator();
  if (!/^[A-Za-z0-9]{32}$/.test(bypassSecret ?? "")) {
    throw new Error("Unable to generate a temporary Vercel bypass.");
  }
  let operationFailure;
  let cleanupFailure;
  let bypassAttempted = false;

  try {
    bypassAttempted = true;
    await client.createAutomationBypass({
      orgId: target.orgId,
      projectId: target.projectId,
      secret: bypassSecret,
    });
    let createdProtection;
    try {
      createdProtection = await readProtection();
    } catch {
      throw new Error("Unable to inspect the created Vercel bypass.");
    }
    assertVercelAuthentication(createdProtection);
    assertExpectedBypass(createdProtection?.protectionBypass, bypassSecret);

    const smokeEnvironment = {
      ...smokeEnvironmentBase,
      VERCEL_AUTOMATION_BYPASS_SECRET: bypassSecret,
    };
    resolveRemoteStagingSmokeEnvironment(smokeEnvironment, parsedManifest);
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const smoke = runCommand(
      npmCommand,
      ["run", "test:e2e:staging-smoke:raw"],
      { environment: smokeEnvironment },
    );
    if (smoke.status !== 0) {
      throw new Error("Remote staging smoke failed.");
    }
  } catch (error) {
    operationFailure = error;
  } finally {
    if (bypassAttempted) {
      try {
        await client.revokeAutomationBypass({
          orgId: target.orgId,
          projectId: target.projectId,
          secret: bypassSecret,
        });
      } catch {
        cleanupFailure = new Error(
          "The temporary Vercel bypass could not be removed.",
        );
      }
    }

    try {
      const finalProtection = await readProtection();
      assertVercelAuthentication(finalProtection);
      if (Object.keys(finalProtection?.protectionBypass ?? {}).length !== 0) {
        cleanupFailure = new Error(
          "Vercel protection cleanup left an active bypass.",
        );
      } else {
        cleanupFailure = undefined;
      }
    } catch {
      cleanupFailure = new Error("Unable to verify Vercel protection cleanup.");
    }
  }

  if (cleanupFailure) throw cleanupFailure;
  if (operationFailure) throw operationFailure;
  return { bypassesAfter: 0, smokeStatus: "passed" };
}

function assertExpectedBypass(protectionBypass = {}, expectedSecret) {
  const entries = Object.entries(protectionBypass);
  if (
    entries.length !== 1 ||
    entries[0][0] !== expectedSecret ||
    entries[0][1]?.scope !== "automation-bypass"
  ) {
    throw new Error("Vercel did not return exactly one temporary bypass.");
  }
}

function assertVercelAuthentication(project) {
  if (project?.ssoProtection?.deploymentType !== "all_except_custom_domains") {
    throw new Error("Vercel Authentication must remain active during smoke.");
  }
}

function parseArguments(args) {
  const confirmationIndex = args.indexOf("--confirm-project");
  return {
    confirmation:
      confirmationIndex === -1 ? undefined : args[confirmationIndex + 1],
    execute: args.includes("--execute"),
  };
}

async function runCli() {
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const result = await runManagedRemoteStagingSmoke({
    args: process.argv.slice(2),
    environment: process.env,
    manifest,
  });
  console.log(JSON.stringify(result));
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Remote staging smoke failed.",
    );
    process.exitCode = 1;
  });
}
