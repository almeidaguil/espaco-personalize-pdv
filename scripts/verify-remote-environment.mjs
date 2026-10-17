import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  resolveRemoteTarget,
  validateRemoteOperation,
} from "./remote-environment-policy.mjs";

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
const requiredRpcs = [
  "open_cash_session_v3",
  "close_cash_session",
  "finalize_sale_v3",
  "finalize_sale_v4",
  "cancel_sale",
  "get_store_sales_report_v2",
];
const adminPredicate = `
  (exists (select 1
    from profiles
    where ((profiles.id = (select auth.uid() as uid))
      and (profiles.role = 'admin'::user_role))))
`;
const activeOwnProfilePredicate = `
  ((id = (select auth.uid() as uid))
  and (select current_user_is_active() as current_user_is_active))
`;
const activeAllowedSalePredicate = `
  ((select current_user_is_active() as current_user_is_active)
  and (
    (operator_id = (select auth.uid() as uid))
    or (select current_user_is_admin() as current_user_is_admin)
  ))
`;

export const requiredPolicyContract = Object.freeze([
  policy("profiles", "Admins can read operator profiles", "SELECT", {
    qual: "(select current_user_is_admin() as current_user_is_admin)",
  }),
  policy("profiles", "Active users can read own profile", "SELECT", {
    qual: activeOwnProfilePredicate,
  }),
  policy("profiles", "Active users can update own profile name", "UPDATE", {
    qual: activeOwnProfilePredicate,
    withCheck: activeOwnProfilePredicate,
  }),
  policy("categories", "Authenticated users can read categories", "SELECT", {
    qual: "true",
  }),
  policy("categories", "Admins can create categories", "INSERT", {
    withCheck: adminPredicate,
  }),
  policy("categories", "Admins can update categories", "UPDATE", {
    qual: adminPredicate,
    withCheck: adminPredicate,
  }),
  policy("categories", "Admins can delete categories", "DELETE", {
    qual: adminPredicate,
  }),
  policy("products", "Authenticated users can read products", "SELECT", {
    qual: "true",
  }),
  policy("products", "Admins can create products", "INSERT", {
    withCheck: adminPredicate,
  }),
  policy("products", "Admins can update products", "UPDATE", {
    qual: adminPredicate,
    withCheck: adminPredicate,
  }),
  policy("products", "Admins can delete products", "DELETE", {
    qual: adminPredicate,
  }),
  policy(
    "stock_movements",
    "Authenticated users can read stock movements",
    "SELECT",
    { qual: "true" },
  ),
  policy(
    "stock_movements",
    "Admins can create manual stock movements",
    "INSERT",
    {
      withCheck: `
        (((type)::text = any (
          array['initial_adjustment'::text, 'manual_adjustment'::text]
        ))
        and (sale_id is null)
        and ${adminPredicate})
      `,
    },
  ),
  policy(
    "cash_sessions",
    "Active users can read allowed cash sessions",
    "SELECT",
    { qual: activeAllowedSalePredicate },
  ),
  policy("sales", "Active users can read allowed sales", "SELECT", {
    qual: activeAllowedSalePredicate,
  }),
  policy(
    "sale_items",
    "Active users can read items from allowed sales",
    "SELECT",
    {
      qual: `
        ((select current_user_is_active() as current_user_is_active)
        and (exists (
          select 1
          from sales
          where (sales.id = sale_items.sale_id)
        )))
      `,
    },
  ),
  policy(
    "payments",
    "Active users can read payments from allowed sales",
    "SELECT",
    {
      qual: `
        ((select current_user_is_active() as current_user_is_active)
        and (exists (
          select 1
          from sales
          where (sales.id = payments.sale_id)
        )))
      `,
    },
  ),
]);

