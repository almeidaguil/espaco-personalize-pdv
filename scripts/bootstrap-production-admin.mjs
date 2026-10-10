import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  bootstrapRemoteAdmin,
  createRemoteAdminAdapter,
} from "./bootstrap-remote-admin.mjs";
import {
  loadProductionCutoverState,
  recordProductionCutoverPhase,
} from "./production-cutover-state.mjs";
import { loadRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";

const stateFilePath = ".provisioning/production-cutover-state.json";

export async function runBootstrapProductionAdminCli(
  argv = process.argv.slice(2),
  dependencies = {},
) {
  const options = parseArguments(argv);
  const log = dependencies.log ?? console.log;
  if (options.help) {
    log(
      "Uso: npm run ops:bootstrap-production-admin -- --execute --confirm-ref <production-ref>",
    );
    return;
  }

  const environment = dependencies.environment ?? process.env;
  const loadManifest =
    dependencies.loadManifest ?? loadRemoteEnvironmentManifest;
  const manifest = await loadManifest(
    resolve("config/remote-environments.json"),
  );
  const target = manifest.supabase.targets.production;
  if (!target.projectRef || !target.hostname) {
    throw new Error("The production project ref is not registered.");
  }
  const loadState = dependencies.loadState ?? loadProductionCutoverState;
  const state = await loadState({ filePath: resolve(stateFilePath) });
  if (!state || !["database-ready", "admin-ready"].includes(state.phase)) {
    throw new Error("Production bootstrap requires database-ready state.");
  }
  assertStateProjectRef(state, target.projectRef);

  const adminApi =
    dependencies.adminApi ??
    (await connectProductionAdmin({
      environment,
      projectRef: target.projectRef,
    }));
  const result = await bootstrapRemoteAdmin({
    adminApi,
    confirmation: options.confirmRef,
    credentials: {
      email: environment.PRODUCTION_ADMIN_EMAIL,
      fullName: environment.PRODUCTION_ADMIN_FULL_NAME,
      password: environment.PRODUCTION_ADMIN_PASSWORD,
    },
    environment: "production",
    execute: options.execute,
    logger: () => {},
    manifest,
    requireEmptyOperationalData: true,
    sensitiveValues: [environment.SUPABASE_ACCESS_TOKEN],
  });

  if (options.execute && state.phase === "database-ready") {
    const recordPhase =
      dependencies.recordPhase ??
      ((input) =>
        recordProductionCutoverPhase({
          ...input,
          filePath: resolve(stateFilePath),
          now: new Date(),
        }));
    await recordPhase({
      facts: { adminCount: 1, operationalRowCount: 0, operatorCount: 0 },
      phase: "admin-ready",
      previousState: state,
    });
  }
  log(result);
  return result;
}

function assertStateProjectRef(state, projectRef) {
  const requiredPhases = ["production-created", "database-ready"];
  const divergent = requiredPhases.find((phase) => {
    const entry = state.history?.find((item) => item.phase === phase);
    return entry?.facts?.projectRef !== projectRef;
  });
  if (divergent) {
    throw new Error("Production cutover state project ref is divergent.");
  }
}

function parseArguments(argv) {
  if (argv.includes("--help")) {
    if (argv.length !== 1) throw new Error("--help cannot be combined.");
    return { execute: false, help: true };
  }
  const options = { execute: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--execute") {
      if (options.execute) throw new Error("Duplicate --execute option.");
      options.execute = true;
      continue;
    }
    if (argument === "--confirm-ref") {
      if (options.confirmRef !== undefined) {
        throw new Error("Duplicate --confirm-ref option.");
      }
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--confirm-ref requires a value.");
      }
      options.confirmRef = value;
      index += 1;
      continue;
    }
    throw new Error(`Unexpected argument: ${argument}`);
  }
  return options;
}

async function connectProductionAdmin({ environment, projectRef }) {
  if (!environment.SUPABASE_ACCESS_TOKEN?.trim()) {
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
  return createRemoteAdminAdapter(supabase);
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runBootstrapProductionAdminCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Production bootstrap failed.",
    );
    process.exitCode = 1;
  });
}
