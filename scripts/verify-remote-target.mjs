import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  loadRemoteEnvironmentManifest,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

export async function runVerifyRemoteTargetCli(
  argv = process.argv.slice(2),
  { log = console.log } = {},
) {
  const options = parseArguments(argv);
  const manifest = await loadRemoteEnvironmentManifest(
    resolve(options.manifest ?? "config/remote-environments.json"),
  );
  const target = resolveTarget(manifest, options);
  const result = validateRemoteOperation({
    confirmation: options.confirm,
    environment: options.environment,
    execute: options.execute,
    manifest,
    operation: options.operation,
    provider: options.provider,
    target,
  });

  log(JSON.stringify(result, null, 2));
  return result;
}

function parseArguments(argv) {
  const options = { execute: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--execute") {
      options.execute = true;
      continue;
    }

    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}.`);
    }

    options[toCamelCase(argument.slice(2))] = value;
    index += 1;
  }

  for (const required of ["provider", "environment", "operation"]) {
    if (!options[required]) {
      throw new Error(`Missing required option --${required}.`);
    }
  }

  return options;
}

function resolveTarget(manifest, options) {
  if (options.provider === "supabase") {
    const expected = resolveSupabaseTarget(manifest, options.environment);
    return {
      hostname: options.hostname ?? expected.hostname,
      name: options.name ?? expected.name,
      organizationId:
        options.organizationId ?? manifest.supabase.organization.id,
      projectRef: options.projectRef ?? expected.projectRef,
    };
  }

  if (options.provider === "vercel") {
    return {
      orgId: options.orgId ?? manifest.vercel.orgId,
      projectId: options.projectId ?? manifest.vercel.projectId,
      projectName: options.projectName ?? manifest.vercel.projectName,
    };
  }

  return {};
}

function resolveSupabaseTarget(manifest, environment) {
  const targets = {
    "legacy-production": manifest.supabase.legacy.production,
    "legacy-staging": manifest.supabase.legacy.staging,
    production: manifest.supabase.targets.production,
    staging: manifest.supabase.targets.staging,
  };

  return targets[environment] ?? {};
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runVerifyRemoteTargetCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Verification failed.",
    );
    process.exitCode = 1;
  });
}
