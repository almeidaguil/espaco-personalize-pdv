import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { createProductionEnvironmentFingerprint } from "./production-environment-fingerprint.mjs";
import {
  readAndValidateProductionReleaseBackup,
  runProductionMigrationRollout,
} from "./production-rollout.mjs";

const manifest = structuredClone(manifestFixture);
const projectRef = manifest.supabase.targets.production.projectRef;
const projectId = manifest.vercel.targets.production.projectId;
const projectName = manifest.vercel.targets.production.projectName;
const orgId = manifest.vercel.orgId;
const siteUrl = manifest.vercel.targets.production.siteUrl;
const foundationMigration =
  "20261018120000_add_split_payments_and_cash_reconciliation.sql";
const cutoverMigration = "20261018180000_disable_legacy_cash_close.sql";
const commitSha = "b".repeat(40);
const deploymentId = "dpl_ProductionRollout123";
const now = new Date("2026-10-20T23:00:00.000Z");
const databasePassword = "database-password-sentinel";
const accessToken = "supabase-token-sentinel";
const vercelToken = "vercel-token-sentinel";
const productionEnvironment = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key-sentinel",
  NEXT_PUBLIC_SUPABASE_URL: `https://${projectRef}.supabase.co`,
  SUPABASE_SECRET_KEY: "secret-key-sentinel",
};
const temporaryPaths: string[] = [];

