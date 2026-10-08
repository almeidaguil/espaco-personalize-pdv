import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
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
import { runCliCommand } from "./run-cli-command.mjs";

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
  linkedProjectRef,
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
  if (linkedProjectRef?.trim() !== target.projectRef) {
    throw new Error(
      "The local Supabase link does not match the staging project ref.",
    );
  }

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
  if (!manifest.vercel.siteUrl) {
    throw new Error("The Vercel staging URL is not registered.");
  }
  const expectedSiteUrl = manifest.vercel.siteUrl.replace(/\/$/, "");
  if (
    authConfig.disable_signup !== true ||
    authConfig.external_anonymous_users_enabled !== false ||
    authConfig.site_url?.replace(/\/$/, "") !== expectedSiteUrl ||
    authConfig.uri_allow_list !== `${expectedSiteUrl}/**`
  ) {
    throw new Error(
      "Public signup, anonymous users, or Vercel staging Auth URLs are divergent.",
    );
  }

  const rlsSummary = firstQueryRow(
    await managementClient.runReadOnlyQuery(target.projectRef, {
      query: `
        select
          count(*)::integer as table_count,
          count(*) filter (where tables.relrowsecurity)::integer
            as rls_enabled_table_count,
          count(*) filter (
            where exists (
              select 1
              from pg_catalog.pg_policy policies
              where policies.polrelid = tables.oid
            )
          )::integer as tables_with_policies_count
        from pg_catalog.pg_class tables
        join pg_catalog.pg_namespace schemas
          on schemas.oid = tables.relnamespace
        where schemas.nspname = 'public'
          and tables.relkind in ('r', 'p')
          and tables.relname in (
            'profiles',
            'categories',
            'products',
            'stock_movements',
            'cash_sessions',
            'sales',
            'sale_items',
            'payments'
          )
      `,
    }),
  );
  if (
    rlsSummary?.table_count !== requiredTables.length ||
    rlsSummary.rls_enabled_table_count !== requiredTables.length ||
    rlsSummary.tables_with_policies_count !== requiredTables.length
  ) {
    throw new Error(
      "RLS and policies are not enabled on every required staging table.",
    );
  }

  const session = await anonymousClient.authenticate();
  const profile = await authenticatedClient.getOwnProfile();
  if (profile?.id !== session.userId || profile?.role !== "admin") {
    throw new Error("The authenticated staging profile is not the sole admin.");
  }

  const userSummary = firstQueryRow(
    await managementClient.runReadOnlyQuery(target.projectRef, {
      query: `
        select
          (select count(*)::integer from auth.users) as auth_user_count,
          count(*)::integer as profile_count,
          count(*) filter (where profiles.role = 'admin')::integer
            as admin_profile_count,
          count(*) filter (where profiles.role <> 'admin')::integer
            as non_admin_profile_count,
          count(*) filter (
            where exists (
              select 1
              from auth.users
              where auth.users.id = profiles.id
            )
          )::integer as profiles_linked_to_auth_count
        from public.profiles
      `,
    }),
  );
  if (
    userSummary?.auth_user_count !== 1 ||
    userSummary.profile_count !== 1 ||
    userSummary.admin_profile_count !== 1 ||
    userSummary.non_admin_profile_count !== 0 ||
    userSummary.profiles_linked_to_auth_count !== 1
  ) {
    throw new Error(
      "Staging must contain exactly one admin and no other users.",
    );
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
  const grants = firstQueryRow(grantResponse);
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
      "linked-project",
      "migrations",
      "database-lint",
      "schema",
      "auth",
      "rls-policies",
      "admin-profile",
      "user-inventory",
      "empty-operational-data",
      "financial-grants",
    ],
    projectRef: target.projectRef,
    status: "passed",
  };
}

function firstQueryRow(response) {
  const rows = Array.isArray(response) ? response : response?.result;
  return rows?.[0];
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
