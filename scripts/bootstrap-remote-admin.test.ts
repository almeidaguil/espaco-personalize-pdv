import { describe, expect, test, vi } from "vitest";

import manifestFixture from "../config/remote-environments.json";
import { bootstrapRemoteAdmin } from "./bootstrap-remote-admin.mjs";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const email = "owner@roberto-multimarcas.test";
const password = "Strong-production-password-2026!";
const fullName = "Administrador Roberto";

describe("bootstrapRemoteAdmin", () => {
  test("creates and verifies exactly one administrator", async () => {
    const adminApi = createAdminApi();

    const result = await bootstrapRemoteAdmin({
      adminApi,
      confirmation: "otsxpchqtfypxgzjzrxs",
      credentials: { email, fullName, password },
      environment: "staging",
      execute: true,
      logger: vi.fn(),
      manifest: manifestFixture,
    });

    expect(adminApi.createUser).toHaveBeenCalledOnce();
    expect(adminApi.upsertProfile).toHaveBeenCalledWith({
      email,
      full_name: fullName,
      id: userId,
      role: "admin",
    });
    expect(result).toEqual({
      created: true,
      environment: "staging",
      role: "admin",
      userId,
    });
    expect(JSON.stringify(result)).not.toContain(email);
    expect(JSON.stringify(result)).not.toContain(password);
  });

  test("is idempotent for a compatible existing administrator", async () => {
    const adminApi = createAdminApi({
      profile: { email, full_name: fullName, id: userId, role: "admin" },
      users: [{ email, id: userId }],
    });

    await expect(
      bootstrapRemoteAdmin({
        adminApi,
        confirmation: "otsxpchqtfypxgzjzrxs",
        credentials: { email, fullName, password },
        environment: "staging",
        execute: true,
        logger: vi.fn(),
        manifest: manifestFixture,
      }),
    ).resolves.toMatchObject({ created: false, userId });
    expect(adminApi.createUser).not.toHaveBeenCalled();
    expect(adminApi.upsertProfile).not.toHaveBeenCalled();
  });

  test.each([
    [
      "additional user",
      [
        { email, id: userId },
        {
          email: "operator@example.test",
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        },
      ],
      null,
      /exactly zero or one/i,
    ],
    [
      "different email",
      [{ email: "different@example.test", id: userId }],
      null,
      /different Auth user/i,
    ],
    [
      "operator profile",
      [{ email, id: userId }],
      { email, full_name: fullName, id: userId, role: "operator" },
      /incompatible admin profile/i,
    ],
  ])("rejects %s without overwriting", async (_name, users, profile, error) => {
    const adminApi = createAdminApi({ profile, users });

    await expect(
      bootstrapRemoteAdmin({
        adminApi,
        confirmation: "otsxpchqtfypxgzjzrxs",
        credentials: { email, fullName, password },
        environment: "staging",
        execute: true,
        logger: vi.fn(),
        manifest: manifestFixture,
      }),
    ).rejects.toThrow(error);
    expect(adminApi.createUser).not.toHaveBeenCalled();
    expect(adminApi.upsertProfile).not.toHaveBeenCalled();
  });

  test("redacts provider failures", async () => {
    const token = "service-key-sentinel";
    const adminApi = createAdminApi();
    adminApi.createUser.mockRejectedValue(
      new Error(`${email} ${password} ${token}`),
    );

    let message = "";
    try {
      await bootstrapRemoteAdmin({
        adminApi,
        confirmation: "otsxpchqtfypxgzjzrxs",
        credentials: { email, fullName, password },
        environment: "staging",
        execute: true,
        logger: vi.fn(),
        manifest: manifestFixture,
        sensitiveValues: [token],
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toBe("Unable to create the staging administrator.");
    expect(message).not.toContain(email);
    expect(message).not.toContain(password);
    expect(message).not.toContain(token);
  });

  test.each(["listUsers", "getProfile", "upsertProfile"] as const)(
    "sanitizes %s provider failures",
    async (method) => {
      const sentinel = `${email} ${password} service-key-sentinel`;
      const adminApi = createAdminApi();
      if (method === "getProfile") {
        adminApi.listUsers.mockResolvedValue([{ email, id: userId }]);
      }
      adminApi[method].mockRejectedValue(new Error(sentinel));

      let message = "";
      try {
        await bootstrapRemoteAdmin({
          adminApi,
          confirmation: "otsxpchqtfypxgzjzrxs",
          credentials: { email, fullName, password },
          environment: "staging",
          execute: true,
          logger: vi.fn(),
          manifest: manifestFixture,
          sensitiveValues: ["service-key-sentinel"],
        });
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).not.toContain(email);
      expect(message).not.toContain(password);
      expect(message).not.toContain("service-key-sentinel");
    },
  );
});

function createAdminApi({
  profile = null,
  users = [],
}: {
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
    getProfile: vi.fn(async () => currentProfile),
    listUsers: vi.fn(async () => currentUsers),
    upsertProfile: vi.fn(async (value) => {
      currentProfile = value;
      return value;
    }),
  };
}