type RunCommand = (
  command: string,
  args: string[],
  options?: { environment: Record<string, string> },
) => { status: number; stderr: string; stdout: string };

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("runProductionMigrationRollout", () => {
  test("dry-runs only the additive foundation migration in a temporary bundle", async () => {
    const database = createDatabaseClient(preFoundationVersions());
    let bundleSnapshot = { migrationNames: [] as string[], projectRef: "" };
    const runCommand = vi.fn<RunCommand>((_command, args) => {
      const workdir = readWorkdir(args);
      bundleSnapshot = {
        migrationNames: readdirSync(join(workdir, "supabase", "migrations")),
        projectRef: readFileSync(
          join(workdir, "supabase", ".temp", "project-ref"),
          "utf8",
        ),
      };
      return {
        status: 0,
        stderr: "",
        stdout: migrationPlan(foundationMigration),
      };
    });

    const result = await run({
      managementClient: database.client,
      runCommand,
    });

    expect(result).toMatchObject({
      migration: foundationMigration,
      mode: "dry-run",
      phase: "apply-foundation",
      projectRef,
    });
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand.mock.calls[0][1]).toContain("--dry-run");
    expect(runCommand.mock.calls[0][1]).not.toContain("--yes");
    expect(runCommand.mock.calls[0][1]).not.toContain(databasePassword);
    expect(bundleSnapshot.projectRef).toBe(projectRef);
    expect(bundleSnapshot.migrationNames).toContain(foundationMigration);
    expect(bundleSnapshot.migrationNames).not.toContain(cutoverMigration);
    expect(database.client.runReadOnlyQuery).toHaveBeenCalledTimes(1);
  });

  test("applies foundation only after exact database, migration, staging, and source confirmations", async () => {
    const database = createDatabaseClient(preFoundationVersions());
    const runCommand = createMigrationCommandRunner(
      foundationMigration,
      database.addVersion,
    );
    const result = await run({
      args: [
        ...foundationArgs(),
        "--execute",
        "--confirm-backup-verified",
        "PRODUCTION_BACKUP_VERIFIED",
        "--confirm-database-ref",
        projectRef,
        "--confirm-staging-gates",
        "STAGING_RELEASE_GATE_PASSED",
        "--confirm-migration",
        foundationMigration,
      ],
      managementClient: database.client,
      runCommand,
    });

    expect(result).toMatchObject({
      migration: foundationMigration,
      mode: "executed",
      phase: "apply-foundation",
      projectRef,
    });
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls[0][1]).toContain("--dry-run");
    expect(runCommand.mock.calls[1][1]).toContain("--yes");
    expect(database.versions()).toContain(foundationMigration.slice(0, 14));
  });

  test("rejects an incorrect production ref before reading or mutating the database", async () => {
    const database = createDatabaseClient(preFoundationVersions());
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        args: [
          ...foundationArgs(),
          "--execute",
          "--confirm-backup-verified",
          "PRODUCTION_BACKUP_VERIFIED",
          "--confirm-database-ref",
          "wrong-project-ref",
          "--confirm-staging-gates",
          "STAGING_RELEASE_GATE_PASSED",
          "--confirm-migration",
          foundationMigration,
        ],
        managementClient: database.client,
        runCommand,
      }),
    ).rejects.toThrow(/literal|confirmation|target/i);

    expect(database.client.getProject).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("refuses to run migrations from a checkout other than the exact main commit", async () => {
    const database = createDatabaseClient(preFoundationVersions());
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        managementClient: database.client,
        readLocalCommit: async () => "c".repeat(40),
        runCommand,
      }),
    ).rejects.toThrow(/local checkout and remote main ref/i);

    expect(database.client.getProject).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("requires explicit confirmation that the encrypted backup was verified", async () => {
    const database = createDatabaseClient(preFoundationVersions());
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        args: [
          ...foundationArgs(),
          "--execute",
          "--confirm-database-ref",
          projectRef,
          "--confirm-staging-gates",
          "STAGING_RELEASE_GATE_PASSED",
          "--confirm-migration",
          foundationMigration,
        ],
        managementClient: database.client,
        runCommand,
      }),
    ).rejects.toThrow(/PRODUCTION_BACKUP_VERIFIED/i);

    expect(database.client.getProject).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("rejects unexpected planned migrations without applying anything", async () => {
    const database = createDatabaseClient(preFoundationVersions());
    const runCommand = vi.fn<RunCommand>(() => ({
      status: 0,
      stderr: "",
      stdout: migrationPlan(
        foundationMigration,
        "20261018180000_disable_legacy_cash_close.sql",
      ),
    }));

    await expect(
      run({
        managementClient: database.client,
        runCommand,
      }),
    ).rejects.toThrow(/unexpected production migration plan/i);

    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  test("refuses foundation when a prerequisite migration is missing", async () => {
    const database = createDatabaseClient([]);
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        managementClient: database.client,
        runCommand,
      }),
    ).rejects.toThrow(/missing prerequisite migrations/i);

    expect(runCommand).not.toHaveBeenCalled();
  });

  test("applies cutover only after verifying the exact deployment and staging gates", async () => {
    const versions = [
      ...preFoundationVersions(),
      foundationMigration.slice(0, 14),
    ];
    const database = createDatabaseClient(versions);
    const vercelClient = createVercelClient();
    const runCommand = createMigrationCommandRunner(
      cutoverMigration,
      database.addVersion,
    );

    const result = await run({
      args: [
        ...cutoverArgs(),
        "--execute",
        "--confirm-backup-verified",
        "PRODUCTION_BACKUP_VERIFIED",
        "--confirm-project",
        projectId,
        "--confirm-database-ref",
        projectRef,
        "--confirm-staging-gates",
        "STAGING_RELEASE_GATE_PASSED",
        "--confirm-migration",
        cutoverMigration,
      ],
      managementClient: database.client,
      runCommand,
      vercelClient,
    });

    expect(result).toMatchObject({
      commitSha,
      deploymentId,
      migration: cutoverMigration,
      mode: "executed",
      phase: "apply-cutover",
      projectRef,
    });
    expect(vercelClient.getDeployment).toHaveBeenCalledWith(
      deploymentId,
      orgId,
    );
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(database.versions()).toContain(cutoverMigration.slice(0, 14));
    expect(database.client.runReadOnlyQuery).toHaveBeenCalledWith(
      projectRef,
      expect.objectContaining({
        query: expect.stringContaining("legacy_close_executable"),
      }),
    );
  });

  test("rejects cutover when the verified production deployment has a different SHA", async () => {
    const database = createDatabaseClient([
      ...preFoundationVersions(),
      foundationMigration.slice(0, 14),
    ]);
    const vercelClient = createVercelClient({
      deploymentOverrides: { gitSource: { sha: "c".repeat(40) } },
    });
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        args: [
          ...cutoverArgs(),
          "--confirm-staging-gates",
          "STAGING_RELEASE_GATE_PASSED",
          "--confirm-migration",
          cutoverMigration,
        ],
        managementClient: database.client,
        runCommand,
        vercelClient,
      }),
    ).rejects.toThrow(/exact main commit/i);

    expect(runCommand).not.toHaveBeenCalled();
  });

  test("requires an exact stable-alias entry from Vercel", async () => {
    const database = createDatabaseClient([
      ...preFoundationVersions(),
      foundationMigration.slice(0, 14),
    ]);
    const vercelClient = createVercelClient({
      deploymentOverrides: {
        alias: `untrusted-${new URL(siteUrl).hostname}`,
      },
    });
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        args: [
          ...cutoverArgs(),
          "--confirm-staging-gates",
          "STAGING_RELEASE_GATE_PASSED",
          "--confirm-migration",
          cutoverMigration,
        ],
        managementClient: database.client,
        runCommand,
        vercelClient,
      }),
    ).rejects.toThrow(/exact main commit and environment/i);

    expect(runCommand).not.toHaveBeenCalled();
  });
});

