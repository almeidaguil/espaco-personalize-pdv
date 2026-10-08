import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import { verifyRemoteStaging } from "./verify-remote-staging.mjs";

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
          localMigrations: migrationIds,
          managementClient,
          manifest: selectedManifest,
        }),
      ).rejects.toThrow(error);
      expect(managementClient.getAuthConfig).not.toHaveBeenCalled();
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
        localMigrations: migrationIds,
        managementClient: createManagementClient(),
        manifest,
      }),
    ).rejects.toThrow(/unexpected operational data/i);
  });

  test("returns a redacted report when all remote checks pass", async () => {
    const email = "owner@private.example";
    const secret = "secret-key-sentinel";
    const result = await verifyRemoteStaging({
      anonymousClient: createAnonymousClient(),
      authenticatedClient: createAuthenticatedClient(),
      commandRunner: createCommandRunner(),
      localMigrations: migrationIds,
      managementClient: createManagementClient({ secret }),
      manifest,
    });

    expect(result).toEqual({
      checks: [
        "migrations",
        "database-lint",
        "schema",
        "auth",
        "admin-profile",
        "empty-operational-data",
        "financial-grants",
      ],
      projectRef,
      status: "passed",
    });
    expect(JSON.stringify(result)).not.toContain(email);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

function createManifest(hostname = `${projectRef}.supabase.co`) {
  const value = {
    ...manifestFixture,
    vercel: {
      ...manifestFixture.vercel,
      deploymentId: "dpl_preview123",
      deploymentUrl: "https://roberto-preview.vercel.app",
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
    schema?: { rpcs: string[]; tables: string[] };
    secret?: string;
  } = {},
) {
  const {
    authConfig = {
      disable_signup: true,
      external_anonymous_users_enabled: false,
      password_hibp_enabled: true,
      password_min_length: 14,
      site_url: "https://roberto-preview.vercel.app",
      uri_allow_list: "https://roberto-preview.vercel.app/**",
    },
    grants = [
      { payments_insert: false, sale_items_insert: false, sales_insert: false },
    ],
    schema = { rpcs, tables },
    secret = undefined,
  } = options;
  return {
    getAuthConfig: vi.fn().mockResolvedValue({ ...authConfig, secret }),
    getDatabaseOpenApi: vi.fn().mockResolvedValue(toOpenApi(schema)),
    runReadOnlyQuery: vi.fn().mockResolvedValue(grants),
  };
}

function createAnonymousClient() {
  return {
    authenticate: vi.fn().mockResolvedValue({ userId: "admin-user-id" }),
  };
}

function createAuthenticatedClient(counts: Record<string, number> = {}) {
  return {
    countRows: vi.fn(async (table: string) => counts[table] ?? 0),
    getOwnProfile: vi
      .fn()
      .mockResolvedValue({ id: "admin-user-id", role: "admin" }),
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
