import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createNetlifyManagementClient } from "./netlify-management-client.mjs";
import {
  loadRemoteEnvironmentManifest,
  redactSensitiveText,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

const netlifyCliPackage = "netlify-cli@27.11.2";
const allowedPhases = new Set(["site", "configure-staging"]);
const stagingVariableNames = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
];

export async function runNetlifyProvisioning({
  args,
  commandRunner,
  environment,
  log,
  manifest,
  netlifyClient = /** @type {any} */ (undefined),
}) {
  const options = parseArguments(args);
  const target = manifest.netlify;
  const resultBase = {
    accountId: target.accountId,
    productionBranch: target.productionBranch,
    repository: target.repository,
    siteId: target.siteId,
    siteName: target.siteName,
    siteUrl: target.siteUrl,
    stagingBranch: target.stagingBranch,
  };

  if (options.phase === "site" && !options.execute) {
    const result = {
      ...resultBase,
      mode: "dry-run",
      nextAction: `rerun with --execute --confirm-site ${target.siteName}`,
    };
    log(result);
    return result;
  }

  if (options.phase === "configure-staging") {
    assertProvisionedTargets(manifest);
    const variables = readStagingVariables(environment, manifest);

    if (!netlifyClient) {
      throw new Error(
        "A validated Netlify client is required for staging configuration.",
      );
    }

    const site = await getValidatedSite(netlifyClient, manifest);
    if (!options.execute) {
      const result = {
        ...resultBase,
        mode: "dry-run",
        nextAction: `rerun with --execute --confirm-site ${target.siteId}`,
      };
      log(result);
      return result;
    }

    authorizeMutation(manifest, options.confirmation);
    const secrets = [
      environment.NETLIFY_AUTH_TOKEN,
      ...Object.values(variables),
    ];
    try {
      await netlifyClient.upsertSiteEnvironmentVariables({
        accountId: target.accountId,
        branch: target.stagingBranch,
        siteId: target.siteId,
        variables,
      });
    } catch (error) {
      const safeError = redactSensitiveText(error, secrets);
      throw new Error(
        `Unable to configure staging variables: ${safeError.message ?? safeError}`,
      );
    }

    const deployResult = await runNetlifyCommand({
      args: [
        "deploy",
        "--build",
        "--context",
        "branch-deploy",
        "--site",
        site.id,
        "--json",
      ],
      commandRunner,
      environment,
      failureMessage: "Netlify non-production deploy failed.",
      sensitiveValues: secrets,
    });
    const deployId = parseDeployId(deployResult.stdout);
    const result = {
      ...resultBase,
      ...(deployId ? { deployId } : {}),
      mode: "executed",
    };
    log(result);
    return result;
  }

  authorizeCreation(manifest, options);
  if (!netlifyClient) {
    throw new Error("NETLIFY_AUTH_TOKEN is required for site creation.");
  }

  const accountId = environment.NETLIFY_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error("NETLIFY_ACCOUNT_ID is required for site creation.");
  }
  const account = await netlifyClient.getAccount(accountId);
  if (account?.id !== accountId) {
    throw new Error("Netlify account is divergent from NETLIFY_ACCOUNT_ID.");
  }
  if (!account.slug?.trim()) {
    throw new Error("Netlify account slug is missing.");
  }

  let site;
  if (target.siteId) {
    site = await getValidatedSite(netlifyClient, manifest);
  } else {
    const existingSites = await netlifyClient.listSites();
    const sameName = existingSites.find(
      (candidate) => candidate.name === target.siteName,
    );
    if (sameName) {
      if (
        options.recoverSiteId !== sameName.id ||
        !isRecoverableUnlinkedShell(sameName, accountId)
      ) {
        throw new Error("The approved Netlify site name is unavailable.");
      }
      site = sameName;
    } else {
      try {
        site = await netlifyClient.createSite(account.slug, {
          name: target.siteName,
        });
      } catch (error) {
        const safeError = redactSensitiveText(error, [
          environment.NETLIFY_AUTH_TOKEN,
        ]);
        throw new Error(
          `The approved Netlify site name is unavailable: ${safeError.message ?? safeError}`,
        );
      }
    }

    await netlifyClient.updateSite(site.id, {
      repo: expectedBuildSettings(target),
    });
    await netlifyClient.updateSite(site.id, {
      prevent_non_git_prod_deploys: true,
    });
    await runNetlifyCommand({
      args: ["link", "--id", site.id],
      commandRunner,
      environment,
      failureMessage: "Unable to link the local Netlify site.",
      sensitiveValues: [environment.NETLIFY_AUTH_TOKEN],
    });
    site = await netlifyClient.getSite(site.id);
    assertSiteConfiguration(site, { ...target, accountId, siteId: site.id });
  }

  const result = {
    ...resultBase,
    accountId,
    mode: "executed",
    siteId: site.id,
    siteUrl: normalizeSiteUrl(site.ssl_url ?? site.url),
  };
  log(result);
  return result;
}