describe("readAndValidateProductionReleaseBackup", () => {
  test("accepts a fresh, encrypted backup for the exact production project", async () => {
    const directory = await createBackupFixture();
    const evidence = await readAndValidateProductionReleaseBackup({
      filePath: join(directory, backupEvidenceName()),
      now,
      projectRef,
    });

    expect(evidence).toMatchObject({
      capturedAtUtc: "2026-10-20T22:30:00.000Z",
    });
  });

  test.each([
    ["stale evidence", new Date("2026-10-20T23:30:01.000Z"), "different"],
    ["another project", now, "abcdefghijklmnopqrst"],
  ])("rejects %s", async (_description, currentTime, targetRef) => {
    const directory = await createBackupFixture();

    await expect(
      readAndValidateProductionReleaseBackup({
        filePath: join(directory, backupEvidenceName()),
        now: currentTime,
        projectRef: targetRef,
      }),
    ).rejects.toThrow(/production backup evidence|one hour/i);
  });

  test("rejects encrypted backup files whose sizes differ from the evidence", async () => {
    const directory = await createBackupFixture({ dataContents: "tampered" });

    await expect(
      readAndValidateProductionReleaseBackup({
        filePath: join(directory, backupEvidenceName()),
        now,
        projectRef,
      }),
    ).rejects.toThrow(/encrypted production backup files/i);
  });
});

function run(overrides: Record<string, unknown> = {}) {
  return runProductionMigrationRollout({
    args: foundationArgs(),
    backupReader: vi.fn().mockResolvedValue({
      capturedAtUtc: "2026-10-20T22:30:00.000Z",
      evidenceSha256: "d".repeat(64),
    }),
    cutoverState: verifiedState(),
    environment: {
      NODE_ENV: "test",
      ...productionEnvironment,
      SUPABASE_ACCESS_TOKEN: accessToken,
      SUPABASE_DB_PASSWORD: databasePassword,
      VERCEL_TOKEN: vercelToken,
    },
    manifest,
    now: () => now,
    readLocalCommit: async () => commitSha,
    readSourceCommit: async () => commitSha,
    runCommand: vi.fn<RunCommand>(() => ({
      status: 0,
      stderr: "",
      stdout: migrationPlan(foundationMigration),
    })),
    ...overrides,
  });
}

function foundationArgs() {
  return [
    "--phase",
    "apply-foundation",
    "--source-ref",
    "main",
    "--commit-sha",
    commitSha,
    "--backup-evidence",
    "production-backup-evidence.json",
  ];
}

function cutoverArgs() {
  return [
    "--phase",
    "apply-cutover",
    "--source-ref",
    "main",
    "--commit-sha",
    commitSha,
    "--backup-evidence",
    "production-backup-evidence.json",
    "--deployment-id",
    deploymentId,
  ];
}

function preFoundationVersions() {
  return readdirSync(resolve("supabase/migrations"))
    .filter((fileName) => /^\d{14}_.+\.sql$/.test(fileName))
    .map((fileName) => fileName.slice(0, 14))
    .filter((version) => version < foundationMigration.slice(0, 14));
}

function createDatabaseClient(initialVersions: string[]) {
  const versions = [...initialVersions];
  const client = {
    getProject: vi.fn().mockResolvedValue({
      id: projectRef,
      name: "roberto-multimarcas-pdv",
      region: "sa-east-1",
      status: "ACTIVE_HEALTHY",
    }),
    runReadOnlyQuery: vi.fn(
      async (_ref: string, { query }: { query: string }) => {
        if (query.includes("schema_migrations")) {
          return versions.map((version) => ({ version }));
        }
        if (query.includes("has_function_privilege")) {
          return [
            {
              legacy_close_executable: !versions.includes(
                cutoverMigration.slice(0, 14),
              ),
              v2_close_executable: versions.includes(
                foundationMigration.slice(0, 14),
              ),
            },
          ];
        }
        return [];
      },
    ),
  };
  return {
    addVersion(version: string) {
      if (!versions.includes(version)) versions.push(version);
    },
    client,
    versions: () => versions,
  };
}

