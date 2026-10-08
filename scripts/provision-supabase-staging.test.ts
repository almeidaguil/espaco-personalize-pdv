import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import { runSupabaseStagingProvisioning } from "./provision-supabase-staging.mjs";

const manifest = parseRemoteEnvironmentManifest({
  ...manifestFixture,
  vercel: {
    ...manifestFixture.vercel,
    deploymentId: "dpl_preview123",
    deploymentUrl: "https://roberto-preview.vercel.app",
    siteUrl: "https://roberto-multimarcas-pdv-staging.vercel.app",
  },
});
const newProjectRef = "qrstabcdefghijklmnop";
const databasePassword = "database-password-sentinel-Aa1!";
const now = new Date("2026-10-07T12:00:00.000Z");
const persistedTargetRef = manifest.supabase.targets.staging.projectRef!;
const unpersistedManifest = parseRemoteEnvironmentManifest({
  ...manifest,
  supabase: {
    ...manifest.supabase,
    targets: {
      ...manifest.supabase.targets,
      staging: {
        ...manifest.supabase.targets.staging,
        hostname: null,
        projectRef: null,
      },
    },
  },
});

describe("runSupabaseStagingProvisioning", () => {
  test("builds a verified dry-run without calling mutable operations", async () => {
    const managementClient = createManagementClient();
    const log = vi.fn();

    const result = await runSupabaseStagingProvisioning({
      args: [],
      commandRunner: vi.fn(),
      environment: {},
      inventoryReader: vi.fn().mockResolvedValue(validInventory()),
      log,
      managementClient,
      manifest: unpersistedManifest,
      now: () => now,
      wait: vi.fn(),
    });

    expect(result).toEqual({
      legacyState: "ACTIVE_HEALTHY",
      mode: "dry-run",
      nextAction: `rerun with --execute --confirm-legacy-ref ${manifest.supabase.legacy.staging.projectRef} --confirm-target-name ${manifest.supabase.targets.staging.name}`,
      productionState: "ACTIVE_HEALTHY",
      region: "sa-east-1",
      targetState: "absent",
    });
    expect(managementClient.pauseProject).not.toHaveBeenCalled();
    expect(managementClient.createProject).not.toHaveBeenCalled();
    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(result);
  });

  test("reads inventory evidence from the authorized --inventory path", async () => {
    const inventoryPath = resolve(
      ".provisioning/inventory/provision-custom.test.json",
    );
    await mkdir(resolve(".provisioning/inventory"), { recursive: true });
    await writeFile(
      inventoryPath,
      JSON.stringify(validInventory("2030-01-01T11:00:00.000Z")),
      "utf8",
    );

    try {
      const result = await runSupabaseStagingProvisioning({
        args: ["--inventory", inventoryPath],
        commandRunner: vi.fn(),
        environment: {},
        log: vi.fn(),
        managementClient: createManagementClient(),
        manifest: unpersistedManifest,
        now: () => new Date("2030-01-01T12:00:00.000Z"),
        wait: vi.fn(),
      });

      expect(result).toMatchObject({ mode: "dry-run" });
    } finally {
      await rm(inventoryPath, { force: true });
    }
  });

  test("rejects an --inventory path outside the private inventory directory", async () => {
    const managementClient = createManagementClient();

    await expect(
      runSupabaseStagingProvisioning({
        args: ["--inventory", resolve("README.md")],
        commandRunner: vi.fn(),
        environment: {},
        inventoryReader: vi.fn().mockResolvedValue(validInventory()),
        log: vi.fn(),
        managementClient,
        manifest: unpersistedManifest,
        now: () => now,
        wait: vi.fn(),
      }),
    ).rejects.toThrow(/authorized inventory directory/i);

    expect(managementClient.listProjects).not.toHaveBeenCalled();
  });

  test("rejects --inventory without a file path", async () => {
    const managementClient = createManagementClient();

    await expect(
      runSupabaseStagingProvisioning({
        args: ["--inventory"],
        commandRunner: vi.fn(),
        environment: {},
        inventoryReader: vi.fn().mockResolvedValue(validInventory()),
        log: vi.fn(),
        managementClient,
        manifest: unpersistedManifest,
        now: () => now,
        wait: vi.fn(),
      }),
    ).rejects.toThrow(/--inventory.*file path/i);

    expect(managementClient.listProjects).not.toHaveBeenCalled();
  });

  test("returns a plan-only dry-run when credentials are not available", async () => {
    const result = await runSupabaseStagingProvisioning({
      args: [],
      commandRunner: vi.fn(),
      environment: {},
      log: vi.fn(),
      manifest,
      wait: vi.fn(),
    });

    expect(result).toEqual({
      legacyState: "unknown",
      mode: "dry-run",
      nextAction:
        "provide SUPABASE_ACCESS_TOKEN and a fresh inventory evidence",
      productionState: "unknown",
      region: "sa-east-1",
      targetState: "pending",
    });
  });

  test.each([
    ["missing", null],
    ["stale", validInventory("2026-10-05T11:59:59.000Z")],
    [
      "wrong project",
      {
        ...validInventory(),
        project: {
          ...validInventory().project,
          projectRef: "wrongprojectrefabcde",
        },
      },
    ],
  ])("rejects %s inventory before any mutation", async (_name, inventory) => {
    const managementClient = createManagementClient();

    await expect(
      runSupabaseStagingProvisioning({
        args: [
          "--execute",
          "--confirm-legacy-ref",
          manifest.supabase.legacy.staging.projectRef,
        ],
        commandRunner: vi.fn(),
        environment: {},
        inventoryReader: vi.fn().mockResolvedValue(inventory),
        log: vi.fn(),
        managementClient,
        manifest,
        now: () => now,
        wait: vi.fn(),
      }),
    ).rejects.toThrow(/inventory evidence/i);

    expect(managementClient.pauseProject).not.toHaveBeenCalled();
  });

  test.each([
    [
      "more than two active projects",
      [
        ...activeLegacyProjects(),
        project({ id: "thirdactiveprojectxy", name: "other" }),
      ],
      /active Supabase projects/i,
    ],
    [
      "production identity mismatch",
      activeLegacyProjects().map((item) =>
        item.id === manifest.supabase.legacy.production.projectRef
          ? { ...item, name: "wrong-production" }
          : item,
      ),
      /production.*divergent/i,
    ],
  ])("rejects %s before pausing", async (_name, projects, error) => {
    const managementClient = createManagementClient({ projects });

    await expect(executeProvisioning({ managementClient })).rejects.toThrow(
      error,
    );
    expect(managementClient.pauseProject).not.toHaveBeenCalled();
  });

  test("rejects unavailable sa-east-1 and a wrong confirmation", async () => {
    const unavailableRegionClient = createManagementClient({
      regions: {
        message: "available regions",
        regions: [{ code: "us-east-1" }],
      },
    });
    await expect(
      executeProvisioning({ managementClient: unavailableRegionClient }),
    ).rejects.toThrow(/sa-east-1.*unavailable/i);
    expect(unavailableRegionClient.pauseProject).not.toHaveBeenCalled();

    const wrongConfirmationClient = createManagementClient();
    await expect(
      executeProvisioning({
        args: ["--execute", "--confirm-legacy-ref", "wrong-ref"],
        managementClient: wrongConfirmationClient,
      }),
    ).rejects.toThrow(/confirmação literal/i);
    expect(wrongConfirmationClient.pauseProject).not.toHaveBeenCalled();

    const missingTargetConfirmationClient = createManagementClient();
    await expect(
      executeProvisioning({
        args: [
          "--execute",
          "--confirm-legacy-ref",
          manifest.supabase.legacy.staging.projectRef,
        ],
        managementClient: missingTargetConfirmationClient,
      }),
    ).rejects.toThrow(/confirmação literal/i);
    expect(missingTargetConfirmationClient.pauseProject).not.toHaveBeenCalled();
  });

  test("pauses only legacy staging, creates Nano-default staging, migrates, and configures Auth", async () => {
    const events: string[] = [];
    const managementClient = createManagementClient({ events });
    const commandRunner = vi.fn<CommandRunner>(async (_command, args) => {
      events.push(`command:${args.join(" ")}`);
      return { status: 0, stderr: "", stdout: "ok" };
    });
    const log = vi.fn();

    const result = await executeProvisioning({
      commandRunner,
      generatePassword: () => databasePassword,
      log,
      managementClient,
    });

    expect(managementClient.pauseProject).toHaveBeenCalledOnce();
    expect(managementClient.listAvailableRegions).toHaveBeenCalledWith(
      manifest.supabase.organization.id,
    );
    expect(managementClient.pauseProject).toHaveBeenCalledWith(
      manifest.supabase.legacy.staging.projectRef,
    );
    expect(managementClient.createProject).toHaveBeenCalledWith({
      dbPass: databasePassword,
      name: "roberto-multimarcas-pdv-staging",
      organizationSlug: "wcqoluxxlvglqtebcucz",
      region: "sa-east-1",
    });
    expect(
      Object.keys(managementClient.createProject.mock.calls[0][0]),
    ).not.toContain("desiredInstanceSize");
    expect(commandRunner.mock.calls.map((call) => call[1])).toEqual([
      ["supabase", "link", "--project-ref", newProjectRef],
      ["supabase", "db", "push", "--linked", "--dry-run"],
      ["supabase", "db", "push", "--linked"],
    ]);
    commandRunner.mock.calls.forEach((call) => {
      expect(call[2].environment.SUPABASE_DB_PASSWORD).toBe(databasePassword);
      expect(call[1]).not.toContain(databasePassword);
    });
    expect(managementClient.updateAuthConfig).toHaveBeenCalledWith(
      newProjectRef,
      {
        disable_signup: true,
        external_anonymous_users_enabled: false,
        external_email_enabled: true,
        password_hibp_enabled: true,
        password_min_length: 14,
        site_url: "https://roberto-multimarcas-pdv-staging.vercel.app",
        uri_allow_list: "https://roberto-multimarcas-pdv-staging.vercel.app/**",
      },
    );
    expect(events).toEqual([
      "pause:gpywbeoqcovjrfnmbdqx",
      "create:roberto-multimarcas-pdv-staging",
      `command:supabase link --project-ref ${newProjectRef}`,
      "command:supabase db push --linked --dry-run",
      "command:supabase db push --linked",
      `auth:${newProjectRef}`,
    ]);
    expect(result).toEqual({
      legacyState: "INACTIVE",
      mode: "executed",
      nextAction: "persist the target ref and run the staging bootstrap",
      productionState: "ACTIVE_HEALTHY",
      region: "sa-east-1",
      targetRef: newProjectRef,
      targetState: "ACTIVE_HEALTHY",
    });
    expect(JSON.stringify(result)).not.toContain(databasePassword);
    expect(JSON.stringify(log.mock.calls)).not.toContain(databasePassword);
  });

  test("rejects a divergent project returned after creation before linking or configuring it", async () => {
    const divergentProject = project({
      id: newProjectRef,
      name: manifest.supabase.targets.staging.name,
      region: "us-east-1",
    });
    const managementClient = createManagementClient({
      targetProject: divergentProject,
    });
    const commandRunner = vi
      .fn<CommandRunner>()
      .mockResolvedValue({ status: 0, stderr: "", stdout: "ok" });

    await expect(
      executeProvisioning({ commandRunner, managementClient }),
    ).rejects.toThrow(/staging identity.*divergent/i);

    expect(commandRunner).not.toHaveBeenCalled();
    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
    expect(managementClient.updateDatabasePassword).not.toHaveBeenCalled();
  });

  test("stops after a migration dry-run failure without Auth, delete, restore, or production mutation", async () => {
    const managementClient = createManagementClient();
    const commandRunner = vi.fn(async (_command, args) => ({
      status: args.includes("--dry-run") ? 1 : 0,
      stderr: args.includes("--dry-run") ? `failure ${databasePassword}` : "",
      stdout: "",
    }));

    let message = "";
    try {
      await executeProvisioning({
        commandRunner,
        generatePassword: () => databasePassword,
        managementClient,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("Supabase migration dry-run failed.");
    expect(message).toContain("[REDACTED]");
    expect(message).not.toContain(databasePassword);

    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
    expect("deleteProject" in managementClient).toBe(false);
    expect("restoreProject" in managementClient).toBe(false);
    expect(managementClient.pauseProject).not.toHaveBeenCalledWith(
      manifest.supabase.legacy.production.projectRef,
    );
  });

  test("resumes an existing healthy target without pausing or creating again", async () => {
    const target = project({
      id: persistedTargetRef,
      name: manifest.supabase.targets.staging.name,
      region: "sa-east-1",
    });
    const managementClient = createManagementClient({
      projects: [
        { ...activeLegacyProjects()[0], status: "INACTIVE" },
        activeLegacyProjects()[1],
        target,
      ],
      targetProject: target,
    });

    const result = await executeProvisioning({
      args: ["--execute", "--confirm-target-ref", persistedTargetRef],
      managementClient,
      provisionManifest: manifest,
    });

    expect(managementClient.pauseProject).not.toHaveBeenCalled();
    expect(managementClient.createProject).not.toHaveBeenCalled();
    expect(managementClient.updateDatabasePassword).toHaveBeenCalledWith(
      persistedTargetRef,
      databasePassword,
    );
    expect(result).toMatchObject({ targetRef: persistedTargetRef });
  });

  test("requires the literal persisted target ref before resuming mutations", async () => {
    const target = project({
      id: persistedTargetRef,
      name: manifest.supabase.targets.staging.name,
      region: "sa-east-1",
    });
    const managementClient = createManagementClient({
      projects: [
        { ...activeLegacyProjects()[0], status: "INACTIVE" },
        activeLegacyProjects()[1],
        target,
      ],
      targetProject: target,
    });
    const commandRunner = vi.fn<CommandRunner>();

    await expect(
      executeProvisioning({
        args: ["--execute", "--confirm-target-ref", newProjectRef],
        commandRunner,
        managementClient,
        provisionManifest: manifest,
      }),
    ).rejects.toThrow(/confirma.*literal/i);

    expect(managementClient.updateDatabasePassword).not.toHaveBeenCalled();
    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
    expect(commandRunner).not.toHaveBeenCalled();
  });

  test("rejects a same-name project whose ref differs from the persisted target", async () => {
    const divergentTarget = project({
      id: newProjectRef,
      name: manifest.supabase.targets.staging.name,
      region: "sa-east-1",
    });
    const managementClient = createManagementClient({
      projects: [
        { ...activeLegacyProjects()[0], status: "INACTIVE" },
        activeLegacyProjects()[1],
        divergentTarget,
      ],
      targetProject: divergentTarget,
    });

    await expect(
      executeProvisioning({
        args: ["--execute", "--confirm-target-ref", persistedTargetRef],
        managementClient,
        provisionManifest: manifest,
      }),
    ).rejects.toThrow(/staging identity.*divergent/i);

    expect(managementClient.updateDatabasePassword).not.toHaveBeenCalled();
    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
  });

  test("rejects a missing persisted target instead of creating a replacement", async () => {
    const managementClient = createManagementClient();

    await expect(
      executeProvisioning({
        args: [
          "--execute",
          "--confirm-legacy-ref",
          manifest.supabase.legacy.staging.projectRef,
          "--confirm-target-ref",
          persistedTargetRef,
        ],
        managementClient,
        provisionManifest: manifest,
      }),
    ).rejects.toThrow(/staging identity.*divergent/i);

    expect(managementClient.pauseProject).not.toHaveBeenCalled();
    expect(managementClient.createProject).not.toHaveBeenCalled();
  });

  test("falls back only when leaked-password protection is unavailable on Free", async () => {
    const managementClient = createManagementClient();
    managementClient.updateAuthConfig
      .mockRejectedValueOnce(
        new Error(
          "Supabase API returned 402: HaveIBeenPwned.org is available on Pro Plans and up.",
        ),
      )
      .mockResolvedValueOnce({ disable_signup: true });

    await executeProvisioning({ managementClient });

    expect(managementClient.updateAuthConfig).toHaveBeenCalledTimes(2);
    expect(managementClient.updateAuthConfig.mock.calls[0][1]).toMatchObject({
      password_hibp_enabled: true,
    });
    expect(managementClient.updateAuthConfig.mock.calls[1][1]).toEqual({
      disable_signup: true,
      external_anonymous_users_enabled: false,
      external_email_enabled: true,
      password_min_length: 14,
      site_url: "https://roberto-multimarcas-pdv-staging.vercel.app",
      uri_allow_list: "https://roberto-multimarcas-pdv-staging.vercel.app/**",
    });
  });
});

function executeProvisioning({
  args = [
    "--execute",
    "--confirm-legacy-ref",
    manifest.supabase.legacy.staging.projectRef,
    "--confirm-target-name",
    manifest.supabase.targets.staging.name,
  ],
  commandRunner = vi
    .fn()
    .mockResolvedValue({ status: 0, stderr: "", stdout: "" }),
  generatePassword = () => databasePassword,
  log = vi.fn(),
  managementClient = createManagementClient(),
  provisionManifest = unpersistedManifest,
}: ProvisionOptions = {}) {
  return runSupabaseStagingProvisioning({
    args,
    commandRunner,
    environment: { SUPABASE_ACCESS_TOKEN: "access-token-sentinel" },
    generatePassword,
    inventoryReader: vi.fn().mockResolvedValue(validInventory()),
    log,
    managementClient,
    manifest: provisionManifest,
    now: () => now,
    wait: vi.fn().mockResolvedValue(undefined),
  });
}

function createManagementClient({
  events = [],
  projects = activeLegacyProjects(),
  regions = [{ code: "sa-east-1" }, { code: "us-east-1" }],
  targetProject = project({
    id: newProjectRef,
    name: manifest.supabase.targets.staging.name,
    region: "sa-east-1",
  }),
}: ManagementClientOptions = {}) {
  let legacyPaused = false;
  let targetCreated = projects.some(
    (item) => item.name === manifest.supabase.targets.staging.name,
  );

  return {
    createProject: vi.fn(async ({ name }) => {
      events.push(`create:${name}`);
      targetCreated = true;
      return { ...targetProject, status: "COMING_UP" };
    }),
    getProject: vi.fn(async (projectRef: string) => {
      if (projectRef === manifest.supabase.legacy.staging.projectRef) {
        return {
          ...activeLegacyProjects()[0],
          status: legacyPaused ? "INACTIVE" : "ACTIVE_HEALTHY",
        };
      }
      if (projectRef === targetProject.id && targetCreated) {
        return targetProject;
      }
      throw new Error("unexpected project ref");
    }),
    listAvailableRegions: vi.fn().mockResolvedValue(regions),
    listProjects: vi.fn(async () => {
      if (!legacyPaused && !targetCreated) return projects;
      return projects.map((item) =>
        item.id === manifest.supabase.legacy.staging.projectRef
          ? { ...item, status: legacyPaused ? "INACTIVE" : item.status }
          : item,
      );
    }),
    pauseProject: vi.fn(async (projectRef: string) => {
      events.push(`pause:${projectRef}`);
      legacyPaused = true;
      return null;
    }),
    updateAuthConfig: vi.fn(
      async (projectRef: string, configuration: Record<string, unknown>) => {
        void configuration;
        events.push(`auth:${projectRef}`);
        return { disable_signup: true };
      },
    ),
    updateDatabasePassword: vi.fn(async () => ({ message: "updated" })),
  };
}

type CommandResult = { status: number; stderr: string; stdout: string };
type CommandRunner = (
  command: string,
  args: string[],
  options: { environment: Record<string, string> },
) => Promise<CommandResult>;

type ManagementClientOptions = {
  events?: string[];
  projects?: ReturnType<typeof project>[];
  regions?: unknown;
  targetProject?: ReturnType<typeof project>;
};

type ProvisionOptions = {
  args?: string[];
  commandRunner?: ReturnType<typeof vi.fn<CommandRunner>>;
  generatePassword?: () => string;
  log?: ReturnType<typeof vi.fn>;
  managementClient?: ReturnType<typeof createManagementClient>;
  provisionManifest?: typeof manifest;
};

function activeLegacyProjects() {
  return [
    project({
      id: manifest.supabase.legacy.staging.projectRef,
      name: manifest.supabase.legacy.staging.name,
      region: "us-west-2",
    }),
    project({
      id: manifest.supabase.legacy.production.projectRef,
      name: manifest.supabase.legacy.production.name,
      region: "us-west-2",
    }),
  ];
}

function project({
  id,
  name,
  region = "us-west-2",
}: {
  id: string;
  name: string;
  region?: string;
}) {
  return {
    id,
    name,
    organization_id: manifest.supabase.organization.id,
    region,
    status: "ACTIVE_HEALTHY",
  };
}

function validInventory(capturedAt = "2026-10-07T11:00:00.000Z") {
  return {
    capturedAt,
    project: {
      name: manifest.supabase.legacy.staging.name,
      projectRef: manifest.supabase.legacy.staging.projectRef,
      region: manifest.supabase.legacy.staging.region,
      status: "ACTIVE_HEALTHY",
    },
  };
}