function parseArguments(args) {
  const phase = readOption(args, "--phase");
  if (!phase || !allowedPhases.has(phase)) {
    throw new Error("--phase must be site or configure-staging.");
  }
  return {
    confirmation: readOption(args, "--confirm-site"),
    execute: args.includes("--execute"),
    phase,
    recoverSiteId: readOption(args, "--recover-site-id"),
  };
}

function isRecoverableUnlinkedShell(site, accountId) {
  return (
    site?.account_id === accountId &&
    site?.prevent_non_git_prod_deploys === false &&
    !site?.repo &&
    Object.keys(site?.build_settings ?? {}).length === 0
  );
}

function authorizeCreation(manifest, options) {
  if (options.confirmation !== manifest.netlify.siteName) {
    throw new Error(
      "Remote mutation requires confirmação literal do nome do site.",
    );
  }
  validateRemoteOperation({
    confirmation: manifest.netlify.siteId ?? options.confirmation,
    environment: "staging",
    execute: options.execute,
    manifest,
    operation: "mutate",
    provider: "netlify",
    target: {
      accountId: manifest.netlify.accountId,
      hostname: new URL(manifest.netlify.siteUrl).hostname,
      siteId: manifest.netlify.siteId,
      siteName: manifest.netlify.siteName,
    },
  });
}

function authorizeMutation(manifest, confirmation) {
  if (confirmation !== manifest.netlify.siteName) {
    throw new Error(
      "Remote mutation requires confirmação literal do nome do site.",
    );
  }
  validateRemoteOperation({
    confirmation: manifest.netlify.siteId,
    environment: "staging",
    execute: true,
    manifest,
    operation: "mutate",
    provider: "netlify",
    target: {
      accountId: manifest.netlify.accountId,
      hostname: new URL(manifest.netlify.siteUrl).hostname,
      siteId: manifest.netlify.siteId,
      siteName: manifest.netlify.siteName,
    },
  });
}

function assertProvisionedTargets(manifest) {
  if (!manifest.netlify.accountId || !manifest.netlify.siteId) {
    throw new Error(
      "The Netlify site must be persisted before staging configuration.",
    );
  }
  if (
    !manifest.supabase.targets.staging.projectRef ||
    !manifest.supabase.targets.staging.hostname
  ) {
    throw new Error(
      "The staging Supabase target must be persisted before Netlify configuration.",
    );
  }
}

