import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import * as productionBackupEvidence from "./production-backup-evidence.mjs";
import {
  createProductionBackupEvidence,
  readAndValidateProductionBackupEvidence,
  writeProductionBackupEvidence,
} from "./production-backup-evidence.mjs";

const authorizedDirectory = resolve(
  ".provisioning/production-backup/evidence-tests",
);
const manifest = {
  supabase: {
    legacy: {
      production: {
        hostname: "ciixpfquwmlsvzleattv.supabase.co",
        name: "espaco-personalize-pdv",
        projectRef: "ciixpfquwmlsvzleattv",
        region: "us-west-2",
      },
    },
    organization: { id: "wcqoluxxlvglqtebcucz" },
  },
};

afterEach(async () => {
  await rm(authorizedDirectory, { force: true, recursive: true });
});

describe("createProductionBackupEvidence", () => {
  test("creates a deterministic PII-free evidence hash", () => {
    const evidence = createProductionBackupEvidence(validInput());
    const reordered = createProductionBackupEvidence({
      ...validInput(),
      database: {
        tableCounts: { sales: 2, products: 3 },
        schema: {
          tables: ["products", "sales"],
          extensions: [{ name: "pgcrypto", version: "1.3" }],
        },
        migrations: ["20261001000000", "20261002000000"],
      },
    });

    expect(evidence).toMatchObject({
      capturedAt: "2026-10-08T12:00:00.000Z",
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      source: {
        hostname: "ciixpfquwmlsvzleattv.supabase.co",
        organizationId: "wcqoluxxlvglqtebcucz",
        projectRef: "ciixpfquwmlsvzleattv",
      },
      version: 1,
    });
    expect(reordered.sha256).toBe(evidence.sha256);
    expect(JSON.stringify(evidence)).not.toMatch(
      /owner@example|row-secret|smtp-secret|api-token-value/i,
    );
  });

  test("rejects row contents, personal identifiers and secret-like fields", () => {
    expect(() =>
      createProductionBackupEvidence({
        ...validInput(),
        auth: {
          ...validInput().auth,
          email: "owner@example.test",
        },
      }),
    ).toThrow(/evidence/i);

    expect(() =>
      createProductionBackupEvidence({
        ...validInput(),
        database: {
          ...validInput().database,
          rows: [{ id: "row-secret" }],
        },
      }),
    ).toThrow(/evidence/i);
  });
});

describe("writeProductionBackupEvidence", () => {
  test("writes atomically inside the authorized directory and validates it", async () => {
    const evidence = createProductionBackupEvidence(validInput());
    const outputPath = join(authorizedDirectory, "production-backup.json");

    const result = await writeProductionBackupEvidence({
      evidence,
      outputPath,
    });
    const validated = await readAndValidateProductionBackupEvidence({
      filePath: outputPath,
      manifest,
      maximumAgeMs: 60 * 60 * 1_000,
      now: new Date("2026-10-08T12:30:00.000Z"),
    });

    expect(result).toEqual({
      outputPath,
      sha256: evidence.sha256,
    });
    expect(validated.sha256).toBe(evidence.sha256);
    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual(evidence);
  });

  test("rejects paths outside the authorized production backup directory", async () => {
    const evidence = createProductionBackupEvidence(validInput());

    await expect(
      writeProductionBackupEvidence({
        evidence,
        outputPath: resolve(".provisioning/not-production/backup.json"),
      }),
    ).rejects.toThrow(/authorized production backup directory/i);
  });
});

describe("readAndValidateProductionBackupEvidence", () => {
  test("validates an in-memory evidence with the same age and identity rules", () => {
    const evidence = createProductionBackupEvidence(validInput());

    expect(
      productionBackupEvidence.validateProductionBackupEvidence({
        evidence,
        manifest,
        maximumAgeMs: 60 * 60 * 1_000,
        now: new Date("2026-10-08T12:30:00.000Z"),
      }),
    ).toEqual(evidence);
  });

  test("rejects tampering, stale and future evidence", async () => {
    await mkdir(authorizedDirectory, { recursive: true });
    const outputPath = join(authorizedDirectory, "production-backup.json");
    const evidence = createProductionBackupEvidence(validInput());
    await writeProductionBackupEvidence({ evidence, outputPath });

    const tampered = JSON.parse(await readFile(outputPath, "utf8"));
    tampered.database.tableCounts.products = 999;
    await writeFile(outputPath, JSON.stringify(tampered), "utf8");
    await expect(
      readAndValidateProductionBackupEvidence({
        filePath: outputPath,
        manifest,
        maximumAgeMs: 60 * 60 * 1_000,
        now: new Date("2026-10-08T12:30:00.000Z"),
      }),
    ).rejects.toThrow(/hash/i);

    await writeProductionBackupEvidence({ evidence, outputPath });
    await expect(
      readAndValidateProductionBackupEvidence({
        filePath: outputPath,
        manifest,
        maximumAgeMs: 60 * 60 * 1_000,
        now: new Date("2026-10-08T13:00:00.001Z"),
      }),
    ).rejects.toThrow(/older than/i);
    await expect(
      readAndValidateProductionBackupEvidence({
        filePath: outputPath,
        manifest,
        maximumAgeMs: 60 * 60 * 1_000,
        now: new Date("2026-10-08T11:59:59.999Z"),
      }),
    ).rejects.toThrow(/future/i);
  });

  test("rejects evidence from another project or organization", async () => {
    const outputPath = join(authorizedDirectory, "production-backup.json");
    await writeProductionBackupEvidence({
      evidence: createProductionBackupEvidence(validInput()),
      outputPath,
    });

    const divergentManifest = structuredClone(manifest);
    divergentManifest.supabase.organization.id = "abcdefghijklmnopqrst";
    await expect(
      readAndValidateProductionBackupEvidence({
        filePath: outputPath,
        manifest: divergentManifest,
        maximumAgeMs: 60 * 60 * 1_000,
        now: new Date("2026-10-08T12:30:00.000Z"),
      }),
    ).rejects.toThrow(/source identity/i);
  });
});

function validInput() {
  return {
    auth: {
      configuration: {
        anonymousUsersEnabled: false,
        disableSignup: true,
        emailEnabled: true,
        leakedPasswordProtectionEnabled: true,
        minimumPasswordLength: 14,
        siteUrl: "https://legacy.example.test",
      },
      usersByRole: { admin: 1, operator: 2, unknown: 0 },
    },
    capturedAt: "2026-10-08T12:00:00.000Z",
    database: {
      migrations: ["20261001000000", "20261002000000"],
      schema: {
        extensions: [{ name: "pgcrypto", version: "1.3" }],
        tables: ["products", "sales"],
      },
      tableCounts: { products: 3, sales: 2 },
    },
    recovery: {
      mechanism: "paused-supabase-project",
      migrationDirectory: "supabase/migrations",
      repository: "almeidaguil/espaco-personalize-pdv",
    },
    source: {
      databaseVersion: "17.4.1",
      hostname: "ciixpfquwmlsvzleattv.supabase.co",
      name: "espaco-personalize-pdv",
      organizationId: "wcqoluxxlvglqtebcucz",
      projectRef: "ciixpfquwmlsvzleattv",
      region: "us-west-2",
      status: "ACTIVE_HEALTHY",
    },
    storage: {
      buckets: [{ name: "product-images", objectCount: 2, totalBytes: 200 }],
    },
  };
}
