import { expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import {
  policyContractsMatch,
  verifyRemoteEnvironment,
} from "./verify-remote-environment.mjs";

const projectRef = "abcdefghijklmnopqrst";
const migrations = ["20261002050000", "20261003120000"];

type PolicyRow = {
  cmd: string;
  permissive: "PERMISSIVE" | "RESTRICTIVE";
  policyname: string;
  qual: string | null;
  roles: string[];
  tablename: string;
  with_check: string | null;
};

test("preserves the complete staging database verification contract", async () => {
  const manifest = structuredClone(manifestFixture);
  manifest.supabase.targets.staging.projectRef = projectRef;
  manifest.supabase.targets.staging.hostname = `${projectRef}.supabase.co`;
  const result = await verifyRemoteEnvironment({
    environment: "staging",
    manifest,
    runCommand: commandRunner(),
    supabase: supabaseFixture({
      siteUrl: manifest.vercel.targets.staging.siteUrl,
    }),
    vercel: {},
  });

  expect(result).toEqual({
    checks: [
      "linked-project",
      "migrations",
      "database-lint",
      "schema",
      "sale-discount-contract",
      "split-payment-contract",
      "auth",
      "rls-policies",
      "admin-profile",
      "user-inventory",
      "empty-operational-data",
      "financial-grants",
    ],
    environment: "staging",
    projectRef,
    status: "passed",
  });
});

test("rejects a missing production extension and redacts credentials from logs", async () => {
  const manifest = productionManifest();
  const logger = vi.fn();
  const supabase = supabaseFixture({ extensionCount: 1 });

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      logger,
      manifest,
      runCommand: commandRunner(),
      supabase,
      vercel: {},
    }),
  ).rejects.toThrow(/extensions/i);
  expect(JSON.stringify(logger.mock.calls)).not.toContain("secret-sentinel");
});

test("rejects a weakened production password policy", async () => {
  const manifest = productionManifest();

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      manifest,
      runCommand: commandRunner(),
      supabase: supabaseFixture({
        authConfig: { password_hibp_enabled: false, password_min_length: 8 },
      }),
      vercel: {},
    }),
  ).rejects.toThrow(/password policy/i);
});

test("uses authoritative management counts instead of RLS-filtered client counts", async () => {
  const manifest = productionManifest();
  const supabase = supabaseFixture({ operationalRowCount: 1 });

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      manifest,
      runCommand: commandRunner(),
      supabase,
      vercel: {},
    }),
  ).rejects.toThrow(/operational data/i);
  expect(supabase.authenticatedClient.countRows).not.toHaveBeenCalled();
});

test("rejects a divergent policy contract even when every table has a policy", async () => {
  const manifest = productionManifest();

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      manifest,
      runCommand: commandRunner(),
      supabase: supabaseFixture({ policies: expectedPolicyRows().slice(1) }),
      vercel: {},
    }),
  ).rejects.toThrow(/policy contract/i);
});

test("rejects a divergent sale discount schema or execution grant", async () => {
  const manifest = productionManifest();

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      manifest,
      runCommand: commandRunner(),
      supabase: supabaseFixture({
        saleDiscountContract: {
          anon_finalize_v4_execute: true,
          authenticated_finalize_v3_execute: true,
          authenticated_finalize_v4_execute: true,
          sales_financial_column_count: 3,
        },
      }),
      vercel: {},
    }),
  ).rejects.toThrow(/sale discount contract/i);
});

test("rejects a divergent split payment schema or execution grant", async () => {
  const manifest = productionManifest();

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      manifest,
      runCommand: commandRunner(),
      supabase: supabaseFixture({
        splitPaymentContract: {
          anon_close_v2_execute: false,
          anon_finalize_v5_execute: false,
          authenticated_close_v2_execute: true,
          authenticated_finalize_v5_execute: true,
          authenticated_legacy_close_execute: true,
          authenticated_payment_helper_execute: true,
          authenticated_reconciliation_select: true,
          authenticated_reconciliation_writes_blocked: true,
          close_v2_exists: true,
          finalize_v5_exists: true,
          payment_installment_column_count: 1,
        },
      }),
      vercel: {},
    }),
  ).rejects.toThrow(/split payment contract/i);
});

