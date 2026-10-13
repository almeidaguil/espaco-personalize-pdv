import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { runBootstrapProductionAdminCli } from "./bootstrap-production-admin.mjs";

const projectRef = "abcdefghijklmnopqrst";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const email = "owner@roberto-multimarcas.test";
const password = "Strong-production-password-2026!";
const fullName = "Administrador Roberto";

describe("runBootstrapProductionAdminCli", () => {
  test("creates the sole admin and records verified empty production", async () => {
    const adminApi = createAdminApi();
    const recordPhase = vi.fn(async ({ phase }) => ({ phase }));

    const result = await runCli({ adminApi, recordPhase });

    expect(result).toEqual({
      created: true,
      environment: "production",
      role: "admin",
      userId,
    });
    expect(recordPhase).toHaveBeenCalledWith({
      facts: { adminCount: 1, operationalRowCount: 0, operatorCount: 0 },
      phase: "admin-ready",
      previousState: expect.objectContaining({ phase: "database-ready" }),
    });
    expect(JSON.stringify(result)).not.toContain(email);
    expect(JSON.stringify(result)).not.toContain(password);
  });

  test("is idempotent for the same sole administrator", async () => {
    const adminApi = createAdminApi({
      profile: { email, full_name: fullName, id: userId, role: "admin" },
      users: [{ email, id: userId }],
    });

    await expect(runCli({ adminApi })).resolves.toMatchObject({
      created: false,
      userId,
    });
    expect(adminApi.createUser).not.toHaveBeenCalled();
  });

  test.each([
    ["operators", { adminCount: 1, operationalRowCount: 0, operatorCount: 1 }],
    [
      "operational rows",
      { adminCount: 1, operationalRowCount: 1, operatorCount: 0 },
    ],
    [
      "admin count",
      { adminCount: 2, operationalRowCount: 0, operatorCount: 0 },
    ],
  ])(
    "rejects non-empty or divergent production: %s",
    async (_name, postcondition) => {
      const adminApi = createAdminApi({ postcondition });

      await expect(runCli({ adminApi })).rejects.toThrow(/postcondition/i);
    },
  );

  test("requires database-ready state and exact target confirmation", async () => {
    const adminApi = createAdminApi();
    await expect(
      runCli({ adminApi, state: { phase: "production-created" } }),
    ).rejects.toThrow(/database-ready/i);
    expect(adminApi.listUsers).not.toHaveBeenCalled();

    await expect(
      runCli({ adminApi, argv: ["--execute", "--confirm-ref", "wrong-ref"] }),
    ).rejects.toThrow(/literal/i);
    expect(adminApi.createUser).not.toHaveBeenCalled();
  });

  test("rejects cutover state recorded for another production ref", async () => {
    const adminApi = createAdminApi();
    const state = databaseReadyState("zyxwvutsrqponmlkjihg");

    await expect(runCli({ adminApi, state })).rejects.toThrow(/state.*ref/i);
    expect(adminApi.listUsers).not.toHaveBeenCalled();
    expect(adminApi.createUser).not.toHaveBeenCalled();
  });

  test("prints help without loading credentials or providers", async () => {
    const loadManifest = vi.fn();
    const log = vi.fn();

    await expect(
      runBootstrapProductionAdminCli(["--help"], { loadManifest, log }),
    ).resolves.toBeUndefined();
    expect(loadManifest).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/--execute/i));
  });
});

function runCli({
  adminApi,
  argv = ["--execute", "--confirm-ref", projectRef],
  recordPhase = vi.fn(),
  state = databaseReadyState(projectRef),
}: {
  adminApi: ReturnType<typeof createAdminApi>;
  argv?: string[];
  recordPhase?: ReturnType<typeof vi.fn>;
  state?: { history?: unknown[]; phase: string };
}) {
  return runBootstrapProductionAdminCli(argv, {
    adminApi,
    environment: {
      PRODUCTION_ADMIN_EMAIL: email,
      PRODUCTION_ADMIN_FULL_NAME: fullName,
      PRODUCTION_ADMIN_PASSWORD: password,
      SUPABASE_ACCESS_TOKEN: "access-token-sentinel",
    },
    loadManifest: vi.fn().mockResolvedValue(persistedManifest()),
    loadState: vi.fn().mockResolvedValue(state),
    log: vi.fn(),
    recordPhase,
  });
}

function databaseReadyState(ref: string) {
  return {
    history: [
      { facts: { projectRef: ref }, phase: "production-created" },
      { facts: { projectRef: ref }, phase: "database-ready" },
    ],
    phase: "database-ready",
  };
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
          hostname: `${projectRef}.supabase.co`,
          projectRef,
        },
      },
    },
  };
}

function createAdminApi({
  postcondition = { adminCount: 1, operationalRowCount: 0, operatorCount: 0 },
  profile = null,
  users = [],
}: {
  postcondition?: {
    adminCount: number;
    operationalRowCount: number;
    operatorCount: number;
  };
  profile?: Record<string, unknown> | null;
  users?: { email: string; id: string }[];
} = {}) {
  let currentUsers = [...users];
  let currentProfile = profile;
  return {
    createUser: vi.fn(async () => {
      currentUsers = [{ email, id: userId }];
      return { email, id: userId };
    }),
    getPostcondition: vi.fn().mockResolvedValue(postcondition),
    getProfile: vi.fn(async () => currentProfile),
    listUsers: vi.fn(async () => currentUsers),
    upsertProfile: vi.fn(async (value) => {
      currentProfile = value;
      return value;
    }),
  };
}
