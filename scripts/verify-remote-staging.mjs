import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  loadRemoteEnvironmentManifest,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";
import {
  buildSupabaseUrl,
  createSupabaseManagementClient,
  parseSupabaseApiKeys,
} from "./supabase-management-client.mjs";

const requiredTables = [
  "profiles",
  "categories",
  "products",
  "stock_movements",
  "cash_sessions",
  "sales",
  "sale_items",
  "payments",
];
const operationalTables = requiredTables.filter(
  (table) => table !== "profiles",
);
const requiredRpcs = [
  "open_cash_session_v3",
  "close_cash_session",
  "finalize_sale_v3",
  "cancel_sale",
  "get_store_sales_report_v2",
];

export async function verifyRemoteStaging({
  anonymousClient,
  authenticatedClient,
  commandRunner,
  localMigrations = /** @type {string[] | undefined} */ (undefined),
  managementClient,
  manifest,
}) {
  const target = manifest.supabase.targets.staging;
  if (!target.projectRef)
    throw new Error("The staging project ref is missing.");
  if (target.hostname !== `${target.projectRef}.supabase.co`) {
    throw new Error("Staging hostname does not match the project ref.");
  }
  validateRemoteOperation({
    environment: "staging",
    execute: false,
    manifest,
    operation: "read",
    provider: "supabase",
    target: {
      hostname: target.hostname,
      name: target.name,
      organizationId: manifest.supabase.organization.id,
      projectRef: target.projectRef,
    },
  });

  const expectedMigrations = localMigrations ?? (await readLocalMigrations());
  const migrationResult = await commandRunner("npx.cmd", [
    "supabase",
    "migration",
    "list",
    "--linked",
  ]);
  if (
    migrationResult.status !== 0 ||
    !sameValues(
      parseRemoteMigrationIds(migrationResult.stdout),
      expectedMigrations,
    )
  ) {
    throw new Error("Local and remote migrations are not aligned.");
  }

  const lintResult = await commandRunner("npx.cmd", [
    "supabase",
    "db",
    "lint",
    "--linked",
  ]);
  if (lintResult.status !== 0) throw new Error("Remote database lint failed.");

  const openApi = await managementClient.getDatabaseOpenApi(target.projectRef);
  assertSchemaContract(openApi);

  const authConfig = await managementClient.getAuthConfig(target.projectRef);
  if (!manifest.vercel.deploymentUrl) {
    throw new Error("The Vercel Preview URL is not registered.");
  }
  const expectedSiteUrl = manifest.vercel.deploymentUrl.replace(/\/$/, "");
  if (
    authConfig.disable_signup !== true ||
    authConfig.external_anonymous_users_enabled !== false ||
    authConfig.site_url?.replace(/\/$/, "") !== expectedSiteUrl ||
    authConfig.uri_allow_list !== `${expectedSiteUrl}/**`
  ) {
    throw new Error(
      "Public signup, anonymous users, or Vercel Preview Auth URLs are divergent.",
    );
  }

  const session = await anonymousClient.authenticate();
  const profile = await authenticatedClient.getOwnProfile();
  if (profile?.id !== session.userId || profile?.role !== "admin") {
    throw new Error("The authenticated staging profile is not the sole admin.");
  }

  for (const table of operationalTables) {
    if ((await authenticatedClient.countRows(table)) !== 0) {
      throw new Error("Staging contains unexpected operational data.");
    }
  }

  const grantResponse = await managementClient.runReadOnlyQuery(
    target.projectRef,
    {
      parameters: ["authenticated"],
      query:
        "select has_table_privilege($1, 'public.sales', 'insert') as sales_insert, has_table_privilege($1, 'public.sale_items', 'insert') as sale_items_insert, has_table_privilege($1, 'public.payments', 'insert') as payments_insert",
    },
  );
  const grantRows = Array.isArray(grantResponse)
    ? grantResponse
    : grantResponse.result;
  const grants = grantRows?.[0];
  if (
    !grants ||
    grants.sales_insert !== false ||
    grants.sale_items_insert !== false ||
    grants.payments_insert !== false
  ) {
    throw new Error("Authenticated role has a financial direct write grant.");
  }

  return {
    checks: [
      "migrations",
      "database-lint",
      "schema",
      "auth",
      "admin-profile",
      "empty-operational-data",
      "financial-grants",
    ],
    projectRef: target.projectRef,
    status: "passed",
  };
}

function parseRemoteMigrationIds(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.split("|")[1]?.match(/\b\d{14}\b/)?.[0])
    .filter(Boolean);
}

function sameValues(actual, expected) {
  return (
    actual.length === expected.length &&
    [...actual]
      .sort()
      .every((value, index) => value === [...expected].sort()[index])
  );
}

function assertSchemaContract(openApi) {
  const paths = new Set(Object.keys(openApi.paths ?? {}));
  const complete =
    requiredTables.every((table) => paths.has(`/${table}`)) &&
    requiredRpcs.every((rpc) => paths.has(`/rpc/${rpc}`));
  if (!complete) throw new Error("Remote schema contract is incomplete.");
}

async function readLocalMigrations() {
  return (await readdir(resolve("supabase/migrations")))
    .map((file) => file.match(/^(\d{14})_.*\.sql$/)?.[1])
    .filter(Boolean);
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: false });
  return {
    status: result.status ?? 1,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
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
    commandRunner: runCommand,
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