function createVercelClient({
  deploymentOverrides = {},
}: {
  deploymentOverrides?: Record<string, unknown>;
} = {}) {
  const environmentFingerprintValues = productionEnvironment;
  return {
    getDeployment: vi.fn().mockResolvedValue({
      alias: [new URL(siteUrl).hostname],
      gitSource: {
        ref: commitSha,
        repoId: manifest.vercel.repositoryId,
        sha: commitSha,
      },
      id: deploymentId,
      meta: {
        pr09: "true",
        roberto_commit_sha: commitSha,
        roberto_environment: "production",
        roberto_environment_fingerprint: createFingerprint(
          environmentFingerprintValues,
        ),
        roberto_source_ref: "main",
      },
      name: projectName,
      readyState: "READY",
      target: "production",
      uid: deploymentId,
      url: "roberto-multimarcas-release.vercel.app",
      ...deploymentOverrides,
    }),
    getProject: vi.fn().mockResolvedValue({
      framework: manifest.vercel.framework,
      id: projectId,
      link: null,
      name: projectName,
      nodeVersion: manifest.vercel.nodeVersion,
      protectionBypass: {},
    }),
    listProjectEnvironmentVariables: vi.fn().mockResolvedValue({
      envs: [
        {
          key: "NEXT_PUBLIC_SUPABASE_URL",
          target: ["production"],
          type: "encrypted",
        },
        {
          key: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
          target: ["production"],
          type: "encrypted",
        },
        {
          key: "SUPABASE_SECRET_KEY",
          target: ["production"],
          type: "sensitive",
        },
      ],
    }),
  };
}

function createFingerprint(values: Record<string, string>) {
  return createProductionEnvironmentFingerprint(values);
}

function createMigrationCommandRunner(
  migration: string,
  addVersion: (version: string) => void,
) {
  return vi.fn<RunCommand>((_command, args) => {
    if (args.includes("--yes")) addVersion(migration.slice(0, 14));
    return {
      status: 0,
      stderr: "",
      stdout: args.includes("--dry-run") ? migrationPlan(migration) : "ok",
    };
  });
}

function migrationPlan(...migrations: string[]) {
  return [
    "DRY RUN: migrations will *not* be pushed to the database.",
    "Would push these migrations:",
    ...migrations.map((migration) => ` • ${migration}`),
    "Finished supabase db push.",
  ].join("\n");
}

function readWorkdir(args: string[]) {
  const index = args.indexOf("--workdir");
  if (index === -1) throw new Error("Missing migration bundle workdir.");
  return args[index + 1];
}

function verifiedState() {
  return {
    history: [
      {
        facts: { projectRef },
        phase: "production-created",
      },
    ],
    phase: "verified",
  };
}

function backupEvidenceName() {
  return "roberto-production-20261020T223000Z-evidence.json";
}

async function createBackupFixture({
  dataContents = "encrypted-data",
}: {
  dataContents?: string;
} = {}) {
  const directory = await mkdtemp(join(tmpdir(), "pdv-release-backup-test-"));
  temporaryPaths.push(directory);
  const timestamp = "20261020T223000Z";
  const schemaFile = `roberto-production-${timestamp}-public-schema.sql.dpapi`;
  const dataFile = `roberto-production-${timestamp}-public-data.sql.dpapi`;
  const schemaContents = "encrypted-schema";
  await writeFile(join(directory, schemaFile), schemaContents);
  await writeFile(join(directory, dataFile), dataContents);
  const evidence = {
    capturedAtUtc: "2026-10-20T22:30:00.000Z",
    dataEncryptedBytes: Buffer.byteLength("encrypted-data"),
    dataFile,
    dataSha256: "e".repeat(64),
    encryption: "Windows DPAPI CurrentUser",
    plaintextRemoved: true,
    projectRef,
    schemaEncryptedBytes: Buffer.byteLength(schemaContents),
    schemaFile,
    schemaSha256: "f".repeat(64),
    scope: "public schema and application data",
  };
  await writeFile(
    join(directory, backupEvidenceName()),
    JSON.stringify(evidence),
    "utf8",
  );
  return directory;
}
