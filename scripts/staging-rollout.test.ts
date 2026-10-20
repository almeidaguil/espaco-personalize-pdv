import { readFileSync, readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { runStagingRollout } from "./staging-rollout.mjs";

const manifest = structuredClone(manifestFixture);
const projectRef = manifest.supabase.targets.staging.projectRef;
const projectId = manifest.vercel.targets.staging.projectId;
const orgId = manifest.vercel.orgId;
const projectName = manifest.vercel.targets.staging.projectName;
const commitSha = "a".repeat(40);
const deploymentId = "dpl_StagingRollout123";
const accessToken = "supabase-token-sentinel";
const databasePassword = "database-password-sentinel";
const vercelToken = "vercel-token-sentinel";
const temporaryPaths: string[] = [];
type RunCommand = (
  command: string,
  args: string[],
  options?: { environment: Record<string, string> },
) => { status: number; stderr: string; stdout: string };
type ResolveSourceCommit = (sourceRef: string) => Promise<string>;

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe("runStagingRollout", () => {
  test("dry-run requires explicit phase and never mutates a remote target", async () => {
    await expect(run()).rejects.toThrow(/--phase/i);

    const managementClient = createSupabaseClient();
    const vercelClient = createVercelClient();
    const runCommand = vi.fn<RunCommand>();
    const result = await run({
      args: ["--phase", "deploy"],
      managementClient,
      vercelClient,
      runCommand,
    });

    expect(result).toMatchObject({ mode: "dry-run", phase: "deploy" });
    expect(managementClient.getProject).not.toHaveBeenCalled();
    expect(vercelClient.createGitDeployment).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("foundation migration bundle contains only the additive migration", async () => {
    const managementClient = createSupabaseClient({
      migrationVersions: ["20261014120000"],
    });
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
        stdout:
          "DRY RUN: migrations will *not* be pushed to the database.\nWould push these migrations:\n • 20261018120000_add_split_payments_and_cash_reconciliation.sql\nFinished supabase db push.",
      };
    });

    await run({
      args: [
        "--phase",
        "apply-foundation",
        "--execute",
        "--confirm-project",
        projectRef,
      ],
      environment: databaseEnvironment(),
      managementClient,
      runCommand,
    });

    const [dryRunCall, applyCall] = runCommand.mock.calls;
    expect(dryRunCall[1]).toContain("--dry-run");
    expect(dryRunCall[1]).not.toContain("--yes");
    expect(applyCall[1]).not.toContain("--dry-run");
    expect(applyCall[1]).toContain("--yes");
    expect(dryRunCall[1]).not.toContain(databasePassword);
    expect(applyCall[1]).not.toContain(databasePassword);
    expect(bundleSnapshot.migrationNames).toContain(
      "20261018120000_add_split_payments_and_cash_reconciliation.sql",
    );
    expect(bundleSnapshot.migrationNames).not.toContain(
      "20261018180000_disable_legacy_cash_close.sql",
    );
    expect(bundleSnapshot.projectRef).toBe(projectRef);
    expect(managementClient.runReadOnlyQuery).toHaveBeenCalledTimes(2);
  });

  test("foundation migration refuses to run when the CLI plans a non-foundation migration", async () => {
    const managementClient = createSupabaseClient({
      migrationVersions: ["20261014120000"],
    });
    const runCommand = commandRunner(
      [
        "DRY RUN: migrations will *not* be pushed to the database.",
        "Would push these migrations:",
        " • 20261018120000_add_split_payments_and_cash_reconciliation.sql",
        " • 20261018180000_disable_legacy_cash_close.sql",
      ].join("\n"),
    );

    await expect(
      run({
        args: [
          "--phase",
          "apply-foundation",
          "--execute",
          "--confirm-project",
          projectRef,
        ],
        environment: databaseEnvironment(),
        managementClient,
        runCommand,
      }),
    ).rejects.toThrow(/unexpected migration plan/i);

    expect(runCommand).toHaveBeenCalledTimes(1);
  });

  test("foundation migration mutation requires exact staging ref confirmation", async () => {
    const managementClient = createSupabaseClient();
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        args: [
          "--phase",
          "apply-foundation",
          "--execute",
          "--confirm-project",
          "wrong-ref",
        ],
        environment: databaseEnvironment(),
        managementClient,
        runCommand,
      }),
    ).rejects.toThrow(/literal|target|confirmation/i);

    expect(managementClient.getProject).not.toHaveBeenCalled();
    expect(runCommand).not.toHaveBeenCalled();
  });

  test("deployment is pinned to the exact develop SHA and gets a stable alias", async () => {
    const vercelClient = createVercelClient();
    const runCommand = vi.fn<RunCommand>(() => ({
      status: 0,
      stderr: "",
      stdout: `${commitSha}\trefs/heads/develop`,
    }));
    const result = await run({
      args: [
        "--phase",
        "deploy",
        "--execute",
        "--confirm-project",
        projectId,
        "--source-ref",
        "develop",
        "--commit-sha",
        commitSha,
      ],
      environment: {
        VERCEL_TOKEN: vercelToken,
        VERCEL_OIDC_TOKEN: "vercel-oidc-sentinel",
      },
      runCommand,
      vercelClient,
    });

    expect(runCommand).toHaveBeenCalledWith(
      "git",
      ["ls-remote", "origin", "refs/heads/develop"],
      {
        environment: {
          VERCEL_TOKEN: undefined,
          VERCEL_OIDC_TOKEN: undefined,
        },
      },
    );
    expect(vercelClient.createGitDeployment).toHaveBeenCalledWith({
      environment: "production",
      metadata: expect.objectContaining({
        roberto_commit_sha: commitSha,
        roberto_environment: "staging",
        roberto_source_ref: "develop",
        staging_rollout: "true",
      }),
      orgId,
      projectId,
      projectName,
      ref: commitSha,
      repositoryId: manifest.vercel.repositoryId,
    });
    expect(result).toMatchObject({
      commitSha,
      deploymentId,
      mode: "deployed",
      phase: "deploy",
      projectId,
    });
    expect(vercelClient.getProject).toHaveBeenCalledWith(projectId, orgId);
    expect(
      vercelClient.upsertProjectEnvironmentVariable,
    ).not.toHaveBeenCalled();
  });

  test("deployment refuses a commit that is no longer the develop head", async () => {
    const vercelClient = createVercelClient();

    await expect(
      run({
        args: [
          "--phase",
          "deploy",
          "--execute",
          "--confirm-project",
          projectId,
          "--source-ref",
          "develop",
          "--commit-sha",
          commitSha,
        ],
        environment: { VERCEL_TOKEN: vercelToken },
        resolveSourceCommit: vi.fn<ResolveSourceCommit>(async () =>
          "b".repeat(40),
        ),
        vercelClient,
      }),
    ).rejects.toThrow(/source ref.*requested commit/i);

    expect(vercelClient.createGitDeployment).not.toHaveBeenCalled();
  });

  test("verification is read-only and does not require mutation authorization", async () => {
    const vercelClient = createVercelClient();
    const result = await run({
      args: [
        "--phase",
        "verify",
        "--source-ref",
        "develop",
        "--commit-sha",
        commitSha,
        "--deployment-id",
        deploymentId,
      ],
      environment: { VERCEL_TOKEN: vercelToken },
      resolveSourceCommit: vi.fn<ResolveSourceCommit>(async () => commitSha),
      vercelClient,
    });

    expect(result).toMatchObject({ mode: "verified", phase: "verify" });
    expect(vercelClient.getDeployment).toHaveBeenCalledWith(
      deploymentId,
      orgId,
    );
    expect(vercelClient.createGitDeployment).not.toHaveBeenCalled();
  });

  test("cutover requires explicit confirmation that the staging financial smoke passed", async () => {
    const managementClient = createSupabaseClient({
      migrationVersions: ["20261014120000", "20261018120000"],
    });
    const vercelClient = createVercelClient();
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        args: [
          "--phase",
          "apply-cutover",
          "--execute",
          "--confirm-project",
          projectId,
          "--source-ref",
          "develop",
          "--commit-sha",
          commitSha,
          "--deployment-id",
          deploymentId,
        ],
        environment: {
          ...databaseEnvironment(),
          VERCEL_TOKEN: vercelToken,
        },
        managementClient,
        resolveSourceCommit: vi.fn<ResolveSourceCommit>(async () => commitSha),
        runCommand,
        vercelClient,
      }),
    ).rejects.toThrow(/confirm.*smoke/i);

    expect(runCommand).not.toHaveBeenCalled();
  });

  test("cutover requires literal confirmation of the Supabase staging ref", async () => {
    const managementClient = createSupabaseClient({
      migrationVersions: ["20261014120000", "20261018120000"],
    });
    const runCommand = vi.fn<RunCommand>();
    const args = cutoverArguments();
    args.splice(args.indexOf("--confirm-database-ref"), 2);

    await expect(
      run({
        args,
        environment: {
          ...databaseEnvironment(),
          VERCEL_TOKEN: vercelToken,
        },
        managementClient,
        resolveSourceCommit: vi.fn<ResolveSourceCommit>(async () => commitSha),
        runCommand,
        vercelClient: createVercelClient(),
      }),
    ).rejects.toThrow(/literal|target|confirmation/i);

    expect(runCommand).not.toHaveBeenCalled();
  });

  test("cutover refuses to revoke the legacy RPC until the verified runtime is deployed", async () => {
    const managementClient = createSupabaseClient({
      migrationVersions: ["20261014120000", "20261018120000"],
    });
    const vercelClient = createVercelClient({
      deployment: { readyState: "BUILDING" },
    });
    const runCommand = vi.fn<RunCommand>();

    await expect(
      run({
        args: cutoverArguments(),
        environment: {
          ...databaseEnvironment(),
          VERCEL_TOKEN: vercelToken,
        },
        managementClient,
        resolveSourceCommit: vi.fn<ResolveSourceCommit>(async () => commitSha),
        runCommand,
        vercelClient,
      }),
    ).rejects.toThrow(/READY|stable alias|deployment/i);

    expect(runCommand).not.toHaveBeenCalled();
  });

  test("cutover applies only the legacy RPC revocation after a confirmed smoke", async () => {
    const managementClient = createSupabaseClient({
      migrationVersions: ["20261014120000", "20261018120000"],
      privilegeRows: [
        { legacy_close_executable: false, v2_close_executable: true },
      ],
    });
    const runCommand = commandRunner(
      [
        "DRY RUN: migrations will *not* be pushed to the database.",
        "Would push these migrations:",
        " • 20261018180000_disable_legacy_cash_close.sql",
      ].join("\n"),
    );

    const result = await run({
      args: cutoverArguments(),
      environment: {
        ...databaseEnvironment(),
        VERCEL_TOKEN: vercelToken,
      },
      managementClient,
      resolveSourceCommit: vi.fn<ResolveSourceCommit>(async () => commitSha),
      runCommand,
      vercelClient: createVercelClient(),
    });

    expect(result).toMatchObject({
      mode: "executed",
      phase: "apply-cutover",
      projectRef,
    });
    expect(runCommand).toHaveBeenCalledTimes(2);
    expect(runCommand.mock.calls[0][1]).toContain("--dry-run");
    expect(runCommand.mock.calls[0][1]).not.toContain("--yes");
    expect(runCommand.mock.calls[1][1]).not.toContain("--dry-run");
    expect(runCommand.mock.calls[1][1]).toContain("--yes");
    expect(managementClient.runReadOnlyQuery).toHaveBeenCalledTimes(3);
  });
});