function readStagingVariables(environment, manifest) {
  const missing = stagingVariableNames.filter(
    (name) => !environment[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error("All three staging variables are required in memory.");
  }
  const expectedUrl = `https://${manifest.supabase.targets.staging.projectRef}.supabase.co`;
  if (environment.NEXT_PUBLIC_SUPABASE_URL !== expectedUrl) {
    if (
      environment.NEXT_PUBLIC_SUPABASE_URL?.includes(
        manifest.supabase.legacy.production.projectRef,
      )
    ) {
      throw new Error(
        "Production Supabase credentials cannot be configured in staging.",
      );
    }
    throw new Error(
      "The staging Supabase URL is divergent from the approved target.",
    );
  }
  return Object.fromEntries(
    stagingVariableNames.map((name) => [name, environment[name]]),
  );
}

async function getValidatedSite(netlifyClient, manifest) {
  const site = await netlifyClient.getSite(manifest.netlify.siteId);
  assertSiteConfiguration(site, manifest.netlify);
  return site;
}

function assertSiteConfiguration(site, target) {
  const buildSettings = site?.build_settings ?? {};
  const expected = expectedBuildSettings(target);
  const siteUrl = normalizeSiteUrl(site?.ssl_url ?? site?.url);
  const exactFields = [
    ["account", site?.account_id, target.accountId],
    ["site id", site?.id, target.siteId],
    ["site name", site?.name, target.siteName],
    ["site URL", siteUrl, target.siteUrl],
    ["repository", buildSettings.repo_path, expected.repo_path],
    ["production branch", buildSettings.repo_branch, expected.repo_branch],
    ["build command", buildSettings.cmd, expected.cmd],
  ];
  const divergent = exactFields.find(([, actual, wanted]) => actual !== wanted);
  if (divergent) {
    throw new Error(`Netlify ${divergent[0]} is divergent.`);
  }
  if (
    site.prevent_non_git_prod_deploys !== true ||
    buildSettings.repo_branch !== target.productionBranch ||
    !Array.isArray(buildSettings.allowed_branches) ||
    buildSettings.allowed_branches.length !== 1 ||
    buildSettings.allowed_branches[0] !== target.stagingBranch
  ) {
    throw new Error("Netlify production is not proven blocked.");
  }
}

function expectedBuildSettings(target) {
  return {
    allowed_branches: [target.stagingBranch],
    cmd: "npm run build",
    provider: "github",
    public_repo: true,
    repo_branch: target.productionBranch,
    repo_path: target.repository,
    repo_url: `https://github.com/${target.repository}`,
    stop_builds: false,
  };
}

async function runNetlifyCommand({
  args,
  commandRunner,
  environment,
  failureMessage,
  sensitiveValues,
}) {
  if (args.includes("--prod") || args.includes("--prod-if-unlocked")) {
    throw new Error("Production deploy flags are forbidden in PR08.");
  }
  const result = await commandRunner(
    "npx.cmd",
    ["--yes", netlifyCliPackage, ...args],
    {
      environment,
    },
  );
  if (result.status !== 0) {
    const safeError = redactSensitiveText(result.stderr, sensitiveValues);
    throw new Error(`${failureMessage} ${safeError}`.trim());
  }
  return result;
}

function normalizeSiteUrl(actual) {
  if (!actual) return null;
  return actual.replace(/^http:/, "https:").replace(/\/$/, "");
}

function parseDeployId(stdout) {
  try {
    const value = JSON.parse(stdout);
    return value.deploy_id ?? value.id ?? null;
  } catch {
    return null;
  }
}

function readOption(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
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

export async function runProvisionNetlifyCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    console.log(
      "Uso: npm run ops:provision-netlify -- --phase <site|configure-staging> [--execute --confirm-site <site>] [--recover-site-id <id>]",
    );
    return;
  }
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const netlifyClient = environment.NETLIFY_AUTH_TOKEN
    ? createNetlifyManagementClient({
        authToken: environment.NETLIFY_AUTH_TOKEN,
      })
    : undefined;
  return runNetlifyProvisioning({
    args: argv,
    commandRunner: runCommand,
    environment,
    log: (value) => console.log(JSON.stringify(value, null, 2)),
    manifest,
    netlifyClient,
  });
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runProvisionNetlifyCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Netlify provisioning failed.",
    );
    process.exitCode = 1;
  });
}
