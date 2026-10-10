import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { loadRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";
import { runCliCommand } from "./run-cli-command.mjs";
import { verifyRemoteEnvironment } from "./verify-remote-environment.mjs";

export async function verifyRemoteStaging({
  anonymousClient,
  authenticatedClient,
  commandRunner,
  linkedProjectRef,
  localMigrations = /** @type {string[] | undefined} */ (undefined),
  managementClient,
  manifest,
}) {
  const result = await verifyRemoteEnvironment({
    environment: "staging",
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
  return {
    checks: result.checks,
    projectRef: result.projectRef,
    status: result.status,
  };
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

export function runRemoteCommand(
  command,
  args,
  options = {},
  dependencies = {},
) {
  return runCliCommand(
    command,
    args,
    { environment: process.env, ...options },
    dependencies,
  );
}

export async function runVerifyRemoteStagingCli(
  argv = process.argv.slice(2),
  environment = process.env,
) {
  if (argv.includes("--help")) {
    console.log(
      "Uso: npm run ops:verify-staging -- --confirm-ref <staging-ref>",
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
  if (readOption(argv, "--confirm-ref") !== projectRef) {
    throw new Error("The staging project ref confirmation is divergent.");
  }
  const linkedProjectRef = await readLocalLinkedProjectRef();
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
  const anonymousClient = {
    async authenticate() {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: environment.STAGING_ADMIN_EMAIL,
        password: environment.STAGING_ADMIN_PASSWORD,
      });
      if (error || !data.user)
        throw new Error("Staging admin authentication failed.");
      return { userId: data.user.id };
    },
  };
  const authenticatedClient = {
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
  };
  const result = await verifyRemoteStaging({
    anonymousClient,
    authenticatedClient,
    commandRunner: runRemoteCommand,
    linkedProjectRef,
    managementClient,
    manifest,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function readOption(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  runVerifyRemoteStagingCli().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Remote verification failed.",
    );
    process.exitCode = 1;
  });
}