function run({
  args = [],
  environment = {},
  managementClient,
  resolveSourceCommit,
  runCommand,
  vercelClient,
}: {
  args?: string[];
  environment?: Record<string, string>;
  managementClient?: ReturnType<typeof createSupabaseClient>;
  resolveSourceCommit?: ResolveSourceCommit;
  runCommand?: RunCommand;
  vercelClient?: ReturnType<typeof createVercelClient>;
} = {}) {
  return runStagingRollout({
    args,
    environment,
    manifest,
    managementClient,
    repoRoot: resolve("."),
    resolveSourceCommit,
    runCommand,
    tempRoot: createTemporaryRoot,
    vercelClient,
    wait: async () => undefined,
  });
}

async function createTemporaryRoot() {
  const path = await mkdtemp(join(tmpdir(), "staging-rollout-test-"));
  temporaryPaths.push(path);
  return path;
}

function createSupabaseClient({
  migrationVersions = ["20261014120000"],
  privilegeRows = [],
  afterMigrationVersions,
}: {
  migrationVersions?: string[];
  privilegeRows?: Record<string, boolean>[];
  afterMigrationVersions?: string[];
} = {}) {
  let queryCount = 0;
  return {
    getProject: vi.fn(async () => ({
      id: projectRef,
      name: manifest.supabase.targets.staging.name,
      region: "sa-east-1",
      status: "ACTIVE_HEALTHY",
    })),
    runReadOnlyQuery: vi.fn(async (_projectRef, { query }) => {
      if (query.includes("has_function_privilege")) return privilegeRows;
      queryCount += 1;
      const versions =
        queryCount === 1
          ? migrationVersions
          : (afterMigrationVersions ??
            (migrationVersions.includes("20261018120000")
              ? [...migrationVersions, "20261018180000"]
              : [...migrationVersions, "20261018120000"]));
      return versions.map((version) => ({ version }));
    }),
  };
}

