import { expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { verifyRemoteEnvironment } from "./verify-remote-environment.mjs";

const projectRef = "abcdefghijklmnopqrst";
const migrations = ["20261002050000", "20261003120000"];

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
      supabase: supabaseFixture({ policyContractMatches: false }),
      vercel: {},
    }),
  ).rejects.toThrow(/policy contract/i);
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
  policyContractMatches = true,
  siteUrl = "https://roberto-multimarcas-pdv.vercel.app",
} = {}) {
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
              rls_enabled_table_count: 8,
              table_count: 8,
              tables_with_policies_count: 8,
            },
          ];
        }
        if (query.includes("policy_contract_matches")) {
          return [{ policy_contract_matches: policyContractMatches }];
        }
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
