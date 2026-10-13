import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test, vi } from "vitest";

import {
  collectDeploymentDependencies,
  collectSupabaseInventory,
  runInventoryCli,
  writeInventoryEvidence,
} from "./inventory-supabase-project.mjs";

const sentinels = {
  apiKey: "sb_secret_api-key-sentinel",
  email: "private-owner@example.test",
  objectPath: "customers/private/document.pdf",
  uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

describe("collectSupabaseInventory", () => {
  test("returns only approved aggregates for the legacy staging project", async () => {
    const inventory = await collectSupabaseInventory({
      authReader: {
        listUsers: vi.fn().mockResolvedValue([
          {
            email: sentinels.email,
            id: sentinels.uuid,
            user_metadata: { role: "admin", secret: sentinels.apiKey },
          },
          {
            email: "operator@example.test",
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            user_metadata: { role: "operator" },
          },
          {
            email: "unknown@example.test",
            id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            user_metadata: {},
          },
        ]),
      },
      databaseReader: {
        countRows: vi.fn(async (table: string) => table.length),
        listExtensions: vi
          .fn()
          .mockResolvedValue([{ name: "pgcrypto", version: "1.3" }]),
        listMigrations: vi
          .fn()
          .mockResolvedValue([
            "20261001000000_initial.sql",
            "20261002000000_cash.sql",
          ]),
        listSchemaTables: vi.fn().mockResolvedValue(["products", "sales"]),
      },
      managementClient: {
        getAuthConfig: vi.fn().mockResolvedValue({
          disable_signup: true,
          external_anonymous_users_enabled: false,
          external_email_enabled: true,
          password_hibp_enabled: true,
          password_min_length: 12,
          secret: sentinels.apiKey,
          site_url: "https://legacy.example.test",
          smtp_pass: "smtp-password-sentinel",
        }),
      },
      now: () => new Date("2026-10-07T12:00:00.000Z"),
      project: {
        database: { version: "17.4.1", password: "database-password-sentinel" },
        id: "gpywbeoqcovjrfnmbdqx",
        name: "espaco-personalize-pdv-staging",
        organization_id: "wcqoluxxlvglqtebcucz",
        region: "us-west-2",
        status: "ACTIVE_HEALTHY",
      },
      storageReader: {
        listBuckets: vi.fn().mockResolvedValue([
          {
            id: sentinels.uuid,
            name: "product-images",
            public: false,
          },
        ]),
        listObjects: vi.fn().mockResolvedValue([
          { metadata: { size: 123 }, name: sentinels.objectPath },
          { metadata: { size: 77 }, name: "another-private-path.jpg" },
        ]),
      },
    });

    expect(inventory).toEqual({
      auth: {
        configuration: {
          disableSignup: true,
          emailEnabled: true,
          leakedPasswordProtectionEnabled: true,
          minimumPasswordLength: 12,
          anonymousUsersEnabled: false,
          siteUrl: "https://legacy.example.test",
        },
        usersByRole: { admin: 1, operator: 1, unknown: 1 },
      },
      capturedAt: "2026-10-07T12:00:00.000Z",
      migrations: ["20261001000000_initial.sql", "20261002000000_cash.sql"],
      project: {
        databaseVersion: "17.4.1",
        name: "espaco-personalize-pdv-staging",
        projectRef: "gpywbeoqcovjrfnmbdqx",
        region: "us-west-2",
        status: "ACTIVE_HEALTHY",
      },
      storage: {
        buckets: [{ name: "product-images", objectCount: 2, totalBytes: 200 }],
      },
      schema: {
        extensions: [{ name: "pgcrypto", version: "1.3" }],
        tables: ["products", "sales"],
      },
      tables: {
        cash_sessions: 13,
        categories: 10,
        payments: 8,
        products: 8,
        profiles: 8,
        sale_items: 10,
        sales: 5,
        stock_movements: 15,
      },
    });
    const serialized = JSON.stringify(inventory);
    Object.values(sentinels).forEach((sentinel) => {
      expect(serialized).not.toContain(sentinel);
    });
    expect(serialized).not.toContain("smtp-password-sentinel");
    expect(serialized).not.toContain("database-password-sentinel");
  });

  test("turns reader failures into safe errors without personal data", async () => {
    await expect(
      collectSupabaseInventory({
        authReader: {
          listUsers: vi.fn().mockRejectedValue(new Error(sentinels.email)),
        },
        databaseReader: {
          countRows: vi.fn().mockResolvedValue(0),
          listExtensions: vi.fn().mockResolvedValue([]),
          listMigrations: vi.fn().mockResolvedValue([]),
          listSchemaTables: vi.fn().mockResolvedValue([]),
        },
        managementClient: {
          getAuthConfig: vi.fn().mockResolvedValue({}),
        },
        now: () => new Date("2026-10-07T12:00:00.000Z"),
        project: {
          id: "gpywbeoqcovjrfnmbdqx",
          name: "espaco-personalize-pdv-staging",
          region: "us-west-2",
          status: "ACTIVE_HEALTHY",
        },
        storageReader: {
          listBuckets: vi.fn().mockResolvedValue([]),
          listObjects: vi.fn().mockResolvedValue([]),
        },
      }),
    ).rejects.toThrow("Unable to aggregate Auth users.");
  });
});

describe("collectDeploymentDependencies", () => {
  test("keeps only public GitHub and non-sensitive Vercel metadata", async () => {
    const dependencies = await collectDeploymentDependencies({
      githubReader: {
        getRepository: vi.fn().mockResolvedValue({
          defaultBranchRef: { name: "main" },
          nameWithOwner: "almeidaguil/espaco-personalize-pdv",
          ownerEmail: sentinels.email,
          url: "https://github.com/almeidaguil/espaco-personalize-pdv",
          visibility: "PUBLIC",
        }),
        listWorkflows: vi.fn().mockResolvedValue([
          {
            id: sentinels.uuid,
            name: "Quality",
            path: ".github/workflows/quality.yml",
          },
        ]),
      },
      vercelReader: {
        getProject: vi.fn().mockResolvedValue({
          accountId: sentinels.uuid,
          framework: "nextjs",
          id: "prj_legacy_public_id",
          name: "espaco-personalize-pdv",
          password: sentinels.apiKey,
          repository: "almeidaguil/espaco-personalize-pdv",
        }),
      },
    });

    expect(dependencies).toEqual({
      github: {
        defaultBranch: "main",
        nameWithOwner: "almeidaguil/espaco-personalize-pdv",
        url: "https://github.com/almeidaguil/espaco-personalize-pdv",
        visibility: "PUBLIC",
        workflows: [{ name: "Quality", path: ".github/workflows/quality.yml" }],
      },
      vercel: {
        framework: "nextjs",
        id: "prj_legacy_public_id",
        name: "espaco-personalize-pdv",
        repository: "almeidaguil/espaco-personalize-pdv",
      },
    });
    const serialized = JSON.stringify(dependencies);
    Object.values(sentinels).forEach((sentinel) => {
      expect(serialized).not.toContain(sentinel);
    });
  });
});

describe("writeInventoryEvidence", () => {
  test("writes a private JSON record and a redacted public summary with SHA-256", async () => {
    const temporaryDirectory = join(
      process.cwd(),
      ".provisioning",
      `inventory-test-${Date.now()}`,
    );
    const publicFile = join(temporaryDirectory, "public-summary.md");
    const inventory = {
      capturedAt: "2026-10-07T12:00:00.000Z",
      project: {
        name: "espaco-personalize-pdv-staging",
        projectRef: "gpywbeoqcovjrfnmbdqx",
        region: "us-west-2",
        status: "ACTIVE_HEALTHY",
      },
      tables: { products: 3 },
    };

    const result = await writeInventoryEvidence({
      inventory,
      privateDirectory: temporaryDirectory,
      publicFile,
    });

    expect(result).toEqual({
      capturedAt: "2026-10-07T12:00:00.000Z",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const privateRecord = await readFile(
      join(temporaryDirectory, "inventory.json"),
      "utf8",
    );
    const publicSummary = await readFile(publicFile, "utf8");
    expect(JSON.parse(privateRecord)).toEqual(inventory);
    expect(publicSummary).toContain(result.sha256);
    expect(publicSummary).toContain("gpywbeoqcovjrfnmbdqx");
    expect(publicSummary).toContain("products: 3");
  });
});

test("--help identifies the exact legacy staging ref without connecting", async () => {
  const log = vi.fn();
  const connect = vi.fn(() => {
    throw new Error("must not connect");
  });

  await expect(
    runInventoryCli(["--help"], { connect, log }),
  ).resolves.toBeUndefined();

  expect(connect).not.toHaveBeenCalled();
  expect(log).toHaveBeenCalledWith(
    expect.stringContaining("gpywbeoqcovjrfnmbdqx"),
  );
});
