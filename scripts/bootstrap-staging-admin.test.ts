import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { parseRemoteEnvironmentManifest } from "./remote-environment-policy.mjs";
import { bootstrapStagingAdmin } from "./bootstrap-staging-admin.mjs";

const projectRef = "qrstabcdefghijklmnop";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const email = "owner@roberto-multimarcas.test";
const password = "Strong-staging-password-2026!";
const fullName = "Administrador Roberto";
const manifest = createManifest();

describe("bootstrapStagingAdmin", () => {
  test.each([
    [
      {},
      /STAGING_ADMIN_EMAIL.*STAGING_ADMIN_PASSWORD.*STAGING_ADMIN_FULL_NAME/,
    ],
    [validEnvironment({ STAGING_ADMIN_PASSWORD: "Short1!" }), /14 characters/],
    [
      validEnvironment({ STAGING_ADMIN_PASSWORD: "alllowercasepassword" }),
      /strong password/i,
    ],
    [
      validEnvironment({
        E2E_USER_EMAIL: email,
        E2E_USER_PASSWORD: "different-password",
      }),
      /local E2E credentials/i,
    ],
    [
      validEnvironment({
        E2E_USER_EMAIL: "other@example.test",
        E2E_USER_PASSWORD: password,
      }),
      /local E2E credentials/i,
    ],
  ])(
    "rejects invalid credentials before reading users",
    async (environment, error) => {
      const supabaseAdmin = createSupabaseAdmin();

      await expect(
        bootstrapStagingAdmin({
          confirmation: projectRef,
          environment,
          execute: true,
          log: vi.fn(),
          manifest,
          supabaseAdmin,
        }),
      ).rejects.toThrow(error);
      expect(supabaseAdmin.listUsers).not.toHaveBeenCalled();
    },
  );

  test("returns a redacted dry-run without creating a user", async () => {
    const supabaseAdmin = createSupabaseAdmin();
    const log = vi.fn();

    const result = await bootstrapStagingAdmin({
      confirmation: undefined,
      environment: validEnvironment(),
      execute: false,
      log,
      manifest,
      supabaseAdmin,
    });

    expect(result).toEqual({
      action: "create-admin",
      mode: "dry-run",
      projectRef,
      userCount: 0,
    });
    expect(supabaseAdmin.createUser).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(email);
    expect(JSON.stringify(log.mock.calls)).not.toContain(password);
    expect(JSON.stringify(log.mock.calls)).not.toContain(email);
  });

  test("creates exactly one admin and reconciles the trigger-created profile", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      createdProfile: {
        email,
        full_name: fullName,
        id: userId,
        role: "operator",
      },
    });

    const result = await bootstrapStagingAdmin({
      confirmation: projectRef,
      environment: validEnvironment(),
      execute: true,
      log: vi.fn(),
      manifest,
      supabaseAdmin,
    });

    expect(supabaseAdmin.createUser).toHaveBeenCalledOnce();
    expect(supabaseAdmin.createUser).toHaveBeenCalledWith({
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: fullName, role: "admin" },
    });
    expect(supabaseAdmin.upsertProfile).toHaveBeenCalledWith({
      email,
      full_name: fullName,
      id: userId,
      role: "admin",
    });
    expect(result).toEqual({
      action: "created",
      mode: "executed",
      projectRef,
      userCount: 1,
    });
  });

  test("is idempotent for the same existing administrator", async () => {
    const supabaseAdmin = createSupabaseAdmin({
      profile: { email, full_name: fullName, id: userId, role: "admin" },
      users: [{ email, id: userId }],
    });

    const result = await bootstrapStagingAdmin({
      confirmation: projectRef,
      environment: validEnvironment(),
      execute: true,
      log: vi.fn(),
      manifest,
      supabaseAdmin,
    });

    expect(result.action).toBe("unchanged");
    expect(supabaseAdmin.createUser).not.toHaveBeenCalled();
    expect(supabaseAdmin.upsertProfile).not.toHaveBeenCalled();
  });

  test.each([
    [
      "an incompatible profile",
      [{ email, id: userId }],
      { email, full_name: fullName, id: userId, role: "operator" },
      /incompatible admin profile/i,
    ],
    [
      "a different existing email",
      [{ email: "different@example.test", id: userId }],
      null,
      /different Auth user/i,
    ],
    [
      "additional users",
      [
        { email, id: userId },
        {
          email: "operator@example.test",
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
      ],
      { email, full_name: fullName, id: userId, role: "admin" },
      /exactly zero or one Auth user/i,
    ],
  ])(
    "refuses %s without overwriting data",
    async (_name, users, profile, error) => {
      const supabaseAdmin = createSupabaseAdmin({ profile, users });

      await expect(
        bootstrapStagingAdmin({
          confirmation: projectRef,
          environment: validEnvironment(),
          execute: true,
          log: vi.fn(),
          manifest,
          supabaseAdmin,
        }),
      ).rejects.toThrow(error);
      expect(supabaseAdmin.createUser).not.toHaveBeenCalled();
      expect(supabaseAdmin.upsertProfile).not.toHaveBeenCalled();
    },
  );

  test("redacts email, password, token, and provider errors", async () => {
    const token = "service-key-sentinel";
    const supabaseAdmin = createSupabaseAdmin();
    supabaseAdmin.createUser.mockRejectedValue(
      new Error(`${email} ${password} ${token}`),
    );

    let message = "";
    try {
      await bootstrapStagingAdmin({
        confirmation: projectRef,
        environment: validEnvironment({ SUPABASE_SECRET_KEY: token }),
        execute: true,
        log: vi.fn(),
        manifest,
        supabaseAdmin,
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("Unable to create the staging administrator.");
    expect(message).not.toContain(email);
    expect(message).not.toContain(password);
    expect(message).not.toContain(token);
  });
});

function createManifest() {
  const value = {
    ...manifestFixture,
    supabase: {
      ...manifestFixture.supabase,
      targets: {
        ...manifestFixture.supabase.targets,
        staging: {
          ...manifestFixture.supabase.targets.staging,
          hostname: `${projectRef}.supabase.co`,
          projectRef,
        },
      },
    },
  };
  return parseRemoteEnvironmentManifest(value);
}

function validEnvironment(overrides: Record<string, string> = {}) {
  return {
    STAGING_ADMIN_EMAIL: email,
    STAGING_ADMIN_FULL_NAME: fullName,
    STAGING_ADMIN_PASSWORD: password,
    ...overrides,
  };
}

function createSupabaseAdmin({
  createdProfile = null,
  profile = null,
  users = [],
}: {
  createdProfile?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
  users?: { email: string; id: string }[];
} = {}) {
  let currentProfile = profile;
  return {
    createUser: vi.fn().mockResolvedValue({ email, id: userId }),
    getProfile: vi.fn(async () => currentProfile ?? createdProfile),
    listUsers: vi.fn().mockResolvedValue(users),
    upsertProfile: vi.fn(async (value) => {
      currentProfile = value;
      return value;
    }),
  };
}
