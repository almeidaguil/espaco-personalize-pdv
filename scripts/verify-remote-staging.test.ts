import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import {
  runRemoteCommand,
  verifyRemoteStaging,
} from "./verify-remote-staging.mjs";

const projectRef = "qrstabcdefghijklmnop";
const manifest = createManifest();
const migrationIds = ["20261002050000", "20261003120000", "20261005143000"];
const tables = [
  "profiles",
  "categories",
  "products",
  "stock_movements",
  "cash_sessions",
  "sales",
  "sale_items",
  "payments",
];
const rpcs = [
  "open_cash_session_v3",
  "close_cash_session",
  "finalize_sale_v3",
  "cancel_sale",
  "get_store_sales_report_v2",
];

describe("verifyRemoteStaging", () => {
  test("runs Windows CLI commands through the shared command runner", () => {
    const spawn = vi.fn().mockReturnValue({
      status: 0,
      stderr: "",
      stdout: "migration-list",
    });

    expect(
      runRemoteCommand(
        "npx.cmd",
        ["supabase", "migration", "list", "--linked"],
        { commandInterpreter: "C:\\Windows\\System32\\cmd.exe" },
        { platform: "win32", spawn },
      ),
    ).toEqual({ status: 0, stderr: "", stdout: "migration-list" });
    expect(spawn).toHaveBeenCalledWith(
      "C:\\Windows\\System32\\cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "npx.cmd",
        "supabase",
        "migration",
        "list",
        "--linked",
      ],
      expect.objectContaining({ shell: false }),
    );
  });

  test.each([
    [
      "missing target ref",
      createManifestWithoutStagingRef(),
      /staging project ref/i,
    ],
    [
      "divergent hostname",
      createManifest("abcdefghijklmnopqrst.supabase.co"),
      /hostname.*project ref/i,
    ],
  ])(
    "rejects %s before remote checks",
    async (_name, selectedManifest, error) => {
      const managementClient = createManagementClient();
      await expect(
        verifyRemoteStaging({
          anonymousClient: createAnonymousClient(),
          authenticatedClient: createAuthenticatedClient(),
          commandRunner: createCommandRunner(),
          linkedProjectRef: projectRef,
          localMigrations: migrationIds,
          managementClient,
          manifest: selectedManifest,
        }),
      ).rejects.toThrow(error);
      expect(managementClient.getAuthConfig).not.toHaveBeenCalled();
    },
  );

  test.each([
    ["missing", undefined],
    ["divergent", "abcdefghijklmnopqrst"],
  ])(
    "rejects a %s local Supabase link before linked CLI commands",
    async (_name, linkedProjectRef) => {
      const commandRunner = createCommandRunner();

      await expect(
        verifyRemoteStaging({
          anonymousClient: createAnonymousClient(),
          authenticatedClient: createAuthenticatedClient(),
          commandRunner,
          linkedProjectRef,
          localMigrations: migrationIds,
          managementClient: createManagementClient(),
          manifest,
        }),
      ).rejects.toThrow(/local Supabase link.*staging project ref/i);
      expect(commandRunner).not.toHaveBeenCalled();
    },
  );

  test("rejects migrations that are not aligned", async () => {
    await expect(
      verifyRemoteStaging({
        anonymousClient: createAnonymousClient(),
        authenticatedClient: createAuthenticatedClient(),
        commandRunner: createCommandRunner({
          migrationsOutput: "20261002050000 | 20261002050000",
        }),
        linkedProjectRef: projectRef,
        localMigrations: migrationIds,
        managementClient: createManagementClient(),
        manifest,
      }),
    ).rejects.toThrow(/migrations.*not aligned/i);
  });

  test("rejects enabled public signup", async () => {
    const managementClient = createManagementClient({
      authConfig: {
        disable_signup: false,
        external_anonymous_users_enabled: false,
      },
    });

    await expect(
      verifyRemoteStaging({
        anonymousClient: createAnonymousClient(),
        authenticatedClient: createAuthenticatedClient(),
        commandRunner: createCommandRunner(),
        linkedProjectRef: projectRef,
        localMigrations: migrationIds,
        managementClient,
        manifest,
      }),
    ).rejects.toThrow(/public signup/i);
  });

  test.each([
    ["table", { tables: tables.filter((table) => table !== "payments"), rpcs }],
    ["RPC", { tables, rpcs: rpcs.filter((rpc) => rpc !== "finalize_sale_v3") }],
  ])("rejects a missing required %s", async (_name, schema) => {
    const managementClient = createManagementClient({ schema });
    await expect(
      verifyRemoteStaging({
        anonymousClient: createAnonymousClient(),
        authenticatedClient: createAuthenticatedClient(),
        commandRunner: createCommandRunner(),
        linkedProjectRef: projectRef,
        localMigrations: migrationIds,
        managementClient,
        manifest,
      }),
    ).rejects.toThrow(/schema contract/i);
  });

  test("rejects financial insert grants and unexpected operational data", async () => {
    const writableManagementClient = createManagementClient({
      grants: [
        {
          payments_insert: false,
          sale_items_insert: false,
          sales_insert: true,
        },
      ],
    });
    await expect(
      verifyRemoteStaging({
        anonymousClient: createAnonymousClient(),
        authenticatedClient: createAuthenticatedClient(),
        commandRunner: createCommandRunner(),
        linkedProjectRef: projectRef,
        localMigrations: migrationIds,
        managementClient: writableManagementClient,
        manifest,
      }),
    ).rejects.toThrow(/financial direct write/i);

    const dataClient = createAuthenticatedClient({ products: 1 });
    await expect(
      verifyRemoteStaging({
        anonymousClient: createAnonymousClient(),
        authenticatedClient: dataClient,
        commandRunner: createCommandRunner(),
        linkedProjectRef: projectRef,
        localMigrations: migrationIds,
        managementClient: createManagementClient({ operationalRowCount: 1 }),
        manifest,
      }),
    ).rejects.toThrow(/unexpected operational data/i);
    expect(dataClient.countRows).not.toHaveBeenCalled();
  });

  test.each([
    [
      "RLS disabled",
      {
        rls_enabled_table_count: 7,
        table_count: 8,
        tables_with_policies_count: 8,
      },
    ],
    [
      "missing policies",
      {
        rls_enabled_table_count: 8,
        table_count: 8,
        tables_with_policies_count: 7,
      },
    ],
  ])("rejects %s on the required tables", async (_name, rlsSummary) => {
    await expect(
      verifyRemoteStaging({
        anonymousClient: createAnonymousClient(),
        authenticatedClient: createAuthenticatedClient(),
        commandRunner: createCommandRunner(),
        linkedProjectRef: projectRef,
        localMigrations: migrationIds,
        managementClient: createManagementClient({ rlsSummary }),
        manifest,
      }),
    ).rejects.toThrow(/RLS.*policies/i);
  });

  test.each([
    [
      "an extra Auth user",
      {
        admin_profile_count: 1,
        auth_user_count: 2,
        non_admin_profile_count: 0,
        profile_count: 1,
        profiles_linked_to_auth_count: 1,
      },
    ],
    [
      "an operator profile",
      {
        admin_profile_count: 1,
        auth_user_count: 2,
        non_admin_profile_count: 1,
        profile_count: 2,
        profiles_linked_to_auth_count: 2,
      },
    ],
  ])("rejects staging with %s", async (_name, userSummary) => {
    await expect(
      verifyRemoteStaging({
        anonymousClient: createAnonymousClient(),
        authenticatedClient: createAuthenticatedClient(),
        commandRunner: createCommandRunner(),
        linkedProjectRef: projectRef,
        localMigrations: migrationIds,
        managementClient: createManagementClient({ userSummary }),
        manifest,
      }),
    ).rejects.toThrow(/exactly one admin.*no other users/i);
  });

  test("returns a redacted report when all remote checks pass", async () => {
    const email = "owner@private.example";
    const userId = "00000000-0000-4000-8000-000000000001";
    const secret = "secret-key-sentinel";
    const result = await verifyRemoteStaging({
      anonymousClient: createAnonymousClient(userId),
      authenticatedClient: createAuthenticatedClient({}, userId),
      commandRunner: createCommandRunner(),
      linkedProjectRef: projectRef,
      localMigrations: migrationIds,
      managementClient: createManagementClient({
        secret,
        userSummary: {
          admin_profile_count: 1,
          auth_user_count: 1,
          email,
          non_admin_profile_count: 0,
          profile_count: 1,
          profiles_linked_to_auth_count: 1,
          user_id: userId,
        },
      }),
      manifest,
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
      projectRef,
      status: "passed",
    });
    expect(JSON.stringify(result)).not.toContain(email);
    expect(JSON.stringify(result)).not.toContain(userId);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

function createManifest(hostname = `${projectRef}.supabase.co`) {
  const value = {
    ...manifestFixture,
    vercel: {
      ...manifestFixture.vercel,
      targets: {
        ...manifestFixture.vercel.targets,
        staging: {
          ...manifestFixture.vercel.targets.staging,
          deploymentId: "dpl_preview123",
          deploymentUrl: "https://roberto-preview.vercel.app",
          siteUrl: "https://roberto-multimarcas-pdv-staging.vercel.app",
        },
      },
    },
    supabase: {
      ...manifestFixture.supabase,
      targets: {
        ...manifestFixture.supabase.targets,
        staging: {
          ...manifestFixture.supabase.targets.staging,
          hostname,
          projectRef,
        },
      },
    },
  };
  return parseRemoteEnvironmentManifest(value);
}

function createManifestWithoutStagingRef() {
  const value = structuredClone(manifest);
  value.supabase.targets.staging.projectRef = null;
  value.supabase.targets.staging.hostname = null;
  return parseRemoteEnvironmentManifest(value);
}

function createManagementClient(
  options: {
    authConfig?: Record<string, boolean | number | string>;
    grants?: Record<string, boolean>[];
    operationalRowCount?: number;
    policyContractMatches?: boolean;
    rlsSummary?: Record<string, number>;
    schema?: { rpcs: string[]; tables: string[] };
    secret?: string;
    userSummary?: Record<string, number | string>;
  } = {},
) {
  const {
    authConfig = {
      disable_signup: true,
      external_anonymous_users_enabled: false,
      password_hibp_enabled: true,
      password_min_length: 14,
      site_url: "https://roberto-multimarcas-pdv-staging.vercel.app",
      uri_allow_list: "https://roberto-multimarcas-pdv-staging.vercel.app/**",
    },
    grants = [
      { payments_insert: false, sale_items_insert: false, sales_insert: false },
    ],
    operationalRowCount = 0,
    policyContractMatches = true,
    rlsSummary = {
      rls_enabled_table_count: 8,
      table_count: 8,
      tables_with_policies_count: 8,
    },
    schema = { rpcs, tables },
    secret = undefined,
    userSummary = {
      admin_profile_count: 1,
      auth_user_count: 1,
      non_admin_profile_count: 0,
      profile_count: 1,
      profiles_linked_to_auth_count: 1,
    },
  } = options;
  return {
    getAuthConfig: vi.fn().mockResolvedValue({ ...authConfig, secret }),
    getDatabaseOpenApi: vi.fn().mockResolvedValue(toOpenApi(schema)),
    runReadOnlyQuery: vi.fn(async (_projectRef, { query }) => {
      if (query.includes("pg_catalog.pg_class")) return [rlsSummary];
      if (query.includes("policy_contract_matches"))
        return [{ policy_contract_matches: policyContractMatches }];
      if (query.includes("auth.users")) return [userSummary];
      if (query.includes("operational_row_count"))
        return [{ operational_row_count: operationalRowCount }];
      return grants;
    }),
  };
}

function createAnonymousClient(userId = "admin-user-id") {
  return {
    authenticate: vi.fn().mockResolvedValue({ userId }),
  };
}

function createAuthenticatedClient(
  counts: Record<string, number> = {},
  userId = "admin-user-id",
) {
  return {
    countRows: vi.fn(async (table: string) => counts[table] ?? 0),
    getOwnProfile: vi.fn().mockResolvedValue({ id: userId, role: "admin" }),
  };
}

function createCommandRunner({
  migrationsOutput = migrationIds.map((id) => `${id} | ${id}`).join("\n"),
} = {}) {
  return vi.fn(async (_command, args) => {
    if (args.includes("migration")) {
      return { status: 0, stderr: "", stdout: migrationsOutput };
    }
    return { status: 0, stderr: "", stdout: "No schema errors found" };
  });
}

function toOpenApi(schema: { tables: string[]; rpcs: string[] }) {
  return {
    paths: Object.fromEntries([
      ...schema.tables.map((table) => [`/${table}`, {}]),
      ...schema.rpcs.map((rpc) => [`/rpc/${rpc}`, {}]),
    ]),
  };
}