test("rejects a policy with the expected identity but a weakened predicate", async () => {
  const manifest = productionManifest();
  const policies = expectedPolicyRows().map((policy) =>
    policy.policyname === "Active users can read allowed sales"
      ? {
          ...policy,
          qual: `
            operator_id = (select auth.uid())
            or (select public.current_user_is_admin())
          `,
        }
      : policy,
  );

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      manifest,
      runCommand: commandRunner(),
      supabase: supabaseFixture({ policies }),
      vercel: {},
    }),
  ).rejects.toThrow(/policy contract/i);
});

test("rejects a restrictive policy when the contract requires permissive", async () => {
  const manifest = productionManifest();
  const policies = expectedPolicyRows().map((policy) =>
    policy.policyname === "Active users can read allowed sales"
      ? { ...policy, permissive: "RESTRICTIVE" as const }
      : policy,
  );

  await expect(
    verifyRemoteEnvironment({
      environment: "production",
      manifest,
      runCommand: commandRunner(),
      supabase: supabaseFixture({ policies }),
      vercel: {},
    }),
  ).rejects.toThrow(/policy contract/i);
});

test("compares complete policy fingerprints independently of SQL formatting", () => {
  const reformattedPolicies = expectedPolicyRows().map((policy) => ({
    ...policy,
    cmd: policy.cmd.toLowerCase(),
    qual:
      policy.qual === null
        ? null
        : policy.qual
            .replaceAll("select", "SeLeCt")
            .replaceAll("and", "AnD")
            .replaceAll("or", "oR")
            .replace(/\s+/gu, "   "),
    with_check:
      policy.with_check === null
        ? null
        : policy.with_check
            .replaceAll("select", "SeLeCt")
            .replaceAll("and", "AnD")
            .replaceAll("or", "oR")
            .replace(/\s+/gu, "\n"),
  }));

  expectedPolicyRows().forEach((expectedPolicy, index) => {
    expect(
      policyContractsMatch([expectedPolicy], [reformattedPolicies[index]]),
      expectedPolicy.policyname,
    ).toBe(true);
  });
});

function productionManifest() {
  const manifest = structuredClone(manifestFixture);
  Object.assign(manifest.supabase.targets.production, {
    hostname: `${projectRef}.supabase.co`,
    projectRef,
  });
  Object.assign(manifest.vercel.targets.production, {
    deploymentId: "dpl_Production123",
    deploymentUrl: "https://roberto-production-build.vercel.app",
  });
  return manifest;
}

function commandRunner() {
  return vi.fn(async (_command, args) => ({
    status: 0,
    stderr: "",
    stdout: args.includes("migration")
      ? migrations.map((id) => `${id} | ${id}`).join("\n")
      : "No schema errors found",
  }));
}

