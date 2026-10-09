import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  bootstrapRemoteAdmin,
  createRemoteAdminAdapter,
} from "./bootstrap-remote-admin.mjs";
import { loadRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";

export async function bootstrapStagingAdmin({
  confirmation,
  email = undefined,
  environment,
  execute,
  fullName = undefined,
  log,
  manifest,
  password = undefined,
  supabaseAdmin,
}) {
  const credentials = resolveCredentials({
    email,
    environment,
    fullName,
    password,
  });
  const target = resolveStagingTarget(manifest);
  const result = await bootstrapRemoteAdmin({
    adminApi: supabaseAdmin,
    confirmation,
    credentials,
    environment: "staging",
    execute,
    logger: () => {},
    manifest,
    requireEmptyOperationalData: false,
    sensitiveValues: [environment.SUPABASE_SECRET_KEY],
  });

  if (!execute) {
    const stagingResult = {
      action: result.userId ? "verify-admin" : "create-admin",
      mode: "dry-run",
      projectRef: target.projectRef,
      userCount: result.userId ? 1 : 0,
    };
    log(stagingResult);
    return stagingResult;
  }

  const stagingResult = {
    action: result.created ? "created" : "unchanged",
    mode: "executed",
    projectRef: target.projectRef,
    userCount: 1,
  };
  log(stagingResult);
  return stagingResult;
}

function resolveCredentials({ email, environment, fullName, password }) {
  const values = {
    email: email ?? environment.STAGING_ADMIN_EMAIL,
    fullName: fullName ?? environment.STAGING_ADMIN_FULL_NAME,
    password: password ?? environment.STAGING_ADMIN_PASSWORD,
  };
  const missing = [
    ["STAGING_ADMIN_EMAIL", values.email],
    ["STAGING_ADMIN_PASSWORD", values.password],
    ["STAGING_ADMIN_FULL_NAME", values.fullName],
  ]
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.join(", ")}.`);
  }
  if (values.password.length < 14) {
    throw new Error("Staging admin password must have at least 14 characters.");
  }
  if (
    !/[a-z]/.test(values.password) ||
    !/[A-Z]/.test(values.password) ||
    !/[0-9]/.test(values.password) ||
    !/[^A-Za-z0-9]/.test(values.password)
  ) {
    throw new Error("Staging admin requires a strong password.");
  }

  const e2eValues = Object.entries(environment)
    .filter(([name]) => /^E2E_.+_(EMAIL|PASSWORD)$/.test(name))
    .map(([, value]) => value)
    .filter(Boolean);
  if (
    /e2e/i.test(values.email) ||
    e2eValues.some(
      (value) =>
        value === values.password ||
        value.toLowerCase() === values.email.toLowerCase(),
    )
  ) {
    throw new Error("Local E2E credentials cannot be used in remote staging.");
  }

  return values;
}

function resolveStagingTarget(manifest) {
  const target = manifest.supabase.targets.staging;
  if (!target.projectRef || !target.hostname) {
    throw new Error(
      "The staging project ref must be persisted before bootstrap.",
    );
  }
  return {
    hostname: target.hostname,
    name: target.name,
    organizationId: manifest.supabase.organization.id,
    projectRef: target.projectRef,
  };
}

export async function runBootstrapStagingAdminCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    console.log(
      "Uso: npm run ops:bootstrap-staging-admin -- [--execute --confirm-ref <staging-ref>]",
    );
    return;
  }
  const manifest = await loadRemoteEnvironmentManifest(
    resolve("config/remote-environments.json"),
  );
  const projectRef = manifest.supabase.targets.staging.projectRef;
  if (!projectRef)
    throw new Error("The staging project ref is not registered.");
  if (!environment.SUPABASE_ACCESS_TOKEN) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required.");
  }
  const managementClient = createSupabaseManagementClient({
    accessToken: environment.SUPABASE_ACCESS_TOKEN,
  });
  const keys = parseSupabaseApiKeys(
    await managementClient.getApiKeys(projectRef),
  );
  const supabase = createClient(buildSupabaseUrl(projectRef), keys.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return bootstrapStagingAdmin({
    confirmation: readOption(argv, "--confirm-ref"),
    environment,
    execute: argv.includes("--execute"),
    log: (value) => console.log(JSON.stringify(value, null, 2)),
    manifest,
    supabaseAdmin: createRemoteAdminAdapter(supabase),
  });
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runBootstrapStagingAdminCli().catch((error) => {
    console.error(error instanceof Error ? error.message : "Bootstrap failed.");
    process.exitCode = 1;
  });
}