export async function verifyRemoteEnvironment({
  authPolicy = /** @type {any} */ (undefined),
  environment,
  logger = () => {},
  manifest,
  runCommand,
  supabase,
  vercel,
}) {
  void vercel;
  if (!["staging", "production"].includes(environment)) {
    throw new Error("Unsupported remote verification environment.");
  }
  const target = resolveRemoteTarget(manifest, {
    environment,
    provider: "supabase",
  });
  if (!target.projectRef) {
    throw new Error(`The ${environment} project ref is missing.`);
  }
  if (target.hostname !== `${target.projectRef}.supabase.co`) {
    throw new Error(
      `${capitalize(environment)} hostname does not match the project ref.`,
    );
  }
  validateRemoteOperation({
    environment,
    execute: false,
    manifest,
    operation: "read",
    provider: "supabase",
    target: {
      hostname: target.hostname,
      name: target.name,
      organizationId: target.organizationId,
      projectRef: target.projectRef,
    },
  });
  if (supabase.linkedProjectRef?.trim() !== target.projectRef) {
    throw new Error(
      `The local Supabase link does not match the ${environment} project ref.`,
    );
  }

  const expectedMigrations =
    supabase.localMigrations ?? (await readLocalMigrations());
  const migrationResult = await runCommand("npx.cmd", [
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

  const policyRows = await supabase.managementClient.runReadOnlyQuery(
    target.projectRef,
    {
      query: `
        select
          tablename,
          policyname,
          permissive,
          cmd,
          to_jsonb(roles) as roles,
          qual,
          with_check,
          true as policy_contract_row
        from pg_catalog.pg_policies
        where schemaname = 'public'
          and tablename in (
            'profiles', 'categories', 'products', 'stock_movements',
            'cash_sessions', 'sales', 'sale_items', 'payments'
          )
        order by tablename, policyname
      `,
    },
  );
  if (!policyContractsMatch(requiredPolicyContract, queryRows(policyRows))) {
    throw new Error(`${capitalize(environment)} policy contract is divergent.`);
  }

  const lintResult = await runCommand("npx.cmd", [
    "supabase",
    "db",
    "lint",
    "--linked",
  ]);
  if (lintResult.status !== 0) throw new Error("Remote database lint failed.");

  const openApi = await supabase.managementClient.getDatabaseOpenApi(
    target.projectRef,
  );
  assertSchemaContract(openApi);

  const saleDiscountContract = firstQueryRow(
    await supabase.managementClient.runReadOnlyQuery(target.projectRef, {
      query: `
        select
          count(*) filter (
            where columns.column_name in (
              'subtotal_in_cents', 'discount_in_cents', 'total_in_cents'
            )
          )::integer as sales_financial_column_count,
          has_function_privilege(
            'authenticated',
            'public.finalize_sale_v3(uuid,uuid,jsonb,jsonb)',
            'execute'
          ) as authenticated_finalize_v3_execute,
          has_function_privilege(
            'authenticated',
            'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)',
            'execute'
          ) as authenticated_finalize_v4_execute,
          has_function_privilege(
            'anon',
            'public.finalize_sale_v4(uuid,uuid,jsonb,jsonb,integer)',
            'execute'
          ) as anon_finalize_v4_execute,
          true as sale_discount_contract_row
        from information_schema.columns
        where columns.table_schema = 'public'
          and columns.table_name = 'sales'
      `,
    }),
  );
  if (
    saleDiscountContract?.sales_financial_column_count !== 3 ||
    saleDiscountContract.authenticated_finalize_v3_execute !== true ||
    saleDiscountContract.authenticated_finalize_v4_execute !== true ||
    saleDiscountContract.anon_finalize_v4_execute !== false
  ) {
    throw new Error(
      `${capitalize(environment)} sale discount contract is divergent.`,
    );
  }

  const authConfig = await supabase.managementClient.getAuthConfig(
    target.projectRef,
  );
  const vercelTarget = resolveRemoteTarget(manifest, {
    environment,
    provider: "vercel",
  });
  if (!vercelTarget.siteUrl) {
    throw new Error(`The Vercel ${environment} URL is not registered.`);
  }
  const expectedSiteUrl = vercelTarget.siteUrl.replace(/\/$/, "");
  if (
    authConfig.disable_signup !== true ||
    authConfig.external_anonymous_users_enabled !== false ||
    authConfig.site_url?.replace(/\/$/, "") !== expectedSiteUrl ||
    authConfig.uri_allow_list !== `${expectedSiteUrl}/**`
  ) {
    throw new Error(
      `Public signup, anonymous users, or Vercel ${environment} Auth URLs are divergent.`,
    );
  }
  if (
    environment === "production" &&
    (authConfig.external_email_enabled !== true ||
      !matchesLeakedPasswordProtection(authConfig, authPolicy) ||
      authConfig.password_min_length !== 14)
  ) {
    throw new Error("Production Auth password policy is divergent.");
  }

  const checks = [
    "linked-project",
    "migrations",
    "database-lint",
    "schema",
    "sale-discount-contract",
  ];
  if (
    environment === "production" &&
    authPolicy?.leakedPasswordProtection === "unavailable-free-plan"
  ) {
    checks.push("auth-hibp-unavailable-free-plan");
  }
  if (environment === "production") {
    const extensions = firstQueryRow(
      await supabase.managementClient.runReadOnlyQuery(target.projectRef, {
        query:
          "select count(*)::integer as extension_count from pg_extension where extname in ('pgcrypto', 'uuid-ossp')",
      }),
    );
    if (extensions?.extension_count !== 2) {
      throw new Error("Required production extensions are not installed.");
    }
    checks.push("extensions");
  }
  checks.push("auth");

  const rlsSummary = firstQueryRow(
    await supabase.managementClient.runReadOnlyQuery(target.projectRef, {
      query: `
        select
          count(*)::integer as table_count,
          count(*) filter (where tables.relrowsecurity)::integer as rls_enabled_table_count,
          count(*) filter (
            where exists (
              select 1 from pg_catalog.pg_policy policies
              where policies.polrelid = tables.oid
            )
          )::integer as tables_with_policies_count
        from pg_catalog.pg_class tables
        join pg_catalog.pg_namespace schemas on schemas.oid = tables.relnamespace
        where schemas.nspname = 'public'
          and tables.relkind in ('r', 'p')
          and tables.relname in (
            'profiles', 'categories', 'products', 'stock_movements',
            'cash_sessions', 'sales', 'sale_items', 'payments'
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
      `RLS and policies are not enabled on every required ${environment} table.`,
    );
  }

  const session = await supabase.anonymousClient.authenticate();
  const profile = await supabase.authenticatedClient.getOwnProfile();
  if (profile?.id !== session.userId || profile?.role !== "admin") {
    throw new Error(
      `The authenticated ${environment} profile is not the sole admin.`,
    );
  }

  const userSummary = firstQueryRow(
    await supabase.managementClient.runReadOnlyQuery(target.projectRef, {
      query: `
        select
          (select count(*)::integer from auth.users) as auth_user_count,
          count(*)::integer as profile_count,
          count(*) filter (where profiles.role = 'admin')::integer as admin_profile_count,
          count(*) filter (where profiles.role <> 'admin')::integer as non_admin_profile_count,
          count(*) filter (
            where exists (select 1 from auth.users where auth.users.id = profiles.id)
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
      `${capitalize(environment)} must contain exactly one admin and no other users.`,
    );
  }

  const operationalSummary = firstQueryRow(
    await supabase.managementClient.runReadOnlyQuery(target.projectRef, {
      query: `
        select (
          (select count(*) from public.categories) +
          (select count(*) from public.products) +
          (select count(*) from public.stock_movements) +
          (select count(*) from public.cash_sessions) +
          (select count(*) from public.sales) +
          (select count(*) from public.sale_items) +
          (select count(*) from public.payments)
        )::integer as operational_row_count
      `,
    }),
  );
  if (operationalSummary?.operational_row_count !== 0) {
    throw new Error(
      `${capitalize(environment)} contains unexpected operational data.`,
    );
  }

  const grants = firstQueryRow(
    await supabase.managementClient.runReadOnlyQuery(target.projectRef, {
      parameters: ["authenticated"],
      query:
        "select has_table_privilege($1, 'public.sales', 'insert') as sales_insert, has_table_privilege($1, 'public.sale_items', 'insert') as sale_items_insert, has_table_privilege($1, 'public.payments', 'insert') as payments_insert",
    }),
  );
  if (
    !grants ||
    grants.sales_insert !== false ||
    grants.sale_items_insert !== false ||
    grants.payments_insert !== false
  ) {
    throw new Error("Authenticated role has a financial direct write grant.");
  }

  checks.push(
    "rls-policies",
    "admin-profile",
    "user-inventory",
    "empty-operational-data",
    "financial-grants",
  );
  const report = {
    checks,
    environment,
    projectRef: target.projectRef,
    status: "passed",
  };
  logger(report);
  return report;
}

function matchesLeakedPasswordProtection(authConfig, authPolicy) {
  const expected = authPolicy?.leakedPasswordProtection ?? "enabled";
  if (!["enabled", "unavailable-free-plan"].includes(expected)) return false;
  return authConfig.password_hibp_enabled === (expected === "enabled");
}

function firstQueryRow(response) {
  const rows = queryRows(response);
  return rows?.[0];
}

function queryRows(response) {
  return Array.isArray(response) ? response : response?.result;
}

export function policyContractsMatch(expectedPolicies, actualPolicies) {
  if (!Array.isArray(expectedPolicies) || !Array.isArray(actualPolicies)) {
    return false;
  }

  const expectedFingerprints = expectedPolicies.map(policyFingerprint);
  const actualFingerprints = actualPolicies.map(policyFingerprint);
  if (
    expectedFingerprints.includes(null) ||
    actualFingerprints.includes(null) ||
    expectedFingerprints.length !== actualFingerprints.length
  ) {
    return false;
  }

  expectedFingerprints.sort();
  actualFingerprints.sort();
  return actualFingerprints.every(
    (fingerprint, index) => fingerprint === expectedFingerprints[index],
  );
}

function policyFingerprint(policyRow) {
  if (
    !policyRow ||
    typeof policyRow.tablename !== "string" ||
    typeof policyRow.policyname !== "string" ||
    typeof policyRow.cmd !== "string"
  ) {
    return null;
  }

  const roles = normalizeRoles(policyRow.roles);
  const permissive = normalizePermissive(policyRow.permissive);
  const qual = normalizePolicyExpression(policyRow.qual);
  const withCheck = normalizePolicyExpression(policyRow.with_check);
  if (!roles || !permissive || qual === undefined || withCheck === undefined) {
    return null;
  }

  const canonicalPolicy = JSON.stringify({
    cmd: policyRow.cmd.toUpperCase(),
    permissive,
    policyname: policyRow.policyname,
    qual,
    roles,
    tablename: policyRow.tablename,
    withCheck,
  });
  return createHash("sha256").update(canonicalPolicy).digest("hex");
}

function normalizeRoles(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((role) => typeof role === "string" && role.length > 0)) {
    return null;
  }
  return [...value].sort();
}

function normalizePermissive(value) {
  return ["PERMISSIVE", "RESTRICTIVE"].includes(value) ? value : null;
}

function normalizePolicyExpression(value) {
  if (value === null) return null;
  if (typeof value !== "string" || value.trim() === "") return undefined;

  let canonical = "";
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      canonical += character;
      if (character === quote) {
        if (value[index + 1] === quote) {
          canonical += value[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      canonical += character;
    } else if (!/\s/u.test(character)) {
      canonical += character.toLowerCase();
    }
  }

  return quote ? undefined : canonical;
}

function policy(tablename, policyname, cmd, { qual = null, withCheck = null }) {
  return Object.freeze({
    cmd,
    permissive: "PERMISSIVE",
    policyname,
    qual,
    roles: Object.freeze(["authenticated"]),
    tablename,
    with_check: withCheck,
  });
}

function parseRemoteMigrationIds(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.split("|")[1]?.match(/\b\d{14}\b/)?.[0])
    .filter(Boolean);
}

function sameValues(actual, expected) {
  const sortedExpected = [...expected].sort();
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === sortedExpected[index])
  );
}

function assertSchemaContract(openApi) {
  const paths = new Set(Object.keys(openApi.paths ?? {}));
  if (
    !requiredTables.every((table) => paths.has(`/${table}`)) ||
    !requiredRpcs.every((rpc) => paths.has(`/rpc/${rpc}`))
  ) {
    throw new Error("Remote schema contract is incomplete.");
  }
}

async function readLocalMigrations() {
  return (await readdir(resolve("supabase/migrations")))
    .map((file) => file.match(/^(\d{14})_.*\.sql$/)?.[1])
    .filter(Boolean);
}

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}
