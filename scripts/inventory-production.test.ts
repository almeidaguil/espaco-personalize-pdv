import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { runInventoryProductionCli } from "./inventory-production.mjs";

const outputPath = resolve(
  ".provisioning/production-backup/inventory-production-test.json",
);

afterEach(async () => {
  await rm(outputPath, { force: true });
});

describe("runInventoryProductionCli", () => {
  test("identifies the exact legacy production target without connecting on help", async () => {
    const connect = vi.fn();
    const log = vi.fn();

    await expect(
      runInventoryProductionCli(["--help"], { connect, log }),
    ).resolves.toBeUndefined();

    expect(connect).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("ciixpfquwmlsvzleattv"),
    );
  });

  test("writes a redacted inventory for the healthy legacy production project", async () => {
    const privateEmail = "private-owner@example.test";
    const privateObject = "customers/private/document.pdf";
    const log = vi.fn();

    const result = await runInventoryProductionCli(["--output", outputPath], {
      connect: vi
        .fn()
        .mockResolvedValue(
          inventoryDependencies({ privateEmail, privateObject }),
        ),
      log,
      manifest: manifestFixture,
      now: () => new Date("2026-10-08T12:00:00.000Z"),
    });

    expect(result).toMatchObject({
      capturedAt: "2026-10-08T12:00:00.000Z",
      outputPath,
      projectRef: "ciixpfquwmlsvzleattv",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    const serialized = await readFile(outputPath, "utf8");
    expect(serialized).not.toContain(privateEmail);
    expect(serialized).not.toContain(privateObject);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateEmail);
    expect(JSON.parse(serialized)).toMatchObject({
      auth: { usersByRole: { admin: 1, operator: 1 } },
      database: {
        schema: {
          extensions: [{ name: "pgcrypto", version: "1.3" }],
          tables: ["products", "sales"],
        },
      },
      source: {
        organizationId: "wcqoluxxlvglqtebcucz",
        projectRef: "ciixpfquwmlsvzleattv",
      },
    });
  });

  test.each([
    ["wrong ref", { id: "gpywbeoqcovjrfnmbdqx" }],
    ["wrong region", { region: "sa-east-1" }],
    ["wrong hostname", { hostname: "gpywbeoqcovjrfnmbdqx.supabase.co" }],
    ["unhealthy state", { status: "INACTIVE" }],
    ["wrong organization", { organization_id: "abcdefghijklmnopqrst" }],
  ])("rejects %s before collecting evidence", async (_name, override) => {
    const dependencies = inventoryDependencies({
      privateEmail: "private@example.test",
      privateObject: "private/object.txt",
    });
    dependencies.project = { ...dependencies.project, ...override };

    await expect(
      runInventoryProductionCli(["--output", outputPath], {
        connect: vi.fn().mockResolvedValue(dependencies),
        log: vi.fn(),
        manifest: manifestFixture,
        now: () => new Date("2026-10-08T12:00:00.000Z"),
      }),
    ).rejects.toThrow(/legacy production project identity|healthy/i);

    await expect(readFile(outputPath, "utf8")).rejects.toThrow();
  });
});

function inventoryDependencies({
  privateEmail,
  privateObject,
}: {
  privateEmail: string;
  privateObject: string;
}) {
  return {
    authReader: {
      listUsers: vi.fn().mockResolvedValue([
        { email: privateEmail, user_metadata: { role: "admin" } },
        { email: "operator@example.test", user_metadata: { role: "operator" } },
      ]),
    },
    databaseReader: {
      countRows: vi.fn().mockResolvedValue(0),
      listExtensions: vi
        .fn()
        .mockResolvedValue([{ name: "pgcrypto", version: "1.3" }]),
      listMigrations: vi
        .fn()
        .mockResolvedValue(["20261001000000", "20261002000000"]),
      listSchemaTables: vi.fn().mockResolvedValue(["products", "sales"]),
    },
    managementClient: {
      getAuthConfig: vi.fn().mockResolvedValue({
        disable_signup: true,
        external_anonymous_users_enabled: false,
        external_email_enabled: true,
        password_hibp_enabled: true,
        password_min_length: 14,
        site_url: "https://legacy.example.test",
      }),
    },
    project: {
      database: { version: "17.4.1" },
      id: "ciixpfquwmlsvzleattv",
      name: "espaco-personalize-pdv",
      organization_id: "wcqoluxxlvglqtebcucz",
      region: "us-west-2",
      status: "ACTIVE_HEALTHY",
    },
    storageReader: {
      listBuckets: vi
        .fn()
        .mockResolvedValue([{ id: "product-images", name: "product-images" }]),
      listObjects: vi
        .fn()
        .mockResolvedValue([{ metadata: { size: 123 }, name: privateObject }]),
    },
  };
}