function supabaseFixture({
  authConfig = {},
  extensionCount = 2,
  operationalRowCount = 0,
  policies = expectedPolicyRows(),
  saleDiscountContract = {
    anon_finalize_v4_execute: false,
    authenticated_finalize_v3_execute: true,
    authenticated_finalize_v4_execute: true,
    sales_financial_column_count: 3,
  },
  splitPaymentContract = {
    anon_close_v2_execute: false,
    anon_finalize_v5_execute: false,
    authenticated_close_v2_execute: true,
    authenticated_finalize_v5_execute: true,
    authenticated_legacy_close_execute: true,
    authenticated_payment_helper_execute: false,
    authenticated_reconciliation_select: true,
    authenticated_reconciliation_writes_blocked: true,
    close_v2_exists: true,
    finalize_v5_exists: true,
    payment_installment_column_count: 1,
  },
  siteUrl = "https://roberto-multimarcas-pdv.vercel.app",
}: {
  authConfig?: Record<string, unknown>;
  extensionCount?: number;
  operationalRowCount?: number;
  policies?: PolicyRow[];
  saleDiscountContract?: Record<string, boolean | number>;
  splitPaymentContract?: Record<string, boolean | number>;
  siteUrl?: string;
} = {}) {
  const requiredTables = [
    "profiles",
    "categories",
    "products",
    "stock_movements",
    "cash_sessions",
    "cash_session_reconciliations",
    "sales",
    "sale_items",
    "payments",
  ];
  const requiredRpcs = [
    "open_cash_session_v3",
    "close_cash_session",
    "close_cash_session_v2",
    "finalize_sale_v3",
    "finalize_sale_v4",
    "finalize_sale_v5",
    "cancel_sale",
    "get_store_sales_report_v2",
  ];
  return {
    anonymousClient: {
      authenticate: vi.fn().mockResolvedValue({ userId: "admin-id" }),
    },
    authenticatedClient: {
      countRows: vi.fn().mockResolvedValue(0),
      getOwnProfile: vi
        .fn()
        .mockResolvedValue({ id: "admin-id", role: "admin" }),
    },
    linkedProjectRef: projectRef,
    localMigrations: migrations,
    managementClient: {
      getAuthConfig: vi.fn().mockResolvedValue({
        disable_signup: true,
        external_anonymous_users_enabled: false,
        external_email_enabled: true,
        password_hibp_enabled: true,
        password_min_length: 14,
        site_url: siteUrl,
        uri_allow_list: `${siteUrl}/**`,
        ...authConfig,
      }),
      getDatabaseOpenApi: vi.fn().mockResolvedValue({
        paths: Object.fromEntries([
          ...requiredTables.map((name) => [`/${name}`, {}]),
          ...requiredRpcs.map((name) => [`/rpc/${name}`, {}]),
        ]),
      }),
      runReadOnlyQuery: vi.fn(async (_ref, { query }) => {
        if (query.includes("pg_extension"))
          return [{ extension_count: extensionCount }];
        if (query.includes("pg_catalog.pg_class")) {
          return [
            {
              rls_enabled_table_count: 9,
              table_count: 9,
              tables_with_policies_count: 9,
            },
          ];
        }
        if (query.includes("policy_contract_row")) return policies;
        if (query.includes("sale_discount_contract_row"))
          return [saleDiscountContract];
        if (query.includes("split_payment_contract_row"))
          return [splitPaymentContract];
        if (query.includes("auth.users")) {
          return [
            {
              admin_profile_count: 1,
              auth_user_count: 1,
              non_admin_profile_count: 0,
              profile_count: 1,
              profiles_linked_to_auth_count: 1,
            },
          ];
        }
        if (query.includes("operational_row_count")) {
          return [{ operational_row_count: operationalRowCount }];
        }
        return [
          {
            payments_insert: false,
            sale_items_insert: false,
            sales_insert: false,
          },
        ];
      }),
    },
  };
}

function expectedPolicyRows(): PolicyRow[] {
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
  const activeAllowedReconciliationPredicate = `
    ((select current_user_is_active() as current_user_is_active)
    and (exists (
      select 1
      from cash_sessions
      where ((cash_sessions.id = cash_session_reconciliations.cash_session_id)
        and (
          (cash_sessions.operator_id = (select auth.uid() as uid))
          or (select current_user_is_admin() as current_user_is_admin)
        ))
    )))
  `;

  return [
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
    policy(
      "cash_session_reconciliations",
      "Active users can read allowed cash reconciliations",
      "SELECT",
      { qual: activeAllowedReconciliationPredicate },
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
  ];
}

function policy(
  tablename: string,
  policyname: string,
  cmd: string,
  {
    qual = null,
    withCheck = null,
  }: { qual?: string | null; withCheck?: string | null },
): PolicyRow {
  return {
    cmd,
    permissive: "PERMISSIVE",
    policyname,
    qual,
    roles: ["authenticated"],
    tablename,
    with_check: withCheck,
  };
}