function createVercelClient({
  deployment = {},
}: {
  deployment?: Record<string, unknown>;
} = {}) {
  return {
    createGitDeployment: vi.fn(async () => ({
      id: deploymentId,
      target: "production",
    })),
    getDeployment: vi.fn(async () => ({
      alias: [new URL(manifest.vercel.targets.staging.siteUrl).hostname],
      gitSource: {
        ref: commitSha,
        repoId: manifest.vercel.repositoryId,
        sha: commitSha,
      },
      id: deploymentId,
      meta: {
        dedicated_staging: "true",
        pr08: "true",
        roberto_commit_sha: commitSha,
        roberto_environment: "staging",
        roberto_source_ref: "develop",
        staging_rollout: "true",
      },
      name: projectName,
      readyState: "READY",
      target: "production",
      url: "https://roberto-staging-rollout.vercel.app",
      ...deployment,
    })),
    getProject: vi.fn(async (id: string) => ({
      framework: "nextjs",
      id,
      link: null,
      name:
        id === manifest.vercel.targets.production.projectId
          ? manifest.vercel.targets.production.projectName
          : projectName,
      nodeVersion: "22.x",
      protectionBypass: {},
      ssoProtection: { deploymentType: "all_except_custom_domains" },
    })),
    listProjectDeployments: vi.fn(async (id: string) => ({
      deployments:
        id === projectId
          ? [
              {
                id: "dpl_bootstrap_staging",
                meta: {
                  dedicated_staging: "true",
                  pr08: "true",
                  roberto_environment: "staging",
                },
                name: projectName,
                target: "production",
              },
            ]
          : [],
    })),
    listProjectDomains: vi.fn(async (id: string) => ({
      domains:
        id === manifest.vercel.targets.production.projectId
          ? [
              {
                name: `${manifest.vercel.targets.production.projectName}.vercel.app`,
              },
            ]
          : [{ name: "roberto-multimarcas-pdv.vercel.app" }],
    })),
    listProjectEnvironmentVariables: vi.fn(async (id: string) => ({
      envs:
        id === manifest.vercel.targets.production.projectId
          ? []
          : [
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
    })),
    upsertProjectEnvironmentVariable: vi.fn(),
  };
}

function commandRunner(stdout: string) {
  return vi.fn<RunCommand>(() => ({ status: 0, stderr: "", stdout }));
}

function readWorkdir(args: string[]) {
  const index = args.indexOf("--workdir");
  if (index === -1) throw new Error("Missing test workdir");
  return args[index + 1];
}

function databaseEnvironment() {
  return {
    SUPABASE_ACCESS_TOKEN: accessToken,
    SUPABASE_DB_PASSWORD: databasePassword,
  };
}

function cutoverArguments() {
  return [
    "--phase",
    "apply-cutover",
    "--execute",
    "--confirm-project",
    projectId,
    "--confirm-database-ref",
    projectRef,
    "--source-ref",
    "develop",
    "--commit-sha",
    commitSha,
    "--deployment-id",
    deploymentId,
    "--confirm-smoke-passed",
    "STAGING_FINANCIAL_SMOKE_PASSED",
    "--confirm-cutover",
    "20261018180000_disable_legacy_cash_close.sql",
  ];
}
