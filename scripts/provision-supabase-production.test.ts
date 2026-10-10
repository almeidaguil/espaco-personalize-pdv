import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { createProductionBackupEvidence } from "./production-backup-evidence.mjs";
import {
  runProvisionSupabaseProductionCli,
  runSupabaseProductionProvisioning,
} from "./provision-supabase-production.mjs";

const newProductionRef = "abcdefghijklmnopqrst";
const databasePassword = "database-password-sentinel-Aa1!";
const now = new Date("2026-10-09T12:30:00.000Z");
const gitIdentity = {
  commitSha: "a".repeat(40),
  sourceRef: "feature/production-cutover",
};

describe("runSupabaseProductionProvisioning", () => {
  test("returns a verified dry-run without mutable calls or state writes", async () => {
    const managementClient = createManagementClient();
    const recordPhase = vi.fn();

    const result = await runProvisioning({
      managementClient,
      options: { execute: false },
      recordPhase,
    });

    expect(result).toMatchObject({
      legacyProductionState: "ACTIVE_HEALTHY",
      mode: "dry-run",
      newProductionState: "absent",
      region: "sa-east-1",
      stagingState: "ACTIVE_HEALTHY",
    });
    expect(managementClient.pauseProject).not.toHaveBeenCalled();
    expect(managementClient.createProject).not.toHaveBeenCalled();
    expect(recordPhase).not.toHaveBeenCalled();
  });

  test.each([
    ["stale evidence", { evidence: evidenceAt("2026-10-09T11:29:59.999Z") }],
    ["unhealthy staging", { clientOptions: { stagingStatus: "INACTIVE" } }],
    ["unknown active project", { clientOptions: { unknownActive: true } }],
  ])("rejects %s before any mutation", async (_name, override) => {
    const managementClient = createManagementClient(
      "clientOptions" in override ? override.clientOptions : undefined,
    );

    await expect(
      runProvisioning({
        evidence: "evidence" in override ? override.evidence : undefined,
        managementClient,
        options: firstExecutionOptions(),
      }),
    ).rejects.toThrow(/evidence|staging|topology|active project/i);

    expect(managementClient.pauseProject).not.toHaveBeenCalled();
    expect(managementClient.createProject).not.toHaveBeenCalled();
  });

  test("pauses the exact legacy production before creating the new project", async () => {
    const events: string[] = [];
    const managementClient = createManagementClient({ events });
    const recorder = createStateRecorder();
    const commandRunner = vi.fn();

    const result = await runProvisioning({
      commandRunner,
      managementClient,
      options: firstExecutionOptions(),
      recordPhase: recorder.recordPhase,
    });

    expect(events).toEqual([
      "pause:ciixpfquwmlsvzleattv",
      "create:roberto-multimarcas-pdv:sa-east-1",
    ]);
    expect(managementClient.createProject).toHaveBeenCalledWith({
      dbPass: databasePassword,
      name: "roberto-multimarcas-pdv",
      organizationSlug: "wcqoluxxlvglqtebcucz",
      region: "sa-east-1",
    });
    expect(result).toMatchObject({
      legacyProductionState: "INACTIVE",
      mode: "executed",
      nextAction: "persist-production-target",
      targetRef: newProductionRef,
      targetState: "ACTIVE_HEALTHY",
    });
    expect(recorder.phases()).toEqual([
      "preflight",
      "backup-recorded",
      "legacy-paused",
      "production-created",
    ]);
    expect(commandRunner).not.toHaveBeenCalled();
    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
  });

  test("never creates while the legacy project has not reached INACTIVE", async () => {
    const managementClient = createManagementClient({
      pauseDoesNotComplete: true,
    });

    await expect(
      runProvisioning({
        managementClient,
        options: firstExecutionOptions(),
      }),
    ).rejects.toThrow(/did not reach INACTIVE/i);

    expect(managementClient.createProject).not.toHaveBeenCalled();
  });

  test("reconciles an interrupted creation by exact ref without creating a duplicate", async () => {
    const managementClient = createManagementClient({
      createdProjectStalls: true,
    });
    const recorder = createStateRecorder();

    await expect(
      runProvisioning({
        managementClient,
        options: firstExecutionOptions(),
        recordPhase: recorder.recordPhase,
      }),
    ).rejects.toThrow(/did not reach ACTIVE_HEALTHY/i);
    expect(recorder.currentState()?.phase).toBe("legacy-paused");
    expect(managementClient.createProject).toHaveBeenCalledTimes(1);

    managementClient.activateProduction();
    await expect(
      runProvisioning({
        managementClient,
        options: { confirmTargetRef: newProductionRef, execute: true },
        recordPhase: recorder.recordPhase,
        state: recorder.currentState(),
      }),
    ).resolves.toMatchObject({
      nextAction: "persist-production-target",
      targetRef: newProductionRef,
    });
    expect(managementClient.createProject).toHaveBeenCalledTimes(1);
    expect(recorder.phases()).toEqual([
      "preflight",
      "backup-recorded",
      "legacy-paused",
      "production-created",
    ]);
  });

  test("accepts stale but hash-matching backup evidence after the legacy pause", async () => {
    const staleEvidence = evidenceAt("2026-10-09T10:00:00.000Z");
    const managementClient = createManagementClient({ targetExists: true });

    await expect(
      runProvisioning({
        commandRunner: vi.fn().mockReturnValue({
          status: 0,
          stderr: "",
          stdout: "ok",
        }),
        evidence: staleEvidence,
        managementClient,
        manifest: persistedManifest(),
        options: { confirmTargetRef: newProductionRef, execute: true },
        state: productionCreatedState(staleEvidence),
      }),
    ).resolves.toMatchObject({ phase: "database-ready" });
  });

  test("rejects resumed backup evidence that differs from the recorded hash", async () => {
    const recordedEvidence = evidenceAt("2026-10-09T10:00:00.000Z");
    const differentEvidence = evidenceAt("2026-10-09T10:00:01.000Z");
    const managementClient = createManagementClient({ targetExists: true });

    await expect(
      runProvisioning({
        evidence: differentEvidence,
        managementClient,
        manifest: persistedManifest(),
        options: { confirmTargetRef: newProductionRef, execute: true },
        state: productionCreatedState(recordedEvidence),
      }),
    ).rejects.toThrow(/backup evidence.*state|state.*backup evidence/i);
    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
  });

  test("requires exact first-cut and resume confirmations", async () => {
    const managementClient = createManagementClient();
    await expect(
      runProvisioning({
        managementClient,
        options: { ...firstExecutionOptions(), confirmLegacyRef: "wrong-ref" },
      }),
    ).rejects.toThrow(/literal/i);
    expect(managementClient.pauseProject).not.toHaveBeenCalled();

    const manifest = persistedManifest();
    const resumedClient = createManagementClient({ targetExists: true });
    await expect(
      runProvisioning({
        managementClient: resumedClient,
        manifest,
        options: {
          confirmTargetRef: "wrong-ref",
          execute: true,
        },
        state: productionCreatedState(),
      }),
    ).rejects.toThrow(/literal/i);
    expect(resumedClient.updateAuthConfig).not.toHaveBeenCalled();
  });

  test.each([
    ["legacy pause", legacyPausedState()],
    ["production creation", productionCreatedState()],
  ])(
    "fails closed when the recorded %s diverges from the provider",
    async (_name, state) => {
      const managementClient = createManagementClient();

      await expect(
        runProvisioning({
          managementClient,
          options: firstExecutionOptions(),
          state,
        }),
      ).rejects.toThrow(/diverge/i);

      expect(managementClient.pauseProject).not.toHaveBeenCalled();
      expect(managementClient.createProject).not.toHaveBeenCalled();
    },
  );

  test("resumes the persisted target, dry-runs migrations before push and verifies Auth", async () => {
    const managementClient = createManagementClient({ targetExists: true });
    const recorder = createStateRecorder(productionCreatedState());
    const commandRunner = vi.fn().mockReturnValue({
      status: 0,
      stderr: "",
      stdout: "ok",
    });

    const result = await runProvisioning({
      commandRunner,
      managementClient,
      manifest: persistedManifest(),
      options: { confirmTargetRef: newProductionRef, execute: true },
      recordPhase: recorder.recordPhase,
      state: productionCreatedState(),
    });

    expect(commandRunner.mock.calls.map((call) => call[1])).toEqual([
      ["supabase", "link", "--project-ref", newProductionRef],
      ["supabase", "db", "push", "--linked", "--dry-run"],
      ["supabase", "db", "push", "--linked"],
    ]);
    for (const call of commandRunner.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain(databasePassword);
      expect(call[2].environment.SUPABASE_DB_PASSWORD).toBe(databasePassword);
    }
    expect(managementClient.updateAuthConfig).toHaveBeenCalledWith(
      newProductionRef,
      {
        disable_signup: true,
        external_anonymous_users_enabled: false,
        external_email_enabled: true,
        password_hibp_enabled: true,
        password_min_length: 14,
        site_url: "https://roberto-multimarcas-pdv.vercel.app",
        uri_allow_list: "https://roberto-multimarcas-pdv.vercel.app/**",
      },
    );
    expect(result).toMatchObject({
      mode: "executed",
      nextAction: "bootstrap-production-admin",
      phase: "database-ready",
      targetRef: newProductionRef,
    });
    expect(recorder.phases()).toEqual(["database-ready"]);
    expect(managementClient.pauseProject).not.toHaveBeenCalled();
    expect(managementClient.createProject).not.toHaveBeenCalled();
  });

  test("stops after migration dry-run failure without push, Auth or destructive operations", async () => {
    const managementClient = createManagementClient({ targetExists: true });
    const commandRunner = vi
      .fn()
      .mockReturnValueOnce({ status: 0, stderr: "", stdout: "linked" })
      .mockReturnValueOnce({
        status: 1,
        stderr: `failed ${databasePassword}`,
        stdout: "",
      });

    let message = "";
    try {
      await runProvisioning({
        commandRunner,
        managementClient,
        manifest: persistedManifest(),
        options: { confirmTargetRef: newProductionRef, execute: true },
        state: productionCreatedState(),
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/migration dry-run failed/i);
    expect(message).not.toContain(databasePassword);
    expect(commandRunner).toHaveBeenCalledTimes(2);
    expect(managementClient.updateAuthConfig).not.toHaveBeenCalled();
    expect(managementClient).not.toHaveProperty("deleteProject");
    expect(managementClient).not.toHaveProperty("restoreProject");
    expect(managementClient).not.toHaveProperty("resetDatabase");
  });
});

describe("runProvisionSupabaseProductionCli", () => {
  test("documents dry-run usage without reading credentials or remote state", async () => {
    const log = vi.fn();
    const loadManifest = vi.fn();

    await expect(
      runProvisionSupabaseProductionCli(["--help"], { loadManifest, log }),
    ).resolves.toBeUndefined();

    expect(loadManifest).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringMatching(/dry-run|--execute/i),
    );
  });

  test.each([
    [["--inventory"], /requires a value/i],
    [["--inventory", "one.json", "--inventory", "two.json"], /duplicate/i],
    [["--unknown", "value"], /unexpected argument/i],
  ])(
    "rejects invalid arguments before loading providers",
    async (argv, error) => {
      const loadManifest = vi.fn();
      await expect(
        runProvisionSupabaseProductionCli(argv, { loadManifest, log: vi.fn() }),
      ).rejects.toThrow(error);
      expect(loadManifest).not.toHaveBeenCalled();
    },
  );

  test("loads resumed state before allowing old but recorded evidence", async () => {
    const staleEvidence = evidenceAt("2026-10-09T10:00:00.000Z");
    const readEvidence = vi.fn(async (input) => {
      expect(input.allowExpired).toBe(true);
      expect(input.maximumAgeMs).toBeUndefined();
      throw new Error("evidence-policy-observed");
    });

    await expect(
      runProvisionSupabaseProductionCli(["--inventory", "backup.json"], {
        loadManifest: vi.fn(async () => persistedManifest()),
        loadState: vi.fn(async () => productionCreatedState(staleEvidence)),
        log: vi.fn(),
        now: () => now,
        readEvidence,
      }),
    ).rejects.toThrow("evidence-policy-observed");
    expect(readEvidence).toHaveBeenCalledOnce();
  });
});

function runProvisioning({
  commandRunner = vi.fn(),
  evidence = evidenceAt("2026-10-09T12:00:00.000Z"),
  managementClient = createManagementClient(),
  manifest = manifestFixture,
  options = { execute: false },
  recordPhase = createStateRecorder().recordPhase,
  state = null,
}: {
  commandRunner?: ReturnType<typeof vi.fn>;
  evidence?: ReturnType<typeof createProductionBackupEvidence>;
  managementClient?: ReturnType<typeof createManagementClient>;
  manifest?: typeof manifestFixture | ReturnType<typeof persistedManifest>;
  options?: Record<string, boolean | string>;
  recordPhase?: ReturnType<typeof vi.fn>;
  state?: unknown;
}) {
  return runSupabaseProductionProvisioning({
    commandRunner,
    environment: {
      SUPABASE_ACCESS_TOKEN: "access-token-sentinel",
      SUPABASE_DB_PASSWORD: databasePassword,
    },
    evidence,
    gitIdentity,
    log: vi.fn(),
    managementClient,
    manifest,
    migrationHead: "20261008000000",
    now: () => now,
    options,
    recordPhase,
    state,
    wait: vi.fn(),
  });
}

function firstExecutionOptions() {
  return {
    confirmLegacyRef: "ciixpfquwmlsvzleattv",
    confirmTargetName: "roberto-multimarcas-pdv",
    execute: true,
  };
}

function evidenceAt(capturedAt: string) {
  return createProductionBackupEvidence({
    auth: {
      configuration: {
        anonymousUsersEnabled: false,
        disableSignup: true,
        emailEnabled: true,
        leakedPasswordProtectionEnabled: true,
        minimumPasswordLength: 14,
        siteUrl: "https://legacy.example.test",
      },
      usersByRole: { admin: 1 },
    },
    capturedAt,
    database: {
      migrations: ["20261008000000"],
      schema: { extensions: [], tables: ["products"] },
      tableCounts: { products: 0 },
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
    storage: { buckets: [] },
  });
}

function persistedManifest() {
  return {
    ...structuredClone(manifestFixture),
    supabase: {
      ...structuredClone(manifestFixture.supabase),
      targets: {
        ...structuredClone(manifestFixture.supabase.targets),
        production: {
          ...structuredClone(manifestFixture.supabase.targets.production),
          hostname: `${newProductionRef}.supabase.co`,
          projectRef: newProductionRef,
        },
      },
    },
  };
}

function productionCreatedState(
  evidence = evidenceAt("2026-10-09T12:00:00.000Z"),
) {
  return {
    history: [
      ...legacyPausedState(evidence).history,
      {
        completedAt: "2026-10-09T12:10:00.000Z",
        facts: {
          hostname: `${newProductionRef}.supabase.co`,
          name: "roberto-multimarcas-pdv",
          organizationId: "wcqoluxxlvglqtebcucz",
          projectRef: newProductionRef,
          region: "sa-east-1",
        },
        phase: "production-created",
      },
    ],
    phase: "production-created",
  } as const;
}

function legacyPausedState(evidence = evidenceAt("2026-10-09T12:00:00.000Z")) {
  return {
    history: [
      {
        completedAt: "2026-10-09T12:00:00.000Z",
        facts: {
          commitSha: gitIdentity.commitSha,
          manifestVersion: 2,
          sourceRef: gitIdentity.sourceRef,
        },
        phase: "preflight",
      },
      {
        completedAt: "2026-10-09T12:01:00.000Z",
        facts: {
          capturedAt: evidence.capturedAt,
          evidenceSha256: evidence.sha256,
          sourceProjectRef: evidence.source.projectRef,
        },
        phase: "backup-recorded",
      },
      {
        completedAt: "2026-10-09T12:05:00.000Z",
        facts: {
          projectRef: "ciixpfquwmlsvzleattv",
          status: "INACTIVE",
        },
        phase: "legacy-paused",
      },
    ],
    phase: "legacy-paused",
  } as const;
}

function createStateRecorder(initialState: unknown = null) {
  let currentState = initialState as {
    history?: Array<{ facts: unknown; phase: string }>;
    phase?: string;
  } | null;
  const recorded: string[] = [];
  const recordPhase = vi.fn(
    async ({ facts, phase }: { facts: unknown; phase: string }) => {
      recorded.push(phase);
      currentState = {
        history: [...(currentState?.history ?? []), { facts, phase }],
        phase,
      };
      return currentState;
    },
  );
  return {
    currentState: () => currentState,
    phases: () => recorded,
    recordPhase,
  };
}

function createManagementClient({
  events = [],
  createdProjectStalls = false,
  pauseDoesNotComplete = false,
  stagingStatus = "ACTIVE_HEALTHY",
  targetExists = false,
  unknownActive = false,
}: {
  events?: string[];
  createdProjectStalls?: boolean;
  pauseDoesNotComplete?: boolean;
  stagingStatus?: string;
  targetExists?: boolean;
  unknownActive?: boolean;
} = {}) {
  let productionIsStalled = createdProjectStalls;
  const projects = [
    project({
      id: "gpywbeoqcovjrfnmbdqx",
      name: "espaco-personalize-pdv-staging",
      region: "us-west-2",
      status: "INACTIVE",
    }),
    project({
      id: "otsxpchqtfypxgzjzrxs",
      name: "roberto-multimarcas-pdv-staging",
      region: "sa-east-1",
      status: stagingStatus,
    }),
    project({
      id: "ciixpfquwmlsvzleattv",
      name: "espaco-personalize-pdv",
      region: "us-west-2",
      status: targetExists ? "INACTIVE" : "ACTIVE_HEALTHY",
    }),
  ];
  if (targetExists) {
    projects.push(
      project({
        id: newProductionRef,
        name: "roberto-multimarcas-pdv",
        region: "sa-east-1",
        status: "ACTIVE_HEALTHY",
      }),
    );
  }
  if (unknownActive) {
    projects.push(
      project({
        id: "zyxwvutsrqponmlkjihg",
        name: "unexpected-project",
        region: "sa-east-1",
        status: "ACTIVE_HEALTHY",
      }),
    );
  }

  const authConfiguration = {
    disable_signup: true,
    external_anonymous_users_enabled: false,
    external_email_enabled: true,
    password_hibp_enabled: true,
    password_min_length: 14,
    site_url: "https://roberto-multimarcas-pdv.vercel.app",
    uri_allow_list: "https://roberto-multimarcas-pdv.vercel.app/**",
  };
  return {
    createProject: vi.fn(async (input: { name: string; region: string }) => {
      events.push(`create:${input.name}:${input.region}`);
      const created = project({
        id: newProductionRef,
        name: input.name,
        region: input.region,
        status: "ACTIVE_HEALTHY",
      });
      projects.push(created);
      return created;
    }),
    getAuthConfig: vi.fn().mockResolvedValue(authConfiguration),
    getProject: vi.fn(async (projectRef: string) => {
      const value = projects.find((item) => item.id === projectRef);
      if (value?.id === "ciixpfquwmlsvzleattv" && pauseDoesNotComplete) {
        return { ...value, status: "ACTIVE_HEALTHY" };
      }
      if (value?.id === newProductionRef && productionIsStalled) {
        return { ...value, status: "COMING_UP" };
      }
      return value;
    }),
    listAvailableRegions: vi.fn().mockResolvedValue([{ code: "sa-east-1" }]),
    listProjects: vi.fn(async () => structuredClone(projects)),
    pauseProject: vi.fn(async (projectRef: string) => {
      events.push(`pause:${projectRef}`);
      const legacy = projects.find((item) => item.id === projectRef)!;
      if (!pauseDoesNotComplete) legacy.status = "INACTIVE";
      return { status: "pausing" };
    }),
    updateAuthConfig: vi.fn().mockResolvedValue(authConfiguration),
    activateProduction: () => {
      productionIsStalled = false;
    },
  };
}

function project({
  id,
  name,
  region,
  status,
}: {
  id: string;
  name: string;
  region: string;
  status: string;
}) {
  return {
    id,
    name,
    organization_id: "wcqoluxxlvglqtebcucz",
    region,
    status,
  };
}
